// src/modules/guilds/commands/subcommands/cards.js
// NEW: Multi-result card search with a pick-list.
//
// Why:
// - /sbf card is great when the query is very specific.
// - Real users often search "Charizard" and need a picker.
//
// UX:
// 1) User runs /sbf cards name:"charizard" set?:"..." number?:"..."
// 2) Bot returns a select menu (up to 10 results)
// 3) User selects the correct card
// 4) Bot shows a preview + buttons (post to channel + view on site)

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  StringSelectMenuBuilder,
} from "discord.js";

import { ENV } from "../../../../config/env.js";
import { lookupCardsMultiple } from "../../../cards/search.service.js";
import { buildCardEmbed, buildCardChannelMessage } from "../../../share/formatters.js";

export const name = "cards";
export const description = "Search cards and pick the right one from results.";

export function build(opt) {
  opt
    .addStringOption((o) =>
      o.setName("name").setDescription("Card name (e.g., 'Charizard')").setRequired(true)
    )
    .addStringOption((o) => o.setName("set").setDescription("Set code or name (optional)"))
    .addStringOption((o) => o.setName("number").setDescription("Card number (optional)"));
}

function safeLabel(card) {
  const parts = [];
  if (card?.cardName) parts.push(card.cardName);
  if (card?.number) parts.push(`#${card.number}`);
  return parts.join(" ") || "Unknown card";
}

function buildViewUrl(card) {
  if (!ENV.WEB_APP_URL) return null;
  const base = ENV.WEB_APP_URL.replace(/\/+$/, "");
  if (card?.id) return `${base}/card/${encodeURIComponent(String(card.id))}`;
  const n = encodeURIComponent(String(card?.cardName || ""));
  const s = encodeURIComponent(String(card?.setCode || card?.setName || ""));
  const num = encodeURIComponent(String(card?.number || ""));
  const qs = [`name=${n}`, s ? `set=${s}` : "", num ? `number=${num}` : ""].filter(Boolean).join("&");
  return `${base}/card?${qs}`;
}

