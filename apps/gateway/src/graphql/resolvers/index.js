import { JSONScalar } from './utils.js';
import * as infrastructure from './infrastructure.js';
import * as auth from './auth.js';
import * as users from './users.js';
import * as catalog from './catalog.js';
import * as collections from './collections.js';
import * as notifications from './notifications.js';
import * as messaging from './messaging.js';
import * as marketplace from './marketplace.js';
import * as payments from './payments.js';
import * as trading from './trading.js';
import * as shipping from './shipping.js';
import * as admin from './admin.js';

export const resolvers = {
  JSON: JSONScalar,

  Query: {
    ...infrastructure.queries,
    ...auth.queries,
    ...users.queries,
    ...catalog.queries,
    ...collections.queries,
    ...notifications.queries,
    ...messaging.queries,
    ...marketplace.queries,
    ...payments.queries,
    ...trading.queries,
    ...shipping.queries,
    ...admin.queries,
  },

  Mutation: {
    ...auth.mutations,
    ...users.mutations,
    ...catalog.mutations,
    ...collections.mutations,
    ...notifications.mutations,
    ...messaging.mutations,
    ...marketplace.mutations,
    ...payments.mutations,
    ...trading.mutations,
    ...shipping.mutations,
    ...admin.mutations,
  },

  ...marketplace.types,
  ...users.types,
  ...messaging.types,
  ...payments.types,
  ...trading.types,
};
