import type { ChatInputCommandInteraction } from "discord.js";

export const pingCommand = {
  data: {
    name: "ping",
    description: "Verifie que le bot repond",
    dm_permission: false
  },
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply(`Pong ! Latence : ${interaction.client.ws.ping} ms`);
  }
};
