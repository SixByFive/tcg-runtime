import { DataTypes } from 'sequelize';
import { getSequelize } from '@sbf/database';
import defineUser from './User.js';
import defineSession from './Session.js';
import defineUserDiscordLink from './UserDiscordLink.js';

let initialized = false;
export let User;
export let Session;
export let UserDiscordLink;

// Columns that may be missing from an existing prod `users` table.
// We add them individually with try-catch instead of relying on
// `sync({ alter: true })` which has race-condition issues with unique indexes
// when multiple services start simultaneously against a shared DB.
const USER_COLUMNS_TO_ADD = [
  ['googleId',         { type: DataTypes.STRING,   allowNull: true }],
  ['chatBanned',       { type: DataTypes.BOOLEAN,  allowNull: false, defaultValue: false }],
  ['referrerId',       { type: DataTypes.UUID,     allowNull: true }],
  ['utmSource',        { type: DataTypes.STRING(128), allowNull: true }],
  ['utmMedium',        { type: DataTypes.STRING(128), allowNull: true }],
  ['utmCampaign',      { type: DataTypes.STRING(128), allowNull: true }],
  ['utmContent',       { type: DataTypes.STRING(128), allowNull: true }],
  ['dob',              { type: DataTypes.DATEONLY,  allowNull: true }],
  ['restrictionLevel', { type: DataTypes.TINYINT,  allowNull: false, defaultValue: 0 }],
  ['parentEmail',      { type: DataTypes.STRING,   allowNull: true }],
  ['parentApproved',   { type: DataTypes.BOOLEAN,  allowNull: false, defaultValue: false }],
];

async function ensureUserColumns(sequelize) {
  const qi = sequelize.getQueryInterface();
  for (const [name, def] of USER_COLUMNS_TO_ADD) {
    try {
      await qi.addColumn('users', name, def);
    } catch {
      // Column already exists — safe to ignore
    }
  }
}

export async function initModels() {
  if (initialized) return;
  const sequelize = getSequelize();
  User = defineUser(sequelize);
  Session = defineSession(sequelize);
  UserDiscordLink = defineUserDiscordLink(sequelize);

  // Create any tables that don't exist yet (no-op if they do)
  await User.sync({ force: false });
  await Session.sync({ force: false });
  await UserDiscordLink.sync({ force: false });

  // Safely add new columns to users without touching indexes
  await ensureUserColumns(sequelize);

  initialized = true;
}
