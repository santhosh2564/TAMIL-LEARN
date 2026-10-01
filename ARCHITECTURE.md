# Architecture

## Project Structure

This project follows a feature-based architecture with separated concerns:

- `src/app`: Application entry point, global providers, and routing definition.
- `src/components`: Reusable UI components (buttons, cards, layout, etc.). They are purely presentational.
- `src/features`: Grouped by domain (e.g. `dashboard`, `activities`). Contains domain-specific pages and components.
- `src/types`: Centralized TypeScript interfaces representing the domain models.
- `src/config`: Configuration constants, environment variables, feature flags.
- `src/repositories`: Data access abstraction layer to decouple the app from specific data sources.
- `src/utils`: Utilities like custom loggers.
- `src/styles`: Global CSS and Tailwind configurations.
- `src/content`: Contains pre-processed JSON data representing validated educational content.
- `scripts`: Contains Node.js utilities to normalize, import, and validate content from source spreadsheets.
- `docs`: Documentation on content schemas, statistics, and mappings.

## Architectural Principles

1. **Separation of Concerns:** 
   - **UI:** Handled strictly by React components in `src/components` and `src/features`.
   - **Business Logic:** Encapsulated in domain-specific hooks and services.
   - **Content & Data Access:** Abstracted via the `Repository` pattern. No components directly fetch JSON/API.

2. **Content Architecture (Phase 02):**
   - Source material (Excel spreadsheets) is considered an authoring format and is *never* loaded directly by the UI.
   - An offline build script (`scripts/import-content.ts`) processes the Excel data into a normalized, strongly-typed JSON format.
   - Content strings are mapped to standard interactions (`picture-recognition`, `word-completion`, etc.) while retaining origin tracing metadata.
   - The repository layer (`LocalContentRepository`) reads these structured JSON files, exposing strongly-typed models to the frontend.

3. **Routing Strategy:**
   - Uses `react-router-dom` with a centralized route configuration (`routes.tsx`).
   - Top-level paths handle navigation between main platform concepts (Classes, Subjects, Activities, Settings).

4. **Design System & Learning Shell (Phase 04):**
   - **Styling:** Tailwind CSS is used for utility-first styling.
   - **Theming:** Centralized design tokens (colors, fonts, border radii) are defined in `tailwind.config.js`.
   - **Accessibility:** Built with semantic HTML, focus outlines, and appropriate touch targets (`min-target-size`). Respects `prefers-reduced-motion`.
   - **Tamil Support:** typography uses "Noto Sans Tamil" alongside "Inter" for accurate character rendering.
   - **Data Binding:** The learning shell uses `ContentRepository` dynamically to resolve available classes, subjects, and activities, preventing dead-ends.

5. **Activity Engine (Phase 05):**
   - **Core Engine:** A framework-agnostic engine manages state transitions (`idle` -> `active` -> `completed`) and attempts.
   - **Registry:** Maps combinations of `category` and `variant` to specific React components and Evaluators.
   - **Session Management:** `SessionService` controls lists of activities, aggregating standardized `ActivityResult` records independent of the underlying interaction type.
   - **Renderer:** `ActivityRenderer` acts as a dynamic factory that pulls components from the registry at runtime, ensuring the core app never hardcodes individual activity imports.

6. **Core Activity Components (Phase 06):**
   - **Activity Types:** Complete implementation of all 6 core families (`picture-recognition`, `spelling-choice`, `meaning-match`, `context-choice`, `arrange-word`, `word-completion`).
   - **Evaluators:** Domain-specific logic independent of React, determining if a user's answer matches the target, producing a standard `ActivityEvaluation`. Safely handles duplicate tokens and strictly adheres to JSON-provided atomic units.
   - **Reusable Components:** `ActivityCard`, `ActivityOption`, `ActivityAsset`, `ContextSentence`, `ArrangeToken`, etc., enabling rapid building of new activities without redefining standard UI patterns (like selecting buttons, rendering accessible blanks, or shuffling token pools).

7. **Runtime Content Validation (Phase 07):**
   - Strict runtime compatibility test suites guarantee that all 144 source activities can individually resolve their mappings, render their React components, and pass through their respective evaluators without crashing.

8. **Session & Learning Flow (Phase 08):**
   - The user interface is driven by `LocalContentRepository` to dynamically generate category counts and available session modes (Mixed Practice vs Category Practice).
   - Sessions are configurable by difficulty Level and activity count (Size), heavily utilizing the Fisher-Yates shuffle algorithm to guarantee randomized presentation without mutating base data.
   - A `SessionService` encapsulates the full lifecycle of an active session, storing completed results safely and ensuring robust boundaries and accidental-exit prevention.

9. **Production Hardening (Phase 09):**
   - **Session Activity Selector:** A dedicated `SessionActivitySelector` orchestrates querying, filtering, and shuffling `LocalContentRepository` decoupled from the UI layer.
   - **Navigation Resilience:** Strict control over navigation boundaries via `react-router-dom` `useBlocker` prevents accidental data loss during active sessions, whilst allowing graceful fallback messages if state corruption occurs.
   - **Fallback Safeties:** Placeholder architectures handle missing activity mappings professionally rather than exposing developer debug telemetry.

10. **Content & Asset Architecture (Phase 10):**
    - **Asset Domain Model:** Assets are decoupled from educational content via `AssetResolver`, mapping ID-based `AssetReference` requests to structural file paths without exposing UI components to physical location strings.
    - **Manifest Driven:** Asset definitions are mapped securely via an `assets.json` manifest lookup, eliminating path-traversal vulnerabilities and hard-coded CDNs.
    - **Safe UI States:** Missing or invalid asset states return explicitly structured error types, allowing UI boundaries like `ActivityAsset` to render fallback visual designs, entirely avoiding application crashes when media is missing.

11. **Local Progress & Persistence (Phase 11):**
    - **ProgressRepository interface:** `LocalProgressRepository` implements it today; `CloudProgressRepository` will implement the same interface in the future without requiring any UI changes.
    - **ProgressService:** Framework-agnostic service layer. React components call `ProgressService`, which calls `ProgressRepository`. No component ever calls `localStorage` directly.
    - **Storage Key:** `sa.learning.progress.v1` — stable, namespaced, versioned.
    - **Resilience:** All storage I/O is wrapped in try/catch. Malformed JSON, quota errors, and version mismatches degrade silently to an empty progress state — the application remains fully functional.
    - **Privacy:** Only anonymous learner state (activity ID, category, attempts, timestamps). No personal information.

## Future Integration

- **Authentication & Backend:** The `types/index.ts` models anticipate users, schools, and teachers, but no auth logic is built yet. When needed, an `AuthService` will be added.
- **Content Expansion:** Content is decoupled from the UI. The current architecture allows adding additional classes and subjects simply by creating new JSON content files and expanding the repository implementation, without modifying UI layers.
