import { DiscordShareLog } from "./model.js";
import { buildCardEmbed } from "./formatters.js";
import { DiscordGuild } from "../guilds/model.js";

export async function postShare({ client, guildId, channelId, discordUserId, type, card, context }) {
  const log = await DiscordShareLog.create({
    guild_id: guildId,
    channel_id: channelId || "unknown",
    discord_user_id: discordUserId || null,
    type,
    card_id: card?.id || null,
    payload: { card, context },
    ok: false
  });

  try {
    // Load guild config
    const cfg = await DiscordGuild.findByPk(guildId);
    if (!cfg) throw new Error("Guild not configured.");
    const targetChannelId = channelId || cfg.default_channel_id;
    if (!targetChannelId) throw new Error("No default channel configured.");
    if (context?.source === "external" && !cfg.allow_external_posts) {
      throw new Error("External posts are disabled for this server.");
    }

    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(targetChannelId);
    if (!channel?.isTextBased()) throw new Error("Target channel is not text-based.");

    // Build embed and post
    const embed = buildCardEmbed({
      cardName: card?.name,
      setName: card?.setName,
      number: card?.number,
      rarity: card?.rarity,
      priceGBP: card?.priceGBP,
      imageUrl: card?.imageUrl,
      context: { type, caption: context?.caption }
    });

    await channel.send({ embeds: [embed] });

    await log.update({ ok: true });
    return { ok: true, channelId: channel.id };
  } catch (err) {
    await log.update({ ok: false, error: String(err?.message || err) });
    return { ok: false, error: String(err?.message || err) };
  }
}
