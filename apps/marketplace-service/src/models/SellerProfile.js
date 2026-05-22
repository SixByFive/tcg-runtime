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

    // Return address for shipping labels
    returnName:     { type: DataTypes.STRING(100), allowNull: true },
    returnLine1:    { type: DataTypes.STRING(200), allowNull: true },
    returnLine2:    { type: DataTypes.STRING(200), allowNull: true },
    returnCity:     { type: DataTypes.STRING(100), allowNull: true },
    returnPostcode: { type: DataTypes.STRING(20),  allowNull: true },
    returnCountry:  { type: DataTypes.CHAR(2),     defaultValue: 'GB' },
    returnPhone:    { type: DataTypes.STRING(30),  allowNull: true },
    returnEmail:    { type: DataTypes.STRING(200), allowNull: true },
  }, {
    tableName: 'seller_profiles',
  });
}
