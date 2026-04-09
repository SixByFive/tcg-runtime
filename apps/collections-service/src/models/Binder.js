import { DataTypes } from 'sequelize';

export function defineBinder(sequelize) {
  return sequelize.define(
    'Binder',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      coverColor: { type: DataTypes.STRING, allowNull: true },
      accentColor: { type: DataTypes.STRING, allowNull: true },
      visibility: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'public',
      },
      slug: { type: DataTypes.STRING, allowNull: false, unique: true },
      isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    {
      tableName: 'binders',
      indexes: [
        { fields: ['userId'] },
        { fields: ['slug'], unique: true },
      ],
    },
  );
}
