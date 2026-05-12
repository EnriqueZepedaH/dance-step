// Re-export of the shared Database types from packages/db so that
// apps/web's imports of `@/lib/db/types` keep working. The source of
// truth lives in packages/db (a workspace package); the typegen
// script regenerates packages/db/src/types.ts and then rebuilds the
// package's dist.
export * from "@dancestep/db";
