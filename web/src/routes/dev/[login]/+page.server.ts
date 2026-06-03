import { error } from '@sveltejs/kit';
import { getDevDetail } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const dev = await getDevDetail(params.login);
  if (!dev) throw error(404, `No developer "${params.login}" (identity unresolved or inactive).`);
  return { dev };
};
