import {
    pgTable,
    uuid,
    integer,
    text,
    timestamp,
    boolean,
    bigint,
    date,
    unique,
    index,
    primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. ecosystems - Hierarchical ecosystem structure
export const ecosystems = pgTable(
    'ecosystems',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        name: text('name').notNull().unique(),
        parentId: integer('parent_id'),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => ({
        parentIdIdx: index('ecosystems_parent_id_idx').on(table.parentId),
    }),
);

export const ecosystemsRelations = relations(ecosystems, ({ one, many }) => ({
    parent: one(ecosystems, {
        fields: [ecosystems.parentId],
        references: [ecosystems.id],
    }),
    children: many(ecosystems),
}));

// 2. agencies - Agencies/organizations that source repositories, authors, or events
export const agencies = pgTable('agencies', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull().unique(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 3. repositories - GitHub repositories
export const repositories = pgTable(
    'repositories',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        githubId: bigint('github_id', { mode: 'number' }).notNull().unique(),
        fullName: text('full_name').notNull().unique(),
        agencyId: integer('agency_id').references(() => agencies.id, {
            onDelete: 'set null',
        }),
        isFork: boolean('is_fork').notNull().default(false),
        parentRepositoryId: integer('parent_repository_id'),
        parentFullName: text('parent_full_name'),
        defaultBranch: text('default_branch').notNull().default('main'),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    },
    (table) => ({
        agencyIdIdx: index('repositories_agency_id_idx').on(table.agencyId),
        parentRepositoryIdIdx: index('repositories_parent_repository_id_idx').on(
            table.parentRepositoryId,
        ),
        isForkIdx: index('repositories_is_fork_idx').on(table.isFork),
    }),
);

// 4. authors - Commit authors/contributors
export const authors = pgTable(
    'authors',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        githubId: bigint('github_id', { mode: 'number' }).unique(),
        username: text('username'),
        name: text('name'),
        email: text('email'),
        agencyId: integer('agency_id').references(() => agencies.id, {
            onDelete: 'set null',
        }),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => ({
        githubIdIdx: index('authors_github_id_idx').on(table.githubId),
        emailIdx: index('authors_email_idx').on(table.email),
        usernameIdx: index('authors_username_idx').on(table.username),
        agencyIdIdx: index('authors_agency_id_idx').on(table.agencyId),
    }),
);

// 5. commits - Individual commits
export const commits = pgTable(
    'commits',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        repositoryId: integer('repository_id')
            .notNull()
            .references(() => repositories.id, {
                onDelete: 'cascade',
            }),
        authorId: integer('author_id')
            .notNull()
            .references(() => authors.id, {
                onDelete: 'set null',
            }),
        sha: text('sha').notNull(),
        commitDate: timestamp('commit_date', { withTimezone: true }).notNull(),
        branch: text('branch').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => ({
        repositoryIdIdx: index('commits_repository_id_idx').on(table.repositoryId),
        authorIdIdx: index('commits_author_id_idx').on(table.authorId),
        shaIdx: index('commits_sha_idx').on(table.sha),
        commitDateIdx: index('commits_commit_date_idx').on(table.commitDate),
        branchIdx: index('commits_branch_idx').on(table.branch),
        repositoryCommitDateIdx: index('commits_repository_commit_date_idx').on(
            table.repositoryId,
            table.commitDate,
        ),
        authorCommitDateIdx: index('commits_author_commit_date_idx').on(
            table.authorId,
            table.commitDate,
        ),
        repositoryShaUnique: unique('commits_repository_sha_unique').on(
            table.repositoryId,
            table.sha,
        ),
    }),
);

// 6. events - Events like hackathons, conferences, etc.
export const events = pgTable(
    'events',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        name: text('name').notNull().unique(),
        description: text('description'),
        startDate: date('start_date'),
        endDate: date('end_date'),
        agencyId: integer('agency_id').references(() => agencies.id, {
            onDelete: 'set null',
        }),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => ({
        agencyIdIdx: index('events_agency_id_idx').on(table.agencyId),
    }),
);

// 7. author_events - Many-to-many: Authors associated with events
export const authorEvents = pgTable(
    'author_events',
    {
        authorId: integer('author_id')
            .notNull()
            .references(() => authors.id, {
                onDelete: 'cascade',
            }),
        eventId: integer('event_id')
            .notNull()
            .references(() => events.id, {
                onDelete: 'cascade',
            }),
    },
    (table) => ({
        pk: primaryKey({ columns: [table.authorId, table.eventId] }),
        authorIdIdx: index('author_events_author_id_idx').on(table.authorId),
        eventIdIdx: index('author_events_event_id_idx').on(table.eventId),
    }),
);

// 8. repository_events - Many-to-many: Repositories associated with events
export const repositoryEvents = pgTable(
    'repository_events',
    {
        repositoryId: integer('repository_id')
            .notNull()
            .references(() => repositories.id, {
                onDelete: 'cascade',
            }),
        eventId: integer('event_id')
            .notNull()
            .references(() => events.id, {
                onDelete: 'cascade',
            }),
    },
    (table) => ({
        pk: primaryKey({ columns: [table.repositoryId, table.eventId] }),
        repositoryIdIdx: index('repository_events_repository_id_idx').on(table.repositoryId),
        eventIdIdx: index('repository_events_event_id_idx').on(table.eventId),
    }),
);

// 9. repository_ecosystems - Many-to-many: Repositories associated with ecosystems
export const repositoryEcosystems = pgTable(
    'repository_ecosystems',
    {
        repositoryId: integer('repository_id')
            .notNull()
            .references(() => repositories.id, {
                onDelete: 'cascade',
            }),
        ecosystemId: integer('ecosystem_id')
            .notNull()
            .references(() => ecosystems.id, {
                onDelete: 'set null',
            }),
    },
    (table) => ({
        pk: primaryKey({ columns: [table.repositoryId, table.ecosystemId] }),
        repositoryIdIdx: index('repository_ecosystems_repository_id_idx').on(table.repositoryId),
        ecosystemIdIdx: index('repository_ecosystems_ecosystem_id_idx').on(table.ecosystemId),
    }),
);
