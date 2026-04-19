import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { gql } from 'graphql-tag';
import type { UserProfile, PublicUser } from '@sbf/api-types';

export interface UserProfileQueryVariables { username: string }
export interface UserProfileQuery { userProfile: UserProfile | null | undefined }
export const UserProfileDocument: TypedDocumentNode<UserProfileQuery, UserProfileQueryVariables> = gql`
  query UserProfile($username: String!) {
    userProfile(username: $username) {
      id userId bio favouritePokemon avatar country status
      publicProfile wantsTrade wantsMarketplace
      user { id username email emailVerified isAdmin restrictionLevel avatar createdAt updatedAt }
    }
  }
`;

export interface UserByIdQueryVariables { id: string }
export interface UserByIdQuery { userById: UserProfile | null | undefined }
export const UserByIdDocument: TypedDocumentNode<UserByIdQuery, UserByIdQueryVariables> = gql`
  query UserById($id: ID!) {
    userById(id: $id) {
      id userId bio favouritePokemon avatar country status
      publicProfile wantsTrade wantsMarketplace
      user { id username email emailVerified isAdmin restrictionLevel avatar createdAt updatedAt }
    }
  }
`;

export interface SearchUsersQueryVariables { q: string; limit?: number | null }
export interface SearchUsersQuery { searchUsers: PublicUser[] }
export const SearchUsersDocument: TypedDocumentNode<SearchUsersQuery, SearchUsersQueryVariables> = gql`
  query SearchUsers($q: String!, $limit: Int) {
    searchUsers(q: $q, limit: $limit) { id username avatar bio country createdAt }
  }
`;

export interface UpdateProfileMutationVariables {
  bio?: string | null;
  favouritePokemon?: string | null;
  avatar?: string | null;
  country?: string | null;
  status?: string | null;
  publicProfile?: boolean | null;
  wantsTrade?: boolean | null;
  wantsMarketplace?: boolean | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  postcode?: string | null;
  state?: string | null;
  phone?: string | null;
  discord?: string | null;
}
export interface UpdateProfileMutation { updateProfile: UserProfile }
export const UpdateProfileDocument: TypedDocumentNode<
  UpdateProfileMutation,
  UpdateProfileMutationVariables
> = gql`
  mutation UpdateProfile(
    $bio: String, $favouritePokemon: String, $avatar: String, $country: String,
    $status: String, $publicProfile: Boolean, $wantsTrade: Boolean, $wantsMarketplace: Boolean,
    $address1: String, $address2: String, $city: String, $postcode: String,
    $state: String, $phone: String, $discord: String
  ) {
    updateProfile(
      bio: $bio, favouritePokemon: $favouritePokemon, avatar: $avatar, country: $country,
      status: $status, publicProfile: $publicProfile, wantsTrade: $wantsTrade,
      wantsMarketplace: $wantsMarketplace, address1: $address1, address2: $address2,
      city: $city, postcode: $postcode, state: $state, phone: $phone, discord: $discord
    ) {
      id userId bio favouritePokemon avatar country status publicProfile wantsTrade wantsMarketplace
    }
  }
`;
