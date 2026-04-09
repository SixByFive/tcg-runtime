/**
 * Exports the gateway GraphQL schema to schema.graphql
 * Usage: node scripts/export-schema.js
 */
import { writeFileSync } from 'node:fs';
import { printSchema, buildASTSchema } from 'graphql';
import { typeDefs } from '../src/graphql/schema.js';

const schema = buildASTSchema(typeDefs);
const sdl = printSchema(schema);

writeFileSync(new URL('../schema.graphql', import.meta.url), sdl);
console.log('schema.graphql written');
