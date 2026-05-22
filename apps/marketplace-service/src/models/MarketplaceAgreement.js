import { DataTypes } from 'sequelize';

export default function defineMarketplaceAgreement(sequelize) {
  return sequelize.define('MarketplaceAgreement', {
    userId:   { type: DataTypes.UUID, primaryKey: true },
    agreedAt: { type: DataTypes.DATE, allowNull: false },
  }, {
    tableName: 'marketplace_agreements',
    timestamps: false,
  });
}
