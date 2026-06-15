// /sbf settings  → shows current config and a quick perm check
import { EmbedBuilder, ChannelType } from "discord.js";
import { getGuildConfig, checkChannelPerms } from "../../config.service.js";

export const name = "settings";
export const description = "Show current SBF bot settings for this server.";

export async function execute(interaction) {
  if (!interaction.guild) {
    return interaction.reply({ content: "Use this in a server.", ephemeral: true });
  }

  const cfg = await getGuildConfig(interaction.guild.id);
  const chanId = cfg?.default_channel_id;
  let chan = chanId ? interaction.guild.channels.cache.get(chanId) : null;

  const permCheck = chan
    ? await checkChannelPerms(chan, interaction.client.user.id)
    : null;

  const eb = new EmbedBuilder()
    .setTitle("SixByFive • Settings")
    .addFields(
      { name: "Guild", value: `${interaction.guild.name} (${interaction.guild.id})` },
      { name: "Default Channel", value: chan ? `<#${chan.id}>` : "_not set_" },
      { name: "Allow External Posts", value: cfg?.allow_external_posts ? "ON" : "OFF" }
    )
    .setFooter({ text: "Use /sbf set-channel and /sbf allow-external to change settings." });

  if (permCheck) {
    eb.addFields({
      name: "Channel Permissions",
      value: permCheck.ok
        ? "✅ OK"
        : `❌ Missing: ${permCheck.missing.join(", ")}`
    });
  }

  return interaction.reply({ embeds: [eb], ephemeral: true });
}
