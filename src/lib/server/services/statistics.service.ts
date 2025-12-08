import { db } from "$lib/server/db";
import { sql, eq, and, gte, lte, inArray } from "drizzle-orm";
import {
    ecosystems,
    repositoryEcosystems,
    commits,
    repositories,
    authors,
    events,
    authorEvents,
    repositoryEvents,
    agencies,
} from "$lib/server/db/schema";

/**
 * Get statistics for a specific ecosystem
 */
export async function getEcosystemStatistics(
    ecosystemId: string,
    options?: {
        startDate?: Date;
        endDate?: Date;
        includeChildren?: boolean;
    },
) {
    const { startDate, endDate, includeChildren = false } = options || {};

    // Get ecosystem and potentially its children
    let ecosystemIds = [ecosystemId];
    if (includeChildren) {
        // Get all child ecosystems recursively
        const childEcosystems = await getDescendantEcosystemIds(ecosystemId);
        ecosystemIds = [ecosystemId, ...childEcosystems];
    }

    // Get all repositories for this ecosystem (and children if requested)
    const ecosystemRepos = await db
        .select({ repositoryId: repositoryEcosystems.repositoryId })
        .from(repositoryEcosystems)
        .where(inArray(repositoryEcosystems.ecosystemId, ecosystemIds));

    const repositoryIds = ecosystemRepos.map((r) => r.repositoryId);

    if (repositoryIds.length === 0) {
        return {
            ecosystemId,
            totalRepositories: 0,
            totalCommits: 0,
            totalContributors: 0,
        };
    }

    // Build date filters
    const dateFilters = [];
    if (startDate) {
        dateFilters.push(gte(commits.commitDate, startDate));
    }
    if (endDate) {
        dateFilters.push(lte(commits.commitDate, endDate));
    }

    // Build where clause
    const whereFilters = [inArray(commits.repositoryId, repositoryIds)];
    if (dateFilters.length > 0) {
        whereFilters.push(...dateFilters);
    }
    const whereClause = whereFilters.length > 1 ? and(...whereFilters) : whereFilters[0];

    // Get total commits
    const commitsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(commits)
        .where(whereClause);

    const totalCommits = Number(commitsResult[0]?.count || 0);

    // Get total unique contributors
    const contributorsResult = await db
        .select({ count: sql<number>`count(distinct ${commits.authorId})` })
        .from(commits)
        .where(whereClause);

    const totalContributors = Number(contributorsResult[0]?.count || 0);

    return {
        ecosystemId,
        totalRepositories: repositoryIds.length,
        totalCommits,
        totalContributors,
    };
}

/**
 * Get statistics for all ecosystems
 */
export async function getAllEcosystemsStatistics(options?: {
    startDate?: Date;
    endDate?: Date;
}) {
    const allEcosystems = await db.select().from(ecosystems);

    const statistics = await Promise.all(
        allEcosystems.map(async (ecosystem) => {
            const stats = await getEcosystemStatistics(ecosystem.id, options);
            return {
                ...stats,
                name: ecosystem.name,
                parentId: ecosystem.parentId,
            };
        }),
    );

    return statistics;
}

/**
 * Get statistics for a specific event
 */
