# GitHub Contribution Dashboard - Implementation Plan

## Project Overview

A SvelteKit application with PostgreSQL backend to track and visualize GitHub contribution activities. The system will store commits, authors, repositories, and ecosystems with agency associations, and provide dashboard views for analyzing contributions over time.

## Technology Stack

- **Framework**: SvelteKit (with TypeScript)
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM (lightweight, type-safe)
- **GitHub API**: Octokit.js
- **Styling**: Tailwind CSS + shadcn-svelte (component library for modern UI)
- **Charts**: Chart.js (for data visualization)

## Database Schema

### Core Tables

1. **ecosystems** - Hierarchical ecosystem structure
    - `id` (uuid, primary key)
    - `name` (text, unique)
    - `parent_id` (uuid, foreign key to ecosystems.id, nullable)
    - `created_at`, `updated_at` (timestamps)

2. **agencies** - Agencies/organizations that source repositories, authors, or events
    - `id` (uuid, primary key)
    - `name` (text, unique) - Agency name
    - `description` (text, nullable)
    - `created_at`, `updated_at` (timestamps)

3. **repositories** - GitHub repositories
    - `id` (uuid, primary key)
    - `github_id` (bigint, unique, NOT NULL) - GitHub's repository ID
    - `full_name` (text, unique, NOT NULL) - e.g., "owner/repo" (name and URL can be derived from this)
    - `agency_id` (uuid, foreign key to agencies.id, nullable) - Agency that sourced this repository
    - `is_fork` (boolean, NOT NULL, default false) - Whether this repository is a fork
    - `parent_repository_id` (uuid, foreign key to repositories.id, nullable) - Upstream repository if fork exists in database
    - `parent_full_name` (text, nullable) - Upstream repository full_name (e.g., "owner/parent-repo") even if not in database
    - `default_branch` (text, NOT NULL, default 'main') - Default/primary branch name (e.g., "main", "master")
    - `created_at`, `updated_at` (timestamps, NOT NULL)
    - `last_synced_at` (timestamp, nullable) - Track when we last fetched commits

4. **authors** - Commit authors/contributors
    - `id` (uuid, primary key)
    - `github_id` (bigint, unique, nullable) - GitHub user ID (primary identifier when available, NULL for email-only commits)
    - `username` (text, nullable) - GitHub username (can be updated when user changes username)
    - `name` (text, nullable) - Author name from commit
    - `email` (text, nullable) - Author email from commit (for non-GitHub users or as fallback identifier)
    - `agency_id` (uuid, foreign key to agencies.id, nullable) - Agency that sourced this author
    - `created_at`, `updated_at` (timestamps)
    - Note: Avatar URL can be constructed from `github_id` or `username` (e.g., `https://avatars.githubusercontent.com/u/{github_id}`, `https://github.com/{username}.png`)
    - Note: `github_id` is the primary identifier when available; for email-only commits, use email as fallback identifier
    - Note: Authors without GitHub accounts will have NULL `github_id` and `username`, identified by email

5. **commits** - Individual commits
    - `id` (uuid, primary key)
    - `repository_id` (uuid, foreign key to repositories.id, NOT NULL)
    - `author_id` (uuid, foreign key to authors.id, NOT NULL)
    - `sha` (text, NOT NULL) - Commit SHA
    - `commit_date` (timestamp, NOT NULL) - Stored as UTC
    - `branch` (text, NOT NULL) - Branch name where commit was found (default branch to start, extensible for future)
    - Unique constraint on (repository_id, sha) - Same SHA can exist in multiple repos

6. **events** - Events like hackathons, conferences, etc.
    - `id` (uuid, primary key)
    - `name` (text, unique) - Event name (e.g., "Stellar Hackathon 2024")
    - `description` (text, nullable)
    - `start_date` (date, nullable)
    - `end_date` (date, nullable)
    - `agency_id` (uuid, foreign key to agencies.id, nullable) - Agency that organized/put on the event
    - `created_at`, `updated_at` (timestamps)

7. **author_events** - Many-to-many: Authors associated with events
    - `author_id` (uuid, foreign key to authors.id)
    - `event_id` (uuid, foreign key to events.id)
    - Primary key on (author_id, event_id)

8. **repository_events** - Many-to-many: Repositories associated with events
    - `repository_id` (uuid, foreign key to repositories.id)
    - `event_id` (uuid, foreign key to events.id)
    - Primary key on (repository_id, event_id)

9. **repository_ecosystems** - Many-to-many: Repositories associated with ecosystems
    - `repository_id` (uuid, foreign key to repositories.id)
    - `ecosystem_id` (uuid, foreign key to ecosystems.id)
    - Primary key on (repository_id, ecosystem_id)

### Indexes

- Index on `commits.commit_date` for time-based queries
- Index on `commits.repository_id` and `commits.author_id` for joins
- Index on `commits.sha` for fork comparison queries (checking if commit exists in parent)
- Composite index on `commits` (`repository_id`, `commit_date`) for fork/parent queries
- Index on `commits.branch` for branch-based queries (future extensibility)
- Index on `repository_ecosystems.repository_id` and `repository_ecosystems.ecosystem_id` for filtering
- Index on `repositories.agency_id` and `authors.agency_id` for agency filtering
- Index on `authors.email` for email-based author deduplication (case-insensitive lookups)
- Index on `events.agency_id` for agency filtering on events
- Index on `repositories.parent_repository_id` for fork relationship queries
- Index on `repositories.is_fork` for filtering forks
- Index on `author_events.author_id` and `author_events.event_id` for event queries
- Index on `repository_events.repository_id` and `repository_events.event_id` for event queries

## Project Structure

