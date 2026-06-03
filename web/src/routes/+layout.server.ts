// Extract provenance (snapshot version, parquet horizon, …) is site-global, so it
// loads once at the layout level and feeds the header.
import { meta } from '$lib/server/db';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => ({ meta: await meta() });
