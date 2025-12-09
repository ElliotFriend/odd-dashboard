# ODD Dashboard

A comprehensive dashboard for tracking and analyzing GitHub contribution activities across repositories, contributors, ecosystems, and events.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Key Concepts](#key-concepts)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Overview

The ODD Dashboard is a SvelteKit application that provides powerful tools for tracking GitHub contributions, managing repositories, analyzing contributor activity, and organizing projects by ecosystems and events. It features fork-aware commit attribution, hierarchical ecosystem management, and comprehensive event tracking.

## Features

- **Repository Management**
  - Add and sync GitHub repositories
  - Automatic fork detection and parent linking
  - Repository rename detection
  - Bulk import from CSV
  - Missing repository tracking (soft delete)

- **Contributor Tracking**
  - Author deduplication (GitHub ID and email-based)
  - Non-GitHub author support (email-only commits)
  - Contributor statistics over time periods
  - Agency and event associations

- **Fork-Aware Commit Attribution**
  - Automatic parent repository syncing
  - SHA-based commit comparison
  - Accurate attribution (upstream commits to parent, original to fork)
  - Prevents duplicate commits between forks and parents

- **Ecosystem Management**
  - Hierarchical ecosystem structure
  - Cycle prevention
  - Repository-ecosystem associations
  - Ecosystem statistics

- **Event System**
  - Track hackathons, conferences, and other events
  - Associate contributors and repositories with events
  - Event-based filtering and statistics

- **Agency Management**
  - Track sourcing agencies
  - Agency associations with repositories, authors, and events

- **Data Visualization**
  - Contribution activity charts
  - Activity timelines
  - Contributor statistics

## Technology Stack

- **Framework**: [SvelteKit](https://kit.svelte.dev/) (with TypeScript)
- **Database**: PostgreSQL
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **GitHub API**: [Octokit.js](https://github.com/octokit/octokit.js)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Components**: [shadcn-svelte](https://www.shadcn-svelte.com/)
- **Charts**: [Chart.js](https://www.chartjs.org/)
- **Icons**: [Lucide Icons](https://lucide.dev/)

## Prerequisites

- **Node.js**: v18 or higher
- **pnpm**: v8 or higher
- **Docker**: For local PostgreSQL database (recommended)
- **GitHub Token**: Personal access token with `repo` scope

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd odd-dashboard
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database connection (for Docker Compose setup)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/odd_dashboard

# GitHub API token
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx

# Docker Compose environment variables (optional, defaults shown)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=odd_dashboard
```

### 4. Start PostgreSQL Database

Using Docker Compose (recommended):

```bash
pnpm docker:up
```

Alternatively, use your own PostgreSQL instance and update `DATABASE_URL` accordingly.

### 5. Run Database Migrations

```bash
pnpm db:push
```

This will create all necessary tables and indexes in your database.

### 6. Seed Initial Data (Optional)

```bash
pnpm tsx scripts/seed-ecosystems.ts
```

This creates initial ecosystem data (e.g., Stellar).

### 7. Start Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:5173`.

## Project Structure

```
odd-dashboard/
├── src/
│   ├── lib/
│   │   ├── server/                # SERVER-ONLY modules
│   │   │   ├── db/
│   │   │   │   ├── schema.ts      # Drizzle schema definitions
│   │   │   │   ├── index.ts       # Database connection
│   │   │   │   └── validators.ts  # Zod validation schemas
│   │   │   ├── github/
│   │   │   │   ├── client.ts      # Octokit client setup
│   │   │   │   ├── fetchers.ts    # GitHub API fetchers
│   │   │   │   ├── types.ts       # GitHub API types
│   │   │   │   ├── rate-limit.ts  # Rate limiting logic
│   │   │   │   └── errors.ts      # GitHub error handling
│   │   │   ├── api/
│   │   │   │   └── errors.ts      # API error utilities
│   │   │   └── services/
│   │   │       ├── repository.service.ts
│   │   │       ├── author.service.ts
│   │   │       ├── commit.service.ts
│   │   │       ├── ecosystem.service.ts
│   │   │       ├── agency.service.ts
│   │   │       ├── event.service.ts
│   │   │       ├── sync.service.ts
│   │   │       ├── fork-detection.service.ts
│   │   │       └── repository-rename.service.ts
│   │   ├── components/            # Reusable components
│   │   │   └── ui/                # shadcn-svelte components
│   │   └── utils/                 # Client-safe utilities
│   │       ├── date.ts            # Date utilities
│   │       └── cn.ts              # Class name utility
│   ├── routes/
│   │   ├── api/                   # API endpoints
│   │   │   ├── repositories/
│   │   │   ├── authors/
│   │   │   ├── commits/
│   │   │   ├── ecosystems/
│   │   │   ├── agencies/
│   │   │   ├── events/
│   │   │   └── contributors/
│   │   ├── +layout.svelte         # Main layout
│   │   ├── +page.svelte           # Dashboard home
│   │   ├── repositories/          # Repository views
│   │   ├── contributors/          # Contributors view
│   │   ├── ecosystems/            # Ecosystems management
│   │   ├── agencies/              # Agencies management
│   │   └── events/                # Events management
│   └── app.html
├── scripts/                       # Utility scripts
│   ├── seed-ecosystems.ts
│   ├── fix-fork-attribution.ts
│   └── test-*.ts                  # Test scripts
├── drizzle.config.ts              # Drizzle configuration
├── docker-compose.yml             # PostgreSQL container
└── package.json
```

## Development Workflow

### Database Commands

```bash
# Start PostgreSQL container
pnpm docker:up

# Stop PostgreSQL container
pnpm docker:down

# View database logs
pnpm docker:logs

# Reset database (fresh start)
pnpm docker:reset

# Push schema changes to database
pnpm db:push

# Generate migrations
pnpm db:generate

# View database in Drizzle Studio
pnpm db:studio
```

### Development Server

```bash
# Start dev server
pnpm dev

# Start dev server with specific port
pnpm dev -- --port 3000

# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Repository Management

```bash
# Sync a single repository
pnpm tsx scripts/test-sync.ts <repository-id>

# Fix fork attribution (one-time cleanup)
pnpm tsx scripts/fix-fork-attribution.ts
```

### Bulk Operations

```bash
# Bulk import repositories from CSV
# Use the UI at /repositories/bulk-import
# Or via API: POST /api/repositories/bulk-import
```

## Key Concepts

### Fork-Aware Commit Attribution

The system intelligently attributes commits based on fork relationships:

- When syncing a fork, the parent repository is synced first
- Commits are compared by SHA between fork and parent
- Commits existing in parent → attributed to parent repository
- Commits unique to fork → attributed to fork repository
- Prevents duplicate commits across fork/parent pairs

### Author Deduplication

Authors are deduplicated using a two-tier approach:

1. **Primary**: GitHub ID (for GitHub users)
2. **Fallback**: Email address (case-insensitive, for non-GitHub users)

When syncing commits:
- If GitHub ID exists, match by GitHub ID
- If no GitHub ID, match by email
- If no match found, create new author
- Updates username if changed

### Repository Rename Detection

The system detects when repositories are renamed on GitHub:

- Compares stored `full_name` with GitHub API response
- Updates database on mismatch
- Logs rename events for audit
- All existing data (commits, etc.) remains linked

### Bot Filtering

Commits from GitHub bots are automatically filtered during sync:

- Identifies bots by `[bot]` suffix in username
- Skips bot commits to focus on human contributors
- Tracks skipped bot commits in sync statistics

### Missing Repository Handling

Repositories that become inaccessible are soft-deleted:

- Sets `is_missing` flag instead of hard delete
- Preserves all historical data
- Can be restored if repository becomes accessible again
- Sync operations detect and mark missing repositories

### Ecosystem Hierarchy

Ecosystems support hierarchical organization:

- Self-referencing `parent_id` foreign key
- Cycle prevention validation
- Recursive queries for getting children/ancestors
- Many-to-many relationship with repositories

### Event System

Events track hackathons, conferences, and other activities:

- Many-to-many relationships with authors and repositories
- Agency association (who organized the event)
- Date range tracking (start_date, end_date)
- Event-based filtering throughout the application

## Database Schema

### Core Tables

- **ecosystems**: Hierarchical ecosystem structure
- **agencies**: Organizations that source repositories, authors, or events
- **repositories**: GitHub repositories with fork tracking
- **authors**: Commit authors (GitHub users and email-only)
- **commits**: Individual commits with branch tracking
- **events**: Hackathons, conferences, etc.

### Junction Tables

- **author_events**: Authors associated with events
- **repository_events**: Repositories associated with events
- **repository_ecosystems**: Repositories associated with ecosystems

### Key Features

- Comprehensive indexing for performance
- Foreign key constraints with appropriate CASCADE/SET NULL rules
- Unique constraints (GitHub IDs, repository names, etc.)
- Timestamp tracking (created_at, updated_at)

For detailed schema documentation, see `src/lib/server/db/schema.ts`.

## API Endpoints

The application provides a comprehensive REST API. Key endpoint groups:

- **Repositories**: `/api/repositories` - CRUD and sync operations
- **Authors**: `/api/authors` - Author queries with filtering
- **Commits**: `/api/commits` - Commit queries with date range filtering
- **Ecosystems**: `/api/ecosystems` - Ecosystem management
- **Agencies**: `/api/agencies` - Agency CRUD operations
- **Events**: `/api/events` - Event management and associations
- **Contributors**: `/api/contributors` - Contributor statistics over time

For detailed API documentation, see [API.md](./API.md).

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `GITHUB_TOKEN` | Yes | - | GitHub personal access token (with `repo` scope) |
| `POSTGRES_USER` | No | `postgres` | Docker Compose PostgreSQL user |
| `POSTGRES_PASSWORD` | No | `postgres` | Docker Compose PostgreSQL password |
| `POSTGRES_DB` | No | `odd_dashboard` | Docker Compose PostgreSQL database name |

### Obtaining a GitHub Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a descriptive name (e.g., "ODD Dashboard")
4. Select scopes: **repo** (Full control of private repositories)
5. Click "Generate token"
6. Copy the token and add it to your `.env` file

**Note**: The token needs `repo` scope to access repository data and commits.

## Deployment

### Production Build

```bash
# Build the application
pnpm build

# Preview the build locally
pnpm preview
```

### Adapter Configuration

The project uses `@sveltejs/adapter-auto` which automatically selects the appropriate adapter based on your deployment platform:

- **Vercel**: Automatically uses `@sveltejs/adapter-vercel`
- **Netlify**: Automatically uses `@sveltejs/adapter-netlify`
- **Cloudflare Pages**: Uses `@sveltejs/adapter-cloudflare`
- **Node.js**: Falls back to `@sveltejs/adapter-node`

For specific deployment targets, you may want to install and configure the appropriate adapter explicitly.

### Database

For production, ensure:

- PostgreSQL database is properly configured
- Connection pooling is set up (min: 2, max: 10 connections)
- Indexes are in place (run migrations)
- Regular backups are configured

### Environment Variables

Set all required environment variables in your deployment platform:

- `DATABASE_URL`: Production PostgreSQL connection string
- `GITHUB_TOKEN`: GitHub token with appropriate permissions

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
pnpm docker:logs

# Restart PostgreSQL container
pnpm docker:down
pnpm docker:up

# Reset database (WARNING: deletes all data)
pnpm docker:reset
```

### GitHub Rate Limiting

The application implements rate limiting and retry logic, but you may still encounter rate limits:

- **Authenticated requests**: 5000 requests/hour
- **Solution**: Wait for rate limit reset, or use multiple tokens

Rate limit information is logged during sync operations.

### Sync Issues

If repository sync fails:

1. Check GitHub token has correct permissions
2. Verify repository is accessible (not deleted/private)
3. Check application logs for specific errors
4. For forks, ensure parent repository is synced first

### Missing Commits

If commits are missing after sync:

1. Check if commits are from bots (filtered automatically)
2. Verify sync completed successfully (check sync statistics)
3. For forks, ensure fork attribution ran correctly
4. Check commit date ranges (incremental sync uses `last_synced_at`)

### Fork Attribution Issues

If you see duplicate commits between forks and parents:

1. Run the fork attribution fix script:
   ```bash
   pnpm tsx scripts/fix-fork-attribution.ts
   ```

2. Verify sync service syncs parent before fork (fixed in latest version)

## Contributing

### Code Style

- **Indentation**: 4 spaces
- **Semicolons**: Required
- **Trailing commas**: Enabled
- **Format on save**: Recommended

Run Prettier to format code:

```bash
pnpm format
```

### Making Changes

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Format code with Prettier
5. Commit with descriptive messages
6. Submit a pull request

### Testing

When adding features:

- Test with real GitHub repositories
- Test with various data sizes (small and large repositories)
- Test error handling
- Verify database queries are optimized
- Check for TypeScript errors: `pnpm check`

## License

[Add your license information here]

## Support

For issues, questions, or contributions, please [open an issue](https://github.com/your-org/odd-dashboard/issues) on GitHub.
