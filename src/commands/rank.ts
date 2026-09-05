import { MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { levelStore } from "../level-store.js";

export const rankCommand = {
  data: {
    name: "rank",
    description: "Affiche ton niveau et ton XP",
    dm_permission: false
  },
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "Cette commande doit etre utilisee sur un serveur.", flags: MessageFlags.Ephemeral });
      return;
    }

    const entry = await levelStore.getMember(interaction.guildId, interaction.user.id);
    const nextLevelXp = 100 * (entry.level + 1) ** 2;
    await interaction.reply(
      `${interaction.user}, tu es niveau ${entry.level} avec ${entry.xp} XP. Prochain niveau : ${nextLevelXp} XP.`
    );
  }
};
