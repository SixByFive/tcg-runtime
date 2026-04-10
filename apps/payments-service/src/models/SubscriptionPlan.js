import { DataTypes } from 'sequelize';

/**
 * A subscription tier available for purchase.
 * Plans are created via admin API and backed by Stripe Products/Prices.
 *
 * feeDiscount: percentage off the platform marketplace fee.
 *   e.g. 0 = no discount (free tier), 50 = 50% off platform fee.
 */
export default function defineSubscriptionPlan(sequelize) {
  return sequelize.define('SubscriptionPlan', {
    id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name:             { type: DataTypes.STRING(80), allowNull: false },
    description:      { type: DataTypes.TEXT, allowNull: true },
    price:            { type: DataTypes.DECIMAL(8, 2), allowNull: false },
    currency:         { type: DataTypes.CHAR(3), defaultValue: 'GBP' },
    interval:         { type: DataTypes.ENUM('month', 'year'), defaultValue: 'month' },
    stripeProductId:  { type: DataTypes.STRING, allowNull: true },
    stripePriceId:    { type: DataTypes.STRING, allowNull: true },
    feeDiscount:      { type: DataTypes.TINYINT, defaultValue: 0, comment: 'Percent off platform fee, 0-100' },
    featuresJson:     { type: DataTypes.JSON, allowNull: true, comment: 'Array of feature strings for display' },
    active:           { type: DataTypes.BOOLEAN, defaultValue: true },
    sortOrder:        { type: DataTypes.INTEGER, defaultValue: 0 },
  }, {
    tableName: 'subscription_plans',
    indexes: [{ fields: ['active'] }],
  });
}
