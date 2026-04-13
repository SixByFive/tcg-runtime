import { DataTypes } from 'sequelize';

export const PROFILE_STATUSES = [
  'Looking to Trade',
  'Just Collecting',
  'Open to Chat',
  'Building a Master Set',
  'Marketplace Seller',
  'Inactive',
];

export default function defineProfile(sequelize) {
  return sequelize.define('Profile', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId:           { type: DataTypes.UUID, allowNull: false, unique: true },
    avatar:           { type: DataTypes.STRING, allowNull: true },
    bio:              { type: DataTypes.STRING(400), allowNull: true },
    favouritePokemon: { type: DataTypes.STRING(64), allowNull: true },
    country:          { type: DataTypes.STRING(64), allowNull: true },
    showcase:         { type: DataTypes.JSON, allowNull: true, defaultValue: {} },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Looking to Trade',
      validate: { isIn: [PROFILE_STATUSES] },
    },
    address1:         { type: DataTypes.STRING, allowNull: true },
    address2:         { type: DataTypes.STRING, allowNull: true },
    city:             { type: DataTypes.STRING, allowNull: true },
    postcode:         { type: DataTypes.STRING, allowNull: true },
    state:            { type: DataTypes.STRING, allowNull: true },
    phone:            { type: DataTypes.STRING, allowNull: true },
    discord:          { type: DataTypes.STRING, allowNull: true },
    publicProfile:    { type: DataTypes.BOOLEAN, defaultValue: true },
    wantsTrade:       { type: DataTypes.BOOLEAN, defaultValue: true },
    wantsMarketplace: { type: DataTypes.BOOLEAN, defaultValue: true },
    // Safety / parental controls
    // NOTE: These columns require a manual migration on existing databases:
    //   ALTER TABLE profiles ADD COLUMN dob DATE NULL;
    //   ALTER TABLE profiles ADD COLUMN parentEmail VARCHAR(255) NULL;
    //   ALTER TABLE profiles ADD COLUMN parentVerifiedAt DATETIME NULL;
    //   ALTER TABLE profiles ADD COLUMN restrictionLevel VARCHAR(20) NULL;
    dob:                 { type: DataTypes.DATEONLY, allowNull: true },
    parentEmail:         { type: DataTypes.STRING, allowNull: true },
    parentVerifiedAt:    { type: DataTypes.DATE, allowNull: true },
    restrictionLevel:    { type: DataTypes.STRING(20), allowNull: true, defaultValue: null }, // null = derived from dob
  }, {
    tableName: 'profiles',
    timestamps: true,
    indexes: [{ fields: ['userId'] }],
  });
}
