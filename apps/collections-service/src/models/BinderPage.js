import { DataTypes } from 'sequelize';

export function defineBinderPage(sequelize) {
  return sequelize.define(
    'BinderPage',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      binderId: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: true },
      layout: { type: DataTypes.STRING, allowNull: false, defaultValue: '3x3' },
      pageOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: 'binder_pages',
      indexes: [{ fields: ['binderId'] }],
    },
  );
}
