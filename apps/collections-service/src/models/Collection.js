import { DataTypes } from 'sequelize';

export function defineCollection(sequelize) {
  return sequelize.define(
    'Collection',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: { type: DataTypes.UUID, allowNull: false },
      cardId: { type: DataTypes.STRING, allowNull: false },
      quantity: { type: DataTypes.INTEGER, defaultValue: 1, allowNull: false },
      condition: { type: DataTypes.STRING, allowNull: true },
      variation: { type: DataTypes.STRING, allowNull: true },
      wishlist: { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    {
      tableName: 'collections',
      indexes: [
        {
          fields: ['userId', 'cardId', 'variation'],
          unique: true,
          name: 'unique_user_card_variation',
        },
        { fields: ['userId'] },
      ],
    },
  );
}
