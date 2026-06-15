// src/commands/test-post.js
// CHANGED: Use TCGdex assets for card images (and optional set logo) with lang/era/set options.

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

export const name = "test-post";
export const description =
  "Post a sample SBF embed with a TCGdex image & details to verify permissions.";

// NEW: expose tcgdex-specific options; keep general fields too
export function build(opt) {
  opt
    .addStringOption(o =>
      o.setName("card_name").setDescription("Card name").setRequired(false)
    )
    .addStringOption(o =>
      o.setName("set_name").setDescription("Set name").setRequired(false)
    )

    // ── TCGdex targeting ───────────────────────────────────────────────────────
    .addStringOption(o =>
      o.setName("lang")
        .setDescription("TCGdex language (e.g., en, fr, de)")
        .setRequired(false)
    )
    .addStringOption(o =>
      o.setName("era")
        .setDescription("TCGdex era (e.g., sv, swsh)")
        .setRequired(false)
    )
    .addStringOption(o =>
      o.setName("set_code")
        .setDescription("Set code (e.g., sv03.5 for SV151)")
        .setRequired(false)
    )
    .addStringOption(o =>
      o.setName("number")
        .setDescription("Card number (e.g., 151)")
        .setRequired(false)
    )
    .addStringOption(o =>
      o.setName("quality")
        .setDescription("Image quality on TCGdex: thumb | low | high")
        .setRequired(false)
    )
    // ──────────────────────────────────────────────────────────────────────────

    .addStringOption(o =>
      o.setName("rarity").setDescription("Rarity (e.g., Double Rare)").setRequired(false)
    )
    .addStringOption(o =>
      o.setName("variant").setDescription("Variant (e.g., Holo)").setRequired(false)
    )
    .addStringOption(o =>
      o.setName("market_gbp").setDescription("Market price in GBP (e.g., 12.34)").setRequired(false)
    )

    // CHANGED: attachment still supported; if provided, it overrides URL rendering
    .addAttachmentOption(o =>
      o.setName("image_file").setDescription("Attach a card image (overrides URL)").setRequired(false)
    )

    // CHANGED: we can also show a set logo from TCGdex if you pass one or we derive it
    .addStringOption(o =>
      o.setName("set_logo_url").setDescription("Override set logo URL (TCGdex)").setRequired(false)
    )
    .addStringOption(o =>
      o.setName("sbf_url").setDescription("Link to view on SixByFive").setRequired(false)
    );
}

// NEW: tiny helpers for TCGdex assets
function tcgdexCardImageUrl({ lang = "en", era = "sv", tcgdexSet = "sv03.5", number = "151", quality = "high" }) {
  // quality: thumb | low | high (TCGdex provides these sizes)
  const q = ["thumb", "low", "high"].includes(quality) ? quality : "high";
  // Example: https://assets.tcgdex.net/en/sv/sv03.5/151/high.webp
  return `https://assets.tcgdex.net/${encodeURIComponent(lang)}/${encodeURIComponent(era)}/${encodeURIComponent(tcgdexSet)}/${encodeURIComponent(number)}/${q}.webp`;
}

function tcgdexSetLogoUrl({ lang = "en", era = "sv", tcgdexSet = "sv03.5" }) {
  // Common logo path used by TCGdex sets:
  // Example: https://assets.tcgdex.net/en/sv/sv03.5/logo.png
  return `https://assets.tcgdex.net/${encodeURIComponent(lang)}/${encodeURIComponent(era)}/${encodeURIComponent(tcgdexSet)}/logo.png`;
}

// OPTIONAL: a tiny heuristic map to make the default demo nice without typing tcgdex_set
// You can extend this over time or rely on passing tcgdex_set explicitly.
const DEMO_SET_MAP = {
  // PTCG style -> TCGdex style
  sv3: "sv03.5", // Scarlet & Violet 151
};

export async function execute(interaction) {
  // General fields
  const cardName  = interaction.options.getString("card_name")  ?? "Mew ex";
  const setName   = interaction.options.getString("set_name")   ?? "Scarlet & Violet 151";
  const rarity    = interaction.options.getString("rarity")     ?? "Double Rare";
  const variant   = interaction.options.getString("variant")    ?? "Holo";
  const marketGbp = interaction.options.getString("market_gbp") ?? "12.34";

  // TCGdex targeting
  const lang      = (interaction.options.getString("lang")      ?? "en").toLowerCase();
  const era       = (interaction.options.getString("era")       ?? "sv").toLowerCase();
  const number    = interaction.options.getString("number")     ?? "151";
  const quality   = interaction.options.getString("quality")    ?? "high";

  // If the caller provides tcgdex_set, we use it. Otherwise, try a friendly demo mapping.
  // If you also pass a PTCG-ish code as "set_code" from previous iterations, we’ll read it too.
  const maybePtCode = interaction.options.getString("set_code"); // legacy option from older command
  const mappedDemo  = maybePtCode ? (DEMO_SET_MAP[maybePtCode.toLowerCase()] ?? maybePtCode) : undefined;

  const tcgdexSet =
    interaction.options.getString("tcgdex_set")    // explicit wins
    ?? mappedDemo                                  // mapped (sv3 -> sv03.5) or passthrough legacy
    ?? "sv03.5";                                   // sensible default for the demo

  // Links
  const sbfUrl = interaction.options.getString("sbf_url")
    ?? `https://tcg.sixbyfive.com/card/${encodeURIComponent(tcgdexSet)}/${encodeURIComponent(number)}`;

  const title = `${cardName} · ${tcgdexSet.toUpperCase()}-${number} · ${variant}`;

  const embed = new EmbedBuilder()
    .setColor(0x2963ff)
    .setAuthor({ name: "SixByFive TCG • Test" })
    .setTitle(title)
    .setURL(sbfUrl)
    .setDescription("Test post from **SixByFive TCG Bot** to verify channel permissions and formatting.")
    .addFields(
      { name: "Set", value: setName, inline: true },
      { name: "Number", value: number, inline: true },
      { name: "Rarity", value: rarity, inline: true },
      { name: "Variant", value: variant, inline: true },
      { name: "Market (GBP)", value: `£${marketGbp}`, inline: true },
      { name: "Set", value: tcgdexSet.toUpperCase(), inline: true },
    )
    .setFooter({ text: "SBF • Test Embed" })
    .setTimestamp(new Date());

  // CHANGED: Prefer TCGdex image; attachment overrides if supplied
  const imageAttachment = interaction.options.getAttachment("image_file");
  let files;
  if (imageAttachment) {
    embed.setImage(`attachment://${imageAttachment.name}`); // attachment always renders
    files = [imageAttachment];
  } else {
    const imgUrl = tcgdexCardImageUrl({ lang, era, tcgdexSet, number, quality });
    embed.setImage(imgUrl); // TCGdex direct image
  }

  // NEW: Set logo from TCGdex (optional override)
  const setLogoOverride = interaction.options.getString("set_logo_url");
  const setLogo = setLogoOverride || tcgdexSetLogoUrl({ lang, era, tcgdexSet });
  embed.setThumbnail(setLogo);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel("View on SixByFive").setStyle(ButtonStyle.Link).setURL(sbfUrl),
    new ButtonBuilder()
      .setLabel("Search this Set")
      .setStyle(ButtonStyle.Link)
      .setURL(`https://tcg.sixbyfive.com/search?set=${encodeURIComponent(tcgdexSet)}`)
  );

  await interaction.reply({ content: "✅ Posting test embed with TCGdex image…", ephemeral: true });
  await interaction.channel.send({ embeds: [embed], components: [row], files }); // CHANGED: include files if any
}
