import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { gql } from 'graphql-tag';
import type { Binder, BinderPage, BinderSlot, BinderInput, BinderPageInput } from '@sbf/api-types';

const BINDER_FIELDS = `
  id userId name description coverColor accentColor visibility slug isDeleted createdAt updatedAt
  pages {
    id binderId title layout pageOrder
    slots {
      id pageId cardId quantity position notes
      card { id name number set_code rarity image_small image_large }
    }
  }
`;

export interface MyBindersQuery { myBinders: Binder[] }
export const MyBindersDocument: TypedDocumentNode<MyBindersQuery, Record<string, never>> = gql`
  query MyBinders { myBinders { ${BINDER_FIELDS} } }
`;

export interface BinderQueryVariables { id?: string | null; slug?: string | null }
export interface BinderQuery { binder: Binder | null | undefined }
export const BinderDocument: TypedDocumentNode<BinderQuery, BinderQueryVariables> = gql`
  query Binder($id: ID, $slug: String) { binder(id: $id, slug: $slug) { ${BINDER_FIELDS} } }
`;

export interface BrowseBindersQueryVariables {
  page?: number | null;
  pageSize?: number | null;
  userId?: string | null;
  search?: string | null;
}
export interface BrowseBindersQuery { browseBinders: BinderPage }
export const BrowseBindersDocument: TypedDocumentNode<
  BrowseBindersQuery,
  BrowseBindersQueryVariables
> = gql`
  query BrowseBinders($page: Int, $pageSize: Int, $userId: ID, $search: String) {
    browseBinders(page: $page, pageSize: $pageSize, userId: $userId, search: $search) {
      binders { id userId name description coverColor accentColor visibility slug createdAt updatedAt }
      total page pageSize
    }
  }
`;

export interface CreateBinderMutationVariables { input: BinderInput }
export interface CreateBinderMutation { createBinder: Binder }
export const CreateBinderDocument: TypedDocumentNode<
  CreateBinderMutation,
  CreateBinderMutationVariables
> = gql`
  mutation CreateBinder($input: BinderInput!) { createBinder(input: $input) { ${BINDER_FIELDS} } }
`;

export interface UpdateBinderMutationVariables { id: string; input: BinderInput }
export interface UpdateBinderMutation { updateBinder: Binder }
export const UpdateBinderDocument: TypedDocumentNode<
  UpdateBinderMutation,
  UpdateBinderMutationVariables
> = gql`
  mutation UpdateBinder($id: ID!, $input: BinderInput!) { updateBinder(id: $id, input: $input) { ${BINDER_FIELDS} } }
`;

export interface DeleteBinderMutationVariables { id: string; permanent?: boolean | null }
export interface DeleteBinderMutation { deleteBinder: boolean | null | undefined }
export const DeleteBinderDocument: TypedDocumentNode<
  DeleteBinderMutation,
  DeleteBinderMutationVariables
> = gql`
  mutation DeleteBinder($id: ID!, $permanent: Boolean) { deleteBinder(id: $id, permanent: $permanent) }
`;

export interface SaveBinderPagesAndSlotsMutationVariables {
  binderId: string;
  pages: BinderPageInput[];
}
export interface SaveBinderPagesAndSlotsMutation { saveBinderPagesAndSlots: Binder }
export const SaveBinderPagesAndSlotsDocument: TypedDocumentNode<
  SaveBinderPagesAndSlotsMutation,
  SaveBinderPagesAndSlotsMutationVariables
> = gql`
  mutation SaveBinderPagesAndSlots($binderId: ID!, $pages: [BinderPageInput!]!) {
    saveBinderPagesAndSlots(binderId: $binderId, pages: $pages) { ${BINDER_FIELDS} }
  }
`;

export interface AddCardToBinderMutationVariables {
  pageId: string;
  input: { id?: string | null; cardId: string; position: number; quantity?: number | null; notes?: string | null };
}
export interface AddCardToBinderMutation { addCardToBinder: BinderSlot }
export const AddCardToBinderDocument: TypedDocumentNode<
  AddCardToBinderMutation,
  AddCardToBinderMutationVariables
> = gql`
  mutation AddCardToBinder($pageId: ID!, $input: BinderSlotInput!) {
    addCardToBinder(pageId: $pageId, input: $input) {
      id pageId cardId quantity position notes
      card { id name number set_code rarity image_small image_large }
    }
  }
`;
