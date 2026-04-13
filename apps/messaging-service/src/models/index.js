import { getSequelize } from '@sbf/database';
import { defineMessage } from './Message.js';
import { defineChatAgreement } from './ChatAgreement.js';
import { defineChatBlock } from './ChatBlock.js';
import { defineChatMute } from './ChatMute.js';
import { defineReportedUser } from './ReportedUser.js';
import { defineChatBan } from './ChatBan.js';

export let Message;
export let ChatAgreement;
export let ChatBlock;
export let ChatMute;
export let ReportedUser;
export let ChatBan;

let initialized = false;

export async function initModels() {
  if (initialized) return;
  const sequelize = getSequelize();

  Message       = defineMessage(sequelize);
  ChatAgreement = defineChatAgreement(sequelize);
  ChatBlock     = defineChatBlock(sequelize);
  ChatMute      = defineChatMute(sequelize);
  ReportedUser  = defineReportedUser(sequelize);
  ChatBan       = defineChatBan(sequelize);

  const alter = process.env.NODE_ENV === 'development';
  await Promise.all(
    [Message, ChatAgreement, ChatBlock, ChatMute, ReportedUser, ChatBan].map(
      (m) => m.sync({ alter, force: false }),
    ),
  );

  initialized = true;
}
