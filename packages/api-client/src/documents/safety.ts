import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { gql } from 'graphql-tag';
import type { SafetyProfile } from '@sbf/api-types';

const SAFETY_FIELDS = `
  dob parentEmail parentVerifiedAt restrictionLevel
  capabilities {
    canTrade canPost canMessage canConnectDiscord
    canBuyMarketplace canSellMarketplace restrictionLevel
  }
`;

export interface MySafetyProfileQuery { mySafetyProfile: SafetyProfile }
export const MySafetyProfileDocument: TypedDocumentNode<
  MySafetyProfileQuery,
  Record<string, never>
> = gql`
  query MySafetyProfile { mySafetyProfile { ${SAFETY_FIELDS} } }
`;

export interface UpdateSafetyProfileMutationVariables {
  dob?: string | null;
  parentEmail?: string | null;
}
export interface UpdateSafetyProfileMutation { updateSafetyProfile: SafetyProfile }
export const UpdateSafetyProfileDocument: TypedDocumentNode<
  UpdateSafetyProfileMutation,
  UpdateSafetyProfileMutationVariables
> = gql`
  mutation UpdateSafetyProfile($dob: String, $parentEmail: String) {
    updateSafetyProfile(dob: $dob, parentEmail: $parentEmail) { ${SAFETY_FIELDS} }
  }
`;

export interface RequestParentVerificationMutation {
  requestParentVerification: boolean | null | undefined;
}
export const RequestParentVerificationDocument: TypedDocumentNode<
  RequestParentVerificationMutation,
  Record<string, never>
> = gql`
  mutation RequestParentVerification { requestParentVerification }
`;
