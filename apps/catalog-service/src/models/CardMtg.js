import { DataTypes } from 'sequelize';

/**
 * MTG-specific attributes for a card.
 *
 * One row per card_id when game='mtg'. Mirrors the Scryfall card shape
 * closely enough that resolvers can hand it to clients without a
 * second transformation.
 *
 * `colors`, `color_identity`, `keywords`, `promo_types` are JSON arrays
 * of short strings. `card_faces` is a JSON array of face objects (name,
 * mana_cost, type_line, oracle_text, image_small, image_large) for
 * double-faced / split / meld cards.
 */
export function defineCardMtg(sequelize) {
  return sequelize.define('CardMtg', {
    card_id: {
      type: DataTypes.STRING(80),
      primaryKey: true,
    },
    scryfall_id: DataTypes.STRING(36),       // Scryfall UUID — stable per printing
    oracle_id: DataTypes.STRING(36),         // Scryfall oracle UUID — shared across reprints
    lang: DataTypes.STRING(8),               // 'en', 'ja', 'de', …
    layout: DataTypes.STRING(32),            // normal, split, transform, modal_dfc, meld, …
    mana_cost: DataTypes.STRING(64),         // "{2}{G}{G}"
    cmc: DataTypes.DECIMAL(5, 2),            // can be fractional (e.g. "Little Girl" = 0.5)
    type_line: DataTypes.STRING(200),        // "Legendary Creature — Human Wizard"
    oracle_text: DataTypes.TEXT,
    power: DataTypes.STRING(8),              // string — can be "*", "1+*"
    toughness: DataTypes.STRING(8),
    loyalty: DataTypes.STRING(8),
    colors: DataTypes.JSON,                  // ["G"] etc.
    color_identity: DataTypes.JSON,          // ["G","U"]
    keywords: DataTypes.JSON,
    produced_mana: DataTypes.JSON,
    card_faces: DataTypes.JSON,              // null for single-faced cards
    promo_types: DataTypes.JSON,             // ["bundle","promopack",…]
    frame_effects: DataTypes.JSON,           // ["showcase","extendedart",…]
    border_color: DataTypes.STRING(16),
    collector_number: DataTypes.STRING(16),  // Scryfall collector_number — may differ from m_cards.number
    released_at: DataTypes.DATEONLY,
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'm_card_mtg',
    timestamps: false,
    indexes: [
      { fields: ['scryfall_id'] },
      { fields: ['oracle_id'] },
      { fields: ['lang'] },
      { fields: ['layout'] },
    ],
  });
}
