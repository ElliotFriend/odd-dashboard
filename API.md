# ODD Dashboard API Documentation

This document provides comprehensive documentation for all API endpoints in the ODD Dashboard.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Repositories](#repositories)
- [Authors](#authors)
- [Commits](#commits)
- [Ecosystems](#ecosystems)
- [Agencies](#agencies)
- [Events](#events)
- [Contributors](#contributors)
- [Statistics](#statistics)

## Overview

The ODD Dashboard API follows RESTful conventions and returns JSON responses. All timestamps are in UTC.

### Base URL

```
http://localhost:5173/api
```

### Content Type

All requests and responses use `application/json` content type.

### Response Format

All successful responses follow this format:

```json
{
    "data": <response_data>
}
```

## Authentication

Currently, the API does not require authentication for read operations. The GitHub token configured in environment variables is used for syncing operations server-side.

## Error Handling

### Error Response Format

```json
{
    "error": "ErrorType",
    "message": "Human-readable error message",
    "details": {} // Optional additional details
}
```

### HTTP Status Codes

- `200 OK` - Successful GET request
- `201 Created` - Successful POST request
- `400 Bad Request` - Invalid request parameters
- `404 Not Found` - Resource not found
- `409 Conflict` - Duplicate resource (unique constraint violation)
- `422 Unprocessable Entity` - Validation error
- `500 Internal Server Error` - Server error

### Common Error Types

- **ValidationError** (422): Request data failed validation
- **NotFoundError** (404): Requested resource doesn't exist
- **ConflictError** (409): Resource already exists (duplicate)
- **DatabaseError** (500): Database operation failed
- **ServerError** (500): Unexpected server error

## Repositories

### List Repositories

Get a list of all repositories with optional filtering.

**Endpoint:** `GET /api/repositories`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agencyId` | integer | No | Filter by agency ID |
| `eventId` | integer | No | Filter by event ID |
| `excludeForks` | boolean | No | Exclude fork repositories (default: false) |
| `search` | string | No | Search by repository name |
| `sortBy` | string | No | Sort field: `commits`, `contributors`, `lastCommitDate`, `fullName` (default: `fullName`) |
| `sortOrder` | string | No | Sort order: `asc`, `desc` (default: `asc`) |

**Response:**

```json
{
    "data": [
        {
            "id": 1,
            "githubId": 123456789,
            "fullName": "owner/repo",
            "agencyId": 1,
            "isFork": false,
            "parentRepositoryId": null,
            "parentFullName": null,
            "defaultBranch": "main",
            "isMissing": false,
            "createdAt": "2024-01-01T00:00:00.000Z",
            "updatedAt": "2024-01-01T00:00:00.000Z",
            "lastSyncedAt": "2024-01-01T00:00:00.000Z",
            "commitCount": 150,
            "contributorCount": 5,
            "lastCommitDate": "2024-01-01T00:00:00.000Z"
        }
    ]
}
```

**Example:**

```bash
curl "http://localhost:5173/api/repositories?excludeForks=true&sortBy=commits&sortOrder=desc"
```

### Get Repository

Get a single repository by ID.

**Endpoint:** `GET /api/repositories/:id`

**Response:**

```json
{
    "data": {
        "id": 1,
        "githubId": 123456789,
        "fullName": "owner/repo",
        "agencyId": 1,
        "isFork": false,
        "parentRepositoryId": null,
        "parentFullName": null,
        "defaultBranch": "main",
        "isMissing": false,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "lastSyncedAt": "2024-01-01T00:00:00.000Z"
    }
}
```

### Create Repository

Create a new repository.

**Endpoint:** `POST /api/repositories`

**Request Body:**

```json
{
    "githubId": 123456789,
    "fullName": "owner/repo",
    "agencyId": 1,
    "defaultBranch": "main",
    "isFork": false,
    "parentFullName": "parent/repo"
}
```

**Required Fields:** `githubId`, `fullName`

**Response:** `201 Created` with created repository data

### Update Repository

Update an existing repository.

**Endpoint:** `PUT /api/repositories/:id`

**Request Body:** (all fields optional)

```json
{
    "fullName": "owner/new-repo-name",
    "agencyId": 2,
    "defaultBranch": "develop"
}
```

**Response:** Updated repository data

### Delete Repository

Delete a repository and all associated commits (CASCADE).

**Endpoint:** `DELETE /api/repositories/:id`

**Response:**

```json
{
    "data": {
        "success": true
    }
}
```

### Add Repository from GitHub

Add a repository by fetching data from GitHub API.

**Endpoint:** `POST /api/repositories/add`

**Request Body:**

```json
{
    "fullName": "owner/repo",
    "agencyId": 1
}
```

**Response:** `201 Created` with repository data

**Note:** This endpoint fetches repository metadata from GitHub, detects forks, and links to parent repositories if they exist in the database.

### Sync Repository Commits

Trigger a sync operation to fetch commits from GitHub.

**Endpoint:** `POST /api/repositories/:id/sync`

**Request Body:** (all fields optional)

```json
{
    "initialSync": false,
    "batchSize": 1000
}
```

**Parameters:**

- `initialSync`: If true, fetch all commits; if false, fetch only since last sync
- `batchSize`: Number of commits to process per batch (default: 1000)

**Response:**

```json
{
    "data": {
        "repositoryId": 1,
        "commitsProcessed": 150,
        "commitsCreated": 100,
        "commitsSkippedBots": 5,
        "authorsCreated": 3,
        "errors": []
    }
}
```

**Example:**

```bash
curl -X POST "http://localhost:5173/api/repositories/1/sync" \
  -H "Content-Type: application/json" \
  -d '{"initialSync": true}'
```

### Bulk Import Repositories

Import multiple repositories from CSV data.

**Endpoint:** `POST /api/repositories/bulk-import`

**Request Body:**

```json
{
    "repositories": [
        {
            "fullName": "owner/repo1",
            "agencyId": 1
        },
        {
            "fullName": "owner/repo2",
            "agencyId": 1
        }
    ]
}
```

**Response:**

```json
{
    "data": {
        "imported": 2,
        "failed": 0,
        "errors": []
    }
}
```

### Batch Sync Repositories

Sync multiple repositories in batch.

**Endpoint:** `POST /api/repositories/sync-batch`

**Request Body:**

```json
{
    "repositoryIds": [1, 2, 3],
    "initialSync": false
}
```

**Response:**

```json
{
    "data": {
        "results": [
            {
                "repositoryId": 1,
                "success": true,
                "commitsProcessed": 150,
                "commitsCreated": 100
            }
        ]
    }
}
```

### Get Repository Contributors

Get contributors for a specific repository.

**Endpoint:** `GET /api/repositories/:id/contributors`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string (ISO 8601) | No | Filter commits from this date |
| `endDate` | string (ISO 8601) | No | Filter commits until this date |
| `branch` | string | No | Filter by branch name |

**Response:**

```json
{
    "data": [
        {
            "id": 1,
            "githubId": 123456,
            "username": "johndoe",
            "name": "John Doe",
            "email": "john@example.com",
            "commitCount": 45
        }
    ]
}
```

### Get Repository Ecosystems

Get ecosystems associated with a repository.

**Endpoint:** `GET /api/repositories/:id/ecosystems`

**Response:**

```json
{
    "data": [
        {
            "id": 1,
            "name": "Stellar",
            "parentId": null
        }
    ]
}
```

### Associate Repository with Ecosystem

Add a repository to an ecosystem.

**Endpoint:** `POST /api/repositories/:id/ecosystems`

**Request Body:**

```json
{
    "ecosystemId": 1
}
```

**Response:** `201 Created`

### Remove Repository from Ecosystem

Remove a repository from an ecosystem.

**Endpoint:** `DELETE /api/repositories/:id/ecosystems`

**Request Body:**

```json
{
    "ecosystemId": 1
}
```

**Response:** `200 OK`

### Get Repository Events

Get events associated with a repository.

**Endpoint:** `GET /api/repositories/:id/events`

**Response:**

```json
{
    "data": [
        {
            "id": 1,
            "name": "Stellar Hackathon 2024",
            "description": "Annual Stellar hackathon",
            "startDate": "2024-06-01",
            "endDate": "2024-06-03"
        }
    ]
}
```

## Authors

### List Authors

Get a list of all authors with optional filtering.

**Endpoint:** `GET /api/authors`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agencyId` | integer | No | Filter by agency ID |
| `githubId` | integer | No | Filter by GitHub ID |
| `email` | string | No | Filter by email address |
| `search` | string | No | Search by name, username, or email |

**Response:**

```json
{
    "data": [
        {
            "id": 1,
            "githubId": 123456,
            "username": "johndoe",
            "name": "John Doe",
            "email": "john@example.com",
            "agencyId": 1,
            "createdAt": "2024-01-01T00:00:00.000Z",
            "updatedAt": "2024-01-01T00:00:00.000Z"
        }
    ]
}
```

## Commits

### List Commits

Get a list of commits with filtering.

**Endpoint:** `GET /api/commits`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repositoryId` | integer | Yes* | Filter by repository ID |
| `authorId` | integer | Yes* | Filter by author ID |
| `startDate` | string (ISO 8601) | No | Filter commits from this date |
| `endDate` | string (ISO 8601) | No | Filter commits until this date |
| `branch` | string | No | Filter by branch name |

*Note: Either `repositoryId` or `authorId` is required.

**Response:**

```json
{
    "data": [
        {
            "id": 1,
            "repositoryId": 1,
            "authorId": 1,
            "sha": "abc123...",
            "commitDate": "2024-01-01T00:00:00.000Z",
            "branch": "main",
            "repository": {
                "fullName": "owner/repo"
            },
            "author": {
                "name": "John Doe",
                "username": "johndoe"
            }
        }
    ]
}
```

**Example:**

```bash
curl "http://localhost:5173/api/commits?repositoryId=1&startDate=2024-01-01&endDate=2024-12-31"
```

## Ecosystems

### List Ecosystems

Get all ecosystems.

**Endpoint:** `GET /api/ecosystems`

**Response:**

```json
{
    "data": [
        {
            "id": 1,
            "name": "Stellar",
            "parentId": null,
            "createdAt": "2024-01-01T00:00:00.000Z",
            "updatedAt": "2024-01-01T00:00:00.000Z"
        }
    ]
}
```

### Get Ecosystem

Get a single ecosystem by ID.

**Endpoint:** `GET /api/ecosystems/:id`

**Response:**

```json
{
    "data": {
        "id": 1,
        "name": "Stellar",
        "parentId": null,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
    }
}
```

### Create Ecosystem

Create a new ecosystem.

**Endpoint:** `POST /api/ecosystems`

**Request Body:**

```json
{
    "name": "Ethereum",
    "parentId": null
}
```

**Required Fields:** `name`

**Response:** `201 Created` with ecosystem data

**Note:** Cycle prevention is enforced. Cannot create cycles in the ecosystem hierarchy.

### Update Ecosystem

Update an existing ecosystem.

**Endpoint:** `PUT /api/ecosystems/:id`

**Request Body:** (all fields optional)

```json
{
    "name": "Stellar Network",
    "parentId": 2
}
```

**Response:** Updated ecosystem data

**Note:** Cycle prevention is enforced when updating `parentId`.

### Delete Ecosystem

Delete an ecosystem.

**Endpoint:** `DELETE /api/ecosystems/:id`

**Response:**

```json
{
    "data": {
        "success": true
    }
}
```

## Agencies

### List Agencies

Get all agencies.

**Endpoint:** `GET /api/agencies`

**Response:**

```json
{
    "data": [
        {
            "id": 1,
            "name": "Stellar Development Foundation",
            "description": "The Stellar Development Foundation is a non-profit organization...",
            "createdAt": "2024-01-01T00:00:00.000Z",
            "updatedAt": "2024-01-01T00:00:00.000Z"
        }
    ]
}
```

### Get Agency

Get a single agency by ID.

**Endpoint:** `GET /api/agencies/:id`

**Response:**

```json
{
    "data": {
        "id": 1,
        "name": "Stellar Development Foundation",
        "description": "The Stellar Development Foundation is a non-profit organization...",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
    }
}
```

### Create Agency

Create a new agency.

**Endpoint:** `POST /api/agencies`

**Request Body:**

```json
{
    "name": "Stellar Development Foundation",
    "description": "The Stellar Development Foundation is a non-profit organization..."
}
```

**Required Fields:** `name`

**Response:** `201 Created` with agency data

### Update Agency

Update an existing agency.

**Endpoint:** `PUT /api/agencies/:id`

**Request Body:** (all fields optional)

```json
{
    "name": "SDF",
    "description": "Updated description..."
}
```

**Response:** Updated agency data

### Delete Agency

Delete an agency. Sets associated records to NULL (SET NULL cascade).

**Endpoint:** `DELETE /api/agencies/:id`

**Response:**

```json
{
    "data": {
        "success": true
    }
}
```

## Events

### List Events

Get all events with optional filtering.

**Endpoint:** `GET /api/events`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agencyId` | integer | No | Filter by agency ID |
| `search` | string | No | Search by name or description |

**Response:**

```json
{
    "data": [
        {
            "id": 1,
            "name": "Stellar Hackathon 2024",
            "description": "Annual Stellar hackathon",
            "startDate": "2024-06-01",
            "endDate": "2024-06-03",
            "agencyId": 1,
            "createdAt": "2024-01-01T00:00:00.000Z",
            "updatedAt": "2024-01-01T00:00:00.000Z"
        }
    ]
}
```

### Get Event

Get a single event by ID with optional includes.

**Endpoint:** `GET /api/events/:id`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `include` | string | No | Comma-separated list: `authors`, `repositories` |

**Response:**

```json
{
    "data": {
        "id": 1,
        "name": "Stellar Hackathon 2024",
        "description": "Annual Stellar hackathon",
        "startDate": "2024-06-01",
        "endDate": "2024-06-03",
        "agencyId": 1,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "authors": [...],
        "repositories": [...]
    }
}
```

### Create Event

Create a new event.

**Endpoint:** `POST /api/events`

**Request Body:**

```json
{
    "name": "Stellar Hackathon 2024",
    "description": "Annual Stellar hackathon",
    "startDate": "2024-06-01",
    "endDate": "2024-06-03",
    "agencyId": 1
}
```

**Required Fields:** `name`

**Validation:** `endDate` must be >= `startDate` if both are provided.

**Response:** `201 Created` with event data

### Update Event

Update an existing event.

**Endpoint:** `PUT /api/events/:id`

**Request Body:** (all fields optional)

```json
{
    "name": "Stellar Hackathon 2024 (Updated)",
    "description": "Updated description...",
    "startDate": "2024-06-01",
    "endDate": "2024-06-05"
}
```

**Response:** Updated event data

### Delete Event

Delete an event. Cascades to author_events and repository_events.

**Endpoint:** `DELETE /api/events/:id`

**Response:**

```json
{
    "data": {
        "success": true
    }
}
```

### List Event Authors

Get authors associated with an event.

**Endpoint:** `GET /api/events/:id/authors`

**Response:**

```json
{
    "data": [
        {
            "id": 1,
            "githubId": 123456,
            "username": "johndoe",
            "name": "John Doe",
            "email": "john@example.com"
        }
    ]
}
```

### Associate Author with Event

Add an author to an event.

**Endpoint:** `POST /api/events/:id/authors`

**Request Body:**

```json
{
    "authorId": 1
}
```

**Response:** `201 Created`

### Remove Author from Event

Remove an author from an event.

**Endpoint:** `DELETE /api/events/:id/authors`

**Request Body:**

```json
{
    "authorId": 1
}
```

**Response:** `200 OK`

### List Event Repositories

Get repositories associated with an event.

**Endpoint:** `GET /api/events/:id/repositories`

**Response:**

```json
{
    "data": [
        {
            "id": 1,
            "fullName": "owner/repo",
            "githubId": 123456789
        }
    ]
}
```

### Associate Repository with Event

Add a repository to an event.

**Endpoint:** `POST /api/events/:id/repositories`

**Request Body:**

```json
{
    "repositoryId": 1
}
```

**Response:** `201 Created`

### Remove Repository from Event

Remove a repository from an event.

**Endpoint:** `DELETE /api/events/:id/repositories`

**Request Body:**

```json
{
    "repositoryId": 1
}
```

**Response:** `200 OK`

## Contributors

### List Contributors

Get contributors with commit counts over a time period.

**Endpoint:** `GET /api/contributors`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string (ISO 8601) | No | Filter commits from this date |
| `endDate` | string (ISO 8601) | No | Filter commits until this date |
| `agencyId` | integer | No | Filter by agency ID |

**Response:**

```json
{
    "data": [
        {
            "id": 1,
            "githubId": 123456,
            "username": "johndoe",
            "name": "John Doe",
            "email": "john@example.com",
            "agencyId": 1,
            "commitCount": 45
        }
    ]
}
```

**Note:** Results are sorted by commit count in descending order.

**Example:**

```bash
curl "http://localhost:5173/api/contributors?startDate=2024-01-01&endDate=2024-12-31&agencyId=1"
```

## Statistics

### Dashboard Statistics

Get overall dashboard statistics.

**Endpoint:** `GET /api/statistics/dashboard`

**Response:**

```json
{
    "data": {
        "totalRepositories": 50,
        "totalAuthors": 200,
        "totalCommits": 15000,
        "last30DaysCommits": 500
    }
}
```

### Ecosystem Statistics

Get statistics for all ecosystems.

**Endpoint:** `GET /api/statistics/ecosystems`

**Response:**

```json
{
    "data": [
        {
            "id": 1,
            "name": "Stellar",
            "repositoryCount": 10,
            "contributorCount": 50,
            "commitCount": 5000
        }
    ]
}
```

### Single Ecosystem Statistics

Get statistics for a specific ecosystem.

**Endpoint:** `GET /api/statistics/ecosystems/:id`

**Response:**

```json
{
    "data": {
        "id": 1,
        "name": "Stellar",
        "repositoryCount": 10,
        "contributorCount": 50,
        "commitCount": 5000
    }
}
```

### Event Statistics

Get statistics for all events.

**Endpoint:** `GET /api/statistics/events`

**Response:**

```json
{
    "data": [
        {
            "id": 1,
            "name": "Stellar Hackathon 2024",
            "repositoryCount": 5,
            "contributorCount": 25,
            "commitCount": 150
        }
    ]
}
```

### Single Event Statistics

Get statistics for a specific event.

**Endpoint:** `GET /api/statistics/events/:id`

**Response:**

```json
{
    "data": {
        "id": 1,
        "name": "Stellar Hackathon 2024",
        "repositoryCount": 5,
        "contributorCount": 25,
        "commitCount": 150
    }
}
```

## Rate Limiting

The API uses GitHub's API internally for syncing operations. GitHub enforces rate limits:

- **Authenticated requests**: 5000 requests per hour
- **Unauthenticated requests**: 60 requests per hour

The application implements automatic rate limit detection, request throttling, and retry logic with exponential backoff.

Rate limit information is logged during sync operations.

## Pagination

Pagination is not currently implemented but is planned for future releases. For now, all list endpoints return all matching records.

## Filtering Best Practices

### Date Ranges

When filtering by date ranges, use ISO 8601 format:

```text
2024-01-01T00:00:00.000Z
```

Dates are stored and queried in UTC timezone.

### Search

Search parameters typically perform case-insensitive partial matching:

- `search=stellar` matches "Stellar", "stellar-core", "my-stellar-app"

### Combining Filters

Multiple query parameters can be combined:

```bash
curl "http://localhost:5173/api/repositories?agencyId=1&excludeForks=true&search=stellar&sortBy=commits&sortOrder=desc"
```

## Examples

### Complete Workflow Example

1. **Create an agency:**

```bash
curl -X POST "http://localhost:5173/api/agencies" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Agency", "description": "Agency description"}'
```

2. **Add a repository:**

```bash
curl -X POST "http://localhost:5173/api/repositories/add" \
  -H "Content-Type: application/json" \
  -d '{"fullName": "stellar/stellar-core", "agencyId": 1}'
```

3. **Sync repository commits:**

```bash
curl -X POST "http://localhost:5173/api/repositories/1/sync" \
  -H "Content-Type: application/json" \
  -d '{"initialSync": true}'
```

4. **Get contributors:**

```bash
curl "http://localhost:5173/api/contributors?startDate=2024-01-01&endDate=2024-12-31"
```

5. **Create an event:**

```bash
curl -X POST "http://localhost:5173/api/events" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hackathon 2024",
    "startDate": "2024-06-01",
    "endDate": "2024-06-03",
    "agencyId": 1
  }'
```

6. **Associate repository with event:**

```bash
curl -X POST "http://localhost:5173/api/events/1/repositories" \
  -H "Content-Type: application/json" \
  -d '{"repositoryId": 1}'
```

## Versioning

The API is currently unversioned. Breaking changes will be documented in release notes.

## Support

For API issues or questions, please open an issue on GitHub.
