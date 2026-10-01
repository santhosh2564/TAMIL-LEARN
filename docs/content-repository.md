# Content Repository Architecture

This document describes the architectural boundary between the UI / Application layer and the Educational Content.

## Core Objective

The Content Repository exists to abstract *where* content comes from and *how* it is stored. The React Application (Activity Engine) will request content via the `ContentRepository` interface. It does not know if the content is sourced from a local JSON file, an API, or a database.

### Separation of Content vs. Session State

- **Content (Immutable):** Educational text, options, correct answers, categories. This data must *never* be modified in memory.
- **Runtime State (Mutable):** Selected answers, attempts, scores, and completion status. This belongs to the learning session, separate from the content object.

## Repository Interface

```typescript
export interface ContentRepository {
  getManifest(): Promise<ContentManifest>;
  getActivities(query?: ActivityQuery): Promise<Activity[]>;
  getActivityById(id: string): Promise<Activity | null>;
  getActivityCount(query?: ActivityQuery): Promise<number>;
}
```

The repository operations return cloned, immutable data to ensure the runtime application cannot accidentally modify the source content structure.

## LocalContentRepository

For the initial phases, the platform runs completely offline using `LocalContentRepository`. 
- **Initialization:** It loads the normalized JSON arrays generated in Phase 02.
- **Indexing:** It builds an in-memory `Map<string, Activity>` for `O(1)` ID lookups.
- **Immutability:** It uses deep cloning (`structuredClone` or JSON parsing) before returning any activity to the frontend.

## Query Model

The `ActivityQuery` provides strongly-typed filters.

```typescript
export interface ActivityQuery {
  classLevel?: number;
  subject?: string;
  term?: string;
  category?: ActivityCategory;
  variant?: ActivityVariant;
  level?: number;
}
```

This model naturally supports multi-class and multi-subject future expansions without needing to duplicate repository implementations.

## Future: ApiContentRepository

In later phases (e.g., Phase 21), a backend will be introduced. 
We will implement an `ApiContentRepository` conforming to the exact same `ContentRepository` interface. 
The API repository will use `fetch()` or a GraphQL client to retrieve activities dynamically from a remote server, mapping remote JSON payloads to our internal `Activity` type.

At that point, a factory or dependency injection mechanism will provide either the `LocalContentRepository` or `ApiContentRepository` based on environment configuration or feature flags, requiring zero changes to the React Activity Engine.

## Error Handling

Repository implementations use specific error classes, such as `ActivityNotFoundError`, so the application layer can gracefully present `ErrorState` components rather than crashing.

## Caching Strategy

The `LocalContentRepository` intrinsically caches data in memory at initialization.
For future `ApiContentRepository` implementations, caching can be introduced via memory, IndexedDB, or React Query at the service boundary, ensuring fast responses without repeatedly polling a remote server.
