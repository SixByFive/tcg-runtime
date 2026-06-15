// src/modules/guilds/commands/subcommands/status.js
// NEW: Lightweight health / configuration diagnostics.
//
// Why this matters:
// - When something "doesn't work" in Discord, 90% of the time it's env/config.
// - This gives you and admins a one-command view of what's missing.

import { EmbedBuilder, MessageFlags } from "discord.js";
import { ENV } from "../../../../config/env.js";

export const name = "status";
export const description = "Show bot + backend status (config + reachability).";

function boolLine(label, ok, extra = "") {
  return `${ok ? "✅" : "❌"} ${label}${extra ? ` — ${extra}` : ""}`;
}

async function checkUrlReachable(url) {
  if (!url) return { ok: false, note: "not set" };
  try {
    // We intentionally do a GET without assuming the endpoint's behavior.
    // - GraphQL endpoints may respond 400 to GET (still reachable)
    // - Reverse proxies may respond 200/30x
    const res = await fetch(url, { method: "GET" });
    return { ok: true, note: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, note: e?.message || String(e) };
  }
}

export async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const hasGraphQL = Boolean(ENV.BACKEND_GRAPHQL_URL);
  const hasRest = Boolean(ENV.BACKEND_REST_URL);
  const hasWeb = Boolean(ENV.WEB_APP_URL);
  const hasApiKey = Boolean(ENV.SBF_API_KEY);

  const gqlCheck = await checkUrlReachable(ENV.BACKEND_GRAPHQL_URL);
  const restCheck = await checkUrlReachable(ENV.BACKEND_REST_URL);
  const webCheck = await checkUrlReachable(ENV.WEB_APP_URL);

  const eb = new EmbedBuilder()
    .setTitle("SixByFive • Status")
    .setDescription(
      [
        "**Config**",
        boolLine("WEB_APP_URL", hasWeb, hasWeb ? ENV.WEB_APP_URL : "missing"),
        boolLine("BACKEND_GRAPHQL_URL", hasGraphQL, hasGraphQL ? ENV.BACKEND_GRAPHQL_URL : "missing"),
        boolLine("BACKEND_REST_URL", hasRest, hasRest ? ENV.BACKEND_REST_URL : "missing"),
        boolLine("SBF_API_KEY (for /api/share-card)", hasApiKey, hasApiKey ? "set" : "missing"),
        "",
        "**Reachability**",
        boolLine("WEB", webCheck.ok, webCheck.note),
        boolLine("GraphQL", gqlCheck.ok, gqlCheck.note),
        boolLine("REST", restCheck.ok, restCheck.note),
      ].join("\n")
    )
    .setColor(parseInt((ENV.BRAND_COLOR || "#2963FF").replace("#", ""), 16))
    .setFooter({ text: "If GraphQL/REST are missing, /sbf card(s) won't be able to search." });

  await interaction.editReply({ embeds: [eb] });
}
