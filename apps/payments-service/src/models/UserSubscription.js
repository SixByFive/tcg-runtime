import { DataTypes } from 'sequelize';

/**
 * A user's subscription record.
 * One active subscription per user at any time.
 * Historical subscriptions are kept with status 'cancelled' or 'expired'.
 */
export default function defineUserSubscription(sequelize) {
  return sequelize.define('UserSubscription', {
    id:                     { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId:                 { type: DataTypes.UUID, allowNull: false },
    planId:                 { type: DataTypes.UUID, allowNull: false },
    status: {
      type: DataTypes.ENUM('active', 'past_due', 'cancelled', 'expired', 'trialing'),
      defaultValue: 'active',
    },
    stripeCustomerId:       { type: DataTypes.STRING, allowNull: true },
    stripeSubscriptionId:   { type: DataTypes.STRING, allowNull: true },
    stripeCheckoutSessionId: { type: DataTypes.STRING, allowNull: true },
    currentPeriodStart:     { type: DataTypes.DATE, allowNull: true },
    currentPeriodEnd:       { type: DataTypes.DATE, allowNull: true },
    cancelAtPeriodEnd:      { type: DataTypes.BOOLEAN, defaultValue: false },
    cancelledAt:            { type: DataTypes.DATE, allowNull: true },
    trialEnd:               { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'user_subscriptions',
    indexes: [
      { fields: ['userId'] },
      { fields: ['stripeSubscriptionId'] },
      { fields: ['stripeCustomerId'] },
      { fields: ['status'] },
    ],
  });
}
