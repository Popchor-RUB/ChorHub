/**
 * Jest-safe stub for the generated Prisma client.
 *
 * The real generated client (src/generated/prisma/client.ts) uses `import.meta.url`
 * which Jest's CJS runtime cannot handle. This stub is loaded instead at test
 * runtime via moduleNameMapper. TypeScript still resolves the real generated
 * types for type-checking — only the runtime module is swapped.
 */
export * from '../../generated/prisma/enums';

// Minimal stub — jest-mock-extended creates a Proxy regardless of class body.
export class PrismaClient {}
