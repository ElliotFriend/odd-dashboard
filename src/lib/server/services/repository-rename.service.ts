import { eq } from 'drizzle-orm';
import { db } from '../db';
import { repositories } from '../db/schema';
import { detectRepositoryRename } from '../github/fetchers';

/**
 * Check if a repository has been renamed on GitHub and update the database if so.
 * Uses the repository's GitHub ID (which never changes) to fetch the current repository data
 * and compare it with the stored full_name.
 * 
 * @param repositoryId The ID of the repository in our database
 * @param currentFullName The full name we currently have stored (e.g., "owner/repo")
 * @param githubId The GitHub repository ID (which never changes, even on rename)
 * @returns Object containing whether a rename was detected and the new name if so
 */
export async function checkAndUpdateRepositoryName(
    repositoryId: number,
    currentFullName: string,
    githubId: number
): Promise<{ renamed: boolean; newFullName?: string; oldFullName?: string }> {
    try {
        // Detect if the repository has been renamed by comparing stored full_name with GitHub API response
        const renameInfo = await detectRepositoryRename(currentFullName, githubId);

        if (renameInfo.isRenamed && renameInfo.newFullName) {
            // Log the rename event for audit purposes
            console.log(
                `📝 Repository rename detected: ${renameInfo.oldFullName} -> ${renameInfo.newFullName} (Repository ID: ${repositoryId}, GitHub ID: ${githubId})`
            );

            // Update the database with the new full_name
            // All existing commits remain linked via repository_id (ID doesn't change)
            await db
                .update(repositories)
                .set({
                    fullName: renameInfo.newFullName,
                    updatedAt: new Date(),
                })
                .where(eq(repositories.id, repositoryId));

            return {
                renamed: true,
                newFullName: renameInfo.newFullName,
                oldFullName: renameInfo.oldFullName,
            };
        }

        return { renamed: false };
    } catch (error) {
        console.error(
            `❌ Error checking for rename for repository ${currentFullName} (ID: ${repositoryId}, GitHub ID: ${githubId}):`,
            error
        );
        // Don't throw - allow sync to continue even if rename detection fails
        return { renamed: false };
    }
}
