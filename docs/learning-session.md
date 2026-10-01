# Learning Session

The Learning Session manages the end-to-end user experience for practicing activities.

## Architecture

The Session flow is conceptually decoupled into:

1. **Configuration (`SessionConfig`)**: Defines the scope of the session, such as which Class, Subject, Category, Level, and the Session Size.
2. **Selection (`SessionActivitySelector`)**: Takes the configuration, asks `LocalContentRepository` for eligible activities, and performs filtering, shuffling (using Fisher-Yates), and capping at the requested size.
3. **Engine Runtime (`CoreActivityEngine` & `SessionService`)**: Once the session is initialized and mapped into an `ActivitySession`, `SessionService` governs moving from one activity to the next, whilst `CoreActivityEngine` handles step-by-step evaluations.

### Flow Diagram

```text
                    CONTENT
                       │
              LocalContentRepository
                       │
                       ▼
              SessionActivitySelector
                       │
                       ▼
                  SessionConfig
                       │
                       ▼
                SessionService
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
       Activity Engine       Session State
             │                   │
             ▼                   ▼
       Activity Registry      Progress
             │                   │
             ▼                   ▼
       6 Activity Types       Results
             │
             ▼
          React UI
```

## Routing

- `/classes/:classId/subjects/:subjectId/session/setup` - Configuration Wizard
- `/classes/:classId/subjects/:subjectId/session/play` - Execution Environment
- `/classes/:classId/subjects/:subjectId/session/results` - Performance Summary

## Recovery & Resilience
- If a session is refreshed during `/play` and state is lost, the user is presented with a safe recovery path rather than a broken page.
- If a user tries to hit the browser Back button mid-session, they will receive a confirmation prompt warning about lost progress.
