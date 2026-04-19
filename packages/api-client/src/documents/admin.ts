import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { gql } from 'graphql-tag';
import type {
  AdminUser,
  AdminBinder,
  UserCollectionSummary,
  ReportedUser,
  Trade,
  TradeDispute,
  TradeBan,
  TradeStatus,
  Order,
  CardListing,
  ProductListing,
  ProductListingInput,
  NotificationPage,
  UserAchievement,
  Message,
  Reward,
  SafetyProfile,
  BroadcastNotificationInput,
} from '@sbf/api-types';

// ── Admin Queries ─────────────────────────────────────────────────────────────

export interface AllUsersQueryVariables { limit?: number | null; offset?: number | null }
export interface AllUsersQuery { allUsers: AdminUser[] }
export const AllUsersDocument: TypedDocumentNode<AllUsersQuery, AllUsersQueryVariables> = gql`
  query AllUsers($limit: Int, $offset: Int) {
    allUsers(limit: $limit, offset: $offset) {
      id username email isAdmin isBanned emailVerified createdAt lastLogin
      profile { id bio avatar country }
    }
  }
`;

export interface AdminBindersQueryVariables { limit?: number | null; offset?: number | null }
export interface AdminBindersQuery { adminBinders: AdminBinder[] }
export const AdminBindersDocument: TypedDocumentNode<
  AdminBindersQuery,
  AdminBindersQueryVariables
> = gql`
  query AdminBinders($limit: Int, $offset: Int) {
    adminBinders(limit: $limit, offset: $offset) {
      id userId name visibility isDeleted createdAt
    }
  }
`;

export interface AdminUserCollectionsQueryVariables { limit?: number | null; search?: string | null }
export interface AdminUserCollectionsQuery { adminUserCollections: UserCollectionSummary[] }
export const AdminUserCollectionsDocument: TypedDocumentNode<
  AdminUserCollectionsQuery,
  AdminUserCollectionsQueryVariables
> = gql`
  query AdminUserCollections($limit: Int, $search: String) {
    adminUserCollections(limit: $limit, search: $search) {
      userId username email totalCards distinctCards
    }
  }
`;

export interface AdminQueryReportedUsersQueryVariables {
  page?: number | null;
  pageSize?: number | null;
  isCleared?: boolean | null;
}
export interface AdminQueryReportedUsersQuery { adminQueryReportedUsers: ReportedUser[] }
export const AdminQueryReportedUsersDocument: TypedDocumentNode<
  AdminQueryReportedUsersQuery,
  AdminQueryReportedUsersQueryVariables
> = gql`
  query AdminQueryReportedUsers($page: Int, $pageSize: Int, $isCleared: Boolean) {
    adminQueryReportedUsers(page: $page, pageSize: $pageSize, isCleared: $isCleared) {
      id userId reporterId reason details isCleared createdAt updatedAt
      user { id username avatar }
      reporter { id username avatar }
    }
  }
`;

export interface AdminTradesQueryVariables {
  page?: number | null;
  pageSize?: number | null;
  status?: TradeStatus | null;
  userId?: string | null;
}
export interface AdminTradesQuery { adminTrades: Trade[] }
export const AdminTradesDocument: TypedDocumentNode<AdminTradesQuery, AdminTradesQueryVariables> = gql`
  query AdminTrades($page: Int, $pageSize: Int, $status: TradeStatus, $userId: ID) {
    adminTrades(page: $page, pageSize: $pageSize, status: $status, userId: $userId) {
      id partyAId partyBId status createdAt updatedAt adminNotes
    }
  }
`;

export interface AdminTradeDisputesQueryVariables { status?: string | null }
export interface AdminTradeDisputesQuery { adminTradeDisputes: TradeDispute[] }
export const AdminTradeDisputesDocument: TypedDocumentNode<
  AdminTradeDisputesQuery,
  AdminTradeDisputesQueryVariables
> = gql`
  query AdminTradeDisputes($status: String) {
    adminTradeDisputes(status: $status) {
      id tradeId raisedById reason status resolution resolvedAt createdAt
    }
  }
`;

export interface AdminTradeBansQuery { adminTradeBans: TradeBan[] }
export const AdminTradeBansDocument: TypedDocumentNode<
  AdminTradeBansQuery,
  Record<string, never>
