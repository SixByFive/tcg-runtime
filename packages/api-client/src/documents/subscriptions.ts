import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { gql } from 'graphql-tag';
import type {
  SubscriptionPlan,
  UserSubscription,
  SubscriptionPortal,
  PaymentTransaction,
} from '@sixbyfive/api-types';

const PLAN_FIELDS = `
  id name description priceMonthly priceYearly currency features
  isActive stripePriceIdMonthly stripePriceIdYearly createdAt updatedAt
`;
const SUB_FIELDS = `
  id userId planId status currentPeriodStart currentPeriodEnd
  cancelAtPeriodEnd cancelledAt stripeSubscriptionId createdAt updatedAt
  plan { ${PLAN_FIELDS} }
`;

export interface SubscriptionPlansQuery { subscriptionPlans: SubscriptionPlan[] }
export const SubscriptionPlansDocument: TypedDocumentNode<
  SubscriptionPlansQuery,
  Record<string, never>
> = gql`
  query SubscriptionPlans { subscriptionPlans { ${PLAN_FIELDS} } }
`;

export interface MySubscriptionQuery { mySubscription: UserSubscription | null | undefined }
export const MySubscriptionDocument: TypedDocumentNode<
  MySubscriptionQuery,
  Record<string, never>
> = gql`
  query MySubscription { mySubscription { ${SUB_FIELDS} } }
`;

export interface SubscriptionPortalQuery { subscriptionPortal: SubscriptionPortal | null | undefined }
export const SubscriptionPortalDocument: TypedDocumentNode<
  SubscriptionPortalQuery,
  Record<string, never>
> = gql`
  query SubscriptionPortal { subscriptionPortal { url } }
`;

export interface MyTransactionsQueryVariables { page?: number | null; pageSize?: number | null }
export interface MyTransactionsQuery { myTransactions: PaymentTransaction[] }
export const MyTransactionsDocument: TypedDocumentNode<
  MyTransactionsQuery,
  MyTransactionsQueryVariables
> = gql`
  query MyTransactions($page: Int, $pageSize: Int) {
    myTransactions(page: $page, pageSize: $pageSize) {
      id userId type amount currency status stripePaymentIntentId description meta createdAt updatedAt
    }
  }
`;

export interface CreateSubscriptionMutationVariables {
  planId: string;
  paymentMethodId?: string | null;
}
export interface CreateSubscriptionMutation { createSubscription: UserSubscription }
export const CreateSubscriptionDocument: TypedDocumentNode<
  CreateSubscriptionMutation,
  CreateSubscriptionMutationVariables
> = gql`
  mutation CreateSubscription($planId: ID!, $paymentMethodId: String) {
    createSubscription(planId: $planId, paymentMethodId: $paymentMethodId) { ${SUB_FIELDS} }
  }
`;

export interface CancelSubscriptionMutation { cancelSubscription: boolean }
export const CancelSubscriptionDocument: TypedDocumentNode<
  CancelSubscriptionMutation,
  Record<string, never>
> = gql`
  mutation CancelSubscription { cancelSubscription }
`;

export interface ResumeSubscriptionMutation { resumeSubscription: UserSubscription }
export const ResumeSubscriptionDocument: TypedDocumentNode<
  ResumeSubscriptionMutation,
  Record<string, never>
> = gql`
  mutation ResumeSubscription { resumeSubscription { ${SUB_FIELDS} } }
`;
