import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { gql } from 'graphql-tag';
import type { CollectionEntry, BulkAddResult, BulkAddCardInput } from '@sbf/api-types';

const ENTRY_FIELDS = `
  id userId cardId quantity condition variation wishlist createdAt updatedAt
  card { id name number set_code rarity image_small image_large supertype subtype }
`;

export interface MyCollectionQuery { myCollection: CollectionEntry[] }
export const MyCollectionDocument: TypedDocumentNode<MyCollectionQuery, Record<string, never>> = gql`
  query MyCollection { myCollection { ${ENTRY_FIELDS} } }
`;

export interface CollectionQueryVariables { userId: string }
export interface CollectionQuery { collection: CollectionEntry[] }
export const CollectionDocument: TypedDocumentNode<CollectionQuery, CollectionQueryVariables> = gql`
  query Collection($userId: ID!) { collection(userId: $userId) { ${ENTRY_FIELDS} } }
`;

export interface CollectionEntryQueryVariables { cardId: string; variation?: string | null }
export interface CollectionEntryQuery { collectionEntry: CollectionEntry | null | undefined }
export const CollectionEntryDocument: TypedDocumentNode<
  CollectionEntryQuery,
  CollectionEntryQueryVariables
> = gql`
  query CollectionEntry($cardId: String!, $variation: String) {
    collectionEntry(cardId: $cardId, variation: $variation) { ${ENTRY_FIELDS} }
  }
`;

export interface AddToCollectionMutationVariables {
  cardId: string;
  quantity?: number | null;
  condition?: string | null;
  variation?: string | null;
}
export interface AddToCollectionMutation { addToCollection: CollectionEntry }
export const AddToCollectionDocument: TypedDocumentNode<
  AddToCollectionMutation,
  AddToCollectionMutationVariables
> = gql`
  mutation AddToCollection($cardId: String!, $quantity: Int, $condition: String, $variation: String) {
    addToCollection(cardId: $cardId, quantity: $quantity, condition: $condition, variation: $variation) {
      ${ENTRY_FIELDS}
    }
  }
`;

export interface UpdateCollectionEntryMutationVariables {
  cardId: string;
  quantity?: number | null;
  condition?: string | null;
  variation?: string | null;
}
export interface UpdateCollectionEntryMutation { updateCollectionEntry: CollectionEntry }
export const UpdateCollectionEntryDocument: TypedDocumentNode<
  UpdateCollectionEntryMutation,
  UpdateCollectionEntryMutationVariables
> = gql`
  mutation UpdateCollectionEntry($cardId: String!, $quantity: Int, $condition: String, $variation: String) {
    updateCollectionEntry(cardId: $cardId, quantity: $quantity, condition: $condition, variation: $variation) {
      ${ENTRY_FIELDS}
    }
  }
`;

export interface RemoveFromCollectionMutationVariables { cardId: string; variation?: string | null }
export interface RemoveFromCollectionMutation { removeFromCollection: boolean }
export const RemoveFromCollectionDocument: TypedDocumentNode<
  RemoveFromCollectionMutation,
  RemoveFromCollectionMutationVariables
> = gql`
  mutation RemoveFromCollection($cardId: String!, $variation: String) {
    removeFromCollection(cardId: $cardId, variation: $variation)
  }
`;

export interface MoveToWishlistMutationVariables { cardId: string; variation?: string | null }
export interface MoveToWishlistMutation { moveToWishlist: boolean }
export const MoveToWishlistDocument: TypedDocumentNode<
  MoveToWishlistMutation,
  MoveToWishlistMutationVariables
> = gql`
  mutation MoveToWishlist($cardId: String!, $variation: String) {
    moveToWishlist(cardId: $cardId, variation: $variation)
  }
`;

export interface MoveToCollectionMutationVariables { cardId: string; variation?: string | null }
export interface MoveToCollectionMutation { moveToCollection: CollectionEntry }
export const MoveToCollectionDocument: TypedDocumentNode<
  MoveToCollectionMutation,
  MoveToCollectionMutationVariables
> = gql`
  mutation MoveToCollection($cardId: String!, $variation: String) {
    moveToCollection(cardId: $cardId, variation: $variation) { ${ENTRY_FIELDS} }
  }
`;

export interface BulkAddToCollectionMutationVariables { cards: BulkAddCardInput[] }
export interface BulkAddToCollectionMutation { bulkAddToCollection: BulkAddResult }
export const BulkAddToCollectionDocument: TypedDocumentNode<
  BulkAddToCollectionMutation,
  BulkAddToCollectionMutationVariables
> = gql`
  mutation BulkAddToCollection($cards: [BulkAddCardInput!]!) {
    bulkAddToCollection(cards: $cards) {
      added
      entries { id cardId quantity condition variation createdAt updatedAt }
    }
  }
`;
