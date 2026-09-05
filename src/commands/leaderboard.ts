import { MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { levelStore } from "../level-store.js";

export const leaderboardCommand = {
  data: {
    name: "leaderboard",
    description: "Affiche le classement XP du serveur",
    dm_permission: false
  },
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "Cette commande doit etre utilisee sur un serveur.", flags: MessageFlags.Ephemeral });
      return;
    }

    const leaderboard = await levelStore.getLeaderboard(interaction.guildId, 10);
    if (leaderboard.length === 0) {
      await interaction.reply("Le classement est encore vide.");
      return;
    }

    const lines = leaderboard.map(({ userId, entry }, index) =>
      `${index + 1}. <@${userId}> : niveau ${entry.level} (${entry.xp} XP)`
    );
    await interaction.reply(`**Classement XP**\n${lines.join("\n")}`);
  }
};
