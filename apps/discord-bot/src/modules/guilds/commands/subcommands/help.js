// src/modules/guilds/commands/subcommands/help.js
// NEW: Quick "what can this bot do" command.
// - Gives users a fast way to discover the useful tools.
// - Keeps everything ephemeral so channels don't get spammed.

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from "discord.js";
import { ENV } from "../../../../config/env.js";

export const name = "help";
export const description = "Show what the SixByFive bot can do.";

export async function execute(interaction) {
  const eb = new EmbedBuilder()
    .setTitle("SixByFive • Bot Help")
    .setDescription(
      [
        "Here are the current tools you can use:",
        "",
        "• `/sbf card` — find a single card and optionally post it to the channel",
        "• `/sbf cards` — search cards and pick the right one from a list",
        "• `/sbf settings` — show this server’s bot configuration",
        "• `/sbf set-channel` — choose the default channel for posts",
        "• `/sbf allow-external` — allow/deny inbound posts from the SBF backend",
        "• `/sbf status` — check bot + backend configuration",
      ].join("\n")
    )
    .setColor(parseInt((ENV.BRAND_COLOR || "#2963FF").replace("#", ""), 16))
    .setFooter({ text: "Tip: Use /sbf cards when your search is ambiguous." });

  const rows = [];

  if (ENV.WEB_APP_URL) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel("Open SixByFive")
          .setURL(ENV.WEB_APP_URL)
      )
    );
  }

  await interaction.reply({
    embeds: [eb],
    components: rows,
    flags: MessageFlags.Ephemeral,
  });
}
