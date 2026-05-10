import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { gql } from 'graphql-tag';
import type { WishlistEntry, WishlistPage, WishlistStatus } from '@sixbyfive/api-types';

const ENTRY_FIELDS = `
  id userId cardId quantity variation notes status addedAt createdAt updatedAt
  card { id cardId name number setCode rarity images { small large } set { code name } variants { key default label } }
`;

export interface MyWishlistQueryVariables { page?: number | null; pageSize?: number | null }
export interface MyWishlistQuery { myWishlist: WishlistPage }
export const MyWishlistDocument: TypedDocumentNode<MyWishlistQuery, MyWishlistQueryVariables> = gql`
  query MyWishlist($page: Int, $pageSize: Int) {
    myWishlist(page: $page, pageSize: $pageSize) {
      entries { ${ENTRY_FIELDS} }
      total page pageSize
    }
  }
`;

export interface WishlistQueryVariables { userId: string; page?: number | null; pageSize?: number | null }
export interface WishlistQuery { wishlist: WishlistPage }
export const WishlistDocument: TypedDocumentNode<WishlistQuery, WishlistQueryVariables> = gql`
  query Wishlist($userId: ID!, $page: Int, $pageSize: Int) {
    wishlist(userId: $userId, page: $page, pageSize: $pageSize) {
      entries { ${ENTRY_FIELDS} }
      total page pageSize
    }
  }
`;

export interface WishlistEntryQueryVariables { cardId: string; variation?: string | null }
export interface WishlistEntryQuery { wishlistEntry: WishlistEntry | null | undefined }
export const WishlistEntryDocument: TypedDocumentNode<
  WishlistEntryQuery,
  WishlistEntryQueryVariables
> = gql`
  query WishlistEntry($cardId: String!, $variation: String) {
    wishlistEntry(cardId: $cardId, variation: $variation) { ${ENTRY_FIELDS} }
  }
`;

export interface AddToWishlistMutationVariables {
  cardId: string;
  quantity?: number | null;
  variation?: string | null;
  notes?: string | null;
  status?: WishlistStatus | null;
}
export interface AddToWishlistMutation { addToWishlist: WishlistEntry }
export const AddToWishlistDocument: TypedDocumentNode<
  AddToWishlistMutation,
  AddToWishlistMutationVariables
> = gql`
  mutation AddToWishlist($cardId: String!, $quantity: Int, $variation: String, $notes: String, $status: WishlistStatus) {
    addToWishlist(cardId: $cardId, quantity: $quantity, variation: $variation, notes: $notes, status: $status) {
      ${ENTRY_FIELDS}
    }
  }
`;

export interface UpdateWishlistEntryMutationVariables {
  cardId: string;
  variation?: string | null;
  quantity?: number | null;
  notes?: string | null;
  status?: WishlistStatus | null;
}
export interface UpdateWishlistEntryMutation { updateWishlistEntry: WishlistEntry }
export const UpdateWishlistEntryDocument: TypedDocumentNode<
  UpdateWishlistEntryMutation,
  UpdateWishlistEntryMutationVariables
> = gql`
  mutation UpdateWishlistEntry($cardId: String!, $variation: String, $quantity: Int, $notes: String, $status: WishlistStatus) {
    updateWishlistEntry(cardId: $cardId, variation: $variation, quantity: $quantity, notes: $notes, status: $status) {
      ${ENTRY_FIELDS}
    }
  }
`;

export interface RemoveFromWishlistMutationVariables { cardId: string; variation?: string | null }
export interface RemoveFromWishlistMutation { removeFromWishlist: boolean | null | undefined }
export const RemoveFromWishlistDocument: TypedDocumentNode<
  RemoveFromWishlistMutation,
  RemoveFromWishlistMutationVariables
> = gql`
  mutation RemoveFromWishlist($cardId: String!, $variation: String) {
    removeFromWishlist(cardId: $cardId, variation: $variation)
  }
`;
