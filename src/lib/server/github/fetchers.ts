import { octokit } from './client';
import type { GitHubRepository, GitHubCommit, GitHubUser } from './types';

/**
 * Fetch a repository by its owner and name.
 */
export async function getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    try {
        const { data } = await octokit.repos.get({
            owner,
            repo,
        });
        return data;
    } catch (error: any) {
        if (error.status === 404) {
            throw new Error(`Repository ${owner}/${repo} not found`);
        }
        throw error;
    }
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
    per_page: number = 100
): Promise<GitHubCommit[]> {
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
}

/**
 * Fetch a GitHub user by username.
 */
export async function getUserByUsername(username: string): Promise<GitHubUser> {
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
}
