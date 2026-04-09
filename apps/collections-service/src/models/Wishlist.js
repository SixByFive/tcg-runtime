import { DataTypes } from 'sequelize';

export function defineWishlist(sequelize) {
  return sequelize.define(
    'Wishlist',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: { type: DataTypes.UUID, allowNull: false },
      cardId: { type: DataTypes.STRING, allowNull: false },
      status: {
        type: DataTypes.ENUM('ACTIVE', 'GRAIL', 'EVENTUAL', 'UPGRADE'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      variation: { type: DataTypes.STRING, allowNull: true },
      quantity: { type: DataTypes.INTEGER, defaultValue: 1, allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
      addedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      movedToCollectionAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'wishlists',
      indexes: [
        { fields: ['userId'] },
        { fields: ['cardId'] },
        {
          fields: ['userId', 'cardId', 'variation'],
          unique: true,
          name: 'unique_wishlist_user_card_variation',
        },
      ],
    },
  );
}