> = gql`
  query AdminTradeBans { adminTradeBans { userId reason bannedBy bannedAt } }
`;

export interface AdminOrdersQueryVariables {
  paymentStatus?: string | null;
  fulfilmentStatus?: string | null;
  limit?: number | null;
  offset?: number | null;
}
export interface AdminOrdersQuery { adminOrders: Order[] }
export const AdminOrdersDocument: TypedDocumentNode<AdminOrdersQuery, AdminOrdersQueryVariables> = gql`
  query AdminOrders($paymentStatus: String, $fulfilmentStatus: String, $limit: Int, $offset: Int) {
    adminOrders(
      paymentStatus: $paymentStatus, fulfilmentStatus: $fulfilmentStatus,
      limit: $limit, offset: $offset
    ) {
      id orderNumber totalAmount currency paymentStatus fulfilmentStatus
      buyerId sellerId cardId createdAt updatedAt
      buyer { id username }
      seller { id username }
    }
  }
`;

export interface AdminListingsQueryVariables {
  status?: string | null;
  sellerId?: string | null;
  limit?: number | null;
  offset?: number | null;
}
export interface AdminListingsQuery { adminListings: CardListing[] }
export const AdminListingsDocument: TypedDocumentNode<
  AdminListingsQuery,
  AdminListingsQueryVariables
> = gql`
  query AdminListings($status: String, $sellerId: ID, $limit: Int, $offset: Int) {
    adminListings(status: $status, sellerId: $sellerId, limit: $limit, offset: $offset) {
      id sellerId cardId title condition price currency quantity status createdAt updatedAt
    }
  }
`;

export interface AdminNotificationsQueryVariables {
  page?: number | null;
  pageSize?: number | null;
  userId?: string | null;
  type?: string | null;
}
export interface AdminNotificationsQuery { adminNotifications: NotificationPage }
export const AdminNotificationsDocument: TypedDocumentNode<
  AdminNotificationsQuery,
  AdminNotificationsQueryVariables
> = gql`
  query AdminNotifications($page: Int, $pageSize: Int, $userId: ID, $type: String) {
    adminNotifications(page: $page, pageSize: $pageSize, userId: $userId, type: $type) {
      notifications { id type title body isRead isDismissed createdAt }
      total page pageSize
    }
  }
`;

// ── Admin Mutations ───────────────────────────────────────────────────────────

export interface AdminBanUserMutationVariables { id: string }
export interface AdminBanUserMutation { adminBanUser: boolean }
export const AdminBanUserDocument: TypedDocumentNode<
  AdminBanUserMutation,
  AdminBanUserMutationVariables
> = gql`
  mutation AdminBanUser($id: ID!) { adminBanUser(id: $id) }
`;

export interface AdminUnbanUserMutationVariables { id: string }
export interface AdminUnbanUserMutation { adminUnbanUser: boolean }
export const AdminUnbanUserDocument: TypedDocumentNode<
  AdminUnbanUserMutation,
  AdminUnbanUserMutationVariables
> = gql`
  mutation AdminUnbanUser($id: ID!) { adminUnbanUser(id: $id) }
`;

export interface AdminDeleteUserMutationVariables { id: string }
export interface AdminDeleteUserMutation { adminDeleteUser: boolean }
export const AdminDeleteUserDocument: TypedDocumentNode<
  AdminDeleteUserMutation,
  AdminDeleteUserMutationVariables
> = gql`
  mutation AdminDeleteUser($id: ID!) { adminDeleteUser(id: $id) }
`;

export interface AdminDeleteBinderMutationVariables { id: string; permanent?: boolean | null }
export interface AdminDeleteBinderMutation { adminDeleteBinder: boolean }
export const AdminDeleteBinderDocument: TypedDocumentNode<
  AdminDeleteBinderMutation,
  AdminDeleteBinderMutationVariables
> = gql`
  mutation AdminDeleteBinder($id: ID!, $permanent: Boolean) {
    adminDeleteBinder(id: $id, permanent: $permanent)
  }
`;

export interface AdminSendBroadcastNotificationMutationVariables {
  input: BroadcastNotificationInput;
}
export interface AdminSendBroadcastNotificationMutation {
  adminSendBroadcastNotification: boolean;
}
export const AdminSendBroadcastNotificationDocument: TypedDocumentNode<
  AdminSendBroadcastNotificationMutation,
  AdminSendBroadcastNotificationMutationVariables
