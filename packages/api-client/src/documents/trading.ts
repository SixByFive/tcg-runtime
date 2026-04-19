import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { gql } from 'graphql-tag';
import type { Trade, TradeStatus, TradeProofResult, TradeDisputeResult, TradeCardInput } from '@sixbyfive/api-types';

const TRADE_FIELDS = `
  id partyAId partyBId initiatorId status counterCount lastCounterBy
  agreedAt lockedAt completedAt cancelledAt cancelledBy cancelledReason
  disputeId adminNotes proofAVerified proofBVerified
  trackingNumberA trackingNumberB createdAt updatedAt
  cards { id tradeId userId cardId quantity condition variation }
  proofs { id tradeId userId proofImagePath proofCode uploadedAt moderationResult moderatedAt }
  dispute { id tradeId raisedById reason status resolution resolvedAt createdAt }
`;

export interface BrowseTradesQueryVariables { page?: number | null; pageSize?: number | null }
export interface BrowseTradesQuery { browseTrades: Trade[] }
export const BrowseTradesDocument: TypedDocumentNode<BrowseTradesQuery, BrowseTradesQueryVariables> = gql`
  query BrowseTrades($page: Int, $pageSize: Int) {
    browseTrades(page: $page, pageSize: $pageSize) { ${TRADE_FIELDS} }
  }
`;

export interface MyTradesQueryVariables {
  page?: number | null;
  pageSize?: number | null;
  status?: TradeStatus | null;
}
export interface MyTradesQuery { myTrades: Trade[] }
export const MyTradesDocument: TypedDocumentNode<MyTradesQuery, MyTradesQueryVariables> = gql`
  query MyTrades($page: Int, $pageSize: Int, $status: TradeStatus) {
    myTrades(page: $page, pageSize: $pageSize, status: $status) { ${TRADE_FIELDS} }
  }
`;

export interface TradeQueryVariables { id: string }
export interface TradeQuery { trade: Trade | null | undefined }
export const TradeDocument: TypedDocumentNode<TradeQuery, TradeQueryVariables> = gql`
  query Trade($id: ID!) { trade(id: $id) { ${TRADE_FIELDS} } }
`;

// ── Mutations ─────────────────────────────────────────────────────────────────

export interface InitiateTradeMutationVariables {
  userId: string;
  offeredCards?: TradeCardInput[] | null;
  wantedCards?: TradeCardInput[] | null;
}
export interface InitiateTradeMutation { initiateTrade: Trade }
export const InitiateTradeDocument: TypedDocumentNode<
  InitiateTradeMutation,
  InitiateTradeMutationVariables
> = gql`
  mutation InitiateTrade($userId: ID!, $offeredCards: [TradeCardInput!], $wantedCards: [TradeCardInput!]) {
    initiateTrade(userId: $userId, offeredCards: $offeredCards, wantedCards: $wantedCards) { ${TRADE_FIELDS} }
  }
`;

export interface RespondToTradeMutationVariables {
  id: string;
  accept: boolean;
  counterCards?: TradeCardInput[] | null;
  reason?: string | null;
}
export interface RespondToTradeMutation { respondToTrade: Trade }
export const RespondToTradeDocument: TypedDocumentNode<
  RespondToTradeMutation,
  RespondToTradeMutationVariables
> = gql`
  mutation RespondToTrade($id: ID!, $accept: Boolean!, $counterCards: [TradeCardInput!], $reason: String) {
    respondToTrade(id: $id, accept: $accept, counterCards: $counterCards, reason: $reason) { ${TRADE_FIELDS} }
  }
`;

export interface CancelTradeMutationVariables { id: string; reason?: string | null }
export interface CancelTradeMutation { cancelTrade: Trade }
export const CancelTradeDocument: TypedDocumentNode<
  CancelTradeMutation,
  CancelTradeMutationVariables
> = gql`
  mutation CancelTrade($id: ID!, $reason: String) { cancelTrade(id: $id, reason: $reason) { ${TRADE_FIELDS} } }
`;

export interface UploadTradeProofMutationVariables {
  id: string;
  proofImage: string;
  proofCode?: string | null;
}
export interface UploadTradeProofMutation { uploadTradeProof: TradeProofResult }
export const UploadTradeProofDocument: TypedDocumentNode<
  UploadTradeProofMutation,
  UploadTradeProofMutationVariables
> = gql`
  mutation UploadTradeProof($id: ID!, $proofImage: String!, $proofCode: String) {
    uploadTradeProof(id: $id, proofImage: $proofImage, proofCode: $proofCode) {
      proof { id tradeId proofImagePath proofCode uploadedAt }
      trade { id status }
    }
  }
`;

export interface SubmitTradeTrackingMutationVariables { id: string; trackingNumber: string }
export interface SubmitTradeTrackingMutation { submitTradeTracking: Trade }
export const SubmitTradeTrackingDocument: TypedDocumentNode<
  SubmitTradeTrackingMutation,
  SubmitTradeTrackingMutationVariables
> = gql`
  mutation SubmitTradeTracking($id: ID!, $trackingNumber: String!) {
    submitTradeTracking(id: $id, trackingNumber: $trackingNumber) { id status trackingNumberA trackingNumberB }
  }
`;

export interface ConfirmTradeReceivedMutationVariables { id: string }
export interface ConfirmTradeReceivedMutation { confirmTradeReceived: Trade }
export const ConfirmTradeReceivedDocument: TypedDocumentNode<
  ConfirmTradeReceivedMutation,
  ConfirmTradeReceivedMutationVariables
> = gql`
  mutation ConfirmTradeReceived($id: ID!) { confirmTradeReceived(id: $id) { id status completedAt } }
`;

export interface RaiseTradeDisputeMutationVariables { id: string; reason: string }
export interface RaiseTradeDisputeMutation { raiseTradeDispute: TradeDisputeResult }
export const RaiseTradeDisputeDocument: TypedDocumentNode<
  RaiseTradeDisputeMutation,
  RaiseTradeDisputeMutationVariables
> = gql`
  mutation RaiseTradeDispute($id: ID!, $reason: String!) {
    raiseTradeDispute(id: $id, reason: $reason) {
      dispute { id tradeId reason status createdAt }
      trade { id status }
    }
  }
`;

export interface LeaveTradeFeedbackMutationVariables {
  id: string;
  rating: number;
  review?: string | null;
}
export interface LeaveTradeFeedbackMutation { leaveTradeFeedback: boolean | null | undefined }
export const LeaveTradeFeedbackDocument: TypedDocumentNode<
  LeaveTradeFeedbackMutation,
  LeaveTradeFeedbackMutationVariables
> = gql`
  mutation LeaveTradeFeedback($id: ID!, $rating: Int!, $review: String) {
    leaveTradeFeedback(id: $id, rating: $rating, review: $review)
  }
`;
