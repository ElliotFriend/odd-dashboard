import { json } from '@sveltejs/kit';
import { getDiagnose } from '$lib/server/queries';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) =>
  json(await getDiagnose(Number(url.searchParams.get('days') || 120)));