> = gql`
  mutation AdminSendBroadcastNotification($input: BroadcastNotificationInput!) {
    adminSendBroadcastNotification(input: $input)
  }
`;

export interface AdminDeleteNotificationMutationVariables { id: string }
export interface AdminDeleteNotificationMutation { adminDeleteNotification: boolean }
export const AdminDeleteNotificationDocument: TypedDocumentNode<
  AdminDeleteNotificationMutation,
  AdminDeleteNotificationMutationVariables
> = gql`
  mutation AdminDeleteNotification($id: ID!) { adminDeleteNotification(id: $id) }
`;

export interface AdminUpdateOrderFulfilmentStatusMutationVariables {
  orderId: string;
  status: string;
}
export interface AdminUpdateOrderFulfilmentStatusMutation {
  adminUpdateOrderFulfilmentStatus: Order;
}
export const AdminUpdateOrderFulfilmentStatusDocument: TypedDocumentNode<
  AdminUpdateOrderFulfilmentStatusMutation,
  AdminUpdateOrderFulfilmentStatusMutationVariables
> = gql`
  mutation AdminUpdateOrderFulfilmentStatus($orderId: ID!, $status: String!) {
    adminUpdateOrderFulfilmentStatus(orderId: $orderId, status: $status) {
      id fulfilmentStatus paymentStatus updatedAt
    }
  }
`;

export interface AdminCreateProductListingMutationVariables { input: ProductListingInput }
export interface AdminCreateProductListingMutation { adminCreateProductListing: ProductListing }
export const AdminCreateProductListingDocument: TypedDocumentNode<
  AdminCreateProductListingMutation,
  AdminCreateProductListingMutationVariables
> = gql`
  mutation AdminCreateProductListing($input: ProductListingInput!) {
    adminCreateProductListing(input: $input) {
      id title description imageUrl price currency quantity status
      fulfilmentType fulfilmentProvider createdAt updatedAt
      inventory { id onHand reserved sold }
    }
  }
`;

export interface AdminUpdateProductListingMutationVariables {
  id: string;
  input: ProductListingInput;
}
export interface AdminUpdateProductListingMutation { adminUpdateProductListing: ProductListing }
export const AdminUpdateProductListingDocument: TypedDocumentNode<
  AdminUpdateProductListingMutation,
  AdminUpdateProductListingMutationVariables
> = gql`
  mutation AdminUpdateProductListing($id: ID!, $input: ProductListingInput!) {
    adminUpdateProductListing(id: $id, input: $input) {
      id title description imageUrl price currency quantity status
      fulfilmentType fulfilmentProvider updatedAt
      inventory { id onHand reserved sold }
    }
  }
`;

export interface AdminSendSystemMessageMutationVariables {
  receiverId: string;
  content: string;
  meta?: unknown;
}
export interface AdminSendSystemMessageMutation { adminSendSystemMessage: Message }
export const AdminSendSystemMessageDocument: TypedDocumentNode<
  AdminSendSystemMessageMutation,
  AdminSendSystemMessageMutationVariables
> = gql`
  mutation AdminSendSystemMessage($receiverId: ID!, $content: String!, $meta: JSON) {
    adminSendSystemMessage(receiverId: $receiverId, content: $content, meta: $meta) {
      id senderId receiverId content isSystemMessage createdAt
    }
  }
`;

export interface AdminGrantAchievementMutationVariables {
  userId: string;
  achievementId: string;
  data?: unknown;
}
export interface AdminGrantAchievementMutation { adminGrantAchievement: UserAchievement }
export const AdminGrantAchievementDocument: TypedDocumentNode<
  AdminGrantAchievementMutation,
  AdminGrantAchievementMutationVariables
> = gql`
  mutation AdminGrantAchievement($userId: ID!, $achievementId: ID!, $data: JSON) {
    adminGrantAchievement(userId: $userId, achievementId: $achievementId, data: $data) {
      id earnedAt
      achievement { id code name tier }
    }
  }
`;

