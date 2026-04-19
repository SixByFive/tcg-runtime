import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { gql } from 'graphql-tag';
import type { ChatThread, Message, ChatMute, ChatBlock } from '@sixbyfive/api-types';

const MESSAGE_FIELDS = `id senderId receiverId content createdAt isRead isSystemMessage meta`;
const THREAD_FIELDS = `
  userId unreadCount
  user { id username avatar }
  lastMessage { ${MESSAGE_FIELDS} }
`;

export interface MyChatsQueryVariables { page?: number | null; pageSize?: number | null }
export interface MyChatsQuery { myChats: ChatThread[] }
export const MyChatsDocument: TypedDocumentNode<MyChatsQuery, MyChatsQueryVariables> = gql`
  query MyChats($page: Int, $pageSize: Int) {
    myChats(page: $page, pageSize: $pageSize) { ${THREAD_FIELDS} }
  }
`;

export interface ChatWithUserQueryVariables {
  userId: string;
  page?: number | null;
  pageSize?: number | null;
}
export interface ChatWithUserQuery { chatWithUser: Message[] }
export const ChatWithUserDocument: TypedDocumentNode<
  ChatWithUserQuery,
  ChatWithUserQueryVariables
> = gql`
  query ChatWithUser($userId: ID!, $page: Int, $pageSize: Int) {
    chatWithUser(userId: $userId, page: $page, pageSize: $pageSize) { ${MESSAGE_FIELDS} }
  }
`;

export interface UnreadMessageCountQuery { unreadMessageCount: number }
export const UnreadMessageCountDocument: TypedDocumentNode<
  UnreadMessageCountQuery,
  Record<string, never>
> = gql`
  query UnreadMessageCount { unreadMessageCount }
`;

export interface HasAgreedToChatRulesQuery { hasAgreedToChatRules: boolean }
export const HasAgreedToChatRulesDocument: TypedDocumentNode<
  HasAgreedToChatRulesQuery,
  Record<string, never>
> = gql`
  query HasAgreedToChatRules { hasAgreedToChatRules }
`;

export interface ChatRulesTextQuery { chatRulesText: string }
export const ChatRulesTextDocument: TypedDocumentNode<ChatRulesTextQuery, Record<string, never>> = gql`
  query ChatRulesText { chatRulesText }
`;

export interface MyMutedConversationsQuery { myMutedConversations: ChatMute[] }
export const MyMutedConversationsDocument: TypedDocumentNode<
  MyMutedConversationsQuery,
  Record<string, never>
> = gql`
  query MyMutedConversations {
    myMutedConversations { id userId otherUserId mutedUntil createdAt }
  }
`;

export interface MyBlockedUsersQuery { myBlockedUsers: ChatBlock[] }
export const MyBlockedUsersDocument: TypedDocumentNode<
  MyBlockedUsersQuery,
  Record<string, never>
> = gql`
  query MyBlockedUsers { myBlockedUsers { id blockerId blockedId reason createdAt } }
`;

// ── Mutations ─────────────────────────────────────────────────────────────────

export interface SendMessageMutationVariables {
  receiverId: string;
  content: string;
  meta?: unknown;
}
export interface SendMessageMutation { sendMessage: Message }
export const SendMessageDocument: TypedDocumentNode<
  SendMessageMutation,
  SendMessageMutationVariables
> = gql`
  mutation SendMessage($receiverId: ID!, $content: String!, $meta: JSON) {
    sendMessage(receiverId: $receiverId, content: $content, meta: $meta) { ${MESSAGE_FIELDS} }
  }
`;

export interface MarkChatReadMutationVariables { userId: string }
export interface MarkChatReadMutation { markChatRead: boolean | null | undefined }
export const MarkChatReadDocument: TypedDocumentNode<
  MarkChatReadMutation,
  MarkChatReadMutationVariables
> = gql`
  mutation MarkChatRead($userId: ID!) { markChatRead(userId: $userId) }
`;

export interface DeleteChatMutationVariables { userId: string }
export interface DeleteChatMutation { deleteChat: boolean | null | undefined }
export const DeleteChatDocument: TypedDocumentNode<
  DeleteChatMutation,
  DeleteChatMutationVariables
> = gql`
  mutation DeleteChat($userId: ID!) { deleteChat(userId: $userId) }
`;

export interface ReportUserMutationVariables {
  userId: string;
  reason: string;
  details?: string | null;
}
export interface ReportUserMutation { reportUser: boolean | null | undefined }
export const ReportUserDocument: TypedDocumentNode<
  ReportUserMutation,
  ReportUserMutationVariables
> = gql`
  mutation ReportUser($userId: ID!, $reason: String!, $details: String) {
    reportUser(userId: $userId, reason: $reason, details: $details)
  }
`;

export interface ReportMessageMutationVariables {
  messageId: string;
  reason: string;
  details?: string | null;
}
export interface ReportMessageMutation { reportMessage: boolean | null | undefined }
export const ReportMessageDocument: TypedDocumentNode<
  ReportMessageMutation,
  ReportMessageMutationVariables
> = gql`
  mutation ReportMessage($messageId: ID!, $reason: String!, $details: String) {
    reportMessage(messageId: $messageId, reason: $reason, details: $details)
  }
`;

export interface AgreeToChatRulesMutation { agreeToChatRules: boolean }
export const AgreeToChatRulesDocument: TypedDocumentNode<
  AgreeToChatRulesMutation,
  Record<string, never>
> = gql`
  mutation AgreeToChatRules { agreeToChatRules }
`;

export interface MuteConversationMutationVariables { userId: string; mutedUntil?: string | null }
export interface MuteConversationMutation { muteConversation: boolean }
export const MuteConversationDocument: TypedDocumentNode<
  MuteConversationMutation,
  MuteConversationMutationVariables
> = gql`
  mutation MuteConversation($userId: ID!, $mutedUntil: String) {
    muteConversation(userId: $userId, mutedUntil: $mutedUntil)
  }
`;

export interface UnmuteConversationMutationVariables { userId: string }
export interface UnmuteConversationMutation { unmuteConversation: boolean }
export const UnmuteConversationDocument: TypedDocumentNode<
  UnmuteConversationMutation,
  UnmuteConversationMutationVariables
> = gql`
  mutation UnmuteConversation($userId: ID!) { unmuteConversation(userId: $userId) }
`;

export interface BlockUserFromChatMutationVariables { userId: string; reason?: string | null }
export interface BlockUserFromChatMutation { blockUserFromChat: boolean }
export const BlockUserFromChatDocument: TypedDocumentNode<
  BlockUserFromChatMutation,
  BlockUserFromChatMutationVariables
> = gql`
  mutation BlockUserFromChat($userId: ID!, $reason: String) {
    blockUserFromChat(userId: $userId, reason: $reason)
  }
`;

export interface UnblockUserFromChatMutationVariables { userId: string }
export interface UnblockUserFromChatMutation { unblockUserFromChat: boolean }
export const UnblockUserFromChatDocument: TypedDocumentNode<
  UnblockUserFromChatMutation,
  UnblockUserFromChatMutationVariables
> = gql`
  mutation UnblockUserFromChat($userId: ID!) { unblockUserFromChat(userId: $userId) }
`;
