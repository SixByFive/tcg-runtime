import { getSequelize } from '@sbf/database';
import defineUser from './User.js';
import defineProfile from './Profile.js';
import defineUserReputation from './UserReputation.js';
import defineDiscordLink from './DiscordLink.js';

export let User;
export let Profile;
export let UserReputation;
export let DiscordLink;

let initialized = false;

export async function initModels() {
  if (initialized) return;
  const sequelize = getSequelize();

  User           = defineUser(sequelize);
  Profile        = defineProfile(sequelize);
  UserReputation = defineUserReputation(sequelize);
  DiscordLink    = defineDiscordLink(sequelize);

  User.hasOne(Profile,        { foreignKey: 'userId', as: 'profile',     constraints: false });
  Profile.belongsTo(User,     { foreignKey: 'userId',                     constraints: false });
  User.hasOne(UserReputation, { foreignKey: 'userId', as: 'reputation',   constraints: false });
  User.hasOne(DiscordLink,    { foreignKey: 'userId', as: 'discordLink',  constraints: false });

  // force: false = create table if it doesn't exist, never alter or drop.
  // We don't use alter: true here because the profiles/reputations tables already
  // exist from prod and Sequelize would attempt to add FK constraints that fail
  // against orphaned rows. Schema changes should go through migrations.
  await Profile.sync({ force: false });
  await UserReputation.sync({ force: false });

  initialized = true;
}
