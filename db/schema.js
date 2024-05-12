import { timestamp, jsonb, pgTable, varchar, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const votings = pgTable('votings', {
    id: varchar('id').primaryKey(),
    active: boolean('active'),
    allowed_participants: jsonb('allowed_participants').default([]),
    allow_all: boolean('allow_all').default(false),
    created_at: timestamp('created_at').defaultNow(),
});

export const keys = pgTable('keys', {
    publicKey: varchar('publicKey', { length: 256 }).primaryKey(),
    vote_id: varchar('vote_id'),
    email: varchar('email', { length: 128 }),
    name: varchar('name', { length: 256 }),
    created_at: timestamp('created_at').defaultNow(),
});

export const votingsRelations = relations(votings, ({ many }) => ({
    keys: many(keys),
}));

export const keysRelations = relations(keys, ({ one }) => ({
    vote: one(votings, { fields: [keys.vote_id], references: [votings.id] }),
}));