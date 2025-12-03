import type { RestEndpointMethodTypes } from '@octokit/rest';

export type GitHubRepository = RestEndpointMethodTypes['repos']['get']['response']['data'];
export type GitHubCommit =
    RestEndpointMethodTypes['repos']['listCommits']['response']['data'][number];
export type GitHubUser = RestEndpointMethodTypes['users']['getByUsername']['response']['data'];

// Simplified types for our internal use (optional, but good for decoupling)
export interface RepositoryData {
    githubId: number;
    fullName: string;
    description: string | null;
    isFork: boolean;
    parentFullName?: string;
    defaultBranch: string;
    createdAt: string;
    updatedAt: string;
}

export interface CommitData {
    sha: string;
    message: string;
    date: string;
    author: {
        name: string;
        email: string;
        githubId?: number;
        username?: string;
    };
}
