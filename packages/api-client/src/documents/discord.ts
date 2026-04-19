import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { gql } from 'graphql-tag';
import type { DiscordGuild, DiscordChannel } from '@sixbyfive/api-types';

export interface DiscordShareGuildsQuery { discordShareGuilds: DiscordGuild[] }
export const DiscordShareGuildsDocument: TypedDocumentNode<
  DiscordShareGuildsQuery,
  Record<string, never>
> = gql`
  query DiscordShareGuilds {
    discordShareGuilds { id name icon botPresent }
  }
`;

export interface DiscordShareChannelsQueryVariables { guildId: string }
export interface DiscordShareChannelsQuery { discordShareChannels: DiscordChannel[] }
export const DiscordShareChannelsDocument: TypedDocumentNode<
  DiscordShareChannelsQuery,
  DiscordShareChannelsQueryVariables
> = gql`
  query DiscordShareChannels($guildId: String!) {
    discordShareChannels(guildId: $guildId) { id name type }
  }
`;

export interface ShareCollectionToDiscordMutationVariables {
  guildId: string;
  channelId: string;
  cardId: string;
  cardName: string;
  variation?: string | null;
  quantity?: number | null;
  imageUrl?: string | null;
}
export interface ShareCollectionToDiscordMutation { shareCollectionToDiscord: boolean }
export const ShareCollectionToDiscordDocument: TypedDocumentNode<
  ShareCollectionToDiscordMutation,
  ShareCollectionToDiscordMutationVariables
> = gql`
  mutation ShareCollectionToDiscord(
    $guildId: String!, $channelId: String!, $cardId: String!, $cardName: String!,
    $variation: String, $quantity: Int, $imageUrl: String
  ) {
    shareCollectionToDiscord(
      guildId: $guildId, channelId: $channelId, cardId: $cardId, cardName: $cardName,
      variation: $variation, quantity: $quantity, imageUrl: $imageUrl
    )
  }
`;

export interface ShareWishlistToDiscordMutationVariables {
  guildId: string;
  channelId: string;
  cardId: string;
  cardName: string;
  variation?: string | null;
  imageUrl?: string | null;
}
export interface ShareWishlistToDiscordMutation { shareWishlistToDiscord: boolean }
export const ShareWishlistToDiscordDocument: TypedDocumentNode<
  ShareWishlistToDiscordMutation,
  ShareWishlistToDiscordMutationVariables
> = gql`
  mutation ShareWishlistToDiscord(
    $guildId: String!, $channelId: String!, $cardId: String!, $cardName: String!,
    $variation: String, $imageUrl: String
  ) {
    shareWishlistToDiscord(
      guildId: $guildId, channelId: $channelId, cardId: $cardId, cardName: $cardName,
      variation: $variation, imageUrl: $imageUrl
    )
  }
`;
