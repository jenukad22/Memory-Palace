import './fsrs-typecheck'; // compile-time ts-fsrs guards

export * from './schema';
export type { Db } from './types';
export { newId } from './id';
export { runMigrations } from './migrate';
export * from './queries/cards';
export * from './queries/reviews';
export * from './queries/assessments';
export * from './queries/ability';
export * from './queries/sessions';
export { seedDemoCards } from './seed';
export { runDbSelfTest, type SelfTestResult } from './selftest';
export { createDb, type AppDb } from './client';
