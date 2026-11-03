import { text, uuid } from 'drizzle-orm/pg-core';

export const pulls = {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),
};
