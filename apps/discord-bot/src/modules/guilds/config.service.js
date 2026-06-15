// Reads/writes guild config and does basic channel/perm checks

import { PermissionsBitField } from "discord.js";
import { DiscordGuild } from "./model.js";

export async function getGuildConfig(guildId) {
  return DiscordGuild.findByPk(guildId);
}

export async function upsertGuildConfig(guild, patch = {}) {
  const existing = await DiscordGuild.findByPk(guild.id);
  const payload = {
    guild_id: guild.id,
    guild_name: guild.name,
    ...patch
  };
  if (!existing) return DiscordGuild.create(payload);
  return existing.update(payload);
}

export async function checkChannelPerms(channel, clientUserId) {
  const perms = channel.permissionsFor(clientUserId);
  if (!perms) return { ok: false, missing: ["View Channel"] };

  const needed = [
    "ViewChannel",
    "SendMessages",
    "EmbedLinks"
  ];
  const missing = needed.filter((p) => !perms.has(PermissionsBitField.Flags[p]));
  return { ok: missing.length === 0, missing };
}
