import { z } from 'zod';

// ============================================================================
// Ecosystem Validators
// ============================================================================

/**
 * Schema for creating an ecosystem
 */
export const createEcosystemSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
    parentId: z.number().int().positive().nullable().optional(),
});

/**
 * Schema for updating an ecosystem
 */
export const updateEcosystemSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name is too long').optional(),
    parentId: z.number().int().positive().nullable().optional(),
});

/**
 * Type inference for create ecosystem
 */
export type CreateEcosystemInput = z.infer<typeof createEcosystemSchema>;

/**
 * Type inference for update ecosystem
 */
export type UpdateEcosystemInput = z.infer<typeof updateEcosystemSchema>;

// ============================================================================
// Agency Validators
// ============================================================================

/**
 * Schema for creating an agency
 */
export const createAgencySchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
    description: z.string().max(1000, 'Description is too long').nullable().optional(),
});

/**
 * Schema for updating an agency
 */
export const updateAgencySchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name is too long').optional(),
    description: z.string().max(1000, 'Description is too long').nullable().optional(),
});

/**
 * Type inference for create agency
 */
export type CreateAgencyInput = z.infer<typeof createAgencySchema>;

/**
 * Type inference for update agency
 */
export type UpdateAgencyInput = z.infer<typeof updateAgencySchema>;

// ============================================================================
// Repository Validators
// ============================================================================

/**
 * Schema for creating a repository
 */
export const createRepositorySchema = z.object({
    githubId: z.number().int().positive('GitHub ID must be a positive integer'),
    fullName: z
        .string()
        .min(1, 'Full name is required')
        .max(255, 'Full name is too long')
        .regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/, 'Full name must be in format "owner/repo"'),
    agencyId: z.number().int().positive().nullable().optional(),
    isFork: z.boolean().default(false),
    parentRepositoryId: z.number().int().positive().nullable().optional(),
    parentFullName: z
        .string()
        .max(255, 'Parent full name is too long')
        .regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/, 'Parent full name must be in format "owner/repo"')
        .nullable()
        .optional(),
    defaultBranch: z.string().min(1, 'Default branch is required').max(255, 'Default branch is too long').default('main'),
});

/**
 * Schema for updating a repository
 */
export const updateRepositorySchema = z.object({
    githubId: z.number().int().positive('GitHub ID must be a positive integer').optional(),
    fullName: z
        .string()
        .min(1, 'Full name is required')
        .max(255, 'Full name is too long')
        .regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/, 'Full name must be in format "owner/repo"')
        .optional(),
    agencyId: z.number().int().positive().nullable().optional(),
    isFork: z.boolean().optional(),
    parentRepositoryId: z.number().int().positive().nullable().optional(),
    parentFullName: z
        .string()
        .max(255, 'Parent full name is too long')
        .regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/, 'Parent full name must be in format "owner/repo"')
        .nullable()
        .optional(),
    defaultBranch: z.string().min(1, 'Default branch is required').max(255, 'Default branch is too long').optional(),
});

/**
 * Type inference for create repository
 */
export type CreateRepositoryInput = z.infer<typeof createRepositorySchema>;

/**
 * Type inference for update repository
 */
export type UpdateRepositoryInput = z.infer<typeof updateRepositorySchema>;

// ============================================================================
// Author Validators
// ============================================================================

/**
 * Schema for creating an author
 */
export const createAuthorSchema = z.object({
    githubId: z.number().int().positive().nullable().optional(),
    username: z.string().max(255, 'Username is too long').nullable().optional(),
    name: z.string().max(255, 'Name is too long').nullable().optional(),
    email: z.string().email('Invalid email format').max(255, 'Email is too long').nullable().optional(),
    agencyId: z.number().int().positive().nullable().optional(),
}).refine(
    (data) => {
        // At least one identifier must be provided (githubId or email)
        return data.githubId !== null || (data.email !== null && data.email !== undefined);
    },
    {
        message: 'Either githubId or email must be provided',
    }
);

/**
 * Schema for updating an author
 */
export const updateAuthorSchema = z.object({
    githubId: z.number().int().positive().nullable().optional(),
    username: z.string().max(255, 'Username is too long').nullable().optional(),
    name: z.string().max(255, 'Name is too long').nullable().optional(),
    email: z.string().email('Invalid email format').max(255, 'Email is too long').nullable().optional(),
    agencyId: z.number().int().positive().nullable().optional(),
});

/**
 * Type inference for create author
 */
export type CreateAuthorInput = z.infer<typeof createAuthorSchema>;

