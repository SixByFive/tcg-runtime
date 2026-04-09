import { gql } from 'graphql-tag';

/**
 * Public GraphQL contract exposed by gateway.
 *
 * Gateway owns the public graph.
 * Internal services own the business logic.
 */
export const typeDefs = gql`
  type Query {
    health: HealthStatus!
    dbHealth: DependencyStatus!
    serviceHealth: ServiceHealth!
    me: AuthUser

    # Collection
    myCollection: [CollectionEntry!]!
    collection(userId: ID!): [CollectionEntry!]!
    collectionEntry(cardId: String!, variation: String): CollectionEntry

    # Wishlist
    myWishlist(page: Int, pageSize: Int): WishlistPage!
    wishlist(userId: ID!, page: Int, pageSize: Int): WishlistPage!
    wishlistEntry(cardId: String!, variation: String): WishlistEntry

    # Binder
    myBinders: [Binder!]!
    binder(id: ID, slug: String): Binder
    browseBinders(page: Int, pageSize: Int, userId: ID, search: String): BinderPage!
  }

  type Mutation {
    login(
      email: String
      username: String
      password: String!
      twoFactorToken: String
    ): AuthPayload!

    register(
      username: String!
      email: String!
      password: String!
      referrerId: ID
    ): AuthPayload!

    # Collection
    addToCollection(cardId: String!, quantity: Int, condition: String, variation: String): CollectionEntry!
    updateCollectionEntry(cardId: String!, quantity: Int, condition: String, variation: String): CollectionEntry!
    removeFromCollection(cardId: String!, variation: String): Boolean!
    moveToWishlist(cardId: String!, variation: String): Boolean!
    moveToCollection(cardId: String!, variation: String): CollectionEntry!
    bulkAddToCollection(cards: [BulkAddCardInput!]!): BulkAddResult!

    # Wishlist
    addToWishlist(cardId: String!, quantity: Int, variation: String, notes: String, status: WishlistStatus): WishlistEntry!
    updateWishlistEntry(cardId: String!, variation: String, quantity: Int, notes: String, status: WishlistStatus): WishlistEntry!
    removeFromWishlist(cardId: String!, variation: String): Boolean!

    # Binder
    createBinder(input: BinderInput!): Binder!
    updateBinder(id: ID!, input: BinderInput!): Binder!
    deleteBinder(id: ID!, permanent: Boolean): Boolean!
    saveBinderPagesAndSlots(binderId: ID!, pages: [BinderPageInput!]!): Binder!
  }

  # ── Auth ──────────────────────────────────────────────────────────────────────

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

  type AuthUser {
    id: ID
    username: String
    email: String
    isAdmin: Boolean
    emailVerified: Boolean
    twoFactorEnabled: Boolean
  }

  type AuthPayload {
    token: String
    user: AuthUser
  }

  # ── Collection ────────────────────────────────────────────────────────────────

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
    slots: [BinderSlotInput!]
  }

  input BinderSlotInput {
    id: ID
    cardId: String!
    position: Int!
    quantity: Int
    notes: String
  }

  # ── Shared ────────────────────────────────────────────────────────────────────

  type CatalogCard {
    id: ID
    name: String
    number: String
    set_code: String
    rarity: String
    image_small: String
    image_large: String
    supertype: String
    subtype: String
  }

  scalar JSON
`;