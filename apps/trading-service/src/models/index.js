import { getSequelize } from '@sbf/database';
import defineTrade from './Trade.js';
import defineTradeCard from './TradeCard.js';
import defineTradeProof from './TradeProof.js';
import defineTradeDispute from './TradeDispute.js';
import defineOwnershipRecord from './OwnershipRecord.js';
import defineUserReputation from './UserReputation.js';
import defineTradeBan from './TradeBan.js';

export let Trade;
export let TradeCard;
export let TradeProof;
export let TradeDispute;
export let OwnershipRecord;
export let UserReputation;
export let TradeBan;
export let sequelize;

let initialized = false;

export async function initModels() {
  if (initialized) return;
  sequelize = getSequelize();

  Trade            = defineTrade(sequelize);
  TradeCard        = defineTradeCard(sequelize);
  TradeProof       = defineTradeProof(sequelize);
  TradeDispute     = defineTradeDispute(sequelize);
  OwnershipRecord  = defineOwnershipRecord(sequelize);
  UserReputation   = defineUserReputation(sequelize);
  TradeBan         = defineTradeBan(sequelize);

  Trade.hasMany(TradeCard,    { foreignKey: 'tradeId', as: 'cards' });
  Trade.hasMany(TradeProof,   { foreignKey: 'tradeId', as: 'proofs' });
  Trade.hasOne(TradeDispute,  { foreignKey: 'tradeId', as: 'dispute' });
  TradeCard.belongsTo(Trade,  { foreignKey: 'tradeId' });
  TradeProof.belongsTo(Trade, { foreignKey: 'tradeId' });

  if (process.env.NODE_ENV === 'development') {
    await Trade.sync({ alter: true });
    await TradeCard.sync({ alter: true });
    await TradeProof.sync({ alter: true });
    await TradeDispute.sync({ alter: true });
    await OwnershipRecord.sync({ alter: true });
    await TradeBan.sync({ alter: true });
  } else {
    await Trade.sync({ force: false });
    await TradeCard.sync({ force: false });
    await TradeProof.sync({ force: false });
    await TradeDispute.sync({ force: false });
    await OwnershipRecord.sync({ force: false });
    await TradeBan.sync({ force: false });
  }

  initialized = true;
}
