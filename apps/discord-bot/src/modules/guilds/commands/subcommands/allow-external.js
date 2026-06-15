// /sbf allow-external true|false  → allow posts from SBF site/app by linked users
// CHANGED: removed .setDefaultMemberPermissions(...) (invalid on subcommand),
// keep runtime permission check instead.

import { PermissionFlagsBits } from "discord.js";
import { upsertGuildConfig } from "../../config.service.js";

export const name = "allow-external";
export const description = "Allow posts from SixByFive (site/app) by linked users.";

export function build(opt) {
  opt.addBooleanOption(o =>
    o.setName("enabled")
      .setDescription("Enable external posts?")
      .setRequired(true)
  );
}

export async function execute(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content: "You need **Manage Server** to do this.",
      ephemeral: true
    });
  }

  const enabled = interaction.options.getBoolean("enabled", true);
  await upsertGuildConfig(interaction.guild, { allow_external_posts: !!enabled });

  return interaction.reply({
    content: `Allow external posts: **${enabled ? "ON" : "OFF"}** ✅`,
    ephemeral: true
  });
}
