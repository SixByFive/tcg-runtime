import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { gql } from 'graphql-tag';
import type {
  CardListing,
  Order,
  Offer,
  SellerStatus,
  StripeConnectResult,
  RespondToOfferResult,
  CartOrderResult,
  CartItemInput,
  CreateListingInput,
  CreateOrderFromListingInput,
  ListingType,
  ListingStatus,
} from '@sbf/api-types';

const ORDER_FIELDS = `
  id orderNumber total paidAt paymentMethod buyerEmail buyerName guestCheckout
  listingId buyerId sellerId cardId salePrice platformFee shippingCost totalAmount
  currency paymentStatus fulfilmentStatus trackingNumber trackingCarrier shippingLabelUrl
  shippingAddressJson buyerAddressJson clientSecret shippedAt completedAt cancelledAt
  createdAt updatedAt
  buyer { id username avatar }
  seller { id username avatar }
`;

const LISTING_FIELDS = `
  id sellerId cardId title description condition variant price currency quantity
  status shippingType shippingPrice parcelSize allowOffers offerMinPrice createdAt updatedAt
`;

// ── Queries ───────────────────────────────────────────────────────────────────

export interface ListingsQueryVariables {
  type?: ListingType | null;
  cardId?: string | null;
  sellerId?: string | null;
  condition?: string | null;
  status?: ListingStatus | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  limit?: number | null;
  offset?: number | null;
}
export interface ListingsQuery { listings: Array<CardListing | { id: string; __typename?: string }> }
export const ListingsDocument: TypedDocumentNode<ListingsQuery, ListingsQueryVariables> = gql`
  query Listings(
    $type: ListingType, $cardId: String, $sellerId: ID, $condition: String,
    $status: ListingStatus, $minPrice: Float, $maxPrice: Float, $limit: Int, $offset: Int
  ) {
    listings(
      type: $type, cardId: $cardId, sellerId: $sellerId, condition: $condition,
      status: $status, minPrice: $minPrice, maxPrice: $maxPrice, limit: $limit, offset: $offset
    ) {
      ... on CardListing { ${LISTING_FIELDS} }
      ... on ProductListing {
        id title description imageUrl price currency quantity status
        fulfilmentType createdAt updatedAt
        seller { id username avatar }
        inventory { id onHand reserved sold }
      }
    }
  }
`;

export interface MyOrdersQueryVariables { role?: string | null; limit?: number | null; offset?: number | null }
export interface MyOrdersQuery { myOrders: Order[] }
export const MyOrdersDocument: TypedDocumentNode<MyOrdersQuery, MyOrdersQueryVariables> = gql`
  query MyOrders($role: String, $limit: Int, $offset: Int) {
    myOrders(role: $role, limit: $limit, offset: $offset) { ${ORDER_FIELDS} }
  }
`;

export interface OrderQueryVariables { id: string }
export interface OrderQuery { order: Order | null | undefined }
export const OrderDocument: TypedDocumentNode<OrderQuery, OrderQueryVariables> = gql`
  query Order($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }
`;

export interface SellerStatusQuery { sellerStatus: SellerStatus }
export const SellerStatusDocument: TypedDocumentNode<SellerStatusQuery, Record<string, never>> = gql`
  query SellerStatus { sellerStatus { connected complete url } }
`;

export interface ListingOffersQueryVariables { listingId: string }
export interface ListingOffersQuery { listingOffers: Offer[] }
export const ListingOffersDocument: TypedDocumentNode<
  ListingOffersQuery,
  ListingOffersQueryVariables
> = gql`
  query ListingOffers($listingId: ID!) {
    listingOffers(listingId: $listingId) {
      id listingId buyerId amount message status expiresAt respondedAt
      counterAmount counterMessage createdAt updatedAt
    }
  }
`;

export interface MyOffersQuery { myOffers: Offer[] }
export const MyOffersDocument: TypedDocumentNode<MyOffersQuery, Record<string, never>> = gql`
  query MyOffers {
    myOffers {
      id listingId buyerId amount message status expiresAt respondedAt
      counterAmount counterMessage createdAt updatedAt
      listing { ${LISTING_FIELDS} }
    }
  }
`;

