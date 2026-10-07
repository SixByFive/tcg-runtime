import { DataTypes } from 'sequelize';

export default function defineCardListingItem(sequelize) {
  return sequelize.define('CardListingItem', {
    id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    listingId: { type: DataTypes.UUID, allowNull: false },
    cardId:    { type: DataTypes.STRING(80), allowNull: false },
    variant:   { type: DataTypes.STRING(80), allowNull: true },
    condition: {
      type: DataTypes.ENUM('M', 'NM', 'LP', 'MP', 'HP', 'DMG'),
      allowNull: true,
    },
    quantity:  { type: DataTypes.INTEGER, defaultValue: 1, allowNull: false },
  }, {
    tableName: 'card_listing_items',
    indexes: [
      { fields: ['listingId'] },
      { fields: ['cardId'] },
    ],
  });
}
