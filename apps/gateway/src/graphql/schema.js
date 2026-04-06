import { gql } from 'graphql-tag';

/**
 * Public GraphQL contract exposed by gateway.
 *
 * Gateway owns the public graph.
 * Internal services own the business logic.
 */
export const typeDefs = gql`
  type Query {
    health: HealthStatus!
    dbHealth: DependencyStatus!
    serviceHealth: ServiceHealth!
    me: AuthUser
  }

  type Mutation {
    login(
      email: String
      username: String
      password: String!
      twoFactorToken: String
    ): AuthPayload!

    register(
      username: String!
      email: String!
      password: String!
      referrerId: ID
    ): AuthPayload!
  }

  type HealthStatus {
    status: String!
    service: String!
  }

  type DependencyStatus {
    ok: Boolean!
    status: String!
    error: String
    name: String
    code: String
    errno: Int
    sqlState: String
    sqlMessage: String
  }

  type ServiceHealth {
    gateway: HealthStatus!
    auth: JSON
    catalog: JSON
  }

  type AuthUser {
    id: ID
    username: String
    email: String
    isAdmin: Boolean
    emailVerified: Boolean
    twoFactorEnabled: Boolean
  }

  type AuthPayload {
    token: String
    user: AuthUser
  }

  scalar JSON
`;