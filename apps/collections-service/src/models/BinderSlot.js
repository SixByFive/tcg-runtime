import { DataTypes } from 'sequelize';

export function defineBinderSlot(sequelize) {
  return sequelize.define(
    'BinderSlot',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      pageId: { type: DataTypes.UUID, allowNull: false },
      cardId: { type: DataTypes.STRING, allowNull: false },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      position: { type: DataTypes.INTEGER, allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'binder_slots',
      indexes: [{ fields: ['pageId'] }],
    },
  );
}