```
odd-dashboard/
├── src/
│   ├── lib/
│   │   ├── server/                # SERVER-ONLY modules (never exposed to client)
│   │   │   ├── db/
│   │   │   │   ├── schema.ts      # Drizzle schema definitions
│   │   │   │   ├── index.ts       # Database connection (uses DATABASE_URL)
│   │   │   │   └── migrations/    # Database migrations
│   │   │   ├── github/
│   │   │   │   ├── client.ts      # Octokit client setup (uses GITHUB_TOKEN)
│   │   │   │   ├── fetchers.ts    # Functions to fetch commits, repos, etc.
│   │   │   │   └── types.ts       # GitHub API types
│   │   │   └── services/
│   │   │       ├── repository.service.ts    # Repository CRUD operations
│   │   │       ├── author.service.ts        # Author CRUD operations
│   │   │       ├── commit.service.ts        # Commit CRUD operations
│   │   │       ├── ecosystem.service.ts     # Ecosystem CRUD operations
│   │   │       ├── agency.service.ts        # Agency CRUD operations
│   │   │       └── event.service.ts         # Event CRUD operations
│   │   ├── components/
│   │   │   └── ui/                # shadcn-svelte components (Button, Card, Table, etc.)
│   │   └── utils/                 # Client-safe utilities
│   │       ├── date.ts            # Date utility functions
│   │       └── cn.ts              # Utility for merging Tailwind classes (for shadcn-svelte)
│   ├── routes/
│   │   ├── api/
│   │   │   ├── repositories/
│   │   │   │   ├── +server.ts           # GET/POST repositories
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── +server.ts       # GET/PUT/DELETE single repo
│   │   │   │   │   ├── sync/+server.ts  # Sync commits for a repo
│   │   │   │   │   └── contributors/+server.ts  # Get contributors for repo
│   │   │   ├── authors/
│   │   │   │   └── +server.ts           # GET authors with filters
│   │   │   ├── commits/
│   │   │   │   └── +server.ts           # GET commits with filters
│   │   │   ├── ecosystems/
│   │   │   │   └── +server.ts           # GET/POST ecosystems
│   │   │   ├── agencies/
│   │   │   │   ├── +server.ts           # GET/POST agencies
│   │   │   │   └── [id]/
│   │   │   │       └── +server.ts       # GET/PUT/DELETE single agency
│   │   │   ├── events/
│   │   │   │   ├── +server.ts           # GET/POST events
│   │   │   │   └── [id]/
│   │   │   │       └── +server.ts       # GET/PUT/DELETE single event (for inline editing)
│   │   ├── +layout.svelte        # Main layout
│   │   ├── +page.svelte          # Dashboard home
│   │   ├── repositories/
│   │   │   ├── +page.svelte      # Repository list view
│   │   │   └── [id]/
│   │   │       └── +page.svelte  # Repository detail view
│   │   ├── contributors/
│   │   │   └── +page.svelte      # Contributors view
│   │   ├── ecosystems/
│   │   │   └── +page.svelte      # Ecosystems management
│   │   ├── agencies/
│   │   │   └── +page.svelte      # Agencies list view with inline editing
│   │   └── events/
│   │       └── +page.svelte      # Events list view with inline editing
│   ├── components/
│   │   ├── CommitList.svelte
│   │   ├── ContributorCard.svelte
│   │   ├── RepositoryCard.svelte
│   │   ├── EcosystemTree.svelte
│   │   ├── DateRangePicker.svelte
│   │   ├── AgencyFilter.svelte
│   │   ├── AgencyCard.svelte
│   │   ├── EventCard.svelte
│   │   └── charts/
│   │       ├── ContributionChart.svelte
│   │       └── ActivityTimeline.svelte
│   └── app.html
├── drizzle.config.ts             # Drizzle configuration
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── prettier.config.js            # Prettier configuration
└── .env.example                  # Environment variables template
```

## Implementation Steps

### Phase 1: Project Setup & Database (Days 1-3)

1. Initialize SvelteKit project with TypeScript
2. Set up SvelteKit adapter: `@sveltejs/adapter-auto` (flexible deployment option)
3. Set up Prettier with configuration (2 spaces indentation, trailing commas, semicolons)
4. Set up Tailwind CSS and shadcn-svelte component library
5. Set up PostgreSQL connection and Drizzle ORM in `$lib/server/db` (configure connection pooling)
6. Create database schema with all tables (including events and junction tables)
7. Set up database migrations
8. Create seed data for initial ecosystems (Stellar, Ethereum, Bitcoin, etc.)

### Phase 2: GitHub API Integration (Days 4-6)

