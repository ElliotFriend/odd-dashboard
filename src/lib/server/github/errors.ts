/**
 * Custom error for when a GitHub repository is not found (404).
 * This indicates the repository may have been deleted, made private, or never existed.
 */
export class RepositoryNotFoundError extends Error {
    public readonly owner: string;
    public readonly repo: string;
    public readonly statusCode: number = 404;

    constructor(owner: string, repo: string, message?: string) {
        super(message || `Repository ${owner}/${repo} not found or is not accessible`);
        this.name = 'RepositoryNotFoundError';
        this.owner = owner;
        this.repo = repo;

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, RepositoryNotFoundError);
        }
    }
}

/**
 * Custom error for when a GitHub repository by ID is not found (404).
 * This indicates the repository may have been deleted.
 */
export class RepositoryNotFoundByIdError extends Error {
    public readonly githubId: number;
    public readonly statusCode: number = 404;

    constructor(githubId: number, message?: string) {
        super(message || `Repository with GitHub ID ${githubId} not found or is not accessible`);
        this.name = 'RepositoryNotFoundByIdError';
        this.githubId = githubId;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, RepositoryNotFoundByIdError);
        }
    }
}
