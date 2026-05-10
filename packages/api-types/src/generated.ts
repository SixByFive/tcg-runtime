export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /**
   * SBF TCG Gateway Schema — SDL snapshot.
   * Regenerate with: pnpm --filter @sbf/gateway schema:export
   */
  JSON: { input: unknown; output: unknown; }
};

export type Achievement = {
  code?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  iconUrl?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  tier?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
};

export type AdminBinder = {
  createdAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isDeleted?: Maybe<Scalars['Boolean']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  userId?: Maybe<Scalars['ID']['output']>;
  visibility?: Maybe<Scalars['String']['output']>;
};

export type AdminUser = {
  createdAt?: Maybe<Scalars['String']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  emailVerified?: Maybe<Scalars['Boolean']['output']>;
  id: Scalars['ID']['output'];
  isAdmin?: Maybe<Scalars['Boolean']['output']>;
  isBanned?: Maybe<Scalars['Boolean']['output']>;
  lastLogin?: Maybe<Scalars['String']['output']>;
  profile?: Maybe<UserProfile>;
  username?: Maybe<Scalars['String']['output']>;
};

export type AuditLog = {
  action?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  details?: Maybe<Scalars['JSON']['output']>;
  id: Scalars['ID']['output'];
  ip?: Maybe<Scalars['String']['output']>;
  targetId?: Maybe<Scalars['String']['output']>;
  targetType?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
  userAgent?: Maybe<Scalars['String']['output']>;
  userId?: Maybe<Scalars['ID']['output']>;
};

export type AuthPayload = {
  token?: Maybe<Scalars['String']['output']>;
  user?: Maybe<User>;
};

export type AuthUser = {
  avatar?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  emailVerified?: Maybe<Scalars['Boolean']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
  isAdmin?: Maybe<Scalars['Boolean']['output']>;
  lastLogin?: Maybe<Scalars['String']['output']>;
  mfaEnabled?: Maybe<Scalars['Boolean']['output']>;
  twoFactorEnabled?: Maybe<Scalars['Boolean']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
  username?: Maybe<Scalars['String']['output']>;
};

export type Binder = {
  accentColor?: Maybe<Scalars['String']['output']>;
  coverColor?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isDeleted?: Maybe<Scalars['Boolean']['output']>;
  name: Scalars['String']['output'];
  pages?: Maybe<Array<BinderPageType>>;
  slug: Scalars['String']['output'];
  updatedAt?: Maybe<Scalars['String']['output']>;
  userId: Scalars['ID']['output'];
  visibility: Scalars['String']['output'];
};

export type BinderInput = {
  accentColor?: InputMaybe<Scalars['String']['input']>;
  coverColor?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  visibility?: InputMaybe<Scalars['String']['input']>;
};

