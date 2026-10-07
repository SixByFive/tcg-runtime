import { gql } from 'graphql-tag';

export const typeDefs = gql`
  type Query {
    health: HealthStatus!
    dbHealth: DependencyStatus!
    serviceHealth: ServiceHealth!
    me: User

    # ── User / Profile ──────────────────────────────────────────────────────────
    userProfile(username: String!): UserProfile
    userById(id: ID!): UserProfile
    myDeliveryAddress: UserProfile
    searchUsers(q: String!, limit: Int): [PublicUser!]!
    userAchievements(userId: ID!): [UserAchievement!]!
    achievements: [Achievement!]!
    myAchievements: [UserAchievement!]!
    discordShareGuilds: [DiscordGuild!]!
    discordShareChannels(guildId: String!): [DiscordChannel!]!

    # ── Collection ──────────────────────────────────────────────────────────────
    myCollection: [CollectionEntry!]!
    collection(userId: ID!): [CollectionEntry!]!
    collectionEntry(cardId: String!, variation: String): CollectionEntry
    cardSetCompletion(setCode: String!): CardSetCompletion!

    # ── Wishlist ────────────────────────────────────────────────────────────────
    myWishlist(page: Int, pageSize: Int): WishlistPage!
    wishlist(userId: ID!, page: Int, pageSize: Int): WishlistPage!
    wishlistEntry(cardId: String!, variation: String): WishlistEntry

    # ── Binder ──────────────────────────────────────────────────────────────────
    myBinders: [Binder!]!
    binder(id: ID, slug: String): Binder
    browseBinders(page: Int, pageSize: Int, userId: ID, search: String): BinderPage!

    # ── Catalog / Card search ────────────────────────────────────────────────────
    cardsearchSets(limit: Int, offset: Int): [CardSet!]!
    cardsearchSetByCode(code: String!): CardSet
    cardsearchSearchCards(input: CardSearchInput!): CardSearchResult!
    searchCards(input: CardSearchInput!): CardSearchResult!
    cardsearchCard(id: ID!, variant: String): CardsearchDetail
    cardsearchPriceObservations(cardId: ID!, variant: String, limit: Int): [PriceObservation!]!
    cardsearchPriceRollups(cardId: ID!, variant: String, windows: [Int]): [PriceRollup!]!

    # ── Notifications ────────────────────────────────────────────────────────────
    myNotifications(page: Int, pageSize: Int, filter: NotificationFilterInput): NotificationPage!
    unreadNotificationCount: Int!
    myNotificationPrefs: NotificationPrefs!
    vapidPublicKey: String

    # ── Price Alerts ──────────────────────────────────────────────────────────────
    myPriceAlerts: [PriceAlert!]!

    # ── Messaging ────────────────────────────────────────────────────────────────
    myChats(page: Int, pageSize: Int): [ChatThread!]!
    chatWithUser(userId: ID!, page: Int, pageSize: Int): [Message!]!
    unreadMessageCount: Int!
    hasAgreedToChatRules: Boolean!
    chatRulesText: String!
    hasAgreedToMarketplaceRules: Boolean!
    marketplaceRules: [String!]!
    myMutedConversations: [ChatMute!]!
    myBlockedUsers: [ChatBlock!]!
    adminQueryReportedUsers(page: Int, pageSize: Int, isCleared: Boolean): [ReportedUser!]!

    # ── Marketplace ───────────────────────────────────────────────────────────────
    listings(type: ListingType, cardId: String, sellerId: ID, condition: String, variation: String, sort: String, status: ListingStatus, minPrice: Float, maxPrice: Float, limit: Int, offset: Int): [ListingBase!]!
    listing(id: ID!): ListingBase
    myListings(status: ListingStatus, limit: Int, offset: Int): [CardListing!]!
    myOrders(role: String, fulfilmentStatus: String, limit: Int, offset: Int): [Order!]!
    order(id: ID!): Order
    sellerStatus: SellerStatus!
    sellerAddress: SellerAddress!
    sellerReputation(userId: ID!): SellerReputation
    sellerReviews(userId: ID!, limit: Int, offset: Int): [SellerReview!]!
    listingOffers(listingId: ID!): [Offer!]!
    myOffers: [Offer!]!
    myIncomingOffers: [Offer!]!

    # ── Trading ───────────────────────────────────────────────────────────────────
    browseTrades(page: Int, pageSize: Int): [Trade!]!
    myTrades(page: Int, pageSize: Int, status: TradeStatus): [Trade!]!
    trade(id: ID!): Trade
    quoteTradeShipping(id: ID!): TradeShippingQuote!

    # ── Subscriptions / Payments ─────────────────────────────────────────────────
    subscriptionPlans: [SubscriptionPlan!]!
    mySubscription: UserSubscription
    myCapabilities: UserCapabilities!
    subscriptionPortal: SubscriptionPortal
    myTransactions(page: Int, pageSize: Int): [PaymentTransaction!]!

    # ── Wallet ────────────────────────────────────────────────────────────────────
    myWallet(limit: Int, offset: Int): Wallet!
    adminWithdrawals(status: String, limit: Int, offset: Int): AdminWithdrawalList!

    # ── Trading Admin ──────────────────────────────────────────────────────────────
    adminTrades(page: Int, pageSize: Int, status: TradeStatus, userId: ID): [Trade!]!
    adminTradeDisputes(status: String): [TradeDispute!]!
    adminTradeBans: [TradeBan!]!

    # ── Marketplace Admin ─────────────────────────────────────────────────────────
    adminListings(status: String, sellerId: ID, limit: Int, offset: Int): [CardListing!]!
    adminOrders(paymentStatus: String, fulfilmentStatus: String, limit: Int, offset: Int): [Order!]!
    adminProofQueue: [CardListing!]!
    adminOrderDisputes(status: String): [OrderDispute!]!
    adminReviewQueue(status: String, limit: Int, offset: Int): [ReviewQueueItem!]!

    # ── Subscription / Revenue Admin ──────────────────────────────────────────────
    adminSubscriptions(status: String, page: Int, pageSize: Int): AdminSubscriptionPage!
    adminAllTransactions(page: Int, pageSize: Int, type: String, status: String): AdminTransactionPage!
    adminRevenueSummary: AdminRevenueSummary!
    adminMarketplaceRevenue: AdminMarketplaceRevenue!
    adminPlans: [SubscriptionPlan!]!

    # ── Safety ────────────────────────────────────────────────────────────────────
    mySafetyProfile: SafetyProfile!

    # ── Shipping ──────────────────────────────────────────────────────────────────
    shippingRates(to: JSON!, from: JSON!, parcel: JSON!, parcelSize: String): [ShippingRate!]!
    shippingLabel(id: ID!): ShippingLabel
    shippingLabelTracking(id: ID!): ShippingLabelTracking!
    orderTracking(orderId: ID!): ShippingLabelTracking

    # ── Rewards ───────────────────────────────────────────────────────────────────
    myRewards: [Reward!]!
    userRewards(userId: ID!): [Reward!]!

    # ── Audit Logs ────────────────────────────────────────────────────────────────
    auditLogs(userId: ID, action: String, targetId: String, targetType: String, page: Int, pageSize: Int): [AuditLog!]!

    # ── Admin ─────────────────────────────────────────────────────────────────────
    allUsers(limit: Int, offset: Int, search: String): [AdminUser!]!
    adminUserCount: Int!
    adminNotifications(page: Int, pageSize: Int, userId: ID, type: String): NotificationPage!
    adminBinders(limit: Int, offset: Int): [AdminBinder!]!
    adminUserCollections(limit: Int, search: String): [UserCollectionSummary!]!
  }

  type Mutation {
    login(
      email: String
      username: String
      password: String!
      mfaToken: String
      twoFactorToken: String
    ): AuthPayload!

    # ── Account / security ───────────────────────────────────────────────────────
    requestPasswordReset(email: String!): Boolean
    resetPassword(token: String!, newPassword: String!): Boolean
    changePassword(currentPassword: String!, newPassword: String!): Boolean
    changeEmail(newEmail: String!, currentPassword: String!): Boolean
    enableTwoFactor: TwoFactorSetup!
    verifyTwoFactor(code: String!): Boolean
    disableTwoFactor(code: String!): Boolean

    # ── User Profile ─────────────────────────────────────────────────────────────
    updateProfile(
      bio: String
      favouritePokemon: String
      avatar: String
      country: String
      status: String
      publicProfile: Boolean
      wantsTrade: Boolean
      wantsMarketplace: Boolean
      address1: String
      address2: String
      city: String
      postcode: String
      state: String
      phone: String
      discord: String
    ): UserProfile!
    deleteAccount(password: String, confirm: String!): Boolean!
    exportUserData(password: String): String

    register(
      username: String!
      email: String!
      password: String!
      referrerId: ID
    ): AuthPayload!

    # ── Collection ──────────────────────────────────────────────────────────────
    addToCollection(cardId: String!, quantity: Int, condition: String, variation: String): CollectionEntry!
    updateCollectionEntry(cardId: String!, quantity: Int, condition: String, variation: String): CollectionEntry!
    removeFromCollection(cardId: String!, variation: String): Boolean!
    moveToWishlist(cardId: String!, variation: String): Boolean!
    moveToCollection(cardId: String!, variation: String): CollectionEntry!
    bulkAddToCollection(cards: [BulkAddCardInput!]!): BulkAddResult!
    cardsearchBulkAddToCollection(input: CardsearchBulkAddInput!): CardsearchBulkAddResult!

    # ── Notifications ────────────────────────────────────────────────────────────
    markNotificationRead(id: ID!): Boolean
    markAllNotificationsRead: Boolean
    dismissNotification(id: ID!): Boolean
    setNotificationPrefs(
      inappEnabled: Boolean
      emailEnabled: Boolean
      pushEnabled: Boolean
      digest: String
      quietStart: String
      quietEnd: String
    ): Boolean
    subscribeWebPush(endpoint: String!, p256dh: String!, auth: String!, userAgent: String): Boolean
    unsubscribeWebPush(endpoint: String!): Boolean

    # ── Messaging ────────────────────────────────────────────────────────────────
    sendMessage(receiverId: ID!, content: String!, meta: JSON): Message!
    markChatRead(userId: ID!): Boolean
    deleteChat(userId: ID!): Boolean
    reportUser(userId: ID!, reason: String!, details: String): Boolean
    reportMessage(messageId: ID!, reason: String!, details: String): Boolean
    agreeToChatRules: Boolean!
    agreeToMarketplaceRules: Boolean!
    muteConversation(userId: ID!, mutedUntil: String): Boolean!
    unmuteConversation(userId: ID!): Boolean!
    blockUserFromChat(userId: ID!, reason: String): Boolean!
    unblockUserFromChat(userId: ID!): Boolean!
    adminBanUserFromChat(userId: ID!, reason: String): Boolean!
    adminUnbanUserFromChat(userId: ID!): Boolean!
    adminDeleteMessage(id: ID!): Boolean!
    adminClearUserReport(userId: ID!): Boolean!

    # ── Price Alerts ──────────────────────────────────────────────────────────────
    upsertPriceAlert(input: UpsertPriceAlertInput!): PriceAlert!
    deletePriceAlert(id: ID!): Boolean!
    togglePriceAlert(id: ID!, active: Boolean!): Boolean!

    # ── Subscriptions / Payments ─────────────────────────────────────────────────
    createSubscription(planId: ID!): SubscriptionCheckoutResult!
    cancelSubscription: Boolean!
    resumeSubscription: UserSubscription!
    updateSubscription(planId: ID!): UserSubscription!

    # ── Wallet ────────────────────────────────────────────────────────────────────
    """
    Creates a Stripe PaymentIntent for a wallet top-up.
    Returns a clientSecret — pass it to Stripe.js to complete the payment.
    amountPence must be an integer (e.g. 1000 = £10). Min £5, max £200.
    """
    createTopupIntent(amountPence: Int!): TopupIntent!
    confirmTopup(paymentIntentId: String!): Wallet!
    """
    Request a wallet withdrawal. Debits the balance immediately and queues
    a pending bank transfer (processed within 1–3 business days).
    amountPence must be a positive integer. Minimum £10 (1000p).
    """
    requestWithdrawal(amountPence: Int!, sortCode: String!, accountNumber: String!, accountName: String): WithdrawalRequest!
    adminCompleteWithdrawal(id: ID!): Boolean!
    adminRejectWithdrawal(id: ID!, reason: String): Boolean!

    # ── Trading ───────────────────────────────────────────────────────────────────
    initiateTrade(userId: ID!, offeredCards: [TradeCardInput!], wantedCards: [TradeCardInput!], topUpAmount: Float): Trade!
    respondToTrade(id: ID!, accept: Boolean!, counterCards: [TradeCardInput!], reason: String): Trade!
    cancelTrade(id: ID!, reason: String): Trade!
    uploadTradeProof(id: ID!, proofImage: String!, proofCode: String): TradeProofResult!
    setTradeShippingAddress(id: ID!, address: JSON!): Boolean!
    shipTrade(id: ID!, parcelSize: String): ShipTradeResult!
    submitTradeTracking(id: ID!, trackingNumber: String!): Trade!
    confirmTradeReceived(id: ID!): Trade!
    raiseTradeDispute(id: ID!, reason: String!): TradeDisputeResult!
    leaveTradeFeedback(id: ID!, rating: Int!, review: String): Boolean!
    adminResolveTradeDispute(id: ID!, resolution: String!, resolvedInFavourOf: String): Trade!
    adminApproveTradeProof(id: ID!, proofId: ID!, party: String!): Boolean!
    adminBanUserFromTrading(userId: ID!, reason: String): Boolean!
    adminUnbanUserFromTrading(userId: ID!): Boolean!

    # ── Binder (slot) ─────────────────────────────────────────────────────────────
    addBinderPage(binderId: ID!, input: BinderPageInput!): BinderPageType!
    addCardToBinder(pageId: ID!, input: BinderSlotInput!): BinderSlot!

    # ── Marketplace ───────────────────────────────────────────────────────────────
    createListing(input: CreateListingInput!): CardListing!
    createBulkLot(input: CreateBulkLotInput!): CardListing!
    updateListing(id: ID!, input: UpdateListingInput!): CardListing!
    createBulkListings(listings: [BulkListingItemInput!]!): BulkListingResult!
    submitBulkProof(batchId: ID!, image: String!): BulkProofResult!
    deleteListing(id: ID!): Boolean!
    submitListingProof(id: ID!, image: String!): SubmitProofResult!
    createOrderFromListing(input: CreateOrderFromListingInput!): Order!
    submitOrderTracking(id: ID!, trackingNumber: String!, carrier: String): Order!
    shipOrder(id: ID!): ShipOrderResult!
    confirmOrderReceived(id: ID!): Order!
    raiseOrderDispute(id: ID!, reason: String!): Order!
    cancelOrder(id: ID!, reason: String): Order!
    leaveOrderFeedback(id: ID!, rating: Int!, review: String): Boolean!
    disputeOrderReview(id: ID!, reason: String): Boolean!
    connectStripe: StripeConnectResult!
    updateSellerAddress(input: SellerAddressInput!): Boolean!
    createOffer(listingId: ID!, amount: Float!, message: String): Offer!
    respondToOffer(offerId: ID!, action: String!, counterAmount: Float, counterMessage: String, buyerAddress: JSON): RespondToOfferResult!
    withdrawOffer(offerId: ID!): Boolean!

    # ── Admin ─────────────────────────────────────────────────────────────────────
    adminGrantAchievement(userId: ID!, achievementId: ID!, data: JSON): UserAchievement!
    shareCollectionToDiscord(guildId: String!, channelId: String!, cardId: String!, cardName: String!, variation: String, quantity: Int, imageUrl: String): Boolean!
    shareWishlistToDiscord(guildId: String!, channelId: String!, cardId: String!, cardName: String!, variation: String, imageUrl: String): Boolean!
    createCartOrders(items: [CartItemInput!]!, walletAmountPence: Int): CartOrderResult!
    applyWalletToOrder(orderId: ID!, walletAmountPence: Int!): ApplyWalletResult!

    # ── Admin ─────────────────────────────────────────────────────────────────────
    adminBanUser(id: ID!): Boolean!
    adminUnbanUser(id: ID!): Boolean!
    adminDeleteUser(id: ID!): Boolean!
    adminDeleteBinder(id: ID!, permanent: Boolean): Boolean!
    adminSendBroadcastNotification(input: BroadcastNotificationInput!): Boolean!
    adminDeleteNotification(id: ID!): Boolean!
    adminUpdateOrderFulfilmentStatus(orderId: ID!, status: String!): Order!
    adminApproveProof(id: ID!): Boolean!
    adminRejectProof(id: ID!, reason: String): Boolean!
    adminResolveDispute(id: ID!, resolution: String!, resolvedInFavourOf: String!): Boolean!
    adminResolveReview(listingId: ID!, action: String!): Boolean!
    adminCancelSubscription(id: ID!): Boolean!
    adminResumeSubscription(id: ID!): Boolean!
    adminChangePlan(id: ID!, planId: ID!): Boolean!
    adminGrantSubscription(userId: ID!, planId: ID!, periodDays: Int): Boolean!
    adminRevokeSubscription(id: ID!): Boolean!
    adminUpdatePlan(id: ID!, input: PlanInput!): SubscriptionPlan!
    adminCreateProductListing(input: ProductListingInput!): ProductListing!
    adminUpdateProductListing(id: ID!, input: ProductListingInput!): ProductListing!
    adminSendSystemMessage(receiverId: ID!, content: String!, meta: JSON): Message!
    grantReward(userId: ID!, type: String!, achievementId: ID, data: JSON): Reward!

    # ── Safety ────────────────────────────────────────────────────────────────────
    updateSafetyProfile(dob: String, parentEmail: String): SafetyProfileResult!
    requestParentVerification: SafetyProfileResult!
    adminSetUserRestriction(userId: ID!, restrictionLevel: String): SafetyProfile!
    adminSetParentVerified(userId: ID!, verified: Boolean!): SafetyProfile!
    adminClearParentLink(userId: ID!): Boolean!

    # ── Shipping ──────────────────────────────────────────────────────────────────
    createShippingLabel(to: JSON!, from: JSON!, parcel: JSON!, parcelSize: String, shipmentId: String, rateId: String!, relatedType: String, relatedId: ID): ShippingLabel!
    cancelShippingLabel(id: ID!): Boolean!

    # ── Push Notifications ────────────────────────────────────────────────────────
    registerExpoPushToken(expoPushToken: String!, platform: String, deviceName: String, appVersion: String): Boolean!
    unregisterExpoPushToken(expoPushToken: String!): Boolean!
    sendTestPush(title: String!, body: String!): Boolean!

    # ── Wishlist ────────────────────────────────────────────────────────────────
    addToWishlist(cardId: String!, quantity: Int, variation: String, notes: String, status: WishlistStatus): WishlistEntry!
    updateWishlistEntry(cardId: String!, variation: String, quantity: Int, notes: String, status: WishlistStatus): WishlistEntry!
    removeFromWishlist(cardId: String!, variation: String): Boolean!

    # ── Binder ──────────────────────────────────────────────────────────────────
    createBinder(input: BinderInput!): Binder!
    updateBinder(id: ID!, input: BinderInput!): Binder!
    deleteBinder(id: ID!, permanent: Boolean): Boolean!
    saveBinderPagesAndSlots(binderId: ID!, pages: [BinderPageInput!]!): Binder!
  }

  # ── Infrastructure ────────────────────────────────────────────────────────────

  type HealthStatus {
    status: String!
    service: String!
  }

  type DependencyStatus {
    ok: Boolean!
    status: String!
    error: String
    name: String
    code: String
    errno: Int
    sqlState: String
    sqlMessage: String
  }

  type ServiceHealth {
    gateway: HealthStatus!
    auth: JSON
    catalog: JSON
  }

  # ── Auth / User ───────────────────────────────────────────────────────────────

  """
  Canonical user type. Covers both the new tcg-runtime fields and legacy
  tcg-binder fields so all existing frontend queries continue to work.
  """
  type User {
    id: ID
    username: String
    email: String
    emailVerified: Boolean
    isAdmin: Boolean
    chatBanned: Boolean
    restrictionLevel: String

    # 2FA — exposed under both names for compatibility
    twoFactorEnabled: Boolean
    mfaEnabled: Boolean

    # Profile
    avatar: String

    # OAuth
    oauthProvider: String
    oauthId: String
    discordId: String
    discordUsername: String

    # Safety / parental controls
    dob: String
    parentEmail: String
    parentVerifiedAt: String
    capabilities: Capabilities

    # Timestamps
    lastLogin: String
    createdAt: String
    updatedAt: String

    # Preview lists for the profile tabs (full lists, no server-side cap).
    # Available both on the me query and on userProfile.user.
    cardsPreview: [CollectionEntry!]
    wishlistPreview: [WishlistEntry!]
    forSalePreview: [CardListing!]
    forTradePreview: [CardListing!]
  }

  # Keep AuthUser as an alias so any existing internal code still compiles.
  type AuthUser {
    id: ID
    username: String
    email: String
    isAdmin: Boolean
    emailVerified: Boolean
    twoFactorEnabled: Boolean
    mfaEnabled: Boolean
    avatar: String
    lastLogin: String
    createdAt: String
    updatedAt: String
  }

  type AuthPayload {
    token: String
    refreshToken: String
    user: User
  }

  type TwoFactorSetup {
    otpauthUrl: String!
    qrCodeDataURL: String!
  }

  # ── User profile & achievements ───────────────────────────────────────────────

  type UserProfile {
    id: ID
    userId: ID
    bio: String
    favouritePokemon: String
    avatar: String
    country: String
    status: String
    publicProfile: Boolean
    wantsTrade: Boolean
    wantsMarketplace: Boolean
    address1: String
    address2: String
    city: String
    postcode: String
    state: String
    user: User
    planName: String
  }

  """Minimal public user shape returned by search."""
  type PublicUser {
    id: ID
    username: String
    avatar: String
    bio: String
    country: String
    createdAt: String
  }

  type Achievement {
    id: ID
    code: String
    name: String
    description: String
    tier: String
    iconUrl: String
    createdAt: String
    updatedAt: String
  }

  type UserAchievement {
    id: ID
    earnedAt: String
    achievement: Achievement
  }

  # ── Catalog / Card types ──────────────────────────────────────────────────────

  type CardSet {
    code: String
    abbr: String
    name: String
    series: String
    releasedAt: String
    lang: String
    total: Int
  }

  type CardImage {
    large: String
    small: String
  }

  type CardSetRef {
    code: String
    name: String
    releaseDate: String
  }

  type CardVariant {
    key: String
    default: Boolean
    label: String
  }

  type CardPrice {
    variation: String
    currency: String
    gbp: Float
    market: Float
    mid: Float
    low: Float
    high: Float
    updatedAt: String
    provider: String
  }

  type CardsearchItem {
    cardId: String
    id: ID
    setCode: String
    number: String
    name: String
    rarity: String
    images: CardImage
    set: CardSetRef
    variants: [CardVariant]
    latestPrices: [CardPrice]
  }

  type CardsearchDetail {
    cardId: String
    id: ID
    setCode: String
    number: String
    name: String
    rarity: String
    images: CardImage
    set: CardSetRef
    variants: [CardVariant]
    latestPrices: [CardPrice]
  }

  type CardSearchResult {
    total: Int!
    limit: Int!
    offset: Int!
    items: [CardsearchItem!]!
  }

  input CardSearchInput {
    query: String
    name: String
    set: String
    setCode: String
    number: String
    rarity: String
    limit: Int
    offset: Int
  }

  type PriceObservation {
    date: String
    market: Float
    mid: Float
    low: Float
    high: Float
  }

  type PricePeriodStats {
    avg: Float
    change: Float
    changePct: Float
    min: Float
    max: Float
  }

  type PriceLatest {
    date: String
    market: Float
    mid: Float
  }

  type PriceRollup {
    variant: String
    currency: String
    latest: PriceLatest
    d7: PricePeriodStats
    d30: PricePeriodStats
    d90: PricePeriodStats
  }

  # ── Price Alerts ─────────────────────────────────────────────────────────────

  type PriceAlert {
    id: ID!
    cardId: String!
    variation: String
    condition: String
    currency: String
    value: Float
    windowHours: Int
    cooldownHours: Int
    isActive: Boolean!
    lastFiredAt: String
    createdAt: String
    updatedAt: String
  }

  input UpsertPriceAlertInput {
    id: ID
    cardId: String
    variation: String
    condition: String
    currency: String
    value: Float
    windowHours: Int
    cooldownHours: Int
    isActive: Boolean
  }

  # ── Notifications ─────────────────────────────────────────────────────────────

  input NotificationFilterInput {
    isRead: Boolean
    isDismissed: Boolean
    type: String
  }

  type Notification {
    id: ID!
    type: String
    title: String
    body: String
    iconUrl: String
    linkUrl: String
    isRead: Boolean
    isDismissed: Boolean
    createdAt: String
  }

  type NotificationPage {
    notifications: [Notification!]!
    total: Int!
    page: Int!
    pageSize: Int!
  }

  type NotificationPrefs {
    inappEnabled: Boolean
    emailEnabled: Boolean
    pushEnabled: Boolean
    digest: String
    quietStart: String
    quietEnd: String
  }

  # ── Messaging ─────────────────────────────────────────────────────────────────

  type Message {
    id: ID!
    senderId: ID
    receiverId: ID
    content: String
    createdAt: String
    isRead: Boolean
    isSystemMessage: Boolean
    meta: JSON
  }

  type ChatThread {
    userId: ID
    user: User
    lastMessage: Message
    unreadCount: Int
  }

  type ChatMute {
    id: ID!
    userId: ID
    otherUserId: ID
    mutedUntil: String
    createdAt: String
  }

  type ChatBlock {
    id: ID!
    blockerId: ID
    blockedId: ID
    reason: String
    createdAt: String
  }

  # ── Marketplace ───────────────────────────────────────────────────────────────

  """
  Common interface implemented by every listing type (card, product).
  Querying shared fields at the top level of a listings result is valid
  because both CardListing and ProductListing implement this interface.
  """
  interface ListingBase {
    id: ID!
    type: String
    price: Float
    currency: String
    quantity: Int
    condition: String
    allowOffers: Boolean
    status: String
    createdAt: String
    updatedAt: String
  }

  enum ListingStatus {
    PENDING_PROOF
    ACTIVE
    SOLD
    CANCELLED
    REMOVED
  }

  """Minimal card data enriched from the catalog service onto a CardListing."""
  type CardInfo {
    id: String
    name: String
    number: String
    rarity: String
    setName: String
    imageSmall: String
    imageLarge: String
  }

  type CardListing implements ListingBase {
    id: ID!
    type: String
    sellerId: ID
    seller: PublicUser
    cardId: String
    title: String
    description: String
    condition: String
    variant: String
    variation: String
    price: Float
    currency: String
    quantity: Int
    status: String
    shippingType: String
    shippingPrice: Float
    parcelSize: String
    labelPaidBy: String
    allowOffers: Boolean
    offerMinPrice: Float
    willTrade: Boolean
    proofCode: String
    proofImageUrl: String
    moderationResult: String
    proofImagePath: String
    rating: Int
    pendingOfferCount: Int
    createdAt: String
    updatedAt: String
    cardInfo: CardInfo

    # Bulk-lot fields (null for SINGLE listings)
    listingKind: ListingKind
    conditionMin: String
    conditionMax: String
    cardCount: Int
    isReturnable: Boolean
    lotPhotoPath: String
    proofCodeExpiresAt: String
    guaranteedInclusions: [GuaranteedInclusion!]
    items: [CardListingItem!]
  }

  enum ListingKind {
    SINGLE
    BULK_TRACKED
    BULK_RANDOM
  }

  type GuaranteedInclusion {
    description: String!
    quantity: Int!
  }

  type CardListingItem {
    id: ID!
    cardId: String!
    variant: String
    condition: String
    quantity: Int!
  }

  type OrderLineItem {
    cardId: String!
    variant: String
    condition: String
    quantity: Int!
  }

  type Order {
    id: ID!
    # Alias fields the frontend expects
    orderNumber: String
    total: Float
    paidAt: String
    shippingAddressJson: JSON
    paymentMethod: String
    buyerEmail: String
    buyerName: String
    guestCheckout: Boolean
    # Nested objects
    buyer: PublicUser
    seller: PublicUser
    listing: ListingBase
    # Bulk-tracked snapshot of what was in the lot at sale time
    items: [OrderLineItem!]
    # Stripe client secret — present immediately after createOrderFromListing
    clientSecret: String
    # Wallet contribution in pence
    walletAmountPence: Int
    # Raw model fields
    listingId: ID
    buyerId: ID
    sellerId: ID
    cardId: String
    salePrice: Float
    platformFee: Float
    shippingCost: Float
    totalAmount: Float
    currency: String
    status: String
    paymentStatus: String
    fulfilmentStatus: String
    trackingNumber: String
    trackingCarrier: String
    shippingLabelUrl: String
    buyerAddressJson: JSON
    metadataJson: JSON
    shippedAt: String
    completedAt: String
    cancelledAt: String
    createdAt: String
    updatedAt: String
    dispute: OrderDispute
  }

  type OrderDispute {
    id: ID!
    orderId: ID
    raisedBy: ID
    reason: String
    status: String
    resolution: String
    resolvedInFavourOf: String
    escrowActionTaken: String
    resolvedAt: String
    createdAt: String
    updatedAt: String
  }

  type ReviewQueueItem {
    id: ID!
    sellerId: ID!
    cardId: String
    rating: Int!
    review: String
    reviewStatus: String!
    disputeReason: String
    updatedAt: String
  }

  type SellerReputation {
    userId: ID!
    score: Int!
    positive: Int!
    negative: Int!
    neutral: Int!
    completedMarketplace: Int!
    flagged: Boolean!
  }

  type SellerReview {
    cardId: String
    rating: Int!
    review: String
    createdAt: String
  }

  type SellerStatus {
    connected: Boolean!
    complete: Boolean!
    url: String
  }

  type SellerAddress {
    name: String
    line1: String
    line2: String
    city: String
    postcode: String
    country: String
    phone: String
    email: String
  }

  input SellerAddressInput {
    name: String!
    line1: String!
    line2: String
    city: String!
    postcode: String!
    country: String
    phone: String
    email: String
  }

  type ApplyWalletResult {
    ok: Boolean!
    clientSecret: String
    walletAmountPence: Int!
    cardTotal: Float!
  }

  type ShipOrderResult {
    ok: Boolean!
    trackingNumber: String
    trackingUrl: String
    labelUrl: String
    labelBase64: String
    carrier: String
    service: String
    labelCost: Float
  }

  type StripeConnectResult {
    accountId: String
    url: String
    alreadyConnected: Boolean
  }

  type SubmitProofResult {
    ok: Boolean!
    result: String!
    newProofCode: String
  }

  type BulkListingResult {
    batchId: ID!
    proofCode: String!
    proofCodeExpiresAt: String
    count: Int!
    listings: [CardListing!]!
  }

  type BulkProofResult {
    ok: Boolean!
    result: String!
    activated: Int!
    newProofCode: String
  }

  input BulkListingItemInput {
    cardId: String!
    title: String!
    description: String
    condition: String!
    variant: String
    price: Float
    currency: String
    quantity: Int
    shippingType: String
    shippingPrice: Float
    parcelSize: String
    labelPaidBy: String
    allowOffers: Boolean
    offerMinPrice: Float
    willTrade: Boolean
  }

  type Offer {
    id: ID!
    listingId: ID
    buyerId: ID
    amount: Float
    message: String
    status: String
    expiresAt: String
    respondedAt: String
    counterAmount: Float
    counterMessage: String
    listing: CardListing
    buyer: PublicUser
    createdAt: String
    updatedAt: String
  }

  type RespondToOfferResult {
    ok: Boolean!
    status: String
    orderId: ID
    clientSecret: String
    totalAmount: Float
    counterAmount: Float
  }

  enum ListingType {
    CARD
    PRODUCT
  }

  type InventoryItem {
    id: ID!
    onHand: Int
    reserved: Int
    sold: Int
  }

  type ProductListing implements ListingBase {
    id: ID!
    type: String
    condition: String
    title: String
    description: String
    imageUrl: String
    imagesJson: JSON
    colourVariantsJson: JSON
    inventory: InventoryItem
    fulfilmentType: String
    fulfilmentProvider: String
    fulfilmentExternalId: String
    seller: PublicUser
    sellerId: ID
    price: Float
    currency: String
    quantity: Int
    status: String
    allowOffers: Boolean
    createdAt: String
    updatedAt: String
  }

  input ProductListingInput {
    title: String!
    description: String
    imageUrl: String
    imagesJson: JSON
    colourVariantsJson: JSON
    price: Float!
    currency: String
    quantity: Int
    status: String
    fulfilmentType: String
    fulfilmentProvider: String
    fulfilmentExternalId: String
  }

  input CreateListingInput {
    cardId: String!
    title: String!
    description: String
    condition: String!
    variant: String
    price: Float
    currency: String
    quantity: Int
    shippingType: String
    shippingPrice: Float
    parcelSize: String
    labelPaidBy: String
    allowOffers: Boolean
    offerMinPrice: Float
    willTrade: Boolean
  }

  # ─── Bulk-lot inputs ──────────────────────────────────────────────────────────
  # One listing representing a whole lot (tracked from the seller's collection
  # or a seller-declared random lot). Forwarded to marketplace-service's
  # POST /listings endpoint.
  input CreateBulkLotInput {
    listingKind: ListingKind!
    title: String!
    description: String
    price: Float!
    currency: String

    # Condition range covers the whole lot
    conditionMin: String!
    conditionMax: String!
    cardCount: Int!

    guaranteedInclusions: [GuaranteedInclusionInput!]

    # Shipping
    parcelSize: String
    labelPaidBy: String
    shippingType: String
    shippingPrice: Float

    allowOffers: Boolean

    # BULK_TRACKED only — the actual card rows that make up the lot
    items: [BulkLotItemInput!]

    # BULK_RANDOM only — either a pre-uploaded path or a base64 data URL
    lotPhotoPath: String
    lotPhotoBase64: String
  }

  input BulkLotItemInput {
    cardId: String!
    variant: String
    condition: String
    quantity: Int
  }

  input GuaranteedInclusionInput {
    description: String!
    quantity: Int!
  }

  input UpdateListingInput {
    title: String
    description: String
    price: Float
    quantity: Int
    condition: String
    variant: String
    shippingType: String
    shippingPrice: Float
    parcelSize: String
    labelPaidBy: String
    allowOffers: Boolean
    offerMinPrice: Float
    willTrade: Boolean
  }

  input CreateOrderFromListingInput {
    listingId: ID!
    buyerAddress: JSON
    shippingRateId: String
    shipmentId: String
  }

  type CardsearchBulkAddItem {
    cardId: String
    quantity: Int
    created: Boolean
    previousQuantity: Int
    newQuantity: Int
    error: String
  }

  type CardsearchBulkAddResult {
    ok: Boolean
    message: String
    items: [CardsearchBulkAddItem]
  }

  input CardsearchBulkAddInput {
    cards: [BulkAddCardInput!]!
  }

  # ── Collection ────────────────────────────────────────────────────────────────

  type CardSetCompletion {
    ownedCardIds: [String!]!
    total: Int!
  }

  type CollectionEntry {
    id: ID!
    userId: ID!
    cardId: String!
    quantity: Int!
    condition: String
    variation: String
    wishlist: Boolean
    createdAt: String
    updatedAt: String
    card: CatalogCard
  }

  input BulkAddCardInput {
    cardId: String!
    quantity: Int
    condition: String
    variation: String
  }

  type BulkAddResult {
    added: Int!
    entries: [CollectionEntry!]!
  }

  # ── Wishlist ──────────────────────────────────────────────────────────────────

  enum WishlistStatus {
    ACTIVE
    GRAIL
    EVENTUAL
    UPGRADE
  }

  type WishlistEntry {
    id: ID!
    userId: ID!
    cardId: String!
    quantity: Int!
    variation: String
    notes: String
    status: WishlistStatus!
    addedAt: String
    createdAt: String
    updatedAt: String
    card: CatalogCard
  }

  type WishlistPage {
    entries: [WishlistEntry!]!
    total: Int!
    page: Int!
    pageSize: Int!
  }

  # ── Binder ────────────────────────────────────────────────────────────────────

  type Binder {
    id: ID!
    userId: ID!
    name: String!
    description: String
    coverColor: String
    accentColor: String
    visibility: String!
    slug: String!
    isDeleted: Boolean
    createdAt: String
    updatedAt: String
    pages: [BinderPageType!]
  }

  type BinderPageType {
    id: ID!
    binderId: ID!
    title: String
    layout: String!
    pageOrder: Int!
    createdAt: String
    updatedAt: String
    slots: [BinderSlot!]
  }

  type BinderSlot {
    id: ID!
    pageId: ID!
    cardId: String!
    quantity: Int!
    position: Int!
    notes: String
    card: CatalogCard
  }

  type BinderPage {
    binders: [Binder!]!
    total: Int!
    page: Int!
    pageSize: Int!
  }

  input BinderInput {
    name: String
    description: String
    coverColor: String
    accentColor: String
    visibility: String
  }

  input BinderPageInput {
    id: ID
    layout: String
    title: String
    pageOrder: Int
    slots: [BinderSlotInput!]
  }

  input BinderSlotInput {
    id: ID
    cardId: String!
    position: Int!
    quantity: Int
    notes: String
  }

  # ── Subscriptions / Payments ─────────────────────────────────────────────────

  type SubscriptionPlan {
    id: ID!
    name: String
    description: String
    price: Float
    priceMonthly: Float
    priceYearly: Float
    currency: String
    interval: String
    platformFeePercent: Float
    feeDiscount: Int
    maxBinders: Int
    maxCollectionCards: Int
    maxActiveListings: Int
    maxActiveTrades: Int
    features: JSON
    featuresJson: JSON
    isActive: Boolean
    active: Boolean
    sortOrder: Int
    stripePriceIdMonthly: String
    stripePriceIdYearly: String
    createdAt: String
    updatedAt: String
  }

  type UserCapabilities {
    planName: String!
    platformFeePercent: Float!
    maxBinders: Int
    maxCollectionCards: Int
    maxActiveListings: Int
    maxActiveTrades: Int
    features: JSON
  }

  type UserSubscription {
    id: ID!
    userId: ID
    planId: ID
    plan: SubscriptionPlan
    status: String
    currentPeriodStart: String
    currentPeriodEnd: String
    cancelAtPeriodEnd: Boolean
    cancelledAt: String
    stripeSubscriptionId: String
    createdAt: String
    updatedAt: String
  }

  type SubscriptionPortal {
    url: String!
  }

  """Returned by createSubscription — redirect the user to url to complete payment."""
  type SubscriptionCheckoutResult {
    url: String!
    sessionId: String!
  }

  type AdminSubscriptionPage {
    subscriptions: [UserSubscription!]!
    total: Int!
    page: Int!
    pageSize: Int!
  }

  type AdminTransactionPage {
    transactions: [PaymentTransaction!]!
    total: Int!
    page: Int!
    pageSize: Int!
  }

  type AdminRevenueSummary {
    totalRevenue: Float!
    revenue30d: Float!
    revenue7d: Float!
    subRevenue: Float!
    productRevenue: Float!
    refunds: Float!
    currency: String!
  }

  type AdminMarketplaceRevenueMonth {
    month: String!
    gmv: Float!
    fees: Float!
    orders: Int!
  }

  type AdminMarketplaceRevenue {
    gmv: Float!
    platformFees: Float!
    shippingCollected: Float!
    walletUsed: Float!
    refundedTotal: Float!
    stripeFeeEstimate: Float!
    gmv30d: Float!
    gmv7d: Float!
    platformFees30d: Float!
    totalOrders: Int!
    completedOrders: Int!
    openDisputes: Int!
    resolvedDisputes: Int!
    monthly: [AdminMarketplaceRevenueMonth!]!
    currency: String!
  }

  input PlanInput {
    name: String
    description: String
    price: Float
    interval: String
    platformFeePercent: Float
    feeDiscount: Int
    maxBinders: Int
    maxActiveListings: Int
    maxActiveTrades: Int
    active: Boolean
    sortOrder: Int
  }

  # ── Wallet ────────────────────────────────────────────────────────────────────

  type WalletTx {
    id: ID!
    type: String!
    amountPence: Int!
    amount: Float!
    currency: String!
    status: String!
    description: String
    relatedTradeId: ID
    stripePaymentIntentId: String
    createdAt: String
  }

  type Wallet {
    balancePence: Int!
    balance: Float!
    heldPence: Int!
    held: Float!
    currency: String!
    transactions: [WalletTx!]!
    total: Int!
  }

  """Returned by createTopupIntent — pass clientSecret to Stripe.js to confirm payment."""
  type TopupIntent {
    clientSecret: String!
    paymentIntentId: String!
  }

  """Returned by requestWithdrawal — the pending withdrawal transaction."""
  type WithdrawalRequest {
    id: ID!
    amountPence: Int!
    amount: Float!
    status: String!
    description: String
    createdAt: String
  }

  """A withdrawal record as seen by the admin (includes bank details)."""
  type AdminWithdrawal {
    id: ID!
    userId: ID!
    amountPence: Int!
    amount: Float!
    status: String!
    description: String
    sortCode: String
    accountNumber: String
    accountName: String
    createdAt: String
  }

  type AdminWithdrawalList {
    total: Int!
    withdrawals: [AdminWithdrawal!]!
  }

  type PaymentTransaction {
    id: ID!
    userId: ID
    type: String
    amount: Float
    currency: String
    status: String
    stripePaymentIntentId: String
    description: String
    meta: JSON
    createdAt: String
    updatedAt: String
  }

  # ── Trading ───────────────────────────────────────────────────────────────────

  enum TradeStatus {
    INITIATED
    NEGOTIATING
    AGREED
    PROOF_PENDING
    LOCKED
    IN_TRANSIT
    COMPLETED
    CANCELLED
    DISPUTED
  }

  type TradeCard {
    id: ID!
    tradeId: ID
    userId: ID
    cardId: String
    quantity: Int
    condition: String
    variation: String
  }

  type TradeProof {
    id: ID!
    tradeId: ID
    userId: ID
    proofImagePath: String
    proofCode: String
    uploadedAt: String
    moderationResult: String
    moderatedAt: String
  }

  type TradeDispute {
    id: ID!
    tradeId: ID
    raisedById: ID
    reason: String
    status: String
    resolution: String
    resolvedAt: String
    createdAt: String
  }

  type TradeShippingQuote {
    amountPence: Int!
    amount: Float!
    currency: String!
    carrier: String
    service: String
  }

  type ShipTradeResult {
    ok: Boolean!
    trackingNumber: String
    trackingUrl: String
    labelUrl: String
    labelBase64: String
    carrier: String
    service: String
    labelCost: Float
    labelCostPence: Int
  }

  type Trade {
    id: ID!
    partyAId: ID
    partyBId: ID
    initiatorId: ID
    status: TradeStatus
    counterCount: Int
    lastCounterBy: ID
    agreedAt: String
    lockedAt: String
    completedAt: String
    cancelledAt: String
    cancelledBy: ID
    cancelledReason: String
    disputeId: ID
    adminNotes: String
    topUpAmount: Float
    topUpPaidBy: ID
    proofAVerified: Boolean
    proofBVerified: Boolean
    trackingNumberA: String
    trackingNumberB: String
    addressASet: Boolean
    addressBSet: Boolean
    createdAt: String
    updatedAt: String
    cards: [TradeCard!]
    proofs: [TradeProof!]
    dispute: TradeDispute
  }

  type TradeBan {
    userId: ID!
    reason: String
    bannedBy: ID
    bannedAt: String
  }

  type TradeProofResult {
    proof: TradeProof
    trade: Trade
  }

  type TradeDisputeResult {
    dispute: TradeDispute
    trade: Trade
  }

  input TradeCardInput {
    cardId: String!
    quantity: Int
    condition: String
    variation: String
  }

  # ── Safety ────────────────────────────────────────────────────────────────────

  type Capabilities {
    canTrade: Boolean
    canPost: Boolean
    canMessage: Boolean
    canConnectDiscord: Boolean
    canBuyMarketplace: Boolean
    canSellMarketplace: Boolean
    canUseCollection: Boolean
    canShareToDiscord: Boolean
    isMinor: Boolean
    requiresParentApproval: Boolean
    restrictionLevel: String
  }

  type SafetyProfile {
    dob: String
    parentEmail: String
    parentVerifiedAt: String
    restrictionLevel: String
    capabilities: Capabilities
  }

  # Returned by updateSafetyProfile and requestParentVerification mutations
  type SafetyResultUser {
    id: ID
    dob: String
    parentEmail: String
    parentVerifiedAt: String
    capabilities: Capabilities
  }

  type SafetyProfileResult {
    ok: Boolean!
    error: String
    user: SafetyResultUser
  }

  # ── Shipping ──────────────────────────────────────────────────────────────────

  type ShippingRate {
    id: ID
    shipmentId: String
    carrier: String
    service: String
    collectionType: String
    estimatedDays: Int
    estimatedDate: String
    cutOff: String
    amount: Float
    currency: String
    trackingAvailable: Boolean
    qrAvailable: Boolean
  }

  type ShippingLabel {
    id: ID!
    carrier: String
    service: String
    trackingNumber: String
    labelUrl: String
    qrCodeUrl: String
    status: String
    trackingStatus: String
    amount: Float
    currency: String
    refundStatus: String
    deliveredAt: String
    lastTrackedAt: String
    createdAt: String
  }

  type TrackingEvent {
    description: String!
    dateTime: String
    status: String
  }

  type ShippingLabelTracking {
    labelId: ID!
    trackingNumber: String
    trackingUrl: String
    # Normalised status: booked | collected | in_transit | out_for_delivery |
    #                    delivered | failed_delivery | returned
    status: String!
    events: [TrackingEvent!]!
  }

  # ── Rewards ───────────────────────────────────────────────────────────────────

  type Reward {
    id: ID!
    userId: ID
    type: String
    achievementId: ID
    data: JSON
    grantedBy: ID
    createdAt: String
    updatedAt: String
  }

  # ── Audit Logs ────────────────────────────────────────────────────────────────

  type AuditLog {
    id: ID!
    userId: ID
    action: String
    targetId: String
    targetType: String
    details: JSON
    ip: String
    userAgent: String
    createdAt: String
    updatedAt: String
  }

  # ── Admin ─────────────────────────────────────────────────────────────────────

  type AdminUser {
    id: ID!
    username: String
    email: String
    isAdmin: Boolean
    isBanned: Boolean
    emailVerified: Boolean
    createdAt: String
    lastLogin: String
    profile: UserProfile
  }

  type AdminBinder {
    id: ID!
    userId: ID
    username: String
    name: String
    visibility: String
    isDeleted: Boolean
    createdAt: String
  }

  type UserCollectionSummary {
    userId: ID!
    username: String
    email: String
    totalCards: Int
    distinctCards: Int
  }

  type ReportedUser {
    id: ID!
    userId: ID
    reporterId: ID
    reason: String
    details: String
    isCleared: Boolean
    createdAt: String
    updatedAt: String
    user: PublicUser
    reporter: PublicUser
  }

  input BroadcastNotificationInput {
    type: String
    title: String!
    body: String!
    iconUrl: String
    linkUrl: String
  }

  # ── Shared ────────────────────────────────────────────────────────────────────

  type CatalogCard {
    id: ID
    cardId: String
    name: String
    number: String
    setCode: String
    rarity: String
    supertype: String
    subtype: String
    images: CardImage
    set: CardSetRef
    variants: [CardVariant]
    latestPrices: [CardPrice]
  }

  # ── Discord Share ─────────────────────────────────────────────────────────────

  type DiscordGuild {
    id: String!
    name: String!
    icon: String
    botPresent: Boolean
  }
  type DiscordChannel {
    id: String!
    name: String!
    type: Int
  }

  # ── Cart checkout ─────────────────────────────────────────────────────────────

  input CartItemInput {
    listingId: ID!
    buyerAddress: JSON!
    shippingRateId: String
    shipmentId: String
  }
  type CartOrderError {
    listingId: ID!
    error: String!
  }
  type CartOrderResult {
    orders: [Order!]!
    errors: [CartOrderError!]!
  }

  scalar JSON
`;
