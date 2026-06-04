import { json } from '@sveltejs/kit';
import { getMad } from '$lib/server/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) =>
    json(await getMad(Number(url.searchParams.get('days') || 120)));
