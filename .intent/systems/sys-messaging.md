---
id: sys-messaging
title: Realtime Service & Messaging
type: system
created: "2026-05-08T00:00:00.000Z"
updated: "2026-05-08T00:00:00.000Z"
plans: []
decisions: [DEC-0004, DEC-0007]
tags: [realtime, websocket, sse, messaging, chat]
---

## Overview

Realtime-service (port `4018`) delivers live events to connected clients via WebSocket and SSE. It is the final hop for all push notifications, chat messages, and live feed updates. Clients connect indirectly — the gateway proxies the connection.

Messaging (chat) is part of the gateway GraphQL schema, backed by the messaging-service or realtime-service depending on the operation.

## Key responsibilities

- Accept WebSocket / SSE connections from authenticated clients
- Receive internal `POST /internal/push` calls from notifications-service
- Fan out events to connected sessions by userId
- Redis pub/sub for multi-instance fan-out

## GraphQL messaging schema (via gateway)

| Operation | Type | Description |
|-----------|------|-------------|
| `myChats(page, pageSize)` | Query | List chat threads |
| `chatWithUser(userId, page, pageSize)` | Query | Message history with a user |
| `unreadMessageCount` | Query | Badge count |
| `hasAgreedToChatRules` | Query | Chat safety gate |
| `chatRulesText` | Query | Rules text for the safety gate modal |
| `sendMessage(toUserId, body)` | Mutation | Send a chat message |
| `agreeToRules` | Mutation | Accept chat rules |
| `muteConversation` / `unmuteConversation` | Mutation | Mute/unmute |
| `blockUser` / `unblockUser` | Mutation | Block/unblock |
| `reportUser` | Mutation | Flag for moderation |

## Chat message shape (current schema)

```graphql
type Message {
  id: ID!
  body: String!
  createdAt: String!
  user: PublicUser!   # sender
}
```

Note: old schema fields `sender`, `receiver`, `isFlagged`, `expiresAt`, `updatedAt` were removed.

## Connection

Clients connect to `EXPO_PUBLIC_SOCKET_URL` (port `4020` in README; actual realtime-service port is `4018` internally — Docker maps as needed).
