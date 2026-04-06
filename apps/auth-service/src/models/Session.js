import { DataTypes } from 'sequelize';

export default function defineSession(sequelize) {
  return sequelize.define(
    'Session',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      token: {
        type: DataTypes.STRING(80),
        allowNull: false,
        unique: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'sessions',
      indexes: [
        { fields: ['token'] },
        { fields: ['userId'] },
        { fields: ['expiresAt'] },
      ],
    },
  );
}