export async function getEventStatistics(
    eventId: string,
    options?: {
        startDate?: Date;
        endDate?: Date;
    },
) {
    const { startDate, endDate } = options || {};

    // Get all repositories for this event
    const eventRepos = await db
        .select({ repositoryId: repositoryEvents.repositoryId })
        .from(repositoryEvents)
        .where(eq(repositoryEvents.eventId, eventId));

    const repositoryIds = eventRepos.map((r) => r.repositoryId);

    // Get all authors for this event
    const eventAuthors = await db
        .select({ authorId: authorEvents.authorId })
        .from(authorEvents)
        .where(eq(authorEvents.eventId, eventId));

    const authorIds = eventAuthors.map((a) => a.authorId);

    // Build date filters for commits
    const dateFilters = [];
    if (startDate) {
        dateFilters.push(gte(commits.commitDate, startDate));
    }
    if (endDate) {
        dateFilters.push(lte(commits.commitDate, endDate));
    }

    // Get total commits from event repositories
    let totalCommits = 0;
    if (repositoryIds.length > 0) {
        const repoFilters = [inArray(commits.repositoryId, repositoryIds)];
        if (dateFilters.length > 0) {
            repoFilters.push(...dateFilters);
        }

        const commitsResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(commits)
            .where(repoFilters.length > 1 ? and(...repoFilters) : repoFilters[0]);
        totalCommits = Number(commitsResult[0]?.count || 0);
    }

    // Get total commits from event authors (regardless of repository)
    let totalAuthorCommits = 0;
    if (authorIds.length > 0) {
        const authorFilters = [inArray(commits.authorId, authorIds)];
        if (dateFilters.length > 0) {
            authorFilters.push(...dateFilters);
        }

        const authorCommitsResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(commits)
            .where(authorFilters.length > 1 ? and(...authorFilters) : authorFilters[0]);
        totalAuthorCommits = Number(authorCommitsResult[0]?.count || 0);
    }

    return {
        eventId,
        totalRepositories: repositoryIds.length,
        totalAuthors: authorIds.length,
        totalCommits, // Commits from event repositories
        totalAuthorCommits, // Commits from event authors (can overlap with totalCommits)
    };
}

/**
 * Get statistics for all events
 */
export async function getAllEventsStatistics(options?: {
    startDate?: Date;
    endDate?: Date;
}) {
    const allEvents = await db.select().from(events);

    const statistics = await Promise.all(
        allEvents.map(async (event) => {
            const stats = await getEventStatistics(event.id, options);
            return {
                ...stats,
                name: event.name,
                startDate: event.startDate,
                endDate: event.endDate,
            };
        }),
    );

    return statistics;
}

/**
 * Helper function to get all descendant ecosystem IDs recursively
 */
async function getDescendantEcosystemIds(
    ecosystemId: string,
): Promise<string[]> {
    const children = await db
        .select({ id: ecosystems.id })
        .from(ecosystems)
        .where(eq(ecosystems.parentId, ecosystemId));

    if (children.length === 0) {
        return [];
    }

    const childIds = children.map((c) => c.id);
    const grandchildIds = await Promise.all(
        childIds.map((id) => getDescendantEcosystemIds(id)),
    );

    return [...childIds, ...grandchildIds.flat()];
}

/**
 * Get overall dashboard statistics
 */
export async function getDashboardStatistics(options?: {
    startDate?: Date;
    endDate?: Date;
}) {
    try {
        const { startDate, endDate } = options || {};

        // Build date filters
        const dateFilters = [];
        if (startDate) {
            dateFilters.push(gte(commits.commitDate, startDate));
        }
        if (endDate) {
            dateFilters.push(lte(commits.commitDate, endDate));
        }

        // Get total repositories
        const reposResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(repositories);
        const totalRepositories = Number(reposResult?.[0]?.count || 0);

        // Get total authors
        const authorsResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(authors);
        const totalAuthors = Number(authorsResult?.[0]?.count || 0);

        // Get total commits (with date filter if provided)
        const commitsResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(commits)
            .where(dateFilters.length > 0 ? and(...dateFilters) : undefined);
        const totalCommits = Number(commitsResult?.[0]?.count || 0);

        // Get total ecosystems
        const ecosystemsResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(ecosystems);
        const totalEcosystems = Number(ecosystemsResult?.[0]?.count || 0);

        // Get total events
        const eventsResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(events);
        const totalEvents = Number(eventsResult?.[0]?.count || 0);

        // Get total agencies
        const agenciesResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(agencies);
        const totalAgencies = Number(agenciesResult?.[0]?.count || 0);

        return {
            totalRepositories,
            totalAuthors,
            totalCommits,
            totalEcosystems,
            totalEvents,
            totalAgencies,
        };
    } catch (error) {
        console.error("Error in getDashboardStatistics:", error);
        throw error;
    }
}
