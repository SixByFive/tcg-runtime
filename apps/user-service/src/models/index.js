import { getSequelize } from '@sbf/database';
import defineUser from './User.js';
import defineProfile from './Profile.js';
import defineUserReputation from './UserReputation.js';
import defineDiscordLink from './DiscordLink.js';
import defineReward from './Reward.js';
import defineAuditLog from './AuditLog.js';
import defineAchievement from './Achievement.js';
import defineUserAchievement from './UserAchievement.js';
import defineAdminAction from './AdminAction.js';

export let User;
export let Profile;
export let UserReputation;
export let DiscordLink;
export let Reward;
export let AuditLog;
export let Achievement;
export let UserAchievement;
export let AdminAction;

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
  Achievement    = defineAchievement(sequelize);
  UserAchievement = defineUserAchievement(sequelize);
  AdminAction    = defineAdminAction(sequelize);

  User.hasOne(Profile,        { foreignKey: 'userId', as: 'profile',     constraints: false });
  Profile.belongsTo(User,     { foreignKey: 'userId',                     constraints: false });
  User.hasOne(UserReputation, { foreignKey: 'userId', as: 'reputation',   constraints: false });
  User.hasOne(DiscordLink,    { foreignKey: 'userId', as: 'discordLink',  constraints: false });

  Achievement.hasMany(UserAchievement, { foreignKey: 'achievementId', as: 'earnedBy' });
  UserAchievement.belongsTo(Achievement, { foreignKey: 'achievementId', as: 'achievement' });

  await Profile.sync({ force: false });
  await UserReputation.sync({ force: false });
  await Reward.sync({ force: false });
  await AuditLog.sync({ force: false });
  await Achievement.sync({ force: false });
  await UserAchievement.sync({ force: false });
  await AdminAction.sync({ force: false });

  initialized = true;
}
