# GitHub Contribution Dashboard - Implementation Plan

## Project Overview
A SvelteKit application with PostgreSQL backend to track and visualize GitHub contribution activities. The system will store commits, authors, repositories, and ecosystems with agency tagging, and provide dashboard views for analyzing contributions over time.

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

2. **repositories** - GitHub repositories
   - `id` (uuid, primary key)
   - `github_id` (bigint, unique) - GitHub's repository ID
   - `name` (text)
   - `full_name` (text, unique) - e.g., "owner/repo"
   - `url` (text)
   - `description` (text, nullable)
   - `ecosystem_id` (uuid, foreign key to ecosystems.id)
   - `agency_tag` (text, nullable) - Simple tag for agency source
   - `is_private` (boolean)
   - `created_at`, `updated_at` (timestamps)
   - `last_synced_at` (timestamp, nullable) - Track when we last fetched commits

3. **authors** - Commit authors/contributors
   - `id` (uuid, primary key)
   - `github_id` (bigint, unique, nullable) - GitHub user ID
   - `username` (text, unique) - GitHub username
   - `email` (text, nullable)
   - `name` (text, nullable)
   - `avatar_url` (text, nullable)
   - `agency_tag` (text, nullable) - Simple tag for agency source
   - `created_at`, `updated_at` (timestamps)

4. **commits** - Individual commits
   - `id` (uuid, primary key)
   - `repository_id` (uuid, foreign key to repositories.id)
   - `author_id` (uuid, foreign key to authors.id)
   - `sha` (text, unique) - Commit SHA
   - `message` (text)
   - `commit_date` (timestamp)
   - `additions` (integer, default 0)
   - `deletions` (integer, default 0)
   - `url` (text)
   - `created_at` (timestamp) - When we stored it

5. **events** - Events like hackathons, conferences, etc.
   - `id` (uuid, primary key)
   - `name` (text, unique) - Event name (e.g., "Stellar Hackathon 2024")
   - `description` (text, nullable)
   - `start_date` (date, nullable)
   - `end_date` (date, nullable)
   - `location` (text, nullable)
   - `event_type` (text, nullable) - e.g., "hackathon", "conference", "workshop"
   - `agency` (text, nullable) - Agency that organized/put on the event
   - `created_at`, `updated_at` (timestamps)

6. **author_events** - Many-to-many: Authors associated with events
   - `id` (uuid, primary key)
   - `author_id` (uuid, foreign key to authors.id)
   - `event_id` (uuid, foreign key to events.id)
   - `created_at` (timestamp)
   - Unique constraint on (author_id, event_id)

7. **repository_events** - Many-to-many: Repositories associated with events
   - `id` (uuid, primary key)
   - `repository_id` (uuid, foreign key to repositories.id)
   - `event_id` (uuid, foreign key to events.id)
   - `created_at` (timestamp)
   - Unique constraint on (repository_id, event_id)

### Indexes
- Index on `commits.commit_date` for time-based queries
- Index on `commits.repository_id` and `commits.author_id` for joins
- Index on `repositories.ecosystem_id` for ecosystem filtering
- Index on `repositories.agency_tag` and `authors.agency_tag` for agency filtering
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
│   │   ├── AgencyTagFilter.svelte
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
2. Implement repository fetching (list repos, get repo details)
3. Implement commit fetching (get commits for a repo with pagination)
4. Implement author/user data fetching
5. Create sync service to fetch and store commits from GitHub
6. Handle rate limiting and error cases

### Phase 3: Core Services & API Routes (Days 7-10)
1. Implement repository service (CRUD operations)
2. Implement author service (CRUD, deduplication by email/username)
3. Implement commit service (CRUD, bulk insert)
4. Implement ecosystem service (CRUD, hierarchy management)
5. Implement event service (CRUD, associate authors/repos with events)
6. Create API routes for all entities
7. Add filtering and pagination to API endpoints
8. Create specialized endpoints (e.g., contributors over time period, event associations)

### Phase 4: Dashboard UI - Core Views (Days 11-14)
1. Create main dashboard layout with navigation using shadcn-svelte components
2. Build repository list view with filters (ecosystem, agency tag, event) using shadcn-svelte components
3. Build repository detail view showing commits and contributors
4. Build contributors view with filtering (ecosystem, agency, event, time period)
5. Build events management view (list, create, edit events) using shadcn-svelte form components
6. Build event detail view (show associated authors and repositories)
7. Implement date range picker component using shadcn-svelte date picker
8. Add agency tag filtering UI using shadcn-svelte select/combobox components
9. Add event filtering UI using shadcn-svelte components
10. Create basic charts for contribution activity

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
- Initial sync: Fetch all commits for a repository
- Incremental sync: Only fetch commits since last_synced_at
- Batch processing for multiple repositories
- Handle large repositories with pagination

### Query Optimization
- Use database indexes on frequently queried fields
- Implement pagination for large result sets
- Use materialized views or computed columns for aggregations if needed
- Cache frequently accessed data

### Agency Tagging
- Simple text field on repositories and authors tables
- UI dropdown/autocomplete for selecting tags
- Filter queries support agency_tag parameter

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

