import { getSequelize } from '@sbf/database';
import defineUser from './User.js';
import defineProfile from './Profile.js';
import defineUserReputation from './UserReputation.js';
import defineDiscordLink from './DiscordLink.js';
import defineReward from './Reward.js';
import defineAuditLog from './AuditLog.js';

export let User;
export let Profile;
export let UserReputation;
export let DiscordLink;
export let Reward;
export let AuditLog;

let initialized = false;

export async function initModels() {
  if (initialized) return;
  const sequelize = getSequelize();

  User           = defineUser(sequelize);
  Profile        = defineProfile(sequelize);
  UserReputation = defineUserReputation(sequelize);
  DiscordLink    = defineDiscordLink(sequelize);
  Reward         = defineReward(sequelize);
  AuditLog       = defineAuditLog(sequelize);

  User.hasOne(Profile,        { foreignKey: 'userId', as: 'profile',     constraints: false });
  Profile.belongsTo(User,     { foreignKey: 'userId',                     constraints: false });
  User.hasOne(UserReputation, { foreignKey: 'userId', as: 'reputation',   constraints: false });
  User.hasOne(DiscordLink,    { foreignKey: 'userId', as: 'discordLink',  constraints: false });

  await Profile.sync({ force: false });
  await UserReputation.sync({ force: false });
  await Reward.sync({ force: false });
  await AuditLog.sync({ force: false });

  initialized = true;
}
