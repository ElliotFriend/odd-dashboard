import { db } from '../db';
import { repositories, commits, authors } from '../db/schema';
import { sql, gte, lte, and } from 'drizzle-orm';

export interface DateRange {
    startDate: string; // ISO date string
    endDate: string; // ISO date string
}

export interface TopAuthorByCommits {
    authorId: number;
    name: string;
    email: string;
    commitCount: number;
}

export interface TopAuthorByRepos {
    authorId: number;
    name: string;
    email: string;
    repoCount: number;
}

export interface TopRepoByCommits {
    repositoryId: number;
    fullName: string;
    commitCount: number;
}

export interface TopRepoByAuthors {
    repositoryId: number;
    fullName: string;
    authorCount: number;
}

export interface AnalyticsData {
    dateRange: DateRange;
    topAuthorsByCommits: TopAuthorByCommits[];
    topAuthorsByRepos: TopAuthorByRepos[];
    topReposByCommits: TopRepoByCommits[];
    topReposByAuthors: TopRepoByAuthors[];
}

/**
 * Get analytics data for a given date range
 */
export async function getAnalytics(
    startDate: string,
    endDate: string,
    limit: number = 10
): Promise<AnalyticsData> {
    // Top authors by number of commits
    const topAuthorsByCommitsQuery = sql`
        SELECT
            a.id as author_id,
            a.name,
            a.email,
            COUNT(c.id)::int as commit_count
        FROM authors a
        INNER JOIN commits c ON a.id = c.author_id
        WHERE c.commit_date >= ${startDate}::timestamp
          AND c.commit_date <= ${endDate}::timestamp
        GROUP BY a.id, a.name, a.email
        ORDER BY commit_count DESC
        LIMIT ${limit}
    `;

    const topAuthorsByCommitsResult = await db.execute(topAuthorsByCommitsQuery);
    // @ts-ignore
    const topAuthorsByCommitsRows = topAuthorsByCommitsResult.rows || topAuthorsByCommitsResult;
    const topAuthorsByCommits = topAuthorsByCommitsRows.map((row: any) => ({
        authorId: row.author_id,
        name: row.name,
        email: row.email,
        commitCount: row.commit_count,
    }));

    // Top authors by number of repositories committed to
    const topAuthorsByReposQuery = sql`
        SELECT
            a.id as author_id,
            a.name,
            a.email,
            COUNT(DISTINCT c.repository_id)::int as repo_count
        FROM authors a
        INNER JOIN commits c ON a.id = c.author_id
        WHERE c.commit_date >= ${startDate}::timestamp
          AND c.commit_date <= ${endDate}::timestamp
        GROUP BY a.id, a.name, a.email
        ORDER BY repo_count DESC
        LIMIT ${limit}
    `;

    const topAuthorsByReposResult = await db.execute(topAuthorsByReposQuery);
    // @ts-ignore
    const topAuthorsByReposRows = topAuthorsByReposResult.rows || topAuthorsByReposResult;
    const topAuthorsByRepos = topAuthorsByReposRows.map((row: any) => ({
        authorId: row.author_id,
        name: row.name,
        email: row.email,
        repoCount: row.repo_count,
    }));

    // Top repositories by number of commits
    const topReposByCommitsQuery = sql`
        SELECT
            r.id as repository_id,
            r.full_name,
            COUNT(c.id)::int as commit_count
        FROM repositories r
        INNER JOIN commits c ON r.id = c.repository_id
        WHERE c.commit_date >= ${startDate}::timestamp
          AND c.commit_date <= ${endDate}::timestamp
        GROUP BY r.id, r.full_name
        ORDER BY commit_count DESC
        LIMIT ${limit}
    `;

    const topReposByCommitsResult = await db.execute(topReposByCommitsQuery);
    // @ts-ignore
    const topReposByCommitsRows = topReposByCommitsResult.rows || topReposByCommitsResult;
    const topReposByCommits = topReposByCommitsRows.map((row: any) => ({
        repositoryId: row.repository_id,
        fullName: row.full_name,
        commitCount: row.commit_count,
    }));

    // Top repositories by number of unique authors
    const topReposByAuthorsQuery = sql`
        SELECT
            r.id as repository_id,
            r.full_name,
            COUNT(DISTINCT c.author_id)::int as author_count
        FROM repositories r
        INNER JOIN commits c ON r.id = c.repository_id
        WHERE c.commit_date >= ${startDate}::timestamp
          AND c.commit_date <= ${endDate}::timestamp
        GROUP BY r.id, r.full_name
        ORDER BY author_count DESC
        LIMIT ${limit}
    `;

    const topReposByAuthorsResult = await db.execute(topReposByAuthorsQuery);
    // @ts-ignore
    const topReposByAuthorsRows = topReposByAuthorsResult.rows || topReposByAuthorsResult;
    const topReposByAuthors = topReposByAuthorsRows.map((row: any) => ({
        repositoryId: row.repository_id,
        fullName: row.full_name,
        authorCount: row.author_count,
    }));

    return {
        dateRange: { startDate, endDate },
        topAuthorsByCommits,
        topAuthorsByRepos,
        topReposByCommits,
        topReposByAuthors,
    };
}
