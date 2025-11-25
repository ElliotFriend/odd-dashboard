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

### Database Connection Pooling
- Configure PostgreSQL connection pool for production use
- Recommended pool settings: min 2, max 10 connections (adjust based on deployment)
- Use connection pooling library (pg-pool or postgres.js built-in pooling)
- Monitor connection pool usage and adjust as needed
- Handle connection pool exhaustion gracefully with appropriate error messages

## Environment Variables
```
DATABASE_URL=postgresql://user:password@localhost:5432/odd_dashboard
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
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
