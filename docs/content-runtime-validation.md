# Content Runtime Validation

## Purpose
The purpose of the runtime compatibility check is to prove that the entire dataset of 144 real activities can safely flow through the runtime architecture, from the `LocalContentRepository` to the `ActivityRenderer`, component rendering, and evaluator.

## 144-Activity Coverage
As of Phase 07, the system contains 144 total normalized Class 3 Tamil Term I activities.

### Category Breakdown
- **picture-recognition**: 21 activities
- **spelling-choice**: 26 activities
- **meaning-match**: 23 activities
- **context-choice**: 27 activities
- **arrange-word**: 38 activities
- **word-completion**: 9 activities

### Variant Breakdown
- **select**: 47 activities (21 picture-recognition, 26 spelling-choice)
- **translate-select**: 23 activities
- **fill-blank**: 27 activities
- **arrange**: 38 activities
- **missing-unit**: 9 activities

### Level Breakdown
- **Level 1**: 57 activities
- **Level 2**: 55 activities
- **Level 3**: 32 activities

## Runtime Validation Method
A dedicated suite (`runtime-compatibility.test.tsx`) loops over all 144 activities dynamically:
1. Validates unique IDs and non-empty categories/variants.
2. Resolves the definition via `ActivityRegistry`.
3. Mocks a minimal session state.
4. Mounts the actual React component (`definition.component`) for the activity using React Testing Library to ensure it handles real data without crashing (e.g. missing prompts, bad IDs, malformed options).
5. Exercises the `definition.evaluator` with an empty/invalid answer payload to prove safe fallback without throwing errors.

## Evaluator Compatibility
All evaluators guarantee safe processing of data. Invalid token IDs, empty sequence arrays, and missing inputs simply return `correct: false` and safely proceed, leaving no room for app crashes.

## Session Integration
A full 6-family session integration test (`six-family-session.test.tsx`) constructs a real session comprising 6 specific activities (one from each family). The session correctly transitions from idle to active, evaluates answers correctly across all 6 distinct evaluators, and cleanly transitions to a completed session state producing standardized `ActivityResult` outputs.

## Known Content Limitations
- Context Choice formatting requires `[blank]` or `______` to render nicely.
- Spelling choice occasionally shares duplicate choices logically, but the `id` field securely differentiates them.
