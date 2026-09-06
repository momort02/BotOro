import { MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { registerStationClick, searchStations } from "../radio-browser.js";
import { playStation, stopSession } from "../voice-manager.js";

export const radioCommand = {
  data: {
    name: "radio",
    description: "Ecoute une radio en direct dans un salon vocal",
    dm_permission: false,
    options: [
      {
        type: 1,
        name: "play",
        description: "Recherche une station radio et la joue dans ton salon vocal",
        options: [
          {
            type: 3,
            name: "station",
            description: "Nom de la station a rechercher (ex : Nova, FIP, NRJ)",
            required: true
          }
        ]
      },
      {
        type: 1,
        name: "stop",
        description: "Arrete la radio et fait quitter le bot du salon vocal"
      }
    ]
  },
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild() || !interaction.guild || !interaction.guildId) {
      await interaction.reply({ content: "Cette commande doit etre utilisee sur un serveur.", flags: MessageFlags.Ephemeral });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "stop") {
      const stopped = stopSession(interaction.guildId);
      await interaction.reply(stopped ? "Radio arretee, a bientot !" : "Aucune radio n est en cours de lecture ici.");
      return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      await interaction.reply({ content: "Rejoins un salon vocal avant d utiliser cette commande.", flags: MessageFlags.Ephemeral });
      return;
    }

    const query = interaction.options.getString("station", true);
    await interaction.deferReply();

    try {
      const stations = await searchStations(query, 5);
      const station = stations[0];
      if (!station) {
        await interaction.editReply(`Aucune station trouvee pour "${query}".`);
        return;
      }

      await playStation(voiceChannel, station.url, station.name);
      registerStationClick(station.uuid);

      const details = [station.codec, station.bitrate ? `${station.bitrate} kbps` : null, station.countryCode]
        .filter(Boolean)
        .join(" \u00b7 ");
      await interaction.editReply(
        `\u25b6\ufe0f Lecture de **${station.name}**${details ? ` (${details})` : ""} dans ${voiceChannel}.`
      );
    } catch (error) {
      console.error("Erreur pendant la lecture radio", error);
      await interaction.editReply("Impossible de lancer cette radio pour le moment. Reessaie avec un autre nom.");
    }
  }
};