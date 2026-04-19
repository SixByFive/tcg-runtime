import { DataTypes } from 'sequelize';
export default function defineAchievement(sequelize) {
  return sequelize.define('Achievement', {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    code:        { type: DataTypes.STRING(50), allowNull: false, unique: true },
    name:        { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    tier:        { type: DataTypes.ENUM('bronze','silver','gold','platinum'), defaultValue: 'bronze' },
    iconUrl:     { type: DataTypes.STRING, allowNull: true },
    hidden:      { type: DataTypes.BOOLEAN, defaultValue: false },
  }, { tableName: 'achievements', timestamps: true });
}
