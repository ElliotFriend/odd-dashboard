# Phase 2 Testing Guide

This guide helps you test all the Phase 2 features: email-only commit handling, sync service, fork detection, and rate limiting.

## Prerequisites

1. Make sure your database is running:
   ```bash
   pnpm docker:up
   ```

2. Ensure your `.env` file has `GITHUB_TOKEN` set:
   ```bash
   GITHUB_TOKEN=ghp_your_token_here
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/odd_dashboard
   ```

## Test Scripts Overview

### 1. `test-author-extraction.ts`
Tests author extraction from commits (GitHub users vs email-only).

**Usage:**
```bash
pnpm tsx scripts/test-author-extraction.ts <owner> <repo> [branch] [limit]
```

**Example:**
```bash
# Test with a small repository
pnpm tsx scripts/test-author-extraction.ts octocat Hello-World main 10
```

**What it tests:**
- Extracts author information from commits
- Identifies GitHub users (with github_id and username)
- Identifies email-only commits (no GitHub account)
- Shows summary statistics

---

### 2. `add-test-repository.ts`
Adds a repository to the database for testing sync and fork detection.

**Usage:**
```bash
pnpm tsx scripts/add-test-repository.ts <owner> <repo>
```

**Example:**
```bash
# Add a test repository
pnpm tsx scripts/add-test-repository.ts octocat Hello-World

# Add a fork repository
pnpm tsx scripts/add-test-repository.ts someuser some-fork-repo
```

**What it does:**
- Fetches repository data from GitHub
- Creates or updates repository in database
- Detects and links fork relationships if applicable
- Returns repository ID for use in other tests

---

### 3. `test-sync.ts`
Tests the sync service to fetch and store commits.

**Usage:**
```bash
pnpm tsx scripts/test-sync.ts <repository_id> [initial]
```

**Examples:**
```bash
# Incremental sync (only new commits since last_synced_at)
pnpm tsx scripts/test-sync.ts 1

# Initial sync (all commits)
pnpm tsx scripts/test-sync.ts 1 initial
```

**What it tests:**
- Fetches commits from GitHub API
- Creates authors in database (with deduplication)
- Creates commits in database
- Updates last_synced_at timestamp
- Shows before/after statistics
- Displays sample commits

**Note:** You need to add a repository first using `add-test-repository.ts` to get the repository ID.

---

### 4. `test-fork-detection.ts`
Tests fork detection and parent repository linking.

**Usage:**
```bash
pnpm tsx scripts/test-fork-detection.ts <owner> <repo>
```

**Example:**
```bash
# Test with a fork repository
pnpm tsx scripts/test-fork-detection.ts someuser some-fork-repo
```

**What it tests:**
- Detects if repository is a fork
- Extracts parent repository information
- Links to parent repository if it exists in database
- Shows fork detection results

**Tip:** To test parent linking, add the parent repository first, then add the fork.

---

### 5. `test-rename-detection.ts`
Tests repository rename detection.

**Usage:**
```bash
pnpm tsx scripts/test-rename-detection.ts <github_id> <stored_full_name>
```

**Example:**
```bash
pnpm tsx scripts/test-rename-detection.ts 12345678 "owner/old-repo-name"
```

**What it tests:**
- Detects if repository has been renamed
- Compares stored full_name with current GitHub full_name
- Uses GitHub ID (which never changes) for reliable detection

---

## Complete Testing Workflow

### Test 1: Author Extraction
```bash
# Test with a repository that has both GitHub users and email-only commits
pnpm tsx scripts/test-author-extraction.ts octocat Hello-World main 20
```

### Test 2: Add Repository and Sync
```bash
# Step 1: Add a repository
pnpm tsx scripts/add-test-repository.ts octocat Hello-World
# Note the repository ID from the output

# Step 2: Initial sync (all commits)
pnpm tsx scripts/test-sync.ts 1 initial

# Step 3: Incremental sync (should be fast, no new commits)
pnpm tsx scripts/test-sync.ts 1
```

### Test 3: Fork Detection
```bash
# Step 1: Add parent repository
pnpm tsx scripts/add-test-repository.ts owner parent-repo

# Step 2: Add fork repository
pnpm tsx scripts/add-test-repository.ts owner fork-repo

# Step 3: Test fork detection
pnpm tsx scripts/test-fork-detection.ts owner fork-repo
```

### Test 4: Rate Limiting
The rate limiting is automatically applied to all API calls. To test it:

1. Make many API calls in quick succession
2. The system will automatically throttle requests
3. If rate limit is hit, it will wait until reset

You can monitor rate limit headers in the console output.

---

## Expected Results

### Author Extraction
- Should identify both GitHub users and email-only commits
- GitHub users should have `github_id` and `username`
- Email-only commits should have `null` for `github_id` and `username`

### Sync Service
- Should fetch commits from GitHub
- Should create authors with proper deduplication
- Should create commits in database
- Should update `last_synced_at` timestamp
- Should handle duplicate commits gracefully (skip them)

### Fork Detection
- Should detect if repository is a fork
- Should extract parent repository information
- Should link to parent if it exists in database
- Should update `is_fork`, `parent_full_name`, and `parent_repository_id` fields

### Rate Limiting
- Requests should be throttled (100ms delay between requests by default)
- Should retry on transient errors (500, 502, 503, 504)
- Should handle rate limit errors (429) with proper delay

---

## Troubleshooting

### "Repository not found" error
- Make sure the repository exists on GitHub
- Check that your `GITHUB_TOKEN` is valid
- Verify the owner/repo name is correct

### "Database connection" error
- Make sure Docker container is running: `pnpm docker:up`
- Check that `DATABASE_URL` in `.env` is correct
- Verify database is accessible

### "Rate limit exceeded" error
- Wait a few minutes and try again
- The system should automatically handle rate limits, but if you hit the limit, wait for reset

### "No commits found" error
- Repository might be empty
- Check that the branch name is correct
- Verify repository has commits on the default branch

---

## Next Steps

After testing Phase 2, you can:
1. Move on to Phase 3 (Core Services & API Routes)
2. Test with larger repositories
3. Test with repositories that have many commits (>1000)
4. Test with multiple forks and parent relationships