function buildPreviewComponents(interactionId, card) {
  const base = `cards:${interactionId}`;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${base}:post`)
      .setLabel("Post to channel")
      .setStyle(ButtonStyle.Primary)
  );

  const url = buildViewUrl(card);
  if (url) {
    row.addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("View on SixByFive").setURL(url)
    );
  }

  return { base, row };
}

export async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const queryName = interaction.options.getString("name", true);
  const querySet = interaction.options.getString("set") || undefined;
  const queryNumber = interaction.options.getString("number") || undefined;

  if (!ENV.BACKEND_GRAPHQL_URL && !ENV.BACKEND_REST_URL) {
    await interaction.editReply(
      "Backend not configured. Set `BACKEND_GRAPHQL_URL` (preferred) or `BACKEND_REST_URL` in the bot’s environment."
    );
    return;
  }

  const results = await lookupCardsMultiple({
    name: queryName,
    set: querySet,
    number: queryNumber,
    limit: 10,
  });

  if (!results.length) {
    await interaction.editReply(
      `I couldn't find anything matching **${queryName}**${querySet ? ` in **${querySet}**` : ""}${
        queryNumber ? ` (#${queryNumber})` : ""
      }.`
    );
    return;
  }

  // If it's effectively a single match, behave like /sbf card but with the same UI.
  if (results.length === 1) {
    const card = results[0];

    const preview = buildCardEmbed({
      cardName: card.cardName,
      setName: card.setName,
      number: card.number,
      rarity: card.rarity,
      priceGBP: card.priceGBP ?? undefined,
      imageUrl: card.imageUrl,
      context: { caption: card.setCode ? `Set: ${card.setCode}` : undefined },
    });

    const { base, row } = buildPreviewComponents(interaction.id, card);

    const msg = await interaction.editReply({
      content: "Here you go:",
      embeds: [preview],
      components: [row],
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on("collect", async (btn) => {
      if (btn.customId !== `${base}:post`) return;
      await btn.deferUpdate();

      const userMention = interaction.user?.toString?.() || `<@${interaction.user?.id}>`;
      const cardLabel = safeLabel(card);
      const setLabel = card.setName || card.setCode || "Unknown set";
      const contentLine = `${userMention} Shared ${cardLabel} from ${setLabel}`;

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
        contentLine,
      });

      await interaction.channel?.send({
        ...channelMessage,
        allowedMentions: { users: [interaction.user.id], roles: [], parse: [] },
      });

      await interaction.followUp({ content: "Posted to channel ✅", flags: MessageFlags.Ephemeral });
    });

    collector.on("end", async () => {
      try {
        const current = await interaction.fetchReply();
        await interaction.editReply({ content: current.content, embeds: current.embeds, components: [] });
      } catch {}
    });

    return;
  }

  // Multi-match picker.
  // Store cards in-memory for this interaction.
  // (For your use-case this is fine; if you later want scale, persist the results by interaction id.)
  const key = interaction.id;
  const state = { cards: results };
  interaction.client.__sbfCardsState = interaction.client.__sbfCardsState || new Map();
  interaction.client.__sbfCardsState.set(key, state);
  setTimeout(() => {
    try { interaction.client.__sbfCardsState?.delete(key); } catch {}
  }, 2 * 60_000);

  const options = results.slice(0, 10).map((c, idx) => ({
    label: safeLabel(c).slice(0, 100),
    description: (c.setName || c.setCode || "Unknown set").slice(0, 100),
    value: String(idx),
  }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`cards:${interaction.id}:pick`)
    .setPlaceholder("Pick a card")
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(menu);

  const msg = await interaction.editReply({
    content: `I found **${results.length}** results for **${queryName}**. Pick one:`,
    components: [row],
  });

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 60_000,
    filter: (i) => i.user.id === interaction.user.id,
  });

  collector.on("collect", async (sel) => {
    try {
      await sel.deferUpdate();
      const idx = Number(sel.values?.[0] || "-1");
      const st = interaction.client.__sbfCardsState?.get(interaction.id);
      const card = st?.cards?.[idx];

      if (!card) {
        await interaction.followUp({ content: "That selection expired. Please run /sbf cards again.", flags: MessageFlags.Ephemeral });
        return;
      }

      const preview = buildCardEmbed({
        cardName: card.cardName,
        setName: card.setName,
        number: card.number,
        rarity: card.rarity,
        priceGBP: card.priceGBP ?? undefined,
        imageUrl: card.imageUrl,
        context: { caption: card.setCode ? `Set: ${card.setCode}` : undefined },
      });

      const { base, row: previewRow } = buildPreviewComponents(interaction.id, card);

      // Replace select menu with preview+buttons
      await interaction.editReply({
        content: "Here you go:",
        embeds: [preview],
        components: [previewRow],
      });

      // Now handle the post button.
      const btnCollector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60_000,
        filter: (i) => i.user.id === interaction.user.id,
      });

      btnCollector.on("collect", async (btn) => {
        if (btn.customId !== `${base}:post`) return;
        await btn.deferUpdate();

        const userMention = interaction.user?.toString?.() || `<@${interaction.user?.id}>`;
        const cardLabel = safeLabel(card);
        const setLabel = card.setName || card.setCode || "Unknown set";
        const contentLine = `${userMention} Shared ${cardLabel} from ${setLabel}`;

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
          contentLine,
        });

        await interaction.channel?.send({
          ...channelMessage,
          allowedMentions: { users: [interaction.user.id], roles: [], parse: [] },
        });

        await interaction.followUp({ content: "Posted to channel ✅", flags: MessageFlags.Ephemeral });
      });

      btnCollector.on("end", async () => {
        try {
          const current = await interaction.fetchReply();
          await interaction.editReply({ content: current.content, embeds: current.embeds, components: [] });
        } catch {}
      });

      collector.stop("picked");
    } catch (e) {
      console.error("[/sbf cards] picker error:", e);
    }
  });

  collector.on("end", async () => {
    try {
      // Clear the menu to prevent late interactions
      const current = await interaction.fetchReply();
      await interaction.editReply({
        content: current.content,
        embeds: current.embeds,
        components: [],
      });
    } catch {}
  });
}
