// src/modules/guilds/commands/subcommands/card.js
//
// UPDATED (2026-01-22):
// - FIX: lookupSingleCard() expects { query }, but this command was passing { name, set, number }.
//        That meant `query` was undefined -> search.service returned null instantly -> no GraphQL call -> no logs.
// - CHANGE: Build a single query string from the structured options:
//        name + (optional) "in <set>" + (optional) "(#<number>)"
//        This matches the parsing logic in search.service.js (extractSetAndNumber).
// - FIX: Normalize returned GraphQL card shape (name/set/images) into the fields your embed helpers expect
//        (cardName/setName/imageUrl etc). Without this, you'd "find" cards but render blank embeds.
// - KEEP: "Post to channel" sends ONE message with mention line + full embed + "View on SixByFive" link.
// - KEEP: Safe allowedMentions.

import {
  SlashCommandSubcommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";

import { lookupSingleCard } from "../../../cards/search.service.js";
import { buildCardEmbed, buildCardChannelMessage } from "../../../share/formatters.js";
import { ENV } from "../../../../config/env.js";

export const name = "card";
export const description = "Search a single card by name (optional set/number).";

export function build(opt) {
  opt
    .addStringOption((o) =>
      o.setName("name").setDescription("Card name (e.g., 'Charizard')").setRequired(true)
    )
    .addStringOption((o) => o.setName("set").setDescription("Set code or name (optional)"))
    .addStringOption((o) => o.setName("number").setDescription("Card number (optional)"));
}

/**
 * Normalize whatever the cardsearch GraphQL returns into the shape your
 * existing embed formatters expect.
 *
 * Your cardsearch query returns (roughly):
 *   card.name
 *   card.set?.name / card.set?.code  (and/or card.setCode)
 *   card.images?.small / card.images?.large
 *
 * Your embed helpers are currently expecting:
 *   card.cardName
 *   card.setName
 *   card.imageUrl
 */
function normalizeCardForEmbeds(card) {
  if (!card) return null;

  const setName = card?.set?.name ?? card?.setName ?? null;
  const setCode = card?.set?.code ?? card?.setCode ?? null;

  const imageUrl =
    card?.images?.large ||
    card?.images?.small ||
    card?.imageUrl ||
    null;

  return {
    // IDs
    id: card?.id ?? null,
    cardId: card?.cardId ?? null,

    // Core
    cardName: card?.name ?? card?.cardName ?? null,
    setName,
    setCode,
    number: card?.number ?? null,
    rarity: card?.rarity ?? null,

    // Media
    imageUrl,

    // Optional (if you later hydrate pricing)
    priceGBP: card?.priceGBP ?? null,

    // Keep the raw object available if your formatters rely on extra fields
    _raw: card,
  };
}

export async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const name = interaction.options.getString("name", true);
  const set = interaction.options.getString("set") || undefined;
  const number = interaction.options.getString("number") || undefined;

  if (!ENV.BACKEND_GRAPHQL_URL && !ENV.BACKEND_REST_URL) {
    await interaction.editReply(
      "Backend not configured. Set `BACKEND_GRAPHQL_URL` (preferred) or `BACKEND_REST_URL` in the bot’s environment."
    );
    return;
  }

  try {
    // CHANGED:
    // - Build a single query string because lookupSingleCard() expects { query }.
    // - This aligns with the parsing logic in search.service.js:
    //     "name in <set> (#<number>)"
    const queryParts = [String(name || "").trim()];
    if (set) queryParts.push(`in ${String(set).trim()}`);
    if (number) queryParts.push(`(#${String(number).trim().replace(/^#/, "")})`);
    const query = queryParts.filter(Boolean).join(" ").trim();

    // FIX:
    // - Call lookupSingleCard with { query }.
    const found = await lookupSingleCard({ query });

    if (!found) {
      await interaction.editReply(
        `I couldn't find a card matching **${name}**${set ? ` in **${set}**` : ""}${
          number ? ` (#${number})` : ""
        }.`
      );
      return;
    }

    // CHANGED:
    // - Normalize to the fields expected by buildCardEmbed/buildCardChannelMessage usage in this file.
    const card = normalizeCardForEmbeds(found);

    // Ephemeral preview (compact)
    const caption = card.setCode ? `Set: ${card.setCode}` : undefined;

    const preview = buildCardEmbed({
      cardName: card.cardName,
      setName: card.setName,
      number: card.number,
      rarity: card.rarity,
      priceGBP: card.priceGBP ?? undefined,
      imageUrl: card.imageUrl,
      context: { caption },
    });

    const base = `card:${interaction.id}`;

    // UI: include a view link in the ephemeral preview too (useful on mobile)
    const components = [];
    const row = new ActionRowBuilder();

    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${base}:post`)
        .setLabel("Post to channel")
        .setStyle(ButtonStyle.Primary)
    );

    // Optional: deep link button (only if WEB_APP_URL configured)
    if (ENV.WEB_APP_URL) {
      // Prefer direct /card/:id when available; otherwise fall back to query form.
      // NOTE: Your site route might be /card/<id> or /cards/<id>; adjust if needed.
      const url = card?.id
        ? `${ENV.WEB_APP_URL.replace(/\/+$/, "")}/card/${encodeURIComponent(String(card.id))}`
        : `${ENV.WEB_APP_URL.replace(/\/+$/, "")}/card?name=${encodeURIComponent(
            String(card.cardName || "")
          )}`;

      row.addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel("View on SixByFive")
          .setURL(url)
      );
    }

    components.push(row);

    const msg = await interaction.editReply({
      content: "Here you go:",
      embeds: [preview],
      components,
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on("collect", async (btn) => {
      try {
        if (btn.customId === `${base}:post`) {
          await btn.deferUpdate();

          // Build mention line
          const userMention = interaction.user?.toString?.() || `<@${interaction.user?.id}>`;
          const cardLabel = [card.cardName || "Unknown Card", card.number ? `#${card.number}` : null]
            .filter(Boolean)
            .join(" ");
          const setLabel = card.setName || card.setCode || "Unknown set";
          const contentLine = `${userMention} Shared ${cardLabel} from ${setLabel}`;

          // Build full, test-post–style embed message
          // IMPORTANT:
          // - buildCardChannelMessage likely expects the same "card" shape used elsewhere in the bot.
          // - We pass our normalized shape (cardName/setName/imageUrl), which matches this file's embed usage.
          // - If buildCardChannelMessage expects raw fields (name/images/set), you can pass card._raw instead.
          const channelMessage = buildCardChannelMessage({
            card,
            env: {
              WEB_APP_URL: ENV.WEB_APP_URL,
              BRAND_COLOR: ENV.BRAND_COLOR,
              BRAND_NAME: ENV.BRAND_NAME,
              BRAND_ICON_URL: ENV.BRAND_ICON_URL,
            },
            requestedBy: interaction.user?.username,
            iconURL: interaction.client?.user?.displayAvatarURL?.() || undefined,
            contentLine, // include the mention line in the same message
          });

          await interaction.channel?.send({
            ...channelMessage,
            allowedMentions: { users: [interaction.user.id], roles: [], parse: [] },
          });

          await interaction.followUp({ content: "Posted to channel ✅", flags: MessageFlags.Ephemeral });
        }
      } catch (e) {
        console.error("[/sbf card] button error:", e);
      }
    });

    collector.on("end", async () => {
      try {
        const current = await interaction.fetchReply();
        await interaction.editReply({
          content: current.content,
          embeds: current.embeds,
          components: [],
        });
      } catch {}
    });
  } catch (err) {
    console.error("[/sbf card] error", err);
    await interaction.editReply(
      "Sorry — something went wrong while searching. Check the bot logs for GraphQL/REST details."
    );
  }
}
