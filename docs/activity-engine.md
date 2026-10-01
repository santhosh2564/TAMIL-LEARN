# Activity Engine Architecture

The Activity Engine is the core system responsible for managing the state, rendering, and evaluation of all educational activities on the platform. It separates *what* an activity is (content) from *how* it is displayed (rendering) and *how* it is evaluated (engine).

## Architecture Layers

### 1. The Core Engine (`CoreActivityEngine`)
Manages the runtime state of an individual activity independently of React.
- Handles transitions from `idle` → `active` → `completed`.
- Counts attempts and tracks duration.
- Delegates business logic (is the answer right?) to an `ActivityEvaluator`.

### 2. The Registry (`ActivityRegistry`)
A central dictionary mapping a `(category, variant)` pair to a specific `ActivityDefinition`.
This definition contains:
- The React component responsible for rendering the UI.
- The `ActivityEvaluator` responsible for grading input.

### 3. The Renderer (`ActivityRenderer`)
A React component that acts as a router for activities. It inspects the `category` and `variant` of an incoming `Activity`, retrieves the correct component from the registry, and renders it. If an activity is unsupported, it falls back to a graceful error boundary or placeholder.

### 4. The Session (`SessionService`)
Manages progress across a sequence of activities.
- Defines state machines across sequences (`not-started` → `active` → `completed`).
- Controls navigation (next, complete session).
- Aggregates standard `ActivityResult` models for future gamification, analytics, or persistence.

## Key Contracts

### `ActivityRuntimeState`
Tracks what the child is doing right now for a single activity.
```typescript
interface ActivityRuntimeState {
  activityId: string;
  status: 'idle' | 'active' | 'completed';
  attempts: number;
  startedAt?: number;
  completedAt?: number;
}
```

### `ActivityResult`
The standardized output of *any* activity, regardless of interaction type (drag-and-drop, multiple-choice, drawing). This ensures the session layer can remain perfectly generic.
```typescript
interface ActivityResult {
  activityId: string;
  completed: boolean;
  correct?: boolean;
  attempts: number;
  startedAt: number;
  completedAt?: number;
  metadata?: Record<string, unknown>; // For specific interaction logs
}
```

## Supported Activities

As of Phase 06B, the following activities are implemented and registered:

1. **Picture Recognition (`picture-recognition` / `select`)**
   - **Interaction**: Displays a prompt and (optionally) an image, asking the user to select the correct label.
   - **Evaluator**: `PictureRecognitionEvaluator`
   - **Component**: `PictureSelectActivity`

2. **Spelling Choice (`spelling-choice` / `select`)**
   - **Interaction**: Displays a target word or prompt and asks the user to select the correct spelling from options.
   - **Evaluator**: `SpellingChoiceEvaluator`
   - **Component**: `SpellingSelectActivity`

3. **Meaning Match (`meaning-match` / `translate-select`)**
   - **Interaction**: Provides a prompt (often a word in another language) and asks for the correct translation.
   - **Evaluator**: `MeaningMatchEvaluator`
   - **Component**: `MeaningMatchActivity`

4. **Context Choice (`context-choice` / `fill-blank`)**
   - **Interaction**: Displays a sentence with a blank (e.g., `______`) and asks the user to choose the correct word to fill it. 
   - **Evaluator**: `ContextChoiceEvaluator`
   - **Component**: `ContextChoiceActivity` (using `ContextSentence` for accessible blank rendering)

5. **Arrange Word (`arrange-word` / `arrange`)**
   - **Interaction**: Provides a prompt and a pool of available tokens (letters, syllables, or words). The user selects tokens to arrange them in the correct order in an answer area.
   - **Evaluator**: `ArrangeWordEvaluator` (compares the joined string of selected tokens against the expected answer)
   - **Component**: `ArrangeWordActivity` (uses `ArrangeToken` for accessible selection and reordering)
   - **Handling Duplicates**: Duplicate tokens in the available pool are treated as independent options with stable unique IDs.

6. **Word Completion (`word-completion` / `missing-unit`)**
   - **Interaction**: Displays a prompt containing an explicit missing unit indicator (e.g., `[blank]`) and asks the user to select the correct unit from options to complete the word.
   - **Evaluator**: `WordCompletionEvaluator`
   - **Component**: `WordCompletionActivity` (uses `WordCompletionDisplay` to render the prompt with an accessible blank)

## Future Extensibility
Adding a new interaction (e.g., voice recognition) does not require modifying the Core Engine. You simply:
1. Create a `VoiceActivityComponent`.
2. Create a `VoiceEvaluator` implementing `ActivityEvaluator`.
3. Call `activityRegistry.register({ ... })`.
