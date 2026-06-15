// NEW: loads env and asserts required secrets
import "dotenv/config";

function must(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`[ENV] Missing required variable: ${name}`);
  }
  return v;
}

function may(name, fallback = "") {
  const v = process.env[name];
  return (v == null ? fallback : String(v)); 
}

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  PORT: Number(process.env.PORT || 4001),

  // Discord
  DISCORD_CLIENT_ID: must("DISCORD_CLIENT_ID"),     // CHANGED: fails fast if missing
  DISCORD_CLIENT_SECRET: must("DISCORD_CLIENT_SECRET"),
  DISCORD_PUBLIC_KEY: must("DISCORD_PUBLIC_KEY"),
  DISCORD_BOT_TOKEN: must("DISCORD_BOT_TOKEN"),
  DISCORD_REDIRECT_URI: must("DISCORD_REDIRECT_URI"),
  DISCORD_REQUIRED_PERMS: process.env.DISCORD_REQUIRED_PERMS || "",

  // Optional DB (safe to leave unset for first run)
  DB_HOST: process.env.DB_HOST || "",
  DB_PORT: Number(process.env.DB_PORT || 3306),
  DB_NAME: process.env.DB_NAME || "",
  DB_USER: process.env.DB_USER || "",
  DB_PASS: process.env.DB_PASS || "", 

  BACKEND_GRAPHQL_URL: may("BACKEND_GRAPHQL_URL"), // e.g., http://localhost:4000/graphql (or host root; we’ll append /graphql)
  BACKEND_REST_URL: may("BACKEND_REST_URL"),       // e.g., http://localhost:4000

  // SBF web/app branding + inbound API auth
  // - WEB_APP_URL is used for deep links in embeds/buttons
  // - BRAND_* controls how rich embeds look in Discord
  // - SBF_API_KEY is required for the inbound POST /api/share-card route
  WEB_APP_URL: may("WEB_APP_URL") || may("APP_BASE_URL"),
  BRAND_NAME: may("BRAND_NAME", "SixByFive TCG"),
  BRAND_COLOR: may("BRAND_COLOR", "#2963FF"),
  BRAND_ICON_URL: may("BRAND_ICON_URL"),
  SBF_API_KEY: may("SBF_API_KEY"),

  // Optional: role to grant when a user is linked (used by future /sbf link flow)
  DISCORD_LINK_ROLE_ID: may("DISCORD_LINK_ROLE_ID"),

  DEBUG_BOT: may("DEBUG_BOT").toLowerCase() === "true" || may("DEBUG_BOT") === "1",
};
