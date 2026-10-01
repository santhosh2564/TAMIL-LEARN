# Learning Experience

This document details the child-facing interaction shell that wraps the Activity Engine.

## Navigation Flow

1. **Home (`/`)**: A welcoming screen offering "Start Learning" (quick start) or "Choose Class" (exploration).
2. **Class Selection (`/classes`)**: Displays a grid of classes. Only classes with populated repository content (currently Class 3) are interactive.
3. **Subject Selection (`/classes/:classId/subjects`)**: Displays subjects. Driven by repository availability.
4. **Learning Area (`/classes/:classId/subjects/:subjectId`)**: The main menu for a subject. Displays categories of activities (e.g., "Picture Words", "Word Building") complete with friendly icons and dynamic activity counts fetched from the `ContentRepository`.
5. **Session Placeholder (`/session`)**: The shell where the Activity Engine will be mounted. Includes a header with progress tracking.
6. **Results Placeholder (`/session/results`)**: A summary screen shown after session completion.

## UI Data Binding

The Learning Area strictly loads its statistics and options via the repository. 
```typescript
const count = await repo.getActivityCount({ 
  classLevel: 3, 
  subject: 'Tamil',
  category: 'picture-recognition' 
});
```
This guarantees the UI will never present an option to a child that has zero underlying activities.

## Placeholders

Currently, `/session` and `/session/results` are visual placeholders. Actual progression logic and gamification will be added in Phase 05 and beyond.
