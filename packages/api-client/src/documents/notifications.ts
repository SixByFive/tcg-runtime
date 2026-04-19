import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { gql } from 'graphql-tag';
import type { NotificationPage, NotificationFilterInput, NotificationPrefs } from '@sbf/api-types';

export interface MyNotificationsQueryVariables {
  page?: number | null;
  pageSize?: number | null;
  filter?: NotificationFilterInput | null;
}
export interface MyNotificationsQuery { myNotifications: NotificationPage }
export const MyNotificationsDocument: TypedDocumentNode<
  MyNotificationsQuery,
  MyNotificationsQueryVariables
> = gql`
  query MyNotifications($page: Int, $pageSize: Int, $filter: NotificationFilterInput) {
    myNotifications(page: $page, pageSize: $pageSize, filter: $filter) {
      notifications { id type title body iconUrl linkUrl isRead isDismissed createdAt }
      total page pageSize
    }
  }
`;

export interface UnreadNotificationCountQuery { unreadNotificationCount: number }
export const UnreadNotificationCountDocument: TypedDocumentNode<
  UnreadNotificationCountQuery,
  Record<string, never>
> = gql`
  query UnreadNotificationCount { unreadNotificationCount }
`;

export interface MyNotificationPrefsQuery { myNotificationPrefs: NotificationPrefs }
export const MyNotificationPrefsDocument: TypedDocumentNode<
  MyNotificationPrefsQuery,
  Record<string, never>
> = gql`
  query MyNotificationPrefs {
    myNotificationPrefs { inappEnabled emailEnabled pushEnabled digest quietStart quietEnd }
  }
`;

export interface MarkNotificationReadMutationVariables { id: string }
export interface MarkNotificationReadMutation { markNotificationRead: boolean | null | undefined }
export const MarkNotificationReadDocument: TypedDocumentNode<
  MarkNotificationReadMutation,
  MarkNotificationReadMutationVariables
> = gql`
  mutation MarkNotificationRead($id: ID!) { markNotificationRead(id: $id) }
`;

export interface MarkAllNotificationsReadMutation { markAllNotificationsRead: boolean | null | undefined }
export const MarkAllNotificationsReadDocument: TypedDocumentNode<
  MarkAllNotificationsReadMutation,
  Record<string, never>
> = gql`
  mutation MarkAllNotificationsRead { markAllNotificationsRead }
`;

export interface DismissNotificationMutationVariables { id: string }
export interface DismissNotificationMutation { dismissNotification: boolean | null | undefined }
export const DismissNotificationDocument: TypedDocumentNode<
  DismissNotificationMutation,
  DismissNotificationMutationVariables
> = gql`
  mutation DismissNotification($id: ID!) { dismissNotification(id: $id) }
`;

export interface SetNotificationPrefsMutationVariables {
  inappEnabled?: boolean | null;
  emailEnabled?: boolean | null;
  pushEnabled?: boolean | null;
  digest?: string | null;
  quietStart?: string | null;
  quietEnd?: string | null;
}
export interface SetNotificationPrefsMutation { setNotificationPrefs: boolean | null | undefined }
export const SetNotificationPrefsDocument: TypedDocumentNode<
  SetNotificationPrefsMutation,
  SetNotificationPrefsMutationVariables
> = gql`
  mutation SetNotificationPrefs(
    $inappEnabled: Boolean, $emailEnabled: Boolean, $pushEnabled: Boolean,
    $digest: String, $quietStart: String, $quietEnd: String
  ) {
    setNotificationPrefs(
      inappEnabled: $inappEnabled, emailEnabled: $emailEnabled, pushEnabled: $pushEnabled,
      digest: $digest, quietStart: $quietStart, quietEnd: $quietEnd
    )
  }
`;

export interface RegisterExpoPushTokenMutationVariables {
  expoPushToken: string;
  platform?: string | null;
  deviceName?: string | null;
  appVersion?: string | null;
}
export interface RegisterExpoPushTokenMutation { registerExpoPushToken: boolean | null | undefined }
export const RegisterExpoPushTokenDocument: TypedDocumentNode<
  RegisterExpoPushTokenMutation,
  RegisterExpoPushTokenMutationVariables
> = gql`
  mutation RegisterExpoPushToken(
    $expoPushToken: String!, $platform: String, $deviceName: String, $appVersion: String
  ) {
    registerExpoPushToken(
      expoPushToken: $expoPushToken, platform: $platform,
      deviceName: $deviceName, appVersion: $appVersion
    )
  }
`;

export interface UnregisterExpoPushTokenMutationVariables { expoPushToken: string }
export interface UnregisterExpoPushTokenMutation { unregisterExpoPushToken: boolean | null | undefined }
export const UnregisterExpoPushTokenDocument: TypedDocumentNode<
  UnregisterExpoPushTokenMutation,
  UnregisterExpoPushTokenMutationVariables
> = gql`
  mutation UnregisterExpoPushToken($expoPushToken: String!) {
    unregisterExpoPushToken(expoPushToken: $expoPushToken)
  }
`;
