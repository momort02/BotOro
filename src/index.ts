import "dotenv/config";
import cron from "node-cron";
import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  type ChatInputCommandInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody
} from "discord.js";
import { generateDependencyReport } from "@discordjs/voice";
import { pingCommand } from "./commands/ping.js";
import { leaderboardCommand } from "./commands/leaderboard.js";
import { rankCommand } from "./commands/rank.js";
import { radioCommand } from "./commands/radio.js";
import { levelStore } from "./level-store.js";
import { getBlockedTermCount, hasBlockedTerm } from "./moderation.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const leaderboardChannelId = process.env.LEADERBOARD_CHANNEL_ID;
const leaderboardTimezone = process.env.LEADERBOARD_TIMEZONE ?? "Europe/Paris";

if (!token || !clientId) {
  throw new Error("DISCORD_TOKEN et DISCORD_CLIENT_ID sont requis");
}

const commands = [pingCommand, rankCommand, leaderboardCommand, radioCommand];
const commandMap = new Collection<string, (typeof commands)[number]>();
for (const command of commands) {
  commandMap.set(command.data.name, command);
}

const rest = new REST({ version: "10" }).setToken(token);
const commandPayload = commands.map((command) => command.data) as RESTPostAPIChatInputApplicationCommandsJSONBody[];

try {
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandPayload });
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body: commandPayload });
  }
} catch (error) {
  if (error && typeof error === "object" && "status" in error && error.status === 401) {
    throw new Error("Token Discord invalide ou revoque. Regenere-le dans Developer Portal > Bot > Reset Token, puis mets-le dans .env.");
  }
  throw error;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Connecte en tant que ${readyClient.user.tag}`);
  console.log(guildId ? `Commandes synchronisees sur le serveur ${guildId}` : "Commandes globales synchronisees");
  console.log(`Filtre de moderation : ${getBlockedTermCount()} terme(s) configure(s)`);
  console.log(generateDependencyReport());

  if (!leaderboardChannelId) {
    console.log("Leaderboard quotidien desactive : LEADERBOARD_CHANNEL_ID est absent");
    return;
  }

  cron.schedule("0 12 * * *", async () => {
    try {
      const channel = await client.channels.fetch(leaderboardChannelId);
      if (!channel || !channel.isTextBased() || !("guildId" in channel) || typeof channel.guildId !== "string") {
        throw new Error("Le salon cible est introuvable ou n est pas un salon de serveur");
      }

      const leaderboard = await levelStore.getLeaderboard(channel.guildId, 10);
      const content = leaderboard.length === 0
        ? "**Classement XP quotidien**\nLe classement est encore vide."
        : `**Classement XP quotidien**\n${leaderboard.map(({ userId, entry }, index) =>
          `${index + 1}. <@${userId}> : niveau ${entry.level} (${entry.xp} XP)`
        ).join("\n")}`;

      await channel.send(content);
      console.log(`Leaderboard quotidien envoye dans ${leaderboardChannelId}`);
    } catch (error) {
      console.error("Erreur pendant l envoi du leaderboard quotidien", error);
    }
  }, { timezone: leaderboardTimezone, noOverlap: true });

  console.log(`Leaderboard quotidien programme a 12:00 (${leaderboardTimezone})`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = commandMap.get(interaction.commandName);
  if (!command) {
    return;
  }

  try {
    await command.execute(interaction as ChatInputCommandInteraction);
  } catch (error) {
    console.error(`Erreur pendant /${interaction.commandName}`, error);
    const message = "Une erreur est survenue pendant l execution de la commande.";
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: message, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guildId) {
    return;
  }

  try {
    if (hasBlockedTerm(message.content)) {
      await message.delete();
      const warning = await message.channel.send(
        `${message.author}, ton message a ete supprime car il contient un terme interdit.`
      );
      setTimeout(() => {
        void warning.delete().catch(() => undefined);
      }, 5_000);
      console.log(`Message modere de ${message.author.tag} sur ${message.guildId}`);
      return;
    }

    const result = await levelStore.addMessageXp(message.guildId, message.author.id);
    console.log(`XP: ${message.author.tag} -> ${result.level} sur ${message.guildId}`);
    if (result.leveledUp) {
      await message.channel.send(`${message.author} passe au niveau ${result.level} !`);
    }
  } catch (error) {
    console.error("Erreur pendant l enregistrement de l XP", error);
  }
});

await client.login(token);