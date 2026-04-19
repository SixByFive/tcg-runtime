import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { gql } from 'graphql-tag';
import type { AuthPayload, User, TwoFactorSetup } from '@sbf/api-types';

// ── Queries ───────────────────────────────────────────────────────────────────

export interface MeQuery { me: User | null | undefined }
export const MeDocument: TypedDocumentNode<MeQuery, Record<string, never>> = gql`
  query Me {
    me {
      id username email emailVerified isAdmin chatBanned restrictionLevel
      twoFactorEnabled mfaEnabled avatar oauthProvider discordId discordUsername
      lastLogin createdAt updatedAt
    }
  }
`;

// ── Mutations ─────────────────────────────────────────────────────────────────

export interface LoginMutationVariables {
  email?: string | null;
  username?: string | null;
  password: string;
  mfaToken?: string | null;
  twoFactorToken?: string | null;
}
export interface LoginMutation { login: AuthPayload }
export const LoginDocument: TypedDocumentNode<LoginMutation, LoginMutationVariables> = gql`
  mutation Login(
    $email: String, $username: String, $password: String!,
    $mfaToken: String, $twoFactorToken: String
  ) {
    login(
      email: $email, username: $username, password: $password,
      mfaToken: $mfaToken, twoFactorToken: $twoFactorToken
    ) {
      token
      user {
        id username email emailVerified isAdmin chatBanned restrictionLevel
        twoFactorEnabled mfaEnabled avatar discordId discordUsername lastLogin createdAt
      }
    }
  }
`;

export interface RegisterMutationVariables {
  username: string;
  email: string;
  password: string;
  referrerId?: string | null;
}
export interface RegisterMutation { register: AuthPayload }
export const RegisterDocument: TypedDocumentNode<RegisterMutation, RegisterMutationVariables> = gql`
  mutation Register($username: String!, $email: String!, $password: String!, $referrerId: ID) {
    register(username: $username, email: $email, password: $password, referrerId: $referrerId) {
      token
      user {
        id username email emailVerified isAdmin restrictionLevel
        twoFactorEnabled mfaEnabled avatar createdAt
      }
    }
  }
`;

export interface RequestPasswordResetMutationVariables { email: string }
export interface RequestPasswordResetMutation { requestPasswordReset: boolean | null | undefined }
export const RequestPasswordResetDocument: TypedDocumentNode<
  RequestPasswordResetMutation,
  RequestPasswordResetMutationVariables
> = gql`
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email)
  }
`;

export interface ResetPasswordMutationVariables { token: string; newPassword: string }
export interface ResetPasswordMutation { resetPassword: boolean | null | undefined }
export const ResetPasswordDocument: TypedDocumentNode<
  ResetPasswordMutation,
  ResetPasswordMutationVariables
> = gql`
  mutation ResetPassword($token: String!, $newPassword: String!) {
    resetPassword(token: $token, newPassword: $newPassword)
  }
`;

export interface ChangePasswordMutationVariables { currentPassword: string; newPassword: string }
export interface ChangePasswordMutation { changePassword: boolean | null | undefined }
export const ChangePasswordDocument: TypedDocumentNode<
  ChangePasswordMutation,
  ChangePasswordMutationVariables
> = gql`
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword)
  }
`;

export interface ChangeEmailMutationVariables { newEmail: string; currentPassword: string }
export interface ChangeEmailMutation { changeEmail: boolean | null | undefined }
export const ChangeEmailDocument: TypedDocumentNode<
  ChangeEmailMutation,
  ChangeEmailMutationVariables
> = gql`
  mutation ChangeEmail($newEmail: String!, $currentPassword: String!) {
    changeEmail(newEmail: $newEmail, currentPassword: $currentPassword)
  }
`;

export interface EnableTwoFactorMutation { enableTwoFactor: TwoFactorSetup }
export const EnableTwoFactorDocument: TypedDocumentNode<
  EnableTwoFactorMutation,
  Record<string, never>
> = gql`
  mutation EnableTwoFactor {
    enableTwoFactor { otpauthUrl qrCodeDataURL }
  }
`;

export interface VerifyTwoFactorMutationVariables { code: string }
export interface VerifyTwoFactorMutation { verifyTwoFactor: boolean | null | undefined }
export const VerifyTwoFactorDocument: TypedDocumentNode<
  VerifyTwoFactorMutation,
  VerifyTwoFactorMutationVariables
> = gql`
  mutation VerifyTwoFactor($code: String!) { verifyTwoFactor(code: $code) }
`;

export interface DisableTwoFactorMutationVariables { code: string }
export interface DisableTwoFactorMutation { disableTwoFactor: boolean | null | undefined }
export const DisableTwoFactorDocument: TypedDocumentNode<
  DisableTwoFactorMutation,
  DisableTwoFactorMutationVariables
> = gql`
  mutation DisableTwoFactor($code: String!) { disableTwoFactor(code: $code) }
`;

export interface DeleteAccountMutationVariables { password?: string | null; confirm: string }
export interface DeleteAccountMutation { deleteAccount: boolean }
export const DeleteAccountDocument: TypedDocumentNode<
  DeleteAccountMutation,
  DeleteAccountMutationVariables
> = gql`
  mutation DeleteAccount($password: String, $confirm: String!) {
    deleteAccount(password: $password, confirm: $confirm)
  }
`;
