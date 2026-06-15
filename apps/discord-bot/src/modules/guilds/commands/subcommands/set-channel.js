// /sbf set-channel #channel  → sets default posting channel
// CHANGED: removed .setDefaultMemberPermissions(...) (invalid on subcommand),
// keep runtime permission check instead.

import { PermissionFlagsBits, ChannelType } from "discord.js";
import { upsertGuildConfig } from "../../config.service.js";

export const name = "set-channel";
export const description = "Set the default channel for SBF posts.";

// Subcommand options only; no default perms here (Discord only supports that at top-level)
export function build(opt) {
  opt
    .addChannelOption(o =>
      o.setName("channel")
        .setDescription("Channel where SBF posts will go by default")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    );
}

export async function execute(interaction) {
  // Runtime permission guard (instead of defaultMemberPermissions on builder)
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content: "You need **Manage Server** to do this.",
      ephemeral: true
    });
  }

  const channel = interaction.options.getChannel("channel", true);
  await upsertGuildConfig(interaction.guild, { default_channel_id: channel.id });

  return interaction.reply({
    content: `Default channel set to <#${channel.id}> ✅`,
    ephemeral: true
  });
}
