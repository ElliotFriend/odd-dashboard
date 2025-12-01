import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.GITHUB_TOKEN;

if (!token) {
    console.error('Error: GITHUB_TOKEN is not set in .env file');
    process.exit(1);
}

const octokit = new Octokit({
    auth: token,
});

async function testConnection() {
    try {
        const { data } = await octokit.users.getAuthenticated();
        console.log(`Successfully authenticated as: ${data.login}`);
    } catch (error: any) {
        console.error('Authentication failed:', error.message);
        process.exit(1);
    }
}

testConnection();
