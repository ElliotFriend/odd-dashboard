import { error } from '@sveltejs/kit';
import { getRepoDetail } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const repo = await getRepoDetail(params.slug);
  if (!repo) throw error(404, `No repo "${params.slug}" in the Stellar extract.`);
  return { repo };
};