export type BinderPage = {
  binders: Array<Binder>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type BinderPageInput = {
  id?: InputMaybe<Scalars['ID']['input']>;
  layout?: InputMaybe<Scalars['String']['input']>;
  slots?: InputMaybe<Array<BinderSlotInput>>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type BinderPageType = {
  binderId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  layout: Scalars['String']['output'];
  pageOrder: Scalars['Int']['output'];
  slots?: Maybe<Array<BinderSlot>>;
  title?: Maybe<Scalars['String']['output']>;
};

export type BinderSlot = {
  card?: Maybe<CatalogCard>;
  cardId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  pageId: Scalars['ID']['output'];
  position: Scalars['Int']['output'];
  quantity: Scalars['Int']['output'];
};

export type BinderSlotInput = {
  cardId: Scalars['String']['input'];
  id?: InputMaybe<Scalars['ID']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  position: Scalars['Int']['input'];
  quantity?: InputMaybe<Scalars['Int']['input']>;
};

export type BroadcastNotificationInput = {
  body: Scalars['String']['input'];
  iconUrl?: InputMaybe<Scalars['String']['input']>;
  linkUrl?: InputMaybe<Scalars['String']['input']>;
  title: Scalars['String']['input'];
  type?: InputMaybe<Scalars['String']['input']>;
};

export type BulkAddCardInput = {
  cardId: Scalars['String']['input'];
  condition?: InputMaybe<Scalars['String']['input']>;
  quantity?: InputMaybe<Scalars['Int']['input']>;
  variation?: InputMaybe<Scalars['String']['input']>;
};

export type BulkAddResult = {
  added: Scalars['Int']['output'];
  entries: Array<CollectionEntry>;
};

export type Capabilities = {
  canBuyMarketplace?: Maybe<Scalars['Boolean']['output']>;
  canConnectDiscord?: Maybe<Scalars['Boolean']['output']>;
  canMessage?: Maybe<Scalars['Boolean']['output']>;
  canPost?: Maybe<Scalars['Boolean']['output']>;
  canSellMarketplace?: Maybe<Scalars['Boolean']['output']>;
  canTrade?: Maybe<Scalars['Boolean']['output']>;
  restrictionLevel?: Maybe<Scalars['String']['output']>;
};

export type CardImage = {
  large?: Maybe<Scalars['String']['output']>;
  small?: Maybe<Scalars['String']['output']>;
};

export type CardListing = {
  allowOffers?: Maybe<Scalars['Boolean']['output']>;
  cardId?: Maybe<Scalars['String']['output']>;
  condition?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  offerMinPrice?: Maybe<Scalars['Float']['output']>;
  parcelSize?: Maybe<Scalars['String']['output']>;
  price?: Maybe<Scalars['Float']['output']>;
  proofCode?: Maybe<Scalars['String']['output']>;
  quantity?: Maybe<Scalars['Int']['output']>;
  sellerId?: Maybe<Scalars['ID']['output']>;
  shippingPrice?: Maybe<Scalars['Float']['output']>;
  shippingType?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
  variant?: Maybe<Scalars['String']['output']>;
};

export type CardPrice = {
  currency?: Maybe<Scalars['String']['output']>;
  gbp?: Maybe<Scalars['Float']['output']>;
  high?: Maybe<Scalars['Float']['output']>;
  low?: Maybe<Scalars['Float']['output']>;
  market?: Maybe<Scalars['Float']['output']>;
  mid?: Maybe<Scalars['Float']['output']>;
  provider?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
  variation?: Maybe<Scalars['String']['output']>;
};

export type CardSearchInput = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  number?: InputMaybe<Scalars['String']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  query?: InputMaybe<Scalars['String']['input']>;
  rarity?: InputMaybe<Scalars['String']['input']>;
  set?: InputMaybe<Scalars['String']['input']>;
  setCode?: InputMaybe<Scalars['String']['input']>;
};

export type CardSearchResult = {
  items: Array<CardsearchItem>;
  limit: Scalars['Int']['output'];
  offset: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type CardSet = {
  abbr?: Maybe<Scalars['String']['output']>;
  code?: Maybe<Scalars['String']['output']>;
  lang?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  releasedAt?: Maybe<Scalars['String']['output']>;
  series?: Maybe<Scalars['String']['output']>;
  total?: Maybe<Scalars['Int']['output']>;
};

export type CardSetRef = {
  code?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
};

export type CardVariant = {
  default?: Maybe<Scalars['Boolean']['output']>;
  key?: Maybe<Scalars['String']['output']>;
  label?: Maybe<Scalars['String']['output']>;
};

export type CardsearchBulkAddInput = {
  cards: Array<BulkAddCardInput>;
};

export type CardsearchBulkAddItem = {
  cardId?: Maybe<Scalars['String']['output']>;
  created?: Maybe<Scalars['Boolean']['output']>;
  error?: Maybe<Scalars['String']['output']>;
  newQuantity?: Maybe<Scalars['Int']['output']>;
  previousQuantity?: Maybe<Scalars['Int']['output']>;
  quantity?: Maybe<Scalars['Int']['output']>;
};

export type CardsearchBulkAddResult = {
  items?: Maybe<Array<Maybe<CardsearchBulkAddItem>>>;
  message?: Maybe<Scalars['String']['output']>;
  ok?: Maybe<Scalars['Boolean']['output']>;
};

export type CardsearchDetail = {
  cardId?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
  images?: Maybe<CardImage>;
  latestPrices?: Maybe<Array<Maybe<CardPrice>>>;
  name?: Maybe<Scalars['String']['output']>;
  number?: Maybe<Scalars['String']['output']>;
  rarity?: Maybe<Scalars['String']['output']>;
  set?: Maybe<CardSetRef>;
  setCode?: Maybe<Scalars['String']['output']>;
  variants?: Maybe<Array<Maybe<CardVariant>>>;
};

export type CardsearchItem = {
  cardId?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
  images?: Maybe<CardImage>;
  latestPrices?: Maybe<Array<Maybe<CardPrice>>>;
  name?: Maybe<Scalars['String']['output']>;
  number?: Maybe<Scalars['String']['output']>;
  rarity?: Maybe<Scalars['String']['output']>;
  set?: Maybe<CardSetRef>;
  setCode?: Maybe<Scalars['String']['output']>;
  variants?: Maybe<Array<Maybe<CardVariant>>>;
};

export type CartItemInput = {
  buyerAddress: Scalars['JSON']['input'];
  listingId: Scalars['ID']['input'];
  shipmentId?: InputMaybe<Scalars['String']['input']>;
  shippingRateId?: InputMaybe<Scalars['String']['input']>;
};

export type CartOrderError = {
  error: Scalars['String']['output'];
  listingId: Scalars['ID']['output'];
};

export type CartOrderResult = {
  errors: Array<CartOrderError>;
  orders: Array<Order>;
};

export type CatalogCard = {
  id?: Maybe<Scalars['ID']['output']>;
  cardId?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  number?: Maybe<Scalars['String']['output']>;
  setCode?: Maybe<Scalars['String']['output']>;
  rarity?: Maybe<Scalars['String']['output']>;
  supertype?: Maybe<Scalars['String']['output']>;
  subtype?: Maybe<Scalars['String']['output']>;
  images?: Maybe<CardImage>;
  set?: Maybe<CardSetRef>;
  variants?: Maybe<Array<Maybe<CardVariant>>>;
  latestPrices?: Maybe<Array<Maybe<CardPrice>>>;
};

export type ChatBlock = {
  blockedId?: Maybe<Scalars['ID']['output']>;
  blockerId?: Maybe<Scalars['ID']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  reason?: Maybe<Scalars['String']['output']>;
};

export type ChatMute = {
  createdAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  mutedUntil?: Maybe<Scalars['String']['output']>;
  otherUserId?: Maybe<Scalars['ID']['output']>;
  userId?: Maybe<Scalars['ID']['output']>;
};

export type ChatThread = {
  lastMessage?: Maybe<Message>;
  unreadCount?: Maybe<Scalars['Int']['output']>;
  user?: Maybe<User>;
  userId?: Maybe<Scalars['ID']['output']>;
};

export type CollectionEntry = {
  card?: Maybe<CatalogCard>;
  cardId: Scalars['String']['output'];
  condition?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  quantity: Scalars['Int']['output'];
  updatedAt?: Maybe<Scalars['String']['output']>;
  userId: Scalars['ID']['output'];
  variation?: Maybe<Scalars['String']['output']>;
  wishlist?: Maybe<Scalars['Boolean']['output']>;
};

export type CreateListingInput = {
  allowOffers?: InputMaybe<Scalars['Boolean']['input']>;
  cardId: Scalars['String']['input'];
  condition: Scalars['String']['input'];
  currency?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  offerMinPrice?: InputMaybe<Scalars['Float']['input']>;
  parcelSize?: InputMaybe<Scalars['String']['input']>;
  price: Scalars['Float']['input'];
  quantity?: InputMaybe<Scalars['Int']['input']>;
  shippingPrice?: InputMaybe<Scalars['Float']['input']>;
  shippingType?: InputMaybe<Scalars['String']['input']>;
  title: Scalars['String']['input'];
  variant?: InputMaybe<Scalars['String']['input']>;
};

export type CreateOrderFromListingInput = {
  buyerAddress?: InputMaybe<Scalars['JSON']['input']>;
  listingId: Scalars['ID']['input'];
  shipmentId?: InputMaybe<Scalars['String']['input']>;
  shippingRateId?: InputMaybe<Scalars['String']['input']>;
};

export type DependencyStatus = {
  code?: Maybe<Scalars['String']['output']>;
  errno?: Maybe<Scalars['Int']['output']>;
  error?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  ok: Scalars['Boolean']['output'];
  sqlMessage?: Maybe<Scalars['String']['output']>;
  sqlState?: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
};

export type DiscordChannel = {
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  type?: Maybe<Scalars['Int']['output']>;
};

export type DiscordGuild = {
  botPresent?: Maybe<Scalars['Boolean']['output']>;
  icon?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type HealthStatus = {
  service: Scalars['String']['output'];
  status: Scalars['String']['output'];
};

export type InventoryItem = {
  id: Scalars['ID']['output'];
  onHand?: Maybe<Scalars['Int']['output']>;
  reserved?: Maybe<Scalars['Int']['output']>;
  sold?: Maybe<Scalars['Int']['output']>;
};

export type Listing = CardListing | ProductListing;

export type ListingStatus =
  | 'ACTIVE'
  | 'CANCELLED'
  | 'PENDING_PROOF'
  | 'REMOVED'
  | 'SOLD';

export type ListingType =
  | 'CARD'
  | 'PRODUCT';

export type Message = {
  content?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isRead?: Maybe<Scalars['Boolean']['output']>;
  isSystemMessage?: Maybe<Scalars['Boolean']['output']>;
  meta?: Maybe<Scalars['JSON']['output']>;
  receiverId?: Maybe<Scalars['ID']['output']>;
  senderId?: Maybe<Scalars['ID']['output']>;
};

export type Mutation = {
  addCardToBinder: BinderSlot;
  addToCollection: CollectionEntry;
  addToWishlist: WishlistEntry;
  adminApproveTradeProof: Scalars['Boolean']['output'];
  adminBanUser: Scalars['Boolean']['output'];
  adminBanUserFromChat: Scalars['Boolean']['output'];
  adminBanUserFromTrading: Scalars['Boolean']['output'];
  adminClearParentLink: Scalars['Boolean']['output'];
  adminClearUserReport: Scalars['Boolean']['output'];
  adminCreateProductListing: ProductListing;
  adminDeleteBinder: Scalars['Boolean']['output'];
  adminDeleteMessage: Scalars['Boolean']['output'];
  adminDeleteNotification: Scalars['Boolean']['output'];
  adminDeleteUser: Scalars['Boolean']['output'];
  adminGrantAchievement: UserAchievement;
  adminResolveTradeDispute: Trade;
  adminSendBroadcastNotification: Scalars['Boolean']['output'];
  adminSendSystemMessage: Message;
  adminSetParentVerified: SafetyProfile;
  adminSetUserRestriction: SafetyProfile;
  adminUnbanUser: Scalars['Boolean']['output'];
  adminUnbanUserFromChat: Scalars['Boolean']['output'];
  adminUnbanUserFromTrading: Scalars['Boolean']['output'];
  adminUpdateOrderFulfilmentStatus: Order;
  adminUpdateProductListing: ProductListing;
  agreeToChatRules: Scalars['Boolean']['output'];
  blockUserFromChat: Scalars['Boolean']['output'];
  bulkAddToCollection: BulkAddResult;
  cancelShippingLabel?: Maybe<Scalars['Boolean']['output']>;
  cancelSubscription: Scalars['Boolean']['output'];
  cancelTrade: Trade;
  cardsearchBulkAddToCollection: CardsearchBulkAddResult;
  changeEmail?: Maybe<Scalars['Boolean']['output']>;
  changePassword?: Maybe<Scalars['Boolean']['output']>;
  confirmTradeReceived: Trade;
  connectStripe: StripeConnectResult;
  createBinder: Binder;
  createCartOrders: CartOrderResult;
  createListing: CardListing;
  createOffer: Offer;
  createOrderFromListing: Order;
  createShippingLabel: ShippingLabel;
  createSubscription: UserSubscription;
  deleteAccount: Scalars['Boolean']['output'];
  deleteBinder?: Maybe<Scalars['Boolean']['output']>;
  deleteChat?: Maybe<Scalars['Boolean']['output']>;
  deleteListing?: Maybe<Scalars['Boolean']['output']>;
  deletePriceAlert: Scalars['Boolean']['output'];
  disableTwoFactor?: Maybe<Scalars['Boolean']['output']>;
  dismissNotification?: Maybe<Scalars['Boolean']['output']>;
  enableTwoFactor: TwoFactorSetup;
  grantReward: Reward;
  initiateTrade: Trade;
  leaveTradeFeedback?: Maybe<Scalars['Boolean']['output']>;
  login: AuthPayload;
  markAllNotificationsRead?: Maybe<Scalars['Boolean']['output']>;
  markChatRead?: Maybe<Scalars['Boolean']['output']>;
  markNotificationRead?: Maybe<Scalars['Boolean']['output']>;
  moveToCollection: CollectionEntry;
  moveToWishlist: Scalars['Boolean']['output'];
  muteConversation: Scalars['Boolean']['output'];
  raiseTradeDispute: TradeDisputeResult;
  register: AuthPayload;
  registerExpoPushToken?: Maybe<Scalars['Boolean']['output']>;
  removeFromCollection: Scalars['Boolean']['output'];
  removeFromWishlist?: Maybe<Scalars['Boolean']['output']>;
  reportMessage?: Maybe<Scalars['Boolean']['output']>;
  reportUser?: Maybe<Scalars['Boolean']['output']>;
  requestParentVerification?: Maybe<Scalars['Boolean']['output']>;
  requestPasswordReset?: Maybe<Scalars['Boolean']['output']>;
  resetPassword?: Maybe<Scalars['Boolean']['output']>;
  respondToOffer: RespondToOfferResult;
  respondToTrade: Trade;
  resumeSubscription: UserSubscription;
  saveBinderPagesAndSlots: Binder;
  sendMessage: Message;
  sendTestPush?: Maybe<Scalars['Boolean']['output']>;
  setNotificationPrefs?: Maybe<Scalars['Boolean']['output']>;
  shareCollectionToDiscord: Scalars['Boolean']['output'];
  shareWishlistToDiscord: Scalars['Boolean']['output'];
  submitTradeTracking: Trade;
  togglePriceAlert: Scalars['Boolean']['output'];
  unblockUserFromChat: Scalars['Boolean']['output'];
  unmuteConversation: Scalars['Boolean']['output'];
  unregisterExpoPushToken?: Maybe<Scalars['Boolean']['output']>;
  updateBinder: Binder;
  updateCollectionEntry: CollectionEntry;
  updateProfile: UserProfile;
  updateSafetyProfile: SafetyProfile;
  updateWishlistEntry: WishlistEntry;
  uploadTradeProof: TradeProofResult;
  upsertPriceAlert: PriceAlert;
  verifyTwoFactor?: Maybe<Scalars['Boolean']['output']>;
  withdrawOffer?: Maybe<Scalars['Boolean']['output']>;
};


export type MutationAddCardToBinderArgs = {
  input: BinderSlotInput;
  pageId: Scalars['ID']['input'];
};


export type MutationAddToCollectionArgs = {
  cardId: Scalars['String']['input'];
  condition?: InputMaybe<Scalars['String']['input']>;
  quantity?: InputMaybe<Scalars['Int']['input']>;
  variation?: InputMaybe<Scalars['String']['input']>;
};


export type MutationAddToWishlistArgs = {
  cardId: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  quantity?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<WishlistStatus>;
  variation?: InputMaybe<Scalars['String']['input']>;
};


export type MutationAdminApproveTradeProofArgs = {
  id: Scalars['ID']['input'];
  party: Scalars['String']['input'];
  proofId: Scalars['ID']['input'];
};


export type MutationAdminBanUserArgs = {
  id: Scalars['ID']['input'];
};


export type MutationAdminBanUserFromChatArgs = {
  reason?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};


export type MutationAdminBanUserFromTradingArgs = {
  reason?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};


export type MutationAdminClearParentLinkArgs = {
  userId: Scalars['ID']['input'];
};


export type MutationAdminClearUserReportArgs = {
  userId: Scalars['ID']['input'];
};


export type MutationAdminCreateProductListingArgs = {
  input: ProductListingInput;
};


export type MutationAdminDeleteBinderArgs = {
  id: Scalars['ID']['input'];
  permanent?: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationAdminDeleteMessageArgs = {
  id: Scalars['ID']['input'];
};


export type MutationAdminDeleteNotificationArgs = {
  id: Scalars['ID']['input'];
};


export type MutationAdminDeleteUserArgs = {
  id: Scalars['ID']['input'];
};


export type MutationAdminGrantAchievementArgs = {
  achievementId: Scalars['ID']['input'];
  data?: InputMaybe<Scalars['JSON']['input']>;
  userId: Scalars['ID']['input'];
};


export type MutationAdminResolveTradeDisputeArgs = {
  id: Scalars['ID']['input'];
  resolution: Scalars['String']['input'];
  resolvedInFavourOf?: InputMaybe<Scalars['String']['input']>;
};


export type MutationAdminSendBroadcastNotificationArgs = {
  input: BroadcastNotificationInput;
};


export type MutationAdminSendSystemMessageArgs = {
  content: Scalars['String']['input'];
  meta?: InputMaybe<Scalars['JSON']['input']>;
  receiverId: Scalars['ID']['input'];
};


export type MutationAdminSetParentVerifiedArgs = {
  userId: Scalars['ID']['input'];
  verified: Scalars['Boolean']['input'];
};


export type MutationAdminSetUserRestrictionArgs = {
  restrictionLevel?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};


export type MutationAdminUnbanUserArgs = {
  id: Scalars['ID']['input'];
};


export type MutationAdminUnbanUserFromChatArgs = {
  userId: Scalars['ID']['input'];
};


export type MutationAdminUnbanUserFromTradingArgs = {
  userId: Scalars['ID']['input'];
};


export type MutationAdminUpdateOrderFulfilmentStatusArgs = {
  orderId: Scalars['ID']['input'];
  status: Scalars['String']['input'];
};


export type MutationAdminUpdateProductListingArgs = {
  id: Scalars['ID']['input'];
  input: ProductListingInput;
};


export type MutationBlockUserFromChatArgs = {
  reason?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};


export type MutationBulkAddToCollectionArgs = {
  cards: Array<BulkAddCardInput>;
};


export type MutationCancelShippingLabelArgs = {
  id: Scalars['ID']['input'];
};


export type MutationCancelTradeArgs = {
  id: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
};


export type MutationCardsearchBulkAddToCollectionArgs = {
  input: CardsearchBulkAddInput;
};


export type MutationChangeEmailArgs = {
  currentPassword: Scalars['String']['input'];
  newEmail: Scalars['String']['input'];
};


export type MutationChangePasswordArgs = {
  currentPassword: Scalars['String']['input'];
  newPassword: Scalars['String']['input'];
};


export type MutationConfirmTradeReceivedArgs = {
  id: Scalars['ID']['input'];
};


export type MutationCreateBinderArgs = {
  input: BinderInput;
};


export type MutationCreateCartOrdersArgs = {
  items: Array<CartItemInput>;
};


export type MutationCreateListingArgs = {
  input: CreateListingInput;
};


export type MutationCreateOfferArgs = {
  amount: Scalars['Float']['input'];
  listingId: Scalars['ID']['input'];
  message?: InputMaybe<Scalars['String']['input']>;
};


export type MutationCreateOrderFromListingArgs = {
  input: CreateOrderFromListingInput;
};


export type MutationCreateShippingLabelArgs = {
  from: Scalars['JSON']['input'];
  parcel: Scalars['JSON']['input'];
  parcelSize?: InputMaybe<Scalars['String']['input']>;
  rateId: Scalars['String']['input'];
  relatedId?: InputMaybe<Scalars['ID']['input']>;
  relatedType?: InputMaybe<Scalars['String']['input']>;
  shipmentId?: InputMaybe<Scalars['String']['input']>;
  to: Scalars['JSON']['input'];
};


export type MutationCreateSubscriptionArgs = {
  paymentMethodId?: InputMaybe<Scalars['String']['input']>;
  planId: Scalars['ID']['input'];
};


export type MutationDeleteAccountArgs = {
  confirm: Scalars['String']['input'];
  password?: InputMaybe<Scalars['String']['input']>;
};


export type MutationDeleteBinderArgs = {
  id: Scalars['ID']['input'];
  permanent?: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationDeleteChatArgs = {
  userId: Scalars['ID']['input'];
};


export type MutationDeleteListingArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeletePriceAlertArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDisableTwoFactorArgs = {
  code: Scalars['String']['input'];
};


export type MutationDismissNotificationArgs = {
  id: Scalars['ID']['input'];
};


export type MutationGrantRewardArgs = {
  achievementId?: InputMaybe<Scalars['ID']['input']>;
  data?: InputMaybe<Scalars['JSON']['input']>;
  type: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};


export type MutationInitiateTradeArgs = {
  offeredCards?: InputMaybe<Array<TradeCardInput>>;
  userId: Scalars['ID']['input'];
  wantedCards?: InputMaybe<Array<TradeCardInput>>;
};


export type MutationLeaveTradeFeedbackArgs = {
  id: Scalars['ID']['input'];
  rating: Scalars['Int']['input'];
  review?: InputMaybe<Scalars['String']['input']>;
};


export type MutationLoginArgs = {
  email?: InputMaybe<Scalars['String']['input']>;
  mfaToken?: InputMaybe<Scalars['String']['input']>;
  password: Scalars['String']['input'];
  twoFactorToken?: InputMaybe<Scalars['String']['input']>;
  username?: InputMaybe<Scalars['String']['input']>;
};


export type MutationMarkChatReadArgs = {
  userId: Scalars['ID']['input'];
};


export type MutationMarkNotificationReadArgs = {
  id: Scalars['ID']['input'];
};


export type MutationMoveToCollectionArgs = {
  cardId: Scalars['String']['input'];
  variation?: InputMaybe<Scalars['String']['input']>;
};


export type MutationMoveToWishlistArgs = {
  cardId: Scalars['String']['input'];
  variation?: InputMaybe<Scalars['String']['input']>;
};


export type MutationMuteConversationArgs = {
  mutedUntil?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};


export type MutationRaiseTradeDisputeArgs = {
  id: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
};


export type MutationRegisterArgs = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
  referrerId?: InputMaybe<Scalars['ID']['input']>;
  username: Scalars['String']['input'];
};


export type MutationRegisterExpoPushTokenArgs = {
  appVersion?: InputMaybe<Scalars['String']['input']>;
  deviceName?: InputMaybe<Scalars['String']['input']>;
  expoPushToken: Scalars['String']['input'];
  platform?: InputMaybe<Scalars['String']['input']>;
};


export type MutationRemoveFromCollectionArgs = {
  cardId: Scalars['String']['input'];
  variation?: InputMaybe<Scalars['String']['input']>;
};


export type MutationRemoveFromWishlistArgs = {
  cardId: Scalars['String']['input'];
  variation?: InputMaybe<Scalars['String']['input']>;
};


export type MutationReportMessageArgs = {
  details?: InputMaybe<Scalars['String']['input']>;
  messageId: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
};


export type MutationReportUserArgs = {
  details?: InputMaybe<Scalars['String']['input']>;
  reason: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};


export type MutationRequestPasswordResetArgs = {
  email: Scalars['String']['input'];
};


export type MutationResetPasswordArgs = {
  newPassword: Scalars['String']['input'];
  token: Scalars['String']['input'];
};


export type MutationRespondToOfferArgs = {
  action: Scalars['String']['input'];
  buyerAddress?: InputMaybe<Scalars['JSON']['input']>;
  counterAmount?: InputMaybe<Scalars['Float']['input']>;
  counterMessage?: InputMaybe<Scalars['String']['input']>;
  offerId: Scalars['ID']['input'];
};


export type MutationRespondToTradeArgs = {
  accept: Scalars['Boolean']['input'];
  counterCards?: InputMaybe<Array<TradeCardInput>>;
  id: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
};


export type MutationSaveBinderPagesAndSlotsArgs = {
  binderId: Scalars['ID']['input'];
  pages: Array<BinderPageInput>;
};


export type MutationSendMessageArgs = {
  content: Scalars['String']['input'];
  meta?: InputMaybe<Scalars['JSON']['input']>;
  receiverId: Scalars['ID']['input'];
};


export type MutationSendTestPushArgs = {
  body: Scalars['String']['input'];
  title: Scalars['String']['input'];
};


export type MutationSetNotificationPrefsArgs = {
  digest?: InputMaybe<Scalars['String']['input']>;
  emailEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  inappEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  pushEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  quietEnd?: InputMaybe<Scalars['String']['input']>;
  quietStart?: InputMaybe<Scalars['String']['input']>;
};


export type MutationShareCollectionToDiscordArgs = {
  cardId: Scalars['String']['input'];
  cardName: Scalars['String']['input'];
  channelId: Scalars['String']['input'];
  guildId: Scalars['String']['input'];
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  quantity?: InputMaybe<Scalars['Int']['input']>;
  variation?: InputMaybe<Scalars['String']['input']>;
};


export type MutationShareWishlistToDiscordArgs = {
  cardId: Scalars['String']['input'];
  cardName: Scalars['String']['input'];
  channelId: Scalars['String']['input'];
  guildId: Scalars['String']['input'];
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  variation?: InputMaybe<Scalars['String']['input']>;
};


export type MutationSubmitTradeTrackingArgs = {
  id: Scalars['ID']['input'];
  trackingNumber: Scalars['String']['input'];
};


export type MutationTogglePriceAlertArgs = {
  active: Scalars['Boolean']['input'];
  id: Scalars['ID']['input'];
};


export type MutationUnblockUserFromChatArgs = {
  userId: Scalars['ID']['input'];
};


export type MutationUnmuteConversationArgs = {
  userId: Scalars['ID']['input'];
};


export type MutationUnregisterExpoPushTokenArgs = {
  expoPushToken: Scalars['String']['input'];
};


export type MutationUpdateBinderArgs = {
  id: Scalars['ID']['input'];
  input: BinderInput;
};


export type MutationUpdateCollectionEntryArgs = {
  cardId: Scalars['String']['input'];
  condition?: InputMaybe<Scalars['String']['input']>;
  quantity?: InputMaybe<Scalars['Int']['input']>;
  variation?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdateProfileArgs = {
  address1?: InputMaybe<Scalars['String']['input']>;
  address2?: InputMaybe<Scalars['String']['input']>;
  avatar?: InputMaybe<Scalars['String']['input']>;
  bio?: InputMaybe<Scalars['String']['input']>;
  city?: InputMaybe<Scalars['String']['input']>;
  country?: InputMaybe<Scalars['String']['input']>;
  discord?: InputMaybe<Scalars['String']['input']>;
  favouritePokemon?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  postcode?: InputMaybe<Scalars['String']['input']>;
  publicProfile?: InputMaybe<Scalars['Boolean']['input']>;
  state?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  wantsMarketplace?: InputMaybe<Scalars['Boolean']['input']>;
  wantsTrade?: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationUpdateSafetyProfileArgs = {
  dob?: InputMaybe<Scalars['String']['input']>;
  parentEmail?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdateWishlistEntryArgs = {
  cardId: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  quantity?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<WishlistStatus>;
  variation?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUploadTradeProofArgs = {
  id: Scalars['ID']['input'];
  proofCode?: InputMaybe<Scalars['String']['input']>;
  proofImage: Scalars['String']['input'];
};


export type MutationUpsertPriceAlertArgs = {
  input: UpsertPriceAlertInput;
};


export type MutationVerifyTwoFactorArgs = {
  code: Scalars['String']['input'];
};


export type MutationWithdrawOfferArgs = {
  offerId: Scalars['ID']['input'];
};

export type Notification = {
  body?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  iconUrl?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isDismissed?: Maybe<Scalars['Boolean']['output']>;
  isRead?: Maybe<Scalars['Boolean']['output']>;
  linkUrl?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  type?: Maybe<Scalars['String']['output']>;
};

export type NotificationFilterInput = {
  isDismissed?: InputMaybe<Scalars['Boolean']['input']>;
  isRead?: InputMaybe<Scalars['Boolean']['input']>;
  type?: InputMaybe<Scalars['String']['input']>;
};

export type NotificationPage = {
  notifications: Array<Notification>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type NotificationPrefs = {
  digest?: Maybe<Scalars['String']['output']>;
  emailEnabled?: Maybe<Scalars['Boolean']['output']>;
  inappEnabled?: Maybe<Scalars['Boolean']['output']>;
  pushEnabled?: Maybe<Scalars['Boolean']['output']>;
  quietEnd?: Maybe<Scalars['String']['output']>;
  quietStart?: Maybe<Scalars['String']['output']>;
};

export type Offer = {
  amount?: Maybe<Scalars['Float']['output']>;
  buyerId?: Maybe<Scalars['ID']['output']>;
  counterAmount?: Maybe<Scalars['Float']['output']>;
  counterMessage?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  expiresAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  listing?: Maybe<CardListing>;
  listingId?: Maybe<Scalars['ID']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  respondedAt?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
};

export type Order = {
  buyer?: Maybe<PublicUser>;
  buyerAddressJson?: Maybe<Scalars['JSON']['output']>;
  buyerEmail?: Maybe<Scalars['String']['output']>;
  buyerId?: Maybe<Scalars['ID']['output']>;
  buyerName?: Maybe<Scalars['String']['output']>;
  cancelledAt?: Maybe<Scalars['String']['output']>;
  cardId?: Maybe<Scalars['String']['output']>;
  clientSecret?: Maybe<Scalars['String']['output']>;
  completedAt?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  fulfilmentStatus?: Maybe<Scalars['String']['output']>;
  guestCheckout?: Maybe<Scalars['Boolean']['output']>;
  id: Scalars['ID']['output'];
  listing?: Maybe<Listing>;
  listingId?: Maybe<Scalars['ID']['output']>;
  orderNumber?: Maybe<Scalars['String']['output']>;
  paidAt?: Maybe<Scalars['String']['output']>;
  paymentMethod?: Maybe<Scalars['String']['output']>;
  paymentStatus?: Maybe<Scalars['String']['output']>;
  platformFee?: Maybe<Scalars['Float']['output']>;
  salePrice?: Maybe<Scalars['Float']['output']>;
  seller?: Maybe<PublicUser>;
  sellerId?: Maybe<Scalars['ID']['output']>;
  shippedAt?: Maybe<Scalars['String']['output']>;
  shippingAddressJson?: Maybe<Scalars['JSON']['output']>;
  shippingCost?: Maybe<Scalars['Float']['output']>;
  shippingLabelUrl?: Maybe<Scalars['String']['output']>;
  total?: Maybe<Scalars['Float']['output']>;
  totalAmount?: Maybe<Scalars['Float']['output']>;
  trackingCarrier?: Maybe<Scalars['String']['output']>;
  trackingNumber?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
};

export type PaymentTransaction = {
  amount?: Maybe<Scalars['Float']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  meta?: Maybe<Scalars['JSON']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  stripePaymentIntentId?: Maybe<Scalars['String']['output']>;
  type?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
  userId?: Maybe<Scalars['ID']['output']>;
};

export type PriceAlert = {
  cardId: Scalars['String']['output'];
  condition?: Maybe<Scalars['String']['output']>;
  cooldownHours?: Maybe<Scalars['Int']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  lastFiredAt?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['Float']['output']>;
  variation?: Maybe<Scalars['String']['output']>;
  windowHours?: Maybe<Scalars['Int']['output']>;
};

export type PriceLatest = {
  date?: Maybe<Scalars['String']['output']>;
  market?: Maybe<Scalars['Float']['output']>;
};

export type PriceObservation = {
  date?: Maybe<Scalars['String']['output']>;
  high?: Maybe<Scalars['Float']['output']>;
  low?: Maybe<Scalars['Float']['output']>;
  market?: Maybe<Scalars['Float']['output']>;
  mid?: Maybe<Scalars['Float']['output']>;
};

export type PricePeriodStats = {
  avg?: Maybe<Scalars['Float']['output']>;
  change?: Maybe<Scalars['Float']['output']>;
  changePct?: Maybe<Scalars['Float']['output']>;
};

export type PriceRollup = {
  currency?: Maybe<Scalars['String']['output']>;
  d7?: Maybe<PricePeriodStats>;
  d30?: Maybe<PricePeriodStats>;
  d90?: Maybe<PricePeriodStats>;
  latest?: Maybe<PriceLatest>;
};

export type ProductListing = {
  colourVariantsJson?: Maybe<Scalars['JSON']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  fulfilmentExternalId?: Maybe<Scalars['String']['output']>;
  fulfilmentProvider?: Maybe<Scalars['String']['output']>;
  fulfilmentType?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  imagesJson?: Maybe<Scalars['JSON']['output']>;
  inventory?: Maybe<InventoryItem>;
  price?: Maybe<Scalars['Float']['output']>;
  quantity?: Maybe<Scalars['Int']['output']>;
  seller?: Maybe<PublicUser>;
  sellerId?: Maybe<Scalars['ID']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
};

export type ProductListingInput = {
  colourVariantsJson?: InputMaybe<Scalars['JSON']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  fulfilmentExternalId?: InputMaybe<Scalars['String']['input']>;
  fulfilmentProvider?: InputMaybe<Scalars['String']['input']>;
  fulfilmentType?: InputMaybe<Scalars['String']['input']>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  imagesJson?: InputMaybe<Scalars['JSON']['input']>;
  price: Scalars['Float']['input'];
  quantity?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  title: Scalars['String']['input'];
};

export type PublicUser = {
  avatar?: Maybe<Scalars['String']['output']>;
  bio?: Maybe<Scalars['String']['output']>;
  country?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
  username?: Maybe<Scalars['String']['output']>;
};

export type Query = {
  achievements: Array<Achievement>;
  adminBinders: Array<AdminBinder>;
  adminListings: Array<CardListing>;
  adminNotifications: NotificationPage;
  adminOrders: Array<Order>;
  adminQueryReportedUsers: Array<ReportedUser>;
  adminTradeBans: Array<TradeBan>;
  adminTradeDisputes: Array<TradeDispute>;
  adminTrades: Array<Trade>;
  adminUserCollections: Array<UserCollectionSummary>;
  allUsers: Array<AdminUser>;
  auditLogs: Array<AuditLog>;
  binder?: Maybe<Binder>;
  browseBinders: BinderPage;
  browseTrades: Array<Trade>;
  cardsearchCard?: Maybe<CardsearchDetail>;
  cardsearchPriceObservations: Array<PriceObservation>;
  cardsearchPriceRollups: Array<PriceRollup>;
  cardsearchSearchCards: CardSearchResult;
  cardsearchSetByCode?: Maybe<CardSet>;
  cardsearchSets: Array<CardSet>;
  chatRulesText: Scalars['String']['output'];
  chatWithUser: Array<Message>;
  collection: Array<CollectionEntry>;
  collectionEntry?: Maybe<CollectionEntry>;
  dbHealth: DependencyStatus;
  discordShareChannels: Array<DiscordChannel>;
  discordShareGuilds: Array<DiscordGuild>;
  hasAgreedToChatRules: Scalars['Boolean']['output'];
  health: HealthStatus;
  listing?: Maybe<Listing>;
  listingOffers: Array<Offer>;
  listings: Array<Listing>;
  me?: Maybe<User>;
  myAchievements: Array<UserAchievement>;
  myBinders: Array<Binder>;
  myBlockedUsers: Array<ChatBlock>;
  myChats: Array<ChatThread>;
  myCollection: Array<CollectionEntry>;
  myMutedConversations: Array<ChatMute>;
  myNotificationPrefs: NotificationPrefs;
  myNotifications: NotificationPage;
  myOffers: Array<Offer>;
  myOrders: Array<Order>;
  myPriceAlerts: Array<PriceAlert>;
  myRewards: Array<Reward>;
  mySafetyProfile: SafetyProfile;
  mySubscription?: Maybe<UserSubscription>;
  myTrades: Array<Trade>;
  myTransactions: Array<PaymentTransaction>;
  myWishlist: WishlistPage;
  order?: Maybe<Order>;
  searchCards: CardSearchResult;
  searchUsers: Array<PublicUser>;
  sellerStatus: SellerStatus;
  serviceHealth: ServiceHealth;
  shippingLabel?: Maybe<ShippingLabel>;
  shippingRates: Array<ShippingRate>;
  subscriptionPlans: Array<SubscriptionPlan>;
  subscriptionPortal?: Maybe<SubscriptionPortal>;
  trade?: Maybe<Trade>;
  unreadMessageCount: Scalars['Int']['output'];
  unreadNotificationCount: Scalars['Int']['output'];
  userAchievements: Array<UserAchievement>;
  userById?: Maybe<UserProfile>;
  userProfile?: Maybe<UserProfile>;
  userRewards: Array<Reward>;
  wishlist: WishlistPage;
  wishlistEntry?: Maybe<WishlistEntry>;
};


export type QueryAdminBindersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryAdminListingsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sellerId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
};


export type QueryAdminNotificationsArgs = {
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
  type?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryAdminOrdersArgs = {
  fulfilmentStatus?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  paymentStatus?: InputMaybe<Scalars['String']['input']>;
};


export type QueryAdminQueryReportedUsersArgs = {
  isCleared?: InputMaybe<Scalars['Boolean']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryAdminTradeDisputesArgs = {
  status?: InputMaybe<Scalars['String']['input']>;
};


export type QueryAdminTradesArgs = {
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<TradeStatus>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryAdminUserCollectionsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};


export type QueryAllUsersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryAuditLogsArgs = {
  action?: InputMaybe<Scalars['String']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
  targetId?: InputMaybe<Scalars['String']['input']>;
  targetType?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryBinderArgs = {
  id?: InputMaybe<Scalars['ID']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
};


export type QueryBrowseBindersArgs = {
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryBrowseTradesArgs = {
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryCardsearchCardArgs = {
  id: Scalars['ID']['input'];
  variant?: InputMaybe<Scalars['String']['input']>;
};


export type QueryCardsearchPriceObservationsArgs = {
  cardId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  variant?: InputMaybe<Scalars['String']['input']>;
};


export type QueryCardsearchPriceRollupsArgs = {
  cardId: Scalars['ID']['input'];
  variant?: InputMaybe<Scalars['String']['input']>;
};


export type QueryCardsearchSearchCardsArgs = {
  input: CardSearchInput;
};


export type QueryCardsearchSetByCodeArgs = {
  code: Scalars['String']['input'];
};


export type QueryCardsearchSetsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryChatWithUserArgs = {
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
  userId: Scalars['ID']['input'];
};


export type QueryCollectionArgs = {
  userId: Scalars['ID']['input'];
};


export type QueryCollectionEntryArgs = {
  cardId: Scalars['String']['input'];
  variation?: InputMaybe<Scalars['String']['input']>;
};


export type QueryDiscordShareChannelsArgs = {
  guildId: Scalars['String']['input'];
};


export type QueryListingArgs = {
  id: Scalars['ID']['input'];
};


export type QueryListingOffersArgs = {
  listingId: Scalars['ID']['input'];
};


export type QueryListingsArgs = {
  cardId?: InputMaybe<Scalars['String']['input']>;
  condition?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  maxPrice?: InputMaybe<Scalars['Float']['input']>;
  minPrice?: InputMaybe<Scalars['Float']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  sellerId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<ListingStatus>;
  type?: InputMaybe<ListingType>;
};


export type QueryMyChatsArgs = {
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryMyNotificationsArgs = {
  filter?: InputMaybe<NotificationFilterInput>;
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryMyOrdersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  role?: InputMaybe<Scalars['String']['input']>;
};


export type QueryMyTradesArgs = {
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<TradeStatus>;
};


export type QueryMyTransactionsArgs = {
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryMyWishlistArgs = {
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryOrderArgs = {
  id: Scalars['ID']['input'];
};


export type QuerySearchCardsArgs = {
  input: CardSearchInput;
};


export type QuerySearchUsersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  q: Scalars['String']['input'];
};


export type QueryShippingLabelArgs = {
  id: Scalars['ID']['input'];
};


export type QueryShippingRatesArgs = {
  from: Scalars['JSON']['input'];
  parcel: Scalars['JSON']['input'];
  parcelSize?: InputMaybe<Scalars['String']['input']>;
  to: Scalars['JSON']['input'];
};


export type QueryTradeArgs = {
  id: Scalars['ID']['input'];
};


export type QueryUserAchievementsArgs = {
  userId: Scalars['ID']['input'];
};


export type QueryUserByIdArgs = {
  id: Scalars['ID']['input'];
};


export type QueryUserProfileArgs = {
  username: Scalars['String']['input'];
};


export type QueryUserRewardsArgs = {
  userId: Scalars['ID']['input'];
};


export type QueryWishlistArgs = {
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
  userId: Scalars['ID']['input'];
};


export type QueryWishlistEntryArgs = {
  cardId: Scalars['String']['input'];
  variation?: InputMaybe<Scalars['String']['input']>;
};

export type ReportedUser = {
  createdAt?: Maybe<Scalars['String']['output']>;
  details?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isCleared?: Maybe<Scalars['Boolean']['output']>;
  reason?: Maybe<Scalars['String']['output']>;
  reporter?: Maybe<PublicUser>;
  reporterId?: Maybe<Scalars['ID']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
  user?: Maybe<PublicUser>;
  userId?: Maybe<Scalars['ID']['output']>;
};

export type RespondToOfferResult = {
  clientSecret?: Maybe<Scalars['String']['output']>;
  counterAmount?: Maybe<Scalars['Float']['output']>;
  ok: Scalars['Boolean']['output'];
  orderId?: Maybe<Scalars['ID']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  totalAmount?: Maybe<Scalars['Float']['output']>;
};

export type Reward = {
  achievementId?: Maybe<Scalars['ID']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  data?: Maybe<Scalars['JSON']['output']>;
  grantedBy?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  type?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
  userId?: Maybe<Scalars['ID']['output']>;
};

export type SafetyProfile = {
  capabilities?: Maybe<Capabilities>;
  dob?: Maybe<Scalars['String']['output']>;
  parentEmail?: Maybe<Scalars['String']['output']>;
  parentVerifiedAt?: Maybe<Scalars['String']['output']>;
  restrictionLevel?: Maybe<Scalars['String']['output']>;
};

export type SellerStatus = {
  complete: Scalars['Boolean']['output'];
  connected: Scalars['Boolean']['output'];
  url?: Maybe<Scalars['String']['output']>;
};

export type ServiceHealth = {
  auth?: Maybe<Scalars['JSON']['output']>;
  catalog?: Maybe<Scalars['JSON']['output']>;
  gateway: HealthStatus;
};

export type ShippingLabel = {
  amount?: Maybe<Scalars['Float']['output']>;
  carrier?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  labelUrl?: Maybe<Scalars['String']['output']>;
  qrCodeUrl?: Maybe<Scalars['String']['output']>;
  refundStatus?: Maybe<Scalars['String']['output']>;
  service?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  trackingNumber?: Maybe<Scalars['String']['output']>;
};

export type ShippingRate = {
  amount?: Maybe<Scalars['Float']['output']>;
  carrier?: Maybe<Scalars['String']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  estimatedDays?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
  qrAvailable?: Maybe<Scalars['Boolean']['output']>;
  service?: Maybe<Scalars['String']['output']>;
  shipmentId?: Maybe<Scalars['String']['output']>;
  trackingAvailable?: Maybe<Scalars['Boolean']['output']>;
};

export type StripeConnectResult = {
  accountId?: Maybe<Scalars['String']['output']>;
  alreadyConnected?: Maybe<Scalars['Boolean']['output']>;
  url?: Maybe<Scalars['String']['output']>;
};

export type SubscriptionPlan = {
  createdAt?: Maybe<Scalars['String']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  features?: Maybe<Scalars['JSON']['output']>;
  id: Scalars['ID']['output'];
  isActive?: Maybe<Scalars['Boolean']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  priceMonthly?: Maybe<Scalars['Float']['output']>;
  priceYearly?: Maybe<Scalars['Float']['output']>;
  stripePriceIdMonthly?: Maybe<Scalars['String']['output']>;
  stripePriceIdYearly?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
};

export type SubscriptionPortal = {
  url: Scalars['String']['output'];
};

export type Trade = {
  adminNotes?: Maybe<Scalars['String']['output']>;
  agreedAt?: Maybe<Scalars['String']['output']>;
  cancelledAt?: Maybe<Scalars['String']['output']>;
  cancelledBy?: Maybe<Scalars['ID']['output']>;
  cancelledReason?: Maybe<Scalars['String']['output']>;
  cards?: Maybe<Array<TradeCard>>;
  completedAt?: Maybe<Scalars['String']['output']>;
  counterCount?: Maybe<Scalars['Int']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  dispute?: Maybe<TradeDispute>;
  disputeId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  initiatorId?: Maybe<Scalars['ID']['output']>;
  lastCounterBy?: Maybe<Scalars['ID']['output']>;
  lockedAt?: Maybe<Scalars['String']['output']>;
  partyAId?: Maybe<Scalars['ID']['output']>;
  partyBId?: Maybe<Scalars['ID']['output']>;
  proofAVerified?: Maybe<Scalars['Boolean']['output']>;
  proofBVerified?: Maybe<Scalars['Boolean']['output']>;
  proofs?: Maybe<Array<TradeProof>>;
  status?: Maybe<TradeStatus>;
  trackingNumberA?: Maybe<Scalars['String']['output']>;
  trackingNumberB?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
};

export type TradeBan = {
  bannedAt?: Maybe<Scalars['String']['output']>;
  bannedBy?: Maybe<Scalars['ID']['output']>;
  reason?: Maybe<Scalars['String']['output']>;
  userId: Scalars['ID']['output'];
};

export type TradeCard = {
  cardId?: Maybe<Scalars['String']['output']>;
  condition?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  quantity?: Maybe<Scalars['Int']['output']>;
  tradeId?: Maybe<Scalars['ID']['output']>;
  userId?: Maybe<Scalars['ID']['output']>;
  variation?: Maybe<Scalars['String']['output']>;
};

export type TradeCardInput = {
  cardId: Scalars['String']['input'];
  condition?: InputMaybe<Scalars['String']['input']>;
  quantity?: InputMaybe<Scalars['Int']['input']>;
  variation?: InputMaybe<Scalars['String']['input']>;
};

export type TradeDispute = {
  createdAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  raisedById?: Maybe<Scalars['ID']['output']>;
  reason?: Maybe<Scalars['String']['output']>;
  resolution?: Maybe<Scalars['String']['output']>;
  resolvedAt?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  tradeId?: Maybe<Scalars['ID']['output']>;
};

export type TradeDisputeResult = {
  dispute?: Maybe<TradeDispute>;
  trade?: Maybe<Trade>;
};

export type TradeProof = {
  id: Scalars['ID']['output'];
  moderatedAt?: Maybe<Scalars['String']['output']>;
  moderationResult?: Maybe<Scalars['String']['output']>;
  proofCode?: Maybe<Scalars['String']['output']>;
  proofImagePath?: Maybe<Scalars['String']['output']>;
  tradeId?: Maybe<Scalars['ID']['output']>;
  uploadedAt?: Maybe<Scalars['String']['output']>;
  userId?: Maybe<Scalars['ID']['output']>;
};

export type TradeProofResult = {
  proof?: Maybe<TradeProof>;
  trade?: Maybe<Trade>;
};

export type TradeStatus =
  | 'AGREED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'INITIATED'
  | 'IN_TRANSIT'
  | 'LOCKED'
  | 'NEGOTIATING'
  | 'PROOF_PENDING';

export type TwoFactorSetup = {
  otpauthUrl: Scalars['String']['output'];
  qrCodeDataURL: Scalars['String']['output'];
};

export type UpsertPriceAlertInput = {
  cardId?: InputMaybe<Scalars['String']['input']>;
  condition?: InputMaybe<Scalars['String']['input']>;
  cooldownHours?: InputMaybe<Scalars['Int']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  value?: InputMaybe<Scalars['Float']['input']>;
  variation?: InputMaybe<Scalars['String']['input']>;
  windowHours?: InputMaybe<Scalars['Int']['input']>;
};

export type User = {
  avatar?: Maybe<Scalars['String']['output']>;
  chatBanned?: Maybe<Scalars['Boolean']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  discordId?: Maybe<Scalars['String']['output']>;
  discordUsername?: Maybe<Scalars['String']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  emailVerified?: Maybe<Scalars['Boolean']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
  isAdmin?: Maybe<Scalars['Boolean']['output']>;
  lastLogin?: Maybe<Scalars['String']['output']>;
  mfaEnabled?: Maybe<Scalars['Boolean']['output']>;
  oauthId?: Maybe<Scalars['String']['output']>;
  oauthProvider?: Maybe<Scalars['String']['output']>;
  restrictionLevel?: Maybe<Scalars['String']['output']>;
  twoFactorEnabled?: Maybe<Scalars['Boolean']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
  username?: Maybe<Scalars['String']['output']>;
};

export type UserAchievement = {
  achievement?: Maybe<Achievement>;
  earnedAt?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
};

export type UserCollectionSummary = {
  distinctCards?: Maybe<Scalars['Int']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  totalCards?: Maybe<Scalars['Int']['output']>;
  userId: Scalars['ID']['output'];
  username?: Maybe<Scalars['String']['output']>;
};

export type UserProfile = {
  avatar?: Maybe<Scalars['String']['output']>;
  bio?: Maybe<Scalars['String']['output']>;
  country?: Maybe<Scalars['String']['output']>;
  favouritePokemon?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
  publicProfile?: Maybe<Scalars['Boolean']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  user?: Maybe<User>;
  userId?: Maybe<Scalars['ID']['output']>;
  wantsMarketplace?: Maybe<Scalars['Boolean']['output']>;
  wantsTrade?: Maybe<Scalars['Boolean']['output']>;
};

export type UserSubscription = {
  cancelAtPeriodEnd?: Maybe<Scalars['Boolean']['output']>;
  cancelledAt?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  currentPeriodEnd?: Maybe<Scalars['String']['output']>;
  currentPeriodStart?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  plan?: Maybe<SubscriptionPlan>;
  planId?: Maybe<Scalars['ID']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  stripeSubscriptionId?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['String']['output']>;
  userId?: Maybe<Scalars['ID']['output']>;
};

export type WishlistEntry = {
  addedAt?: Maybe<Scalars['String']['output']>;
  card?: Maybe<CatalogCard>;
  cardId: Scalars['String']['output'];
  createdAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  quantity: Scalars['Int']['output'];
  status: WishlistStatus;
  updatedAt?: Maybe<Scalars['String']['output']>;
  userId: Scalars['ID']['output'];
  variation?: Maybe<Scalars['String']['output']>;
};

export type WishlistPage = {
  entries: Array<WishlistEntry>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type WishlistStatus =
  | 'ACTIVE'
  | 'EVENTUAL'
  | 'GRAIL'
  | 'UPGRADE';