1. Set up Octokit client with environment token in `$lib/server/github`
2. Implement repository fetching (list repos, get repo details, including fork information and default branch)
3. Implement repository rename detection (compare full_name with GitHub API response)
4. Implement commit fetching (get commits for a repo's default branch with pagination)
5. Implement author/user data fetching (handle both GitHub users and email-only authors)
6. Create sync service to fetch and store commits from GitHub (default branch only, with batching for large repos)
7. Implement fork detection and parent repository linking logic
8. Handle rate limiting and error cases

### Phase 3: Core Services & API Routes (Days 7-10)

1. Set up Drizzle validators (zod schemas) for all entities
2. Implement agency service (CRUD operations with validation)
3. Implement repository service (CRUD operations, fork detection, parent repository linking, rename detection, validation)
4. Implement author service (CRUD, deduplication by github_id/email, handle non-GitHub authors, validation)
5. Implement commit service (CRUD, bulk insert, fork-aware attribution with SHA comparison, validation)
6. Implement ecosystem service (CRUD, hierarchy management, cycle prevention validation)
7. Implement event service (CRUD, associate authors/repos with events, validation)
8. Update sync service to handle forks (compare commits by SHA, attribute unique commits to fork, upstream commits to parent)
9. Create API routes for all entities (including agencies) with request validation
10. Add filtering and pagination to API endpoints
11. Create specialized endpoints (e.g., contributors over time period, event associations)
12. Implement error handling and user-friendly error responses

### Phase 4: Dashboard UI - Core Views (Days 11-14)

1. Create main dashboard layout with navigation using shadcn-svelte components
2. Build agencies management view (list view with inline create/edit) using shadcn-svelte components
3. Build repository list view with filters (ecosystem, agency, event) using shadcn-svelte components
4. Build repository detail view showing commits and contributors
5. Build contributors view with filtering (ecosystem, agency, event, time period)
6. Build events management view (list view with inline create/edit) using shadcn-svelte components
7. Implement date range picker component using shadcn-svelte date picker
8. Implement timezone conversion utilities (convert UTC dates to browser local time for display)
9. Add agency filtering UI using shadcn-svelte select/combobox components (populated from agencies table)
10. Add event filtering UI using shadcn-svelte components
11. Create basic charts for contribution activity (using Chart.js)

### Phase 5: Advanced Features & Polish (Days 15-18)

1. Implement "contributors over time period" query and view
2. Add ecosystem hierarchy visualization
3. Create aggregated statistics (total commits, contributors per ecosystem/event)
4. Add UI for associating authors/repos with events
5. Add loading states and error handling
6. Optimize queries for performance (indexes, query optimization)

### Phase 6: Testing & Documentation (Days 19-21)

1. Test with real GitHub repositories
2. Performance testing with larger datasets
3. Fix any bugs or issues
4. Create README with setup instructions
5. Document API endpoints
6. Add environment variable documentation

## Key Implementation Details

### Security: Server-Only Modules

- All database connections and GitHub API tokens must be in `$lib/server/*` modules
- These modules are automatically excluded from client bundles by SvelteKit
- Never import `$lib/server/*` modules in client-side code
- Use `server-only` package as an additional safeguard if needed

### GitHub API Rate Limiting

- Use authenticated requests (5000 requests/hour)
- Implement request queuing/throttling
- Cache repository metadata to reduce API calls
- Store last_synced_at to only fetch new commits

### Data Sync Strategy

- Detect repository's default/primary branch via GitHub API (typically "main" or "master")
- Initial sync: Fetch all commits from the default branch only
    - For large repositories, process commits in batches (e.g., 1000 commits at a time)
    - Use pagination to handle repositories with thousands of commits
    - Update `last_synced_at` after each successful batch
- Incremental sync: Only fetch commits from default branch since last_synced_at
- Store branch name with each commit for future extensibility (can expand to other branches later)
- Batch processing for multiple repositories
- Handle large repositories with pagination
- Note: Starting with primary branch only to keep initial implementation simple and focused on merged contributions

### Non-GitHub Authors Handling

- Commits can have authors without GitHub accounts (email-only commits)
- Author identification strategy:
    - If commit author has GitHub account: use `github_id` as primary identifier, store `username` and `email`
    - If commit author has no GitHub account: `github_id` and `username` are NULL, use `email` as fallback identifier
- Author deduplication:
    - First, try to match by `github_id` (if available)
    - If no `github_id`, try to match by `email` (case-insensitive)
    - If no match found, create new author record
- When syncing commits, check if author exists by `github_id` or `email` before creating new author
- Authors without GitHub accounts can still be associated with agencies and events

### Repository Rename Handling

- GitHub repositories can be renamed (changing `full_name`)
- During sync, check if repository `full_name` has changed by comparing with GitHub API response
- If `full_name` has changed:
    - Update `repositories.full_name` in database
    - Log the rename event for audit purposes
    - All existing commits remain linked via `repository_id` (UUID doesn't change)
- Repository renames don't affect commit attribution or relationships

### Fork Handling & Commit Attribution

- When fetching repository data from GitHub API, detect if repository is a fork (`fork: true`)
- Store `is_fork` flag and `parent_full_name` from GitHub API response
- If parent repository exists in database, link via `parent_repository_id`
- When syncing commits for a fork:
    - Fetch commits from the fork repository's default branch
    - If parent repository exists in database, also fetch commits from parent repository's default branch
    - Compare commits by SHA to identify which commits are unique to the fork
    - Commits that exist in parent repository → attribute to parent repository (`repository_id` = parent)
    - Commits unique to fork (not present in parent) → attribute to fork repository (`repository_id` = fork)
    - This allows tracking original contributions made in forks separately from upstream commits
- Commit attribution logic:
    - Check if commit SHA exists in parent repository commits (on default branch)
    - If SHA found in parent → `repository_id` points to parent repository
    - If SHA not found in parent → `repository_id` points to fork repository
- Fork comparison performance optimization:
    - Use indexed SHA lookups (index on `commits.sha`) for fast parent commit checks
    - Batch SHA lookups: collect all fork commit SHAs, query parent commits in single query with `WHERE sha IN (...)`
    - For very large repositories, process commits in batches (e.g., 1000 at a time)
    - Cache parent commit SHA sets in memory during sync to avoid repeated database queries
- This ensures accurate attribution: upstream commits go to parent, original fork contributions go to fork
- All comparisons are done on the default/primary branch of both fork and parent repositories
- UI should clearly indicate when viewing a fork, show it's linked to parent, and distinguish between upstream and original commits

### Query Optimization

- Use database indexes on frequently queried fields (including composite indexes)
- Implement pagination for large result sets
- Cache frequently accessed data

### Foreign Key CASCADE Strategy

- **Repositories**: On delete, CASCADE delete related commits (commits are meaningless without repository)
- **Authors**: On delete, SET NULL for commits.author_id (preserve commit history even if author deleted)
- **Agencies**: On delete, SET NULL for repositories.agency_id, authors.agency_id, events.agency_id (preserve data, just remove association)
- **Ecosystems**: On delete, SET NULL for repository_ecosystems.ecosystem_id (preserve repository data)
- **Events**: On delete, CASCADE delete author_events and repository_events (junction table entries)
- **Parent repositories**: On delete, SET NULL for repositories.parent_repository_id (preserve fork data)

### Data Validation

- Use Drizzle validators (zod schemas) for all data validation
- Validate data before database insertion in all services
- Validate API request payloads using Drizzle validators
- Validate GitHub API responses before storing in database
- Type-safe validation ensures data integrity and catches errors early

### Error Handling Strategy

- Implement comprehensive error handling for GitHub API calls (rate limits, network errors, 404s)
- Handle database connection errors gracefully
- Implement retry logic with exponential backoff for transient failures
- Log all errors with appropriate context (repository, commit SHA, etc.)
- Return user-friendly error messages in API responses
- Handle edge cases: deleted repositories, renamed repositories, deleted users
- Gracefully handle missing parent repositories during fork sync

### Timezone Handling

- Store all dates/times in database as UTC (PostgreSQL TIMESTAMP)
- Convert to browser's local timezone for display in UI
- Use date-fns or native JavaScript Date API for timezone conversions
- Display dates with timezone indicator in UI when relevant
- All commit dates from GitHub API are already in UTC

### Ecosystem Hierarchy Cycle Prevention

- Validate ecosystem parent_id assignments to prevent circular references
- Before setting parent_id, check that the new parent is not a descendant of the current ecosystem
- Implement recursive check: traverse up the parent chain to ensure no cycles
- Reject parent_id assignment if it would create a cycle
- Provide clear error message if cycle detected

### Agency Management

- Dedicated `agencies` table with id, name, and description
- Foreign key relationships: `repositories.agency_id`, `authors.agency_id`, `events.agency_id`
- Agencies can be associated with repositories, authors, and events
- UI dropdown/select for selecting agencies (using agency names)
- Filter queries support agency_id parameter
- Agency service provides CRUD operations for managing agencies

### Event System

- Events table stores event metadata (name, description, dates, agency)
- Agency field tracks which agency organized/put on the event
- Many-to-many relationships via junction tables (author_events, repository_events)
- Authors and repositories can be associated with multiple events (e.g., author attended hackathon, repository created at hackathon)
- Events can be filtered in queries and UI
- Events managed via list view with inline editing

### Ecosystem Hierarchy

- Self-referencing foreign key (parent_id)
- Recursive queries for getting all child ecosystems
- UI tree view for managing hierarchy

### Code Formatting: Prettier

- Use 4 spaces for indentation (not tabs)
- Trailing commas enabled everywhere
- Semicolons enabled
- Consistent indentation width (4 spaces) across all files
- Prettier plugin for Svelte support

### Docker Compose Setup

- Use Docker Compose to run PostgreSQL in a container for local development
- **Service configuration**:
    - Image: `postgres:latest`
    - Port: `5432:5432`
    - Database: `odd_dashboard`
    - User: `postgres` (default, can be overridden via environment variables)
    - Password: `postgres` (default, can be overridden via environment variables)
    - Volume: Named volume `postgres_data` for data persistence
    - Health check: Ensures database is ready before connections
- **Environment variables** (can be overridden via `.env` file):
    - `POSTGRES_USER` (default: `postgres`)
    - `POSTGRES_PASSWORD` (default: `postgres`)
    - `POSTGRES_DB` (default: `odd_dashboard`)
- **Connection string**: `postgresql://postgres:postgres@localhost:5432/odd_dashboard`
- **NPM scripts**:
    - `docker:up` - Start PostgreSQL container
    - `docker:down` - Stop PostgreSQL container
    - `docker:logs` - View container logs
    - `docker:reset` - Stop, remove volumes, and restart (fresh database)
- Benefits: No local PostgreSQL installation required, consistent development environment, easy database reset for testing

### Database Connection Pooling

- Configure PostgreSQL connection pool for production use
- Recommended pool settings: min 2, max 10 connections (adjust based on deployment)
- Use connection pooling library (pg-pool or postgres.js built-in pooling)
- Monitor connection pool usage and adjust as needed
- Handle connection pool exhaustion gracefully with appropriate error messages

## Environment Variables

```
# Database connection (for Docker Compose setup)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/odd_dashboard

# GitHub API token
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx

# Docker Compose environment variables (optional, defaults shown)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=odd_dashboard
```

## Dependencies

- `sveltekit` - Framework
- `@sveltejs/adapter-auto` - Deployment adapter
- `drizzle-orm` + `drizzle-kit` - ORM and migrations
- `zod` - Schema validation for Drizzle validators
- `postgres` or `pg` - PostgreSQL driver
- `@octokit/rest` - GitHub API client
- `server-only` - Additional safeguard for server-only modules
- `tailwindcss` - CSS framework
- `shadcn-svelte` - Component library built on Tailwind CSS
- `class-variance-authority`, `clsx`, `tailwind-merge` - Utilities for shadcn-svelte
- `@lucide/svelte` - Icon library for shadcn-svelte components
- `chart.js` - Charts
- `date-fns` - Date utilities
- `prettier` + `prettier-plugin-svelte` - Code formatting

## Future Enhancements (Deferred)

The following features have been deferred to future phases to focus on core functionality:

### Detail Pages

- Add dedicated detail pages for agencies and events (currently using inline editing in list views)
- Enhanced views with more detailed information and relationships

### Soft Deletes

- Add `deleted_at` timestamp column to all major tables (ecosystems, agencies, repositories, authors, events)
- Update all queries to filter out soft-deleted records
- Implement restore functionality

### Daily Repository Stats Aggregation

- Create `daily_repository_stats` table for pre-aggregated metrics:
    - `repository_id`, `date`, `commit_count`, `active_developer_count`, `additions`, `deletions`
- Implement background job to populate stats table during sync
- Use stats table for dashboard charts to improve performance with large datasets

### Search Functionality

- Add full-text search for repositories, authors, and commits
- Implement search API endpoints with filtering
- Add search UI components to dashboard

### Bulk Repository Sync

- Implement batch sync endpoint for multiple repositories
- Add progress tracking for bulk operations
- Queue management for large sync jobs

## Implementation Checklist

Use this detailed checklist to track progress and ensure each item is complete and working before moving to the next.

### Phase 1: Project Setup & Database (Days 1-3)

#### Project Initialization

- [x] Run `pnpm dlx sv create .` with TypeScript template
- [x] Verify `package.json` exists with correct dependencies
- [x] Verify `tsconfig.json` is configured correctly
- [x] Test that `pnpm install` completes without errors
- [x] Verify `pnpm dev` starts the development server
- [x] Verify `pnpm build` completes successfully

#### Prettier Setup

- [x] Install prettier and dependencies (`pnpm dlx sv add prettier`)
- [x] Ensure prettier config specifies:
    - [x] 4 spaces indentation
    - [x] Trailing commas enabled
    - [x] Semicolons enabled
- [x] Test Prettier formatting on a sample file

#### Tailwind CSS & shadcn-svelte Setup

- [x] Install Tailwind CSS and dependencies (`tailwindcss`, `postcss`, `autoprefixer`)
- [x] Initialize Tailwind config (`pnpm dlx sv add tailwindcss="plugins:forms,typography"`)
- [x] Configure Tailwind (Tailwind v4 uses Vite plugin, content paths auto-detected)
- [x] Set up CSS file with Tailwind imports and theme variables
- [x] Create shadcn-svelte configuration (`components.json`)
- [x] Install required shadcn-svelte dependencies (`class-variance-authority`, `clsx`, `tailwind-merge`, `@lucide/svelte`)
- [x] Create `lib/utils/cn.ts` utility function
- [x] Add a test shadcn-svelte component (Button) to verify setup
- [x] Verify Tailwind styles are applied correctly (dev server and build tested)

#### SvelteKit Adapter Setup

- [x] Install `@sveltejs/adapter-auto`
- [x] Update `svelte.config.js` to use adapter-auto
- [x] Verify adapter is configured correctly

#### Database Setup

- [x] setup database access using the svelte cli (`pnpm dlx sv add drizzle="database:postgresql+client:postgres.js+docker:true`) - This should take care of everything we need
- [x] Create `docker-compose.yml` with PostgreSQL service configuration
- [x] Create `.dockerignore` file to exclude unnecessary files
- [x] Create `.env.example` with Docker-specific `DATABASE_URL` and instructions
- [x] Add Docker-related npm scripts to `package.json` (docker:up, docker:down, docker:logs, docker:reset)
- [x] Test Docker Compose setup: start container, verify connection, stop container
- [x] Create `.env` file with `DATABASE_URL` pointing to Docker container
- [x] Test database connection with a simple script
- [x] Configure connection pooling (min 2, max 10 connections)

#### Database Schema Creation

- [x] Create `src/lib/server/db/schema.ts`
- [x] Define `ecosystems` table with all fields and constraints
- [x] Define `agencies` table with all fields and constraints
- [x] Define `repositories` table with all fields and constraints
- [x] Define `authors` table with all fields and constraints (including email)
- [x] Define `commits` table with all fields and constraints
- [x] Define `events` table with all fields and constraints
- [x] Define `author_events` junction table with composite primary key
- [x] Define `repository_events` junction table with composite primary key
- [x] Define `repository_ecosystems` junction table with composite primary key
- [x] Add all foreign key relationships (columns defined; FK constraints will be added in migrations)
- [x] Add all unique constraints (including composite on commits)
- [x] Verify schema compiles without TypeScript errors

#### Database Migrations

- [x] Configure `drizzle.config.ts` with database connection
- [x] Run initial migration generation: `drizzle-kit generate`
- [x] Verify migration files are created correctly
- [x] Run migration: `drizzle-kit migrate` or custom migrate script
- [x] Verify all tables are created in database (9 tables: ecosystems, agencies, repositories, authors, commits, events, and 3 junction tables)
- [x] Verify all indexes are created (all 20+ indexes verified)
- [x] Verify all foreign keys are created (13 foreign keys with correct CASCADE/SET NULL rules)
- [x] Verify all constraints are applied (primary keys, unique constraints, composite unique constraints)

#### Seed Data

- [x] Create seed script for ecosystems
- [x] Add seed data for Stellar ecosystem
- [x] Run seed script and verify data is inserted
- [x] Verify ecosystem hierarchy (parent_id relationships) works correctly (Stellar inserted with parent_id: NULL)

### Phase 2: GitHub API Integration (Days 4-6)

#### Octokit Client Setup

- [x] Install `@octokit/rest`
- [x] Create `src/lib/server/github/client.ts`
- [x] Set up Octokit client with `GITHUB_TOKEN` from environment
- [x] Add `server-only` import to prevent client-side usage
- [x] Test client initialization
- [x] Verify token authentication works (make a test API call)

#### GitHub Types

- [x] Create `src/lib/server/github/types.ts`
- [x] Define TypeScript types for GitHub API responses
- [x] Define types for repository data
- [x] Define types for commit data
- [x] Define types for author/user data

#### Repository Fetching

- [ ] Create `src/lib/server/github/fetchers.ts`
- [ ] Implement function to fetch repository by full_name
- [ ] Implement function to fetch repository details (including fork info, default branch)
- [ ] Test fetching a real repository from GitHub API
- [ ] Verify fork detection works correctly
- [ ] Verify default branch detection works
- [ ] Handle API errors (404, rate limits, etc.)

#### Repository Rename Detection

- [ ] Implement logic to compare stored `full_name` with GitHub API response
- [ ] Test rename detection with a renamed repository
- [ ] Verify rename update logic works

#### Commit Fetching

- [ ] Implement function to fetch commits for a repository's default branch
- [ ] Implement pagination for commit fetching
- [ ] Test fetching commits from a real repository
- [ ] Verify pagination works for repositories with many commits
- [ ] Handle API errors gracefully

#### Author/User Data Fetching

- [ ] Implement function to fetch GitHub user by username
- [ ] Implement function to fetch GitHub user by ID
- [ ] Handle cases where user doesn't exist (404)
- [ ] Handle email-only commits (no GitHub user)
- [ ] Test fetching user data for both GitHub users and email-only commits

#### Sync Service - Basic Structure

- [ ] Create sync service file
- [ ] Implement basic sync function structure
- [ ] Implement initial sync (fetch all commits)
- [ ] Implement incremental sync (fetch commits since last_synced_at)
- [ ] Test sync with a small test repository
- [ ] Verify commits are stored correctly

#### Sync Service - Batching for Large Repos

- [ ] Implement batching logic (process 1000 commits at a time)
- [ ] Update `last_synced_at` after each batch
- [ ] Test with a repository that has >1000 commits
- [ ] Verify all commits are synced correctly

#### Fork Detection & Linking

- [ ] Implement fork detection logic
- [ ] Implement parent repository lookup by `parent_full_name`
- [ ] Implement `parent_repository_id` linking when parent exists
- [ ] Test with a fork repository
- [ ] Verify parent linking works correctly

#### Rate Limiting & Error Handling

- [ ] Implement rate limit detection
- [ ] Implement request queuing/throttling
- [ ] Implement retry logic with exponential backoff
- [ ] Test rate limit handling
- [ ] Test error handling for network failures
- [ ] Test error handling for API errors (404, 403, etc.)

### Phase 3: Core Services & API Routes (Days 7-10)

#### Drizzle Validators Setup

- [ ] Install `zod` (if not already installed)
- [ ] Create validator schemas for ecosystems
- [ ] Create validator schemas for agencies
- [ ] Create validator schemas for repositories
- [ ] Create validator schemas for authors
- [ ] Create validator schemas for commits
- [ ] Create validator schemas for events
- [ ] Test validators with valid data
- [ ] Test validators with invalid data (verify errors)

#### Agency Service

- [ ] Create `src/lib/server/services/agency.service.ts`
- [ ] Implement `createAgency()` with validation
- [ ] Implement `getAgencyById()`
- [ ] Implement `getAllAgencies()`
- [ ] Implement `updateAgency()` with validation
- [ ] Implement `deleteAgency()` with CASCADE handling
- [ ] Test all CRUD operations
- [ ] Verify validation works correctly

#### Repository Service

- [ ] Create `src/lib/server/services/repository.service.ts`
- [ ] Implement `createRepository()` with validation
- [ ] Implement `getRepositoryById()`
- [ ] Implement `getRepositoryByFullName()`
- [ ] Implement `getAllRepositories()` with filtering
- [ ] Implement `updateRepository()` with validation
- [ ] Implement `deleteRepository()` with CASCADE handling
- [ ] Implement fork detection logic
- [ ] Implement parent repository linking
- [ ] Implement rename detection and update
- [ ] Test all CRUD operations
- [ ] Test fork detection and linking
- [ ] Test rename detection

#### Author Service

- [ ] Create `src/lib/server/services/author.service.ts`
- [ ] Implement `createAuthor()` with validation
- [ ] Implement `getAuthorById()`
- [ ] Implement `getAuthorByGithubId()`
- [ ] Implement `getAuthorByEmail()` (case-insensitive)
- [ ] Implement `getAllAuthors()` with filtering
- [ ] Implement `updateAuthor()` with validation (including username updates)
- [ ] Implement `deleteAuthor()` with SET NULL handling
- [ ] Implement deduplication logic (github_id first, then email)
- [ ] Test author creation for GitHub users
- [ ] Test author creation for email-only commits
- [ ] Test deduplication logic
- [ ] Test username update logic

#### Commit Service

- [ ] Create `src/lib/server/services/commit.service.ts`
- [ ] Implement `createCommit()` with validation
- [ ] Implement `bulkInsertCommits()` for batch operations
- [ ] Implement `getCommitById()`
- [ ] Implement `getCommitsByRepository()` with filtering
- [ ] Implement `getCommitsByAuthor()` with filtering
- [ ] Implement `getCommitsBySha()` (for fork comparison)
- [ ] Test commit creation
- [ ] Test bulk insert with large batches
- [ ] Test commit queries with filters

#### Ecosystem Service

- [ ] Create `src/lib/server/services/ecosystem.service.ts`
- [ ] Implement `createEcosystem()` with validation
- [ ] Implement `getEcosystemById()`
- [ ] Implement `getAllEcosystems()` with hierarchy
- [ ] Implement `updateEcosystem()` with validation
- [ ] Implement `deleteEcosystem()` with SET NULL handling
- [ ] Implement cycle prevention validation
- [ ] Test cycle prevention (try to create circular reference)
- [ ] Test hierarchy queries (get children, get ancestors)

#### Event Service

- [ ] Create `src/lib/server/services/event.service.ts`
- [ ] Implement `createEvent()` with validation
- [ ] Implement `getEventById()`
- [ ] Implement `getAllEvents()` with filtering
- [ ] Implement `updateEvent()` with validation
- [ ] Implement `deleteEvent()` with CASCADE handling
- [ ] Implement `associateAuthorWithEvent()`
- [ ] Implement `associateRepositoryWithEvent()`
- [ ] Implement `getAuthorsForEvent()`
- [ ] Implement `getRepositoriesForEvent()`
- [ ] Test all CRUD operations
- [ ] Test author/repository associations

#### Fork-Aware Sync Service Updates

- [ ] Update sync service to handle forks
- [ ] Implement commit SHA comparison logic
- [ ] Implement batch SHA lookup for parent commits
- [ ] Implement in-memory caching for parent commit SHAs
- [ ] Implement commit attribution (parent vs fork)
- [ ] Test sync with a fork repository
- [ ] Test sync with fork that has parent in database
- [ ] Test sync with fork that has parent NOT in database
- [ ] Verify commit attribution is correct

#### API Routes - Repositories

- [ ] Create `src/routes/api/repositories/+server.ts`
- [ ] Implement GET (list repositories with filters)
- [ ] Implement POST (create repository) with validation
- [ ] Create `src/routes/api/repositories/[id]/+server.ts`
- [ ] Implement GET (single repository)
- [ ] Implement PUT (update repository) with validation
- [ ] Implement DELETE (delete repository)
- [ ] Create `src/routes/api/repositories/[id]/sync/+server.ts`
- [ ] Implement POST (trigger sync for repository)
- [ ] Create `src/routes/api/repositories/[id]/contributors/+server.ts`
- [ ] Implement GET (get contributors for repository)
- [ ] Test all repository endpoints
- [ ] Verify validation works
- [ ] Verify error handling works

#### API Routes - Authors

- [ ] Create `src/routes/api/authors/+server.ts`
- [ ] Implement GET (list authors with filters)
- [ ] Test author endpoints
- [ ] Verify filtering works

#### API Routes - Commits

- [ ] Create `src/routes/api/commits/+server.ts`
- [ ] Implement GET (list commits with filters)
- [ ] Test commit endpoints
- [ ] Verify filtering works (repository, author, date range)

#### API Routes - Ecosystems

- [ ] Create `src/routes/api/ecosystems/+server.ts`
- [ ] Implement GET (list ecosystems)
- [ ] Implement POST (create ecosystem) with validation
- [ ] Test ecosystem endpoints

#### API Routes - Agencies

- [ ] Create `src/routes/api/agencies/+server.ts`
- [ ] Implement GET (list agencies)
- [ ] Implement POST (create agency) with validation
- [ ] Create `src/routes/api/agencies/[id]/+server.ts`
- [ ] Implement GET (single agency)
- [ ] Implement PUT (update agency) with validation
- [ ] Implement DELETE (delete agency)
- [ ] Test all agency endpoints

#### API Routes - Events

- [ ] Create `src/routes/api/events/+server.ts`
- [ ] Implement GET (list events)
- [ ] Implement POST (create event) with validation
- [ ] Create `src/routes/api/events/[id]/+server.ts`
- [ ] Implement GET (single event)
- [ ] Implement PUT (update event) with validation
- [ ] Implement DELETE (delete event)
- [ ] Test all event endpoints

#### API Routes - Filtering & Pagination

- [ ] Add filtering to all list endpoints (ecosystem, agency, event, date range)
- [ ] Add pagination to all list endpoints
- [ ] Test filtering with various combinations
- [ ] Test pagination with large datasets
- [ ] Verify pagination metadata is returned correctly

#### API Routes - Specialized Endpoints

- [ ] Create endpoint for "contributors over time period"
- [ ] Create endpoint for event associations
- [ ] Test specialized endpoints

#### Error Handling

- [ ] Implement consistent error response format
- [ ] Add user-friendly error messages
- [ ] Test error handling for invalid requests
- [ ] Test error handling for database errors
- [ ] Test error handling for validation errors

### Phase 4: Dashboard UI - Core Views (Days 11-14)

#### Layout & Navigation

- [ ] Create `src/routes/+layout.svelte`
- [ ] Add navigation menu with links to all main views
- [ ] Style navigation with shadcn-svelte components
- [ ] Test navigation between pages
- [ ] Verify layout is responsive

#### Dashboard Home

- [ ] Create `src/routes/+page.svelte`
- [ ] Add overview statistics (total repos, authors, commits)
- [ ] Add recent activity section
- [ ] Test dashboard home loads correctly

#### Timezone Utilities

- [ ] Create `src/lib/utils/date.ts`
- [ ] Implement function to convert UTC to browser local time
- [ ] Implement function to format dates for display
- [ ] Test timezone conversion with different timezones
- [ ] Test date formatting

#### Agencies Management View

- [ ] Create `src/routes/agencies/+page.svelte`
- [ ] Implement list view with table/cards
- [ ] Implement inline create form
- [ ] Implement inline edit form
- [ ] Implement delete functionality
- [ ] Add loading states
- [ ] Add error handling
- [ ] Test all CRUD operations in UI
- [ ] Verify form validation works

#### Repository List View

- [ ] Create `src/routes/repositories/+page.svelte`
- [ ] Implement repository list display
- [ ] Add ecosystem filter dropdown
- [ ] Add agency filter dropdown
- [ ] Add event filter dropdown
- [ ] Implement filtering logic
- [ ] Add pagination UI
- [ ] Test all filters work correctly
- [ ] Test pagination works

#### Repository Detail View

- [ ] Create `src/routes/repositories/[id]/+page.svelte`
- [ ] Display repository information
- [ ] Display commits list for repository
- [ ] Display contributors list
- [ ] Add date range filter for commits
- [ ] Add sync button
- [ ] Test repository detail page loads
- [ ] Test commits display correctly
- [ ] Test contributors display correctly
- [ ] Test sync functionality

#### Contributors View

- [ ] Create `src/routes/contributors/+page.svelte`
- [ ] Implement contributors list display
- [ ] Add ecosystem filter
- [ ] Add agency filter
- [ ] Add event filter
- [ ] Add date range filter
- [ ] Implement filtering logic
- [ ] Test all filters work
- [ ] Verify contributor data displays correctly

#### Events Management View

- [ ] Create `src/routes/events/+page.svelte`
- [ ] Implement events list display
- [ ] Implement inline create form
- [ ] Implement inline edit form
- [ ] Implement delete functionality
- [ ] Add UI for associating authors with events
- [ ] Add UI for associating repositories with events
- [ ] Test all CRUD operations
- [ ] Test author/repository associations

#### Date Range Picker Component

- [ ] Create `src/components/DateRangePicker.svelte`
- [ ] Use shadcn-svelte date picker component
- [ ] Implement date range selection
- [ ] Test date range picker works
- [ ] Verify dates are handled in UTC

#### Filter Components

- [ ] Create `src/components/AgencyFilter.svelte`
- [ ] Implement agency dropdown/combobox
- [ ] Populate from agencies API
- [ ] Test agency filter works
- [ ] Create event filter component
- [ ] Test event filter works

#### Charts

- [ ] Install Chart.js
- [ ] Create `src/components/charts/ContributionChart.svelte`
- [ ] Implement contribution activity chart
- [ ] Create `src/components/charts/ActivityTimeline.svelte`
- [ ] Implement activity timeline chart
- [ ] Test charts render correctly
- [ ] Test charts update with filtered data

### Phase 5: Advanced Features & Polish (Days 15-18)

#### Contributors Over Time Period

- [ ] Implement query for contributors over time period
- [ ] Create view/component to display this data
- [ ] Test with various time periods
- [ ] Verify data is accurate

#### Ecosystem Hierarchy Visualization

- [ ] Create `src/components/EcosystemTree.svelte`
- [ ] Implement tree view for ecosystem hierarchy
- [ ] Add expand/collapse functionality
- [ ] Test hierarchy displays correctly
- [ ] Test with nested hierarchies

#### Aggregated Statistics

- [ ] Implement query for total commits per ecosystem
- [ ] Implement query for total contributors per ecosystem
- [ ] Implement query for total commits per event
- [ ] Implement query for total contributors per event
- [ ] Create UI components to display statistics
- [ ] Test statistics are accurate

#### Event Associations UI

- [ ] Add UI for associating authors with events in event management view
- [ ] Add UI for associating repositories with events in event management view
- [ ] Implement add/remove association functionality
- [ ] Test associations work correctly

#### Loading States

- [ ] Add loading spinners to all async operations
- [ ] Add skeleton loaders where appropriate
- [ ] Test loading states display correctly

#### Error Handling UI

- [ ] Add error message display components
- [ ] Add error boundaries where needed
- [ ] Test error handling displays user-friendly messages
- [ ] Test error recovery

#### Query Optimization

- [ ] Review all database queries
- [ ] Add missing indexes if needed
- [ ] Optimize slow queries
- [ ] Test query performance with larger datasets
- [ ] Verify indexes are being used

### Phase 6: Testing & Documentation (Days 19-21)

#### Testing with Real Repositories

- [ ] Sync a real GitHub repository
- [ ] Verify all commits are synced correctly
- [ ] Verify authors are created correctly
- [ ] Test with a fork repository
- [ ] Verify fork attribution works
- [ ] Test with a repository that has been renamed
- [ ] Test with email-only commits

#### Performance Testing

- [ ] Test with repository containing 1000+ commits
- [ ] Test with repository containing 10000+ commits
- [ ] Verify sync performance is acceptable
- [ ] Verify query performance is acceptable
- [ ] Test with multiple repositories
- [ ] Monitor database connection pool usage

#### Bug Fixes

- [ ] Document any bugs found during testing
- [ ] Fix all critical bugs
- [ ] Fix all high-priority bugs
- [ ] Verify fixes work correctly

#### README Documentation

- [ ] Create `README.md`
- [ ] Add project overview
- [ ] Add setup instructions
- [ ] Add environment variables documentation
- [ ] Add database setup instructions
- [ ] Add development workflow
- [ ] Add deployment instructions

#### API Documentation

- [ ] Document all API endpoints
- [ ] Document request/response formats
- [ ] Document authentication requirements
- [ ] Document error responses
- [ ] Add example requests/responses

#### Code Documentation

- [ ] Add JSDoc comments to all service functions
- [ ] Add inline comments for complex logic
- [ ] Verify code is well-documented

#### Final Verification

- [ ] Run full test suite (if created)
- [ ] Verify all features work end-to-end
- [ ] Verify no console errors
- [ ] Verify no TypeScript errors
- [ ] Verify Prettier formatting is applied
- [ ] Verify all environment variables are documented
- [ ] Verify README is complete and accurate