/**
 * Type inference for update author
 */
export type UpdateAuthorInput = z.infer<typeof updateAuthorSchema>;

// ============================================================================
// Commit Validators
// ============================================================================

/**
 * Schema for creating a commit
 */
export const createCommitSchema = z.object({
    repositoryId: z.number().int().positive('Repository ID must be a positive integer'),
    authorId: z.number().int().positive('Author ID must be a positive integer'),
    sha: z.string().min(1, 'SHA is required').max(40, 'SHA must be 40 characters or less'),
    commitDate: z.coerce.date(),
    branch: z.string().min(1, 'Branch is required').max(255, 'Branch name is too long'),
});

/**
 * Schema for bulk creating commits
 */
export const bulkCreateCommitsSchema = z.array(createCommitSchema);

/**
 * Schema for updating a commit
 */
export const updateCommitSchema = z.object({
    repositoryId: z.number().int().positive('Repository ID must be a positive integer').optional(),
    authorId: z.number().int().positive('Author ID must be a positive integer').optional(),
    sha: z.string().min(1, 'SHA is required').max(40, 'SHA must be 40 characters or less').optional(),
    commitDate: z.coerce.date().optional(),
    branch: z.string().min(1, 'Branch is required').max(255, 'Branch name is too long').optional(),
});

/**
 * Type inference for create commit
 */
export type CreateCommitInput = z.infer<typeof createCommitSchema>;

/**
 * Type inference for bulk create commits
 */
export type BulkCreateCommitsInput = z.infer<typeof bulkCreateCommitsSchema>;

/**
 * Type inference for update commit
 */
export type UpdateCommitInput = z.infer<typeof updateCommitSchema>;

// ============================================================================
// Event Validators
// ============================================================================

/**
 * Schema for creating an event
 */
export const createEventSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
    description: z.string().max(2000, 'Description is too long').nullable().optional(),
    startDate: z.coerce.date().nullable().optional(),
    endDate: z.coerce.date().nullable().optional(),
    agencyId: z.number().int().positive().nullable().optional(),
}).refine(
    (data) => {
        // If both dates are provided, endDate must be after startDate
        if (data.startDate && data.endDate) {
            return data.endDate >= data.startDate;
        }
        return true;
    },
    {
        message: 'End date must be after or equal to start date',
        path: ['endDate'],
    }
);

/**
 * Schema for updating an event
 */
export const updateEventSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name is too long').optional(),
    description: z.string().max(2000, 'Description is too long').nullable().optional(),
    startDate: z.coerce.date().nullable().optional(),
    endDate: z.coerce.date().nullable().optional(),
    agencyId: z.number().int().positive().nullable().optional(),
}).refine(
    (data) => {
        // If both dates are provided, endDate must be after startDate
        if (data.startDate && data.endDate) {
            return data.endDate >= data.startDate;
        }
        return true;
    },
    {
        message: 'End date must be after or equal to start date',
        path: ['endDate'],
    }
);

/**
 * Type inference for create event
 */
export type CreateEventInput = z.infer<typeof createEventSchema>;

/**
 * Type inference for update event
 */
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

// ============================================================================
// Junction Table Validators
// ============================================================================

/**
 * Schema for associating an author with an event
 */
export const associateAuthorWithEventSchema = z.object({
    authorId: z.number().int().positive('Author ID must be a positive integer'),
    eventId: z.number().int().positive('Event ID must be a positive integer'),
});

/**
 * Schema for associating a repository with an event
 */
export const associateRepositoryWithEventSchema = z.object({
    repositoryId: z.number().int().positive('Repository ID must be a positive integer'),
    eventId: z.number().int().positive('Event ID must be a positive integer'),
});

/**
 * Schema for associating a repository with an ecosystem
 */
export const associateRepositoryWithEcosystemSchema = z.object({
    repositoryId: z.number().int().positive('Repository ID must be a positive integer'),
    ecosystemId: z.number().int().positive('Ecosystem ID must be a positive integer'),
});

/**
 * Type inference for associate author with event
 */
export type AssociateAuthorWithEventInput = z.infer<typeof associateAuthorWithEventSchema>;

/**
 * Type inference for associate repository with event
 */
export type AssociateRepositoryWithEventInput = z.infer<typeof associateRepositoryWithEventSchema>;

/**
 * Type inference for associate repository with ecosystem
 */
export type AssociateRepositoryWithEcosystemInput = z.infer<typeof associateRepositoryWithEcosystemSchema>;