// ── Mutations ─────────────────────────────────────────────────────────────────

export interface CreateListingMutationVariables { input: CreateListingInput }
export interface CreateListingMutation { createListing: CardListing }
export const CreateListingDocument: TypedDocumentNode<
  CreateListingMutation,
  CreateListingMutationVariables
> = gql`
  mutation CreateListing($input: CreateListingInput!) {
    createListing(input: $input) { ${LISTING_FIELDS} }
  }
`;

export interface DeleteListingMutationVariables { id: string }
export interface DeleteListingMutation { deleteListing: boolean | null | undefined }
export const DeleteListingDocument: TypedDocumentNode<
  DeleteListingMutation,
  DeleteListingMutationVariables
> = gql`
  mutation DeleteListing($id: ID!) { deleteListing(id: $id) }
`;

export interface CreateOrderFromListingMutationVariables { input: CreateOrderFromListingInput }
export interface CreateOrderFromListingMutation { createOrderFromListing: Order }
export const CreateOrderFromListingDocument: TypedDocumentNode<
  CreateOrderFromListingMutation,
  CreateOrderFromListingMutationVariables
> = gql`
  mutation CreateOrderFromListing($input: CreateOrderFromListingInput!) {
    createOrderFromListing(input: $input) { ${ORDER_FIELDS} }
  }
`;

export interface ConnectStripeMutation { connectStripe: StripeConnectResult }
export const ConnectStripeDocument: TypedDocumentNode<
  ConnectStripeMutation,
  Record<string, never>
> = gql`
  mutation ConnectStripe { connectStripe { accountId url alreadyConnected } }
`;

export interface CreateOfferMutationVariables {
  listingId: string;
  amount: number;
  message?: string | null;
}
export interface CreateOfferMutation { createOffer: Offer }
export const CreateOfferDocument: TypedDocumentNode<
  CreateOfferMutation,
  CreateOfferMutationVariables
> = gql`
  mutation CreateOffer($listingId: ID!, $amount: Float!, $message: String) {
    createOffer(listingId: $listingId, amount: $amount, message: $message) {
      id listingId buyerId amount message status expiresAt createdAt updatedAt
    }
  }
`;

export interface RespondToOfferMutationVariables {
  offerId: string;
  action: string;
  counterAmount?: number | null;
  counterMessage?: string | null;
  buyerAddress?: unknown;
}
export interface RespondToOfferMutation { respondToOffer: RespondToOfferResult }
export const RespondToOfferDocument: TypedDocumentNode<
  RespondToOfferMutation,
  RespondToOfferMutationVariables
> = gql`
  mutation RespondToOffer(
    $offerId: ID!, $action: String!, $counterAmount: Float,
    $counterMessage: String, $buyerAddress: JSON
  ) {
    respondToOffer(
      offerId: $offerId, action: $action, counterAmount: $counterAmount,
      counterMessage: $counterMessage, buyerAddress: $buyerAddress
    ) {
      ok status orderId clientSecret totalAmount counterAmount
    }
  }
`;

export interface WithdrawOfferMutationVariables { offerId: string }
export interface WithdrawOfferMutation { withdrawOffer: boolean | null | undefined }
export const WithdrawOfferDocument: TypedDocumentNode<
  WithdrawOfferMutation,
  WithdrawOfferMutationVariables
> = gql`
  mutation WithdrawOffer($offerId: ID!) { withdrawOffer(offerId: $offerId) }
`;

export interface CreateCartOrdersMutationVariables { items: CartItemInput[] }
export interface CreateCartOrdersMutation { createCartOrders: CartOrderResult }
export const CreateCartOrdersDocument: TypedDocumentNode<
  CreateCartOrdersMutation,
  CreateCartOrdersMutationVariables
> = gql`
  mutation CreateCartOrders($items: [CartItemInput!]!) {
    createCartOrders(items: $items) {
      orders { ${ORDER_FIELDS} }
      errors { listingId error }
    }
  }
`;
