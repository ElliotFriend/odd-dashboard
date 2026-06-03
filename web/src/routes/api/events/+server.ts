import { json } from '@sveltejs/kit';
import { loadEvents } from '$lib/server/events';
import type { RequestHandler } from './$types';

// Curated timeline events (programs/hackathons) for chart annotation.
// Returns all events; the chart clips them to the visible window itself.
export const GET: RequestHandler = async () => {
    return json({ events: await loadEvents() });
};
