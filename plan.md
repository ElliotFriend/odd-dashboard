# GitHub Contribution Dashboard - Implementation Plan

## Project Overview
A SvelteKit application with PostgreSQL backend to track and visualize GitHub contribution activities. The system will store commits, authors, repositories, and ecosystems with agency associations, and provide dashboard views for analyzing contributions over time.

## Technology Stack
- **Framework**: SvelteKit (with TypeScript)
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM (lightweight, type-safe)
- **GitHub API**: Octokit.js
- **Styling**: Tailwind CSS + shadcn-svelte (component library for modern UI)
- **Charts**: Chart.js or Recharts (for data visualization)

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
   - `github_id` (bigint, unique) - GitHub's repository ID
   - `name` (text)
   - `full_name` (text, unique) - e.g., "owner/repo"
   - `url` (text)
   - `description` (text, nullable)
   - `ecosystem_id` (uuid, foreign key to ecosystems.id)
   - `agency_id` (uuid, foreign key to agencies.id, nullable) - Agency that sourced this repository
   - `is_private` (boolean)
   - `is_fork` (boolean, default false) - Whether this repository is a fork
   - `parent_repository_id` (uuid, foreign key to repositories.id, nullable) - Upstream repository if fork exists in database
   - `parent_full_name` (text, nullable) - Upstream repository full_name (e.g., "owner/parent-repo") even if not in database
   - `default_branch` (text, default 'main') - Default/primary branch name (e.g., "main", "master")
   - `created_at`, `updated_at` (timestamps)
   - `last_synced_at` (timestamp, nullable) - Track when we last fetched commits

4. **authors** - Commit authors/contributors
   - `id` (uuid, primary key)
   - `github_id` (bigint, unique, nullable) - GitHub user ID
   - `username` (text, unique) - GitHub username
   - `email` (text, nullable)
   - `name` (text, nullable)
   - `avatar_url` (text, nullable)
   - `agency_id` (uuid, foreign key to agencies.id, nullable) - Agency that sourced this author
   - `created_at`, `updated_at` (timestamps)

5. **commits** - Individual commits
   - `id` (uuid, primary key)
   - `repository_id` (uuid, foreign key to repositories.id)
   - `author_id` (uuid, foreign key to authors.id)
   - `sha` (text, unique) - Commit SHA
   - `message` (text)
   - `commit_date` (timestamp)
   - `branch` (text) - Branch name where commit was found (default branch to start, extensible for future)
   - `additions` (integer, default 0)
   - `deletions` (integer, default 0)
   - `url` (text)
   - `created_at` (timestamp) - When we stored it

6. **events** - Events like hackathons, conferences, etc.
   - `id` (uuid, primary key)
   - `name` (text, unique) - Event name (e.g., "Stellar Hackathon 2024")
   - `description` (text, nullable)
   - `start_date` (date, nullable)
   - `end_date` (date, nullable)
   - `location` (text, nullable)
   - `event_type` (text, nullable) - e.g., "hackathon", "conference", "workshop"
   - `agency_id` (uuid, foreign key to agencies.id, nullable) - Agency that organized/put on the event
   - `created_at`, `updated_at` (timestamps)

7. **author_events** - Many-to-many: Authors associated with events
   - `id` (uuid, primary key)
   - `author_id` (uuid, foreign key to authors.id)
   - `event_id` (uuid, foreign key to events.id)
   - `created_at` (timestamp)
   - Unique constraint on (author_id, event_id)

8. **repository_events** - Many-to-many: Repositories associated with events
   - `id` (uuid, primary key)
   - `repository_id` (uuid, foreign key to repositories.id)
   - `event_id` (uuid, foreign key to events.id)
   - `created_at` (timestamp)
   - Unique constraint on (repository_id, event_id)

### Indexes
- Index on `commits.commit_date` for time-based queries
- Index on `commits.repository_id` and `commits.author_id` for joins
- Index on `commits.branch` for branch-based queries (future extensibility)
- Index on `repositories.ecosystem_id` for ecosystem filtering
- Index on `repositories.agency_id` and `authors.agency_id` for agency filtering
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
│   │   │   │       ├── +server.ts       # GET/PUT/DELETE single event
│   │   │   │       ├── authors/+server.ts  # GET authors for event
│   │   │   │       └── repositories/+server.ts  # GET repos for event
│   │   │   └── sync/
│   │   │       └── +server.ts           # Bulk sync endpoint
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
│   │   │   ├── +page.svelte      # Agencies list view
│   │   │   └── [id]/
│   │   │       └── +page.svelte  # Agency detail view
│   │   └── events/
│   │       ├── +page.svelte      # Events list view
│   │       └── [id]/
│   │           └── +page.svelte  # Event detail view
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
2. Set up Prettier with configuration (spaces, trailing commas, semicolons)
3. Set up Tailwind CSS and shadcn-svelte component library
4. Set up PostgreSQL connection and Drizzle ORM in `$lib/server/db`
5. Create database schema with all tables (including events and junction tables)
6. Set up database migrations
7. Create seed data for initial ecosystems (Stellar, Ethereum, Bitcoin, etc.)

