import { json } from '@sveltejs/kit';
import { getRepos } from '$lib/server/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) =>
    json(
        await getRepos(
            Number(url.searchParams.get('days') || 28),
            url.searchParams.get('by') || 'devs',
        ),
    );
