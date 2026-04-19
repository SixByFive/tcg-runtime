import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { gql } from 'graphql-tag';
import type { Achievement, UserAchievement } from '@sixbyfive/api-types';

const ACHIEVEMENT_FIELDS = `id code name description tier iconUrl createdAt updatedAt`;
const USER_ACHIEVEMENT_FIELDS = `
  id earnedAt
  achievement { ${ACHIEVEMENT_FIELDS} }
`;

export interface AchievementsQuery { achievements: Achievement[] }
export const AchievementsDocument: TypedDocumentNode<AchievementsQuery, Record<string, never>> = gql`
  query Achievements { achievements { ${ACHIEVEMENT_FIELDS} } }
`;

export interface MyAchievementsQuery { myAchievements: UserAchievement[] }
export const MyAchievementsDocument: TypedDocumentNode<
  MyAchievementsQuery,
  Record<string, never>
> = gql`
  query MyAchievements { myAchievements { ${USER_ACHIEVEMENT_FIELDS} } }
`;

export interface UserAchievementsQueryVariables { userId: string }
export interface UserAchievementsQuery { userAchievements: UserAchievement[] }
export const UserAchievementsDocument: TypedDocumentNode<
  UserAchievementsQuery,
  UserAchievementsQueryVariables
> = gql`
  query UserAchievements($userId: ID!) {
    userAchievements(userId: $userId) { ${USER_ACHIEVEMENT_FIELDS} }
  }
`;
