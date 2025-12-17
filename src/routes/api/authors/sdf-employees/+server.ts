import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { authors } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { handleError, errorResponse } from '$lib/server/api/errors';

/**
 * GET /api/authors/sdf-employees
 * Get the list of current SDF employee usernames
 */
export const GET: RequestHandler = async () => {
    try {
        const sdfEmployees = await db
            .select({
                username: authors.username,
            })
            .from(authors)
            .where(eq(authors.isSdfEmployee, true));

        const usernames = sdfEmployees
            .map((author) => author.username)
            .filter((username): username is string => username !== null);

        return json({ usernames });
    } catch (error: any) {
        return handleError(error);
    }
};

/**
 * POST /api/authors/sdf-employees
 * Update the list of SDF employees by GitHub username
 *
 * Request body:
 * {
 *   "usernames": ["username1", "username2", ...]
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const { usernames } = body;

        if (!Array.isArray(usernames)) {
            return errorResponse(400, 'usernames must be an array');
        }

        // Validate usernames
        const validUsernames = usernames.filter(
            (u) => typeof u === 'string' && u.trim().length > 0
        );

        if (validUsernames.length === 0) {
            // Clear all SDF employee flags if empty list
            const result = await db
                .update(authors)
                .set({
                    isSdfEmployee: false,
                    updatedAt: sql`NOW()`,
                })
                .where(eq(authors.isSdfEmployee, true));

            return json({
                updated: 0,
                cleared: result.rowCount || 0,
                message: 'All SDF employee flags cleared',
            });
        }

        // First, clear all existing SDF employee flags
        await db
            .update(authors)
            .set({
                isSdfEmployee: false,
                updatedAt: sql`NOW()`,
            })
            .where(eq(authors.isSdfEmployee, true));

        // Then, set the flag for authors with matching usernames (case-insensitive)
        const lowerUsernames = validUsernames.map((u) => u.toLowerCase());

        const updateQuery = sql`
            UPDATE authors
            SET is_sdf_employee = true, updated_at = NOW()
            WHERE LOWER(username) = ANY(ARRAY[${sql.join(lowerUsernames.map((u) => sql`${u}`), sql`, `)}])
        `;

        const updateResult = await db.execute(updateQuery);

        return json({
            updated: updateResult.rowCount || 0,
            cleared: 0,
            message: 'SDF employee list updated successfully',
        });
    } catch (error: any) {
        return handleError(error);
    }
};