### Phase 2: GitHub API Integration (Days 4-6)
1. Set up Octokit client with environment token in `$lib/server/github`
2. Implement repository fetching (list repos, get repo details, including fork information and default branch)
3. Implement commit fetching (get commits for a repo's default branch with pagination)
4. Implement author/user data fetching
5. Create sync service to fetch and store commits from GitHub (default branch only)
6. Implement fork detection and parent repository linking logic
7. Handle rate limiting and error cases

### Phase 3: Core Services & API Routes (Days 7-10)
1. Implement agency service (CRUD operations)
2. Implement repository service (CRUD operations, fork detection, parent repository linking)
3. Implement author service (CRUD, deduplication by email/username)
4. Implement commit service (CRUD, bulk insert, fork-aware attribution with SHA comparison)
5. Implement ecosystem service (CRUD, hierarchy management)
6. Implement event service (CRUD, associate authors/repos with events)
7. Update sync service to handle forks (compare commits by SHA, attribute unique commits to fork, upstream commits to parent)
8. Create API routes for all entities (including agencies)
9. Add filtering and pagination to API endpoints
10. Create specialized endpoints (e.g., contributors over time period, event associations)

### Phase 4: Dashboard UI - Core Views (Days 11-14)
1. Create main dashboard layout with navigation using shadcn-svelte components
2. Build agencies management view (list, create, edit agencies) using shadcn-svelte form components
3. Build repository list view with filters (ecosystem, agency, event) using shadcn-svelte components
4. Build repository detail view showing commits and contributors
5. Build contributors view with filtering (ecosystem, agency, event, time period)
6. Build events management view (list, create, edit events) using shadcn-svelte form components
7. Build event detail view (show associated authors and repositories)
8. Implement date range picker component using shadcn-svelte date picker
9. Add agency filtering UI using shadcn-svelte select/combobox components (populated from agencies table)
10. Add event filtering UI using shadcn-svelte components
11. Create basic charts for contribution activity

### Phase 5: Advanced Features & Polish (Days 15-18)
1. Implement "contributors over time period" query and view
2. Add ecosystem hierarchy visualization
3. Create aggregated statistics (total commits, contributors per ecosystem/event)
4. Add search functionality
5. Implement bulk repository sync
6. Add UI for associating authors/repos with events
7. Add loading states and error handling
8. Optimize queries for performance (indexes, query optimization)

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
- Incremental sync: Only fetch commits from default branch since last_synced_at
- Store branch name with each commit for future extensibility (can expand to other branches later)
- Batch processing for multiple repositories
- Handle large repositories with pagination
- Note: Starting with primary branch only to keep initial implementation simple and focused on merged contributions

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
- This ensures accurate attribution: upstream commits go to parent, original fork contributions go to fork
- All comparisons are done on the default/primary branch of both fork and parent repositories
- UI should clearly indicate when viewing a fork, show it's linked to parent, and distinguish between upstream and original commits

### Query Optimization
- Use database indexes on frequently queried fields
- Implement pagination for large result sets
- Use materialized views or computed columns for aggregations if needed
- Cache frequently accessed data

### Agency Management
- Dedicated `agencies` table with id, name, and description
- Foreign key relationships: `repositories.agency_id`, `authors.agency_id`, `events.agency_id`
- Agencies can be associated with repositories, authors, and events
- UI dropdown/select for selecting agencies (using agency names)
- Filter queries support agency_id parameter
- Agency service provides CRUD operations for managing agencies

### Event System
- Events table stores event metadata (name, dates, type, location, agency)
- Agency field tracks which agency organized/put on the event
- Many-to-many relationships via junction tables (author_events, repository_events)
- Authors and repositories can be associated with multiple events (e.g., author attended hackathon, repository created at hackathon)
- Events can be filtered in queries and UI
- Event detail views show all associated authors and repositories

### Ecosystem Hierarchy
- Self-referencing foreign key (parent_id)
- Recursive queries for getting all child ecosystems
- UI tree view for managing hierarchy

### Code Formatting: Prettier
- Use spaces for indentation (not tabs)
- Trailing commas enabled everywhere
- Semicolons enabled
- Consistent indentation width across all files
- Prettier plugin for Svelte support

## Environment Variables
```
DATABASE_URL=postgresql://user:password@localhost:5432/odd_dashboard
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
```

## Dependencies
- `sveltekit` - Framework
- `@sveltejs/adapter-node` or `@sveltejs/adapter-vercel` - Deployment adapter
- `drizzle-orm` + `drizzle-kit` - ORM and migrations
- `postgres` or `pg` - PostgreSQL driver
- `@octokit/rest` - GitHub API client
- `server-only` - Additional safeguard for server-only modules
- `tailwindcss` - CSS framework
- `shadcn-svelte` - Component library built on Tailwind CSS
- `class-variance-authority`, `clsx`, `tailwind-merge` - Utilities for shadcn-svelte
- `@lucide/svelte` - Icon library for shadcn-svelte components
- `chart.js` or `recharts` - Charts
- `date-fns` - Date utilities
- `prettier` + `prettier-plugin-svelte` - Code formatting

