import { DataTypes } from 'sequelize';

export default function defineProductListing(sequelize) {
  return sequelize.define('ProductListing', {
    id:       { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sellerId: { type: DataTypes.UUID, allowNull: false },
    title:    { type: DataTypes.STRING(255), allowNull: false },
    description:        { type: DataTypes.TEXT, allowNull: true },
    imageUrl:           { type: DataTypes.STRING, allowNull: true },
    imagesJson:         { type: DataTypes.JSON, allowNull: true },
    colourVariantsJson: { type: DataTypes.JSON, allowNull: true },
    price:    { type: DataTypes.DECIMAL(10, 4), allowNull: false },
    currency: { type: DataTypes.CHAR(3), defaultValue: 'GBP' },
    quantity: { type: DataTypes.INTEGER, defaultValue: 1, allowNull: false },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'SOLD_OUT', 'REMOVED'),
      defaultValue: 'ACTIVE',
    },
    fulfilmentType:       { type: DataTypes.STRING(50), allowNull: true },
    fulfilmentProvider:   { type: DataTypes.STRING(100), allowNull: true },
    fulfilmentExternalId: { type: DataTypes.STRING(255), allowNull: true },
  }, {
    tableName: 'product_listings',
    timestamps: true,
    indexes: [
      { fields: ['sellerId'] },
      { fields: ['status'] },
    ],
  });
}
