// src/modules/share/formatters.js
// RESTORED + UPDATED (2026-01-24):
// - RESTORED: buildCardEmbed() (compact, empty-safe preview embed)
// - RESTORED: buildCardChannelMessage() (public channel post styled like test-post)
// - NEW: buildCardChannelMessage() now accepts `viewUrl` to force the button deep-link
// - KEEP: makeDeepLink() fallback when viewUrl not supplied
// - KEEP: utils clean/pushField/hexToInt

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

/* ---------------- utils ---------------- */

function clean(v) {
  if (v == null) return undefined;
  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : undefined;
  }
  return v;
}

function pushField(fields, name, value, inline = true) {
  const v = clean(value);
  if (v === undefined) return;
  fields.push({ name, value: String(v), inline });
}

function hexToInt(hex) {
  try {
    const h = String(hex || "").startsWith("#") ? String(hex).slice(1) : String(hex || "");
    const out = parseInt(h, 16);
    return Number.isFinite(out) ? out : 0x2963ff;
  } catch {
    return 0x2963ff;
  }
}

/* ---------------- compact preview embed (ephemeral-safe) ---------------- */

export function buildCardEmbed({
  cardName,
  setName,
  number,
  rarity,
  priceGBP,
  imageUrl,
  context,
}) {
  const titleParts = [];
  const _cardName = clean(cardName);
  if (_cardName) titleParts.push(_cardName);
  const _number = clean(number);
  if (_number) titleParts.push(`#${_number}`);
  const title = titleParts.join(" ");

  const fields = [];
  pushField(fields, "Set", setName);
  pushField(fields, "Rarity", rarity);

  if (priceGBP !== null && priceGBP !== undefined && priceGBP !== "") {
    const asText =
      typeof priceGBP === "number" ? `£${priceGBP.toFixed(2)}` : String(priceGBP).trim();
    pushField(fields, "Price (GBP)", asText);
  }

  const caption = clean(context?.caption);
  const embed = new EmbedBuilder();

  if (title) embed.setTitle(title);
  if (caption) embed.setDescription(caption);

  if (fields.length) embed.addFields(fields);

  // Compact preview uses thumbnail (matches what you had before)
  if (clean(imageUrl)) embed.setThumbnail(imageUrl);

  return embed;
}

/* ---------------- public channel message (matches test-post) ---------------- */

export function buildCardChannelMessage({
  card,               // { cardName,setName,number,rarity,priceGBP,imageUrl,setCode,id }
  env = {},           // { WEB_APP_URL?, BRAND_COLOR?, BRAND_NAME?, BRAND_ICON_URL? }
  requestedBy,        // string OR { username } OR null
  iconURL,            // author icon (e.g., bot avatar)
  contentLine,        // optional content string above embed
  viewUrl,            // force the button URL (profile deep-link)
  shareType,          // ✅ NEW: "collection" | "wishlist" (optional)
}) {
  const c = card || {};

  const cardName = c.cardName ?? c.name;
  const setName = c.setName;
  const number = c.number;
  const rarity = c.rarity;
  const priceGBP = c.priceGBP;
  const imageUrl = c.imageUrl;
  const setCode = c.setCode;
  const id = c.id ?? c.cardId;

  const brandName = clean(env.BRAND_NAME) || "SixByFive TCG";
  const brandColor = hexToInt(clean(env.BRAND_COLOR) || "#2963FF");
  const brandIcon = clean(env.BRAND_ICON_URL);
  const webBase = clean(env.WEB_APP_URL);

  const titleParts = [];
  const _cardName = clean(cardName);
  if (_cardName) titleParts.push(_cardName);
  const _number = clean(number);
  if (_number) titleParts.push(`#${_number}`);
  const title = titleParts.join(" ");

  const requestedByName =
    typeof requestedBy === "string"
      ? requestedBy
      : clean(requestedBy?.username) || clean(requestedBy?.displayName);

  // ✅ NEW: never silently lose the “message line”
  const listLabel =
    shareType === "wishlist" ? "wishlist" : shareType === "collection" ? "collection" : "collection";

  const defaultContentLine = requestedByName
    ? `**${requestedByName}** shared a card from their **${listLabel}**.`
    : `A card was shared from a **${listLabel}**.`;

  const finalContent = clean(contentLine) || defaultContentLine;

  const fields = [];
  pushField(fields, "Set", setName || setCode);
  pushField(fields, "Number", number);
  pushField(fields, "Rarity", rarity);
  if (priceGBP !== null && priceGBP !== undefined && priceGBP !== "") {
    const asText =
      typeof priceGBP === "number" ? `£${priceGBP.toFixed(2)}` : String(priceGBP).trim();
    pushField(fields, "Market (GBP)", asText);
  }

  const embed = new EmbedBuilder()
    .setColor(brandColor)
    .setTimestamp(new Date());

  if (title) embed.setTitle(title);

  embed.setAuthor({
    name: brandName,
    iconURL: brandIcon || iconURL || undefined,
  });

  const img = clean(imageUrl);
  if (img) embed.setImage(img);

  if (fields.length) embed.addFields(fields);

  embed.setFooter({
    text: requestedByName ? `Requested by ${requestedByName}` : brandName,
    iconURL: brandIcon || undefined,
  });

  const forcedUrl = clean(viewUrl);
  const maybeUrl = forcedUrl || null;

  const components = [];
  if (maybeUrl) {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel("View on SixByFive")
          .setURL(maybeUrl)
      )
    );
  }

  return {
    content: finalContent, // ✅ always non-empty now
    embeds: [embed],
    components,
  };
}

function makeDeepLink({ webBase, id, setCode, setName, number, cardName }) {
  if (!webBase) return null;
  try {
    const base = webBase.replace(/\/+$/, "");

    // If you have a real single-card route, this is ideal:
    if (id) return `${base}/card/${encodeURIComponent(String(id))}`;

    // Fallback: query params
    const u = new URL("/card", base);
    if (cardName) u.searchParams.set("name", String(cardName));
    if (setCode || setName) u.searchParams.set("set", String(setCode || setName));
    if (number) u.searchParams.set("number", String(number));
    return u.toString();
  } catch {
    return null;
  }
}
