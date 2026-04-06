import { DataTypes } from 'sequelize';

export function defineCard(sequelize) {
  return sequelize.define('Card', {
    id: {
      type: DataTypes.STRING(80),
      primaryKey: true,
    },
    set_code: DataTypes.STRING(32),
    number: DataTypes.STRING(16),
    name: DataTypes.STRING(200),
    rarity: DataTypes.STRING(80),
    image_small: DataTypes.TEXT,
    image_large: DataTypes.TEXT,
    supertype: DataTypes.STRING(40),
    subtype: DataTypes.STRING(80),
    image_url_remote: DataTypes.TEXT,
    regulation_mark: DataTypes.STRING(8),
    legality_std: DataTypes.TINYINT,
    legality_exp: DataTypes.TINYINT,
    legality_unl: DataTypes.TINYINT,
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'm_cards',
    timestamps: false,
    indexes: [
      { fields: ['set_code'] },
      { fields: ['number'] },
      { fields: ['name'] },
    ],
  });
}
