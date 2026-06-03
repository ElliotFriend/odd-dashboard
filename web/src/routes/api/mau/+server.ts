import { json } from '@sveltejs/kit';
import { getMau } from '$lib/server/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) =>
    json(await getMau(Number(url.searchParams.get('days') || 120)));
