import { Octokit } from '@octokit/rest';
// import 'server-only';
import dotenv from 'dotenv';

// Ensure env vars are loaded if running in standalone script
dotenv.config();

const token = process.env.GITHUB_TOKEN;

if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
}

export const octokit = new Octokit({
    auth: token,
});
