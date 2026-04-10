import { DataTypes } from 'sequelize';

/**
 * Stores a seller's Stripe Connect account details.
 * Created when a user initiates Stripe Connect onboarding.
 * A complete SellerProfile (stripeOnboardingComplete = true) is required
 * before a listing can go ACTIVE.
 */
export default function defineSellerProfile(sequelize) {
  return sequelize.define('SellerProfile', {
    userId:                  { type: DataTypes.UUID, primaryKey: true },
    stripeAccountId:         { type: DataTypes.STRING, allowNull: true },
    stripeOnboardingComplete: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, {
    tableName: 'seller_profiles',
  });
}
