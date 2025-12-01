import { Octokit } from '@octokit/rest';
import { GITHUB_TOKEN } from '$env/static/private';
import 'server-only';

if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
}

export const octokit = new Octokit({
    auth: GITHUB_TOKEN,
});
