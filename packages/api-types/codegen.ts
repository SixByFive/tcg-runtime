import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: './schema.graphql',
  generates: {
    './src/generated.ts': {
      plugins: ['typescript'],
      config: {
        scalars: {
          JSON: 'unknown',
          ID: 'string',
        },
        enumsAsTypes: true,
        avoidOptionals: false,
        maybeValue: 'T | null | undefined',
        skipTypename: true,
      },
    },
  },
};

export default config;
