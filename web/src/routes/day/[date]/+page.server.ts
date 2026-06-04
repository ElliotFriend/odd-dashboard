import { error } from '@sveltejs/kit';
import { getDayDetail } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) throw error(404, `"${params.date}" is not a date.`);
    const day = await getDayDetail(params.date);
    // Out of the data range is a 404; an in-range day with no activity renders an empty state.
    if (params.date < day.earliest || params.date > day.latest)
        throw error(404, `${params.date} is outside the data range (${day.earliest}–${day.latest}).`);
    return { day };
};
