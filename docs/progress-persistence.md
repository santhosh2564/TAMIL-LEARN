# Progress & Persistence Architecture

This document outlines how learner progress is stored, retrieved, and cleared.

## Architecture

The persistence layer is organized in explicit layers — no React component ever calls `localStorage` directly.

```text
Learning UI (LearningAreaPage, ResultsPage, SettingsPage)
           ↓
     ProgressService
           ↓
   ProgressRepository (interface)
           ↓
 LocalProgressRepository
           ↓
  localStorage (key: sa.learning.progress.v1)
```

When a `CloudProgressRepository` is implemented in a future phase, only the repository implementation changes — the service, components, and session engine are unaffected.

## Progress Domain Model

```typescript
interface ActivityProgress {
  activityId: string;         // Stable reference to ContentRepository ID
  category: ActivityCategory; // Used for category-level aggregation
  completed: boolean;
  correct: boolean;           // True if ever answered correctly
  attempts: number;           // Lifetime attempts
  lastCompletedAt: string;   // ISO timestamp
  lastAttemptedAt: string;   // ISO timestamp
}

interface ProgressSnapshot {
  version: number;    // Schema version — used for forward compat
  updatedAt: string;  // ISO timestamp of last write
  activities: Record<string, ActivityProgress>;
}
```

## What is NOT stored

Progress deliberately stores **only learner state**. It never duplicates:

- prompts
- options
- correct answers
- activity definitions
- asset data

That data remains exclusively in `ContentRepository`.

## Storage Key

```text
sa.learning.progress.v1
```

This is:
- Namespaced to this application (`sa.learning`)
- Semantic (`progress`)  
- Versioned (`v1`) to enable safe schema migrations in future

## Schema Versioning

Every stored snapshot includes `"version": 1`. On load:
- If version matches `PROGRESS_SCHEMA_VERSION`, the snapshot is used
- If version mismatches or JSON is malformed, the repository silently returns an empty state without crashing the application

## Storage Failure Handling

All `localStorage` calls (`getItem`, `setItem`, `removeItem`) are wrapped in try/catch. Storage failures (quota exceeded, SecurityError, private browsing restrictions) degrade gracefully:

- The application continues normally
- Session activity is unaffected
- The progress simply isn't persisted for that session

This is intentional: **persistence is an enhancement, not a crash condition**.

## Privacy

The stored data is entirely anonymous:

- No names, emails, phone numbers, or credentials
- Only activity IDs, categories, attempt counts, and timestamps
- No user account or identity tracking

## Clearing Progress

Via **Settings → Clear Learning Progress**:
1. User requests clear
2. A confirmation dialog explains exactly what will be removed
3. On confirmation, `ProgressService.clearProgress()` removes the storage key
4. Learning Area category counts return to zero
5. Content, sessions, and application state are unaffected

## Integration Points

### SessionPage
After each activity completion:
```text
ActivityResult (from engine)
      ↓
ProgressService.recordCompletion()
      ↓
LocalProgressRepository.saveActivityProgress()
      ↓
localStorage
```

### LearningAreaPage
For each category card, fetches live completion count:
```text
ProgressService.getCategoryProgress(category, totalFromContentRepo)
      ↓
"N / M done" badge on each category card
```

## Future: CloudProgressRepository

```typescript
class CloudProgressRepository implements ProgressRepository {
  // Backed by Backend API
  // Same interface as LocalProgressRepository
}
```

Switching requires only:
```typescript
// In DI/provider:
const progressService = new ProgressService(new CloudProgressRepository());
// instead of new LocalProgressRepository()
```

No component, page, or engine needs to change.
