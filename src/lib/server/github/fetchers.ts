import { octokit } from './client';
import type { GitHubRepository, GitHubCommit, GitHubUser } from './types';
import { withRateLimitAndRetry } from './rate-limit';
import { RepositoryNotFoundError, RepositoryNotFoundByIdError } from './errors';

/**
 * Fetch a repository by its owner and name.
 */
export async function getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return await withRateLimitAndRetry(async () => {
        try {
            const { data } = await octokit.repos.get({
                owner,
                repo,
            });
            return data;
        } catch (error: any) {
            if (error.status === 404) {
                throw new RepositoryNotFoundError(owner, repo);
            }
            throw error;
        }
    });
}

/**
 * Fetch commits for a repository with pagination and optional filters.
 */
export async function getCommits(
    owner: string,
    repo: string,
    branch: string = 'main',
    since?: string,
    page: number = 1,
    per_page: number = 100,
): Promise<GitHubCommit[]> {
    return await withRateLimitAndRetry(async () => {
        try {
            const params: any = {
                owner,
                repo,
                sha: branch,
                per_page,
                page,
            };

            if (since) {
                params.since = since;
            }

            const { data } = await octokit.repos.listCommits(params);
            return data;
        } catch (error: any) {
            if (error.status === 404) {
                // If the branch doesn't exist or repo is empty, it might return 404 or 409
                // For now, let's rethrow, but we might want to return empty array in some cases
                throw new Error(`Commits not found for ${owner}/${repo} on branch ${branch}`);
            }
            throw error;
        }
    });
}

/**
 * Fetch a GitHub user by username.
 */
export async function getUserByUsername(username: string): Promise<GitHubUser> {
    return await withRateLimitAndRetry(async () => {
        try {
            const { data } = await octokit.users.getByUsername({
                username,
            });
            return data;
        } catch (error: any) {
            if (error.status === 404) {
                throw new Error(`User ${username} not found`);
            }
            throw error;
        }
    });
}

/**
 * Fetch a GitHub user by ID.
 * Note: Octokit doesn't have a direct "get by ID" method easily accessible without using the generic request or specific endpoint if available.
 * The standard way is often via `octokit.request('GET /user/:id')` or similar if the SDK supports it,
 * but `users.getById` is the method if it exists in this version.
 * Let's check if `getByUsername` is the only easy one.
 * Actually, `octokit.users.getById({ account_id })` usually exists.
 */
export async function getUserById(accountId: number): Promise<GitHubUser> {
    return await withRateLimitAndRetry(async () => {
        try {
            const { data } = await octokit.request('GET /user/{account_id}', {
                account_id: accountId,
            });
            return data as GitHubUser;
        } catch (error: any) {
            if (error.status === 404) {
                throw new Error(`User with ID ${accountId} not found`);
            }
            throw error;
        }
    });
}

/**
 * Fetch a repository by its GitHub ID.
 * This is useful for detecting renames, as the GitHub ID never changes even if the repository is renamed.
 */
export async function getRepositoryById(githubId: number): Promise<GitHubRepository> {
    return await withRateLimitAndRetry(async () => {
        try {
            // GitHub API doesn't have a direct endpoint to fetch by ID, but we can use the generic request
            // However, we need to know the owner/repo. Since we're using this for rename detection,
            // we'll need to fetch by the current full_name first, then verify the ID matches.
            // Actually, let's use a different approach: fetch by ID using the generic endpoint
            // The endpoint is: GET /repositories/{id}
            const { data } = await octokit.request('GET /repositories/{id}', {
                id: githubId,
            });
            return data as GitHubRepository;
        } catch (error: any) {
            if (error.status === 404) {
                throw new RepositoryNotFoundByIdError(githubId);
            }
            throw error;
        }
    });
}

/**
 * Extract author information from a GitHub commit.
 * Handles both GitHub users and email-only commits (authors without GitHub accounts).
 *
 * @param commit - The GitHub commit object
 * @returns Author information with github_id and username if available, or email-only if not
 */
export function extractAuthorFromCommit(commit: GitHubCommit): {
    name: string;
    email: string;
    githubId: number | null;
    username: string | null;
} {
    // The commit.author field contains the GitHub user if they have an account
    // The commit.commit.author field contains the commit author info (name, email) - always present
    const commitAuthor = commit.commit.author;
    const githubUser = commit.author;

    // Extract name and email from commit.author (always present)
    const name = commitAuthor?.name || '';
    const email = commitAuthor?.email || '';

    // If there's a GitHub user associated with the commit, extract their ID and username
    if (githubUser && githubUser.id && githubUser.login) {
        return {
            name,
            email,
            githubId: githubUser.id,
            username: githubUser.login,
        };
    }

    // Email-only commit (no GitHub account)
    return {
        name,
        email,
        githubId: null,
        username: null,
    };
}

/**
 * Detect if a repository has been renamed by comparing the stored full_name with the current full_name from GitHub.
 *
 * @param storedFullName - The full_name currently stored in the database (e.g., "owner/old-name")
 * @param githubId - The GitHub repository ID (which never changes, even on rename)
 * @returns An object with `isRenamed` boolean and `newFullName` if renamed, or `null` if not renamed
 */
export async function detectRepositoryRename(
    storedFullName: string,
    githubId: number,
): Promise<{ isRenamed: boolean; newFullName: string | null; oldFullName: string }> {
    try {
        // Fetch the repository from GitHub using its ID (which never changes)
        const repo = await getRepositoryById(githubId);
        const currentFullName = repo.full_name;

        // Compare the stored full_name with the current full_name from GitHub
        if (storedFullName !== currentFullName) {
            return {
                isRenamed: true,
                newFullName: currentFullName,
                oldFullName: storedFullName,
            };
        }

        return {
            isRenamed: false,
            newFullName: null,
            oldFullName: storedFullName,
        };
    } catch (error: any) {
        // If we can't fetch the repository, log the error but don't throw
        // This allows the sync to continue even if rename detection fails
        console.error(
            `Error detecting rename for repository ${storedFullName} (GitHub ID: ${githubId}):`,
            error,
        );
        return {
            isRenamed: false,
            newFullName: null,
            oldFullName: storedFullName,
        };
    }
}
