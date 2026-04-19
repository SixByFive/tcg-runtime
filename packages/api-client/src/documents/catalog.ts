import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { gql } from 'graphql-tag';
import type {
  CardSet,
  CardsearchDetail,
  CardSearchResult,
  CardSearchInput,
  PriceObservation,
  PriceRollup,
} from '@sixbyfive/api-types';

export interface CardsearchSetsQueryVariables { limit?: number | null; offset?: number | null }
export interface CardsearchSetsQuery { cardsearchSets: CardSet[] }
export const CardsearchSetsDocument: TypedDocumentNode<
  CardsearchSetsQuery,
  CardsearchSetsQueryVariables
> = gql`
  query CardsearchSets($limit: Int, $offset: Int) {
    cardsearchSets(limit: $limit, offset: $offset) {
      code abbr name series releasedAt lang total
    }
  }
`;

export interface CardsearchSetByCodeQueryVariables { code: string }
export interface CardsearchSetByCodeQuery { cardsearchSetByCode: CardSet | null | undefined }
export const CardsearchSetByCodeDocument: TypedDocumentNode<
  CardsearchSetByCodeQuery,
  CardsearchSetByCodeQueryVariables
> = gql`
  query CardsearchSetByCode($code: String!) {
    cardsearchSetByCode(code: $code) { code abbr name series releasedAt lang total }
  }
`;

export interface SearchCardsQueryVariables { input: CardSearchInput }
export interface SearchCardsQuery { searchCards: CardSearchResult }
export const SearchCardsDocument: TypedDocumentNode<SearchCardsQuery, SearchCardsQueryVariables> = gql`
  query SearchCards($input: CardSearchInput!) {
    searchCards(input: $input) {
      total limit offset
      items {
        cardId id setCode number name rarity
        images { large small }
        set { code name }
        variants { key default label }
        latestPrices { variation currency market mid low high updatedAt }
      }
    }
  }
`;

export interface CardsearchCardQueryVariables { id: string; variant?: string | null }
export interface CardsearchCardQuery { cardsearchCard: CardsearchDetail | null | undefined }
export const CardsearchCardDocument: TypedDocumentNode<
  CardsearchCardQuery,
  CardsearchCardQueryVariables
> = gql`
  query CardsearchCard($id: ID!, $variant: String) {
    cardsearchCard(id: $id, variant: $variant) {
      cardId id setCode number name rarity
      images { large small }
      set { code name }
      variants { key default label }
      latestPrices { variation currency gbp market mid low high updatedAt provider }
    }
  }
`;

export interface CardsearchPriceObservationsQueryVariables {
  cardId: string;
  variant?: string | null;
  limit?: number | null;
}
export interface CardsearchPriceObservationsQuery {
  cardsearchPriceObservations: PriceObservation[];
}
export const CardsearchPriceObservationsDocument: TypedDocumentNode<
  CardsearchPriceObservationsQuery,
  CardsearchPriceObservationsQueryVariables
> = gql`
  query CardsearchPriceObservations($cardId: ID!, $variant: String, $limit: Int) {
    cardsearchPriceObservations(cardId: $cardId, variant: $variant, limit: $limit) {
      date market mid low high
    }
  }
`;

export interface CardsearchPriceRollupsQueryVariables { cardId: string; variant?: string | null }
export interface CardsearchPriceRollupsQuery { cardsearchPriceRollups: PriceRollup[] }
export const CardsearchPriceRollupsDocument: TypedDocumentNode<
  CardsearchPriceRollupsQuery,
  CardsearchPriceRollupsQueryVariables
> = gql`
  query CardsearchPriceRollups($cardId: ID!, $variant: String) {
    cardsearchPriceRollups(cardId: $cardId, variant: $variant) {
      currency
      latest { date market }
      d7 { avg change changePct }
      d30 { avg change changePct }
      d90 { avg change changePct }
    }
  }
`;