export interface GrantRewardMutationVariables {
  userId: string;
  type: string;
  achievementId?: string | null;
  data?: unknown;
}
export interface GrantRewardMutation { grantReward: Reward }
export const GrantRewardDocument: TypedDocumentNode<
  GrantRewardMutation,
  GrantRewardMutationVariables
> = gql`
  mutation GrantReward($userId: ID!, $type: String!, $achievementId: ID, $data: JSON) {
    grantReward(userId: $userId, type: $type, achievementId: $achievementId, data: $data) {
      id userId type achievementId data grantedBy createdAt
    }
  }
`;

export interface AdminClearUserReportMutationVariables { userId: string }
export interface AdminClearUserReportMutation { adminClearUserReport: boolean }
export const AdminClearUserReportDocument: TypedDocumentNode<
  AdminClearUserReportMutation,
  AdminClearUserReportMutationVariables
> = gql`
  mutation AdminClearUserReport($userId: ID!) { adminClearUserReport(userId: $userId) }
`;

export interface AdminBanUserFromChatMutationVariables { userId: string; reason?: string | null }
export interface AdminBanUserFromChatMutation { adminBanUserFromChat: boolean }
export const AdminBanUserFromChatDocument: TypedDocumentNode<
  AdminBanUserFromChatMutation,
  AdminBanUserFromChatMutationVariables
> = gql`
  mutation AdminBanUserFromChat($userId: ID!, $reason: String) {
    adminBanUserFromChat(userId: $userId, reason: $reason)
  }
`;

export interface AdminUnbanUserFromChatMutationVariables { userId: string }
export interface AdminUnbanUserFromChatMutation { adminUnbanUserFromChat: boolean }
export const AdminUnbanUserFromChatDocument: TypedDocumentNode<
  AdminUnbanUserFromChatMutation,
  AdminUnbanUserFromChatMutationVariables
> = gql`
  mutation AdminUnbanUserFromChat($userId: ID!) { adminUnbanUserFromChat(userId: $userId) }
`;

export interface AdminDeleteMessageMutationVariables { id: string }
export interface AdminDeleteMessageMutation { adminDeleteMessage: boolean }
export const AdminDeleteMessageDocument: TypedDocumentNode<
  AdminDeleteMessageMutation,
  AdminDeleteMessageMutationVariables
> = gql`
  mutation AdminDeleteMessage($id: ID!) { adminDeleteMessage(id: $id) }
`;

export interface AdminResolveTradeDisputeMutationVariables {
  id: string;
  resolution: string;
  resolvedInFavourOf?: string | null;
}
export interface AdminResolveTradeDisputeMutation { adminResolveTradeDispute: Trade }
export const AdminResolveTradeDisputeDocument: TypedDocumentNode<
  AdminResolveTradeDisputeMutation,
  AdminResolveTradeDisputeMutationVariables
> = gql`
  mutation AdminResolveTradeDispute($id: ID!, $resolution: String!, $resolvedInFavourOf: String) {
    adminResolveTradeDispute(id: $id, resolution: $resolution, resolvedInFavourOf: $resolvedInFavourOf) {
      id status adminNotes dispute { id status resolution resolvedAt }
    }
  }
`;

export interface AdminBanUserFromTradingMutationVariables { userId: string; reason?: string | null }
export interface AdminBanUserFromTradingMutation { adminBanUserFromTrading: boolean }
export const AdminBanUserFromTradingDocument: TypedDocumentNode<
  AdminBanUserFromTradingMutation,
  AdminBanUserFromTradingMutationVariables
> = gql`
  mutation AdminBanUserFromTrading($userId: ID!, $reason: String) {
    adminBanUserFromTrading(userId: $userId, reason: $reason)
  }
`;

export interface AdminSetUserRestrictionMutationVariables {
  userId: string;
  restrictionLevel?: string | null;
}
export interface AdminSetUserRestrictionMutation { adminSetUserRestriction: SafetyProfile }
export const AdminSetUserRestrictionDocument: TypedDocumentNode<
  AdminSetUserRestrictionMutation,
  AdminSetUserRestrictionMutationVariables
> = gql`
  mutation AdminSetUserRestriction($userId: ID!, $restrictionLevel: String) {
    adminSetUserRestriction(userId: $userId, restrictionLevel: $restrictionLevel) {
      restrictionLevel capabilities { canTrade canPost canMessage canConnectDiscord }
    }
  }
`;
