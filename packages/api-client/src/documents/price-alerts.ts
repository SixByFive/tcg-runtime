import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { gql } from 'graphql-tag';
import type { PriceAlert, UpsertPriceAlertInput } from '@sbf/api-types';

const ALERT_FIELDS = `
  id cardId variation condition currency value windowHours cooldownHours
  isActive lastFiredAt createdAt updatedAt
`;

export interface MyPriceAlertsQuery { myPriceAlerts: PriceAlert[] }
export const MyPriceAlertsDocument: TypedDocumentNode<
  MyPriceAlertsQuery,
  Record<string, never>
> = gql`
  query MyPriceAlerts { myPriceAlerts { ${ALERT_FIELDS} } }
`;

export interface UpsertPriceAlertMutationVariables { input: UpsertPriceAlertInput }
export interface UpsertPriceAlertMutation { upsertPriceAlert: PriceAlert }
export const UpsertPriceAlertDocument: TypedDocumentNode<
  UpsertPriceAlertMutation,
  UpsertPriceAlertMutationVariables
> = gql`
  mutation UpsertPriceAlert($input: UpsertPriceAlertInput!) {
    upsertPriceAlert(input: $input) { ${ALERT_FIELDS} }
  }
`;

export interface DeletePriceAlertMutationVariables { id: string }
export interface DeletePriceAlertMutation { deletePriceAlert: boolean }
export const DeletePriceAlertDocument: TypedDocumentNode<
  DeletePriceAlertMutation,
  DeletePriceAlertMutationVariables
> = gql`
  mutation DeletePriceAlert($id: ID!) { deletePriceAlert(id: $id) }
`;

export interface TogglePriceAlertMutationVariables { id: string; active: boolean }
export interface TogglePriceAlertMutation { togglePriceAlert: boolean }
export const TogglePriceAlertDocument: TypedDocumentNode<
  TogglePriceAlertMutation,
  TogglePriceAlertMutationVariables
> = gql`
  mutation TogglePriceAlert($id: ID!, $active: Boolean!) { togglePriceAlert(id: $id, active: $active) }
`;
