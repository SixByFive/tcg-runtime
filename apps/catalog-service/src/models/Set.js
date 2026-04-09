import { DataTypes } from 'sequelize';

export function defineSet(sequelize) {
  return sequelize.define('Set', {
    code: {
      type: DataTypes.STRING(32),
      primaryKey: true,
    },
    name: DataTypes.STRING(200),
    era: DataTypes.STRING(100),
    release_date: DataTypes.DATEONLY,
    abbreviation: DataTypes.STRING(32),
    official_count: DataTypes.INTEGER,
    total_cards: DataTypes.INTEGER,
    set_logo: DataTypes.TEXT,
    set_symbol: DataTypes.TEXT,
    source_at: DataTypes.DATE,
    generator_version: DataTypes.STRING(64),
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'm_sets',
    timestamps: false,
    indexes: [
      { fields: ['abbreviation'] },
    ],
  });
}
