# English Content Runtime Schema

> **Document Version:** 1.0.0  
> **Target Audience:** Content Import Scripts, LocalContentRepository, Activity Engine, and Evaluators  
> **Subject Integration:** Class 3 English (`class-3/english/`) alongside Tamil (`class-3/tamil/term-1/`)

---

## 1. Architectural Strategy

The English content schema builds upon the existing platform domain model in `src/types/index.ts` while remaining completely subject-agnostic. 

Key principles:
1. **Zero Breaking Changes for Tamil:** The existing `Activity` interface remains fully compatible.
2. **First-Class Subject Agnosticism:** Content queries use `subject: 'English'`, `module?: number`, and `day?: number`.
3. **Exact Source Preservation:** Child-facing instructions (`prompt`), clues, and option order from the verified Excel sheets are preserved verbatim without translation or artificial rewriting.
4. **Separation of Content and Assets:** Images are referenced by stable semantic asset IDs resolved via manifest lookup, never by hardcoded file paths.
5. **Separation of Curriculum Metadata and Learning Events:** The schema supports both primary new-word mastery and spiral review sessions without inflating the unique word count beyond 958.

---

## 2. TypeScript Data Interfaces

```typescript
import { ActivityCategory, ActivityVariant, ContentAsset, ActivityOption } from '../../types';

/**
 * Extended Activity Category union supporting English interaction types
 */
export type EnglishActivityCategory = 
  | 'spelling-choice'       // E08: Select correct spelling from 3 options
  | 'arrange-word'          // E04, E06, E07: Arrange letters, syllables, or compound parts
  | 'word-completion'       // E05, E11: Fill in missing letter(s)
  | 'picture-recognition'   // E01, E12: Identify or spell word from picture
  | 'meaning-match';        // E09: Complete word from meaning/definition

/**
 * Extended Activity Variant union
 */
export type EnglishActivityVariant = 
  | 'select'                // Multiple-choice selection
  | 'arrange'               // Reordering tiles (letters or syllables)
  | 'missing-unit'          // Filling blank letter(s)
  | 'word-entry';           // Producing/typing full word from visual or clue

/**
 * Unified English Activity Model
 */
export interface EnglishActivity {
  /** Unique composite activity identifier: e.g. "ENG-M1-EW002" */
  id: string;

  /** Standard class level */
  classLevel: 3;

  /** Subject identifier */
  subject: 'English';

  /** Language locale */
  language: 'en-US' | 'en-IN';

  /** Module number (1 to 8) */
  module: number;

  /** Day of the module (1 to 5) */
  day: number;

  /** Pedagogical role within the module session */
  role: 'new' | 'review';

  /** If role === 'review', indicates the module where the word was originally introduced */
  reviewSourceModule?: number;

  /** Target vocabulary word (lowercase) */
  targetWord: string;

  /** Normalized numeric difficulty level (1 = Easy, 2 = Medium, 3 = Hard) */
  level: 1 | 2 | 3;

  /** Raw difficulty string from source authoring */
  sourceDifficulty: 'Easy' | 'Medium' | 'Hard' | 'Mixed' | 'Unclassified';

  /** Primary interaction category */
  category: EnglishActivityCategory;

  /** Interaction variant */
  variant: EnglishActivityVariant;

  /** EXACT child-facing instruction / clue from spreadsheet */
  prompt: string;

  /** Multiple-choice options (used for E08, E12 choice variants) */
  options?: ActivityOption[];

  /** Discrete units / tiles to be arranged (used for E04, E06, E07) */
  units?: string[];

  /** Missing letter template (e.g. "a b _ u t" for E05) */
  template?: string;

  /** Correct target answer string */
  correctAnswer: string;

  /** Visual image asset reference (for E01, E12, and picture-context prompts) */
  image?: ContentAsset;

  /** Source tracking and pedigree metadata */
  source: {
    workbook: string;
    ewId: string;
    activityCode: string; // e.g. "E01", "E04", "E05", "E06", "E07", "E08", "E09", "E11", "E12"
    originalActivity: string;
    hasSourceAnomaly?: boolean;
    anomalyNote?: string;
  };

  /** Additional metadata */
  metadata?: {
    withinWeekReview?: boolean;
    partCount?: number;
    letterCount?: number;
  };
}

/**
 * Module Manifest Interface
 */
export interface EnglishModuleManifest {
  classLevel: 3;
  subject: 'English';
  module: number;
  title: string;
  newWordCount: number;
  reviewWordCount: number;
  totalActivities: number;
  days: {
    day: number;
    newCount: number;
    reviewCount: number;
    totalCount: number;
  }[];
  difficultyBreakdown: {
    easy: number;
    medium: number;
    hard: number;
    mixed: number;
    unclassified: number;
  };
  supportedCategories: EnglishActivityCategory[];
  version: string;
}
```

---

## 3. Concrete Activity Examples by Activity Code

### 1. Code E08 — Correct Spelling (`spelling-choice::select`)
```json
{
  "id": "ENG-M3-EW011",
  "classLevel": 3,
  "subject": "English",
  "language": "en-IN",
  "module": 3,
  "day": 1,
  "role": "new",
  "targetWord": "angry",
  "level": 2,
  "sourceDifficulty": "Medium",
  "category": "spelling-choice",
  "variant": "select",
  "prompt": "Choose the correct spelling:",
  "options": [
    { "id": "A", "label": "angry" },
    { "id": "B", "label": "engri" },
    { "id": "C", "label": "angrie" }
  ],
  "correctAnswer": "angry",
  "source": {
    "workbook": "English_Module_3_120_NEW_40_REVIEW_PROCESSED.xlsx",
    "ewId": "EW011",
    "activityCode": "E08",
    "originalActivity": "E08 – Correct Spelling"
  }
}
```

---

### 2. Code E06 — Arrange Letters (`arrange-word::arrange`)
```json
{
  "id": "ENG-M1-EW002",
  "classLevel": 3,
  "subject": "English",
  "language": "en-IN",
  "module": 1,
  "day": 1,
  "role": "new",
  "targetWord": "achieve",
  "level": 3,
  "sourceDifficulty": "Hard",
  "category": "arrange-word",
  "variant": "arrange",
  "prompt": "Put the letters in the correct order:",
  "units": ["e", "v", "a", "i", "h", "c", "e"],
  "correctAnswer": "achieve",
  "source": {
    "workbook": "English_Module_1_120_Word_Implementation_Plan.xlsx",
    "ewId": "EW002",
    "activityCode": "E06",
    "originalActivity": "E06 – Arrange Letters"
  }
}
```

---

### 3. Code E04 — Arrange Syllables (`arrange-word::arrange`)
```json
{
  "id": "ENG-M1-EW003",
  "classLevel": 3,
  "subject": "English",
  "language": "en-IN",
  "module": 1,
  "day": 1,
  "role": "new",
  "targetWord": "adventure",
  "level": 2,
  "sourceDifficulty": "Medium",
  "category": "arrange-word",
  "variant": "arrange",
  "prompt": "This means an exciting journey or experience. Put the word parts in the correct order:",
  "units": ["ture", "ad", "ven"],
  "correctAnswer": "adventure",
  "source": {
    "workbook": "English_Module_1_120_Word_Implementation_Plan.xlsx",
    "ewId": "EW003",
    "activityCode": "E04",
    "originalActivity": "E04 – Arrange Syllables"
  }
}
```

---

### 4. Code E07 — Arrange Compound Parts (`arrange-word::arrange`)
```json
{
  "id": "ENG-M2-EW006",
  "classLevel": 3,
  "subject": "English",
  "language": "en-IN",
  "module": 2,
  "day": 1,
  "role": "new",
  "targetWord": "airport",
  "level": 2,
  "sourceDifficulty": "Medium",
  "category": "arrange-word",
  "variant": "arrange",
  "prompt": "Put the word parts in the correct order:",
  "units": ["port", "air"],
  "correctAnswer": "airport",
  "source": {
    "workbook": "English_Module_2_120_NEW_40_REVIEW_PROCESSED.xlsx",
    "ewId": "EW006",
    "activityCode": "E07",
    "originalActivity": "E07 – Arrange Syllables"
  }
}
```

---

### 5. Code E05 — Missing Letters (`word-completion::missing-unit`)
```json
{
  "id": "ENG-M2-EW001",
  "classLevel": 3,
  "subject": "English",
  "language": "en-IN",
  "module": 2,
  "day": 1,
  "role": "new",
  "targetWord": "about",
  "level": 1,
  "sourceDifficulty": "Easy",
  "category": "word-completion",
  "variant": "missing-unit",
  "prompt": "The programme is ______ to start. Complete the word:",
  "template": "a b _ u t",
  "correctAnswer": "about",
  "source": {
    "workbook": "English_Module_2_120_NEW_40_REVIEW_PROCESSED.xlsx",
    "ewId": "EW001",
    "activityCode": "E05",
    "originalActivity": "E05 – Missing Letters"
  }
}
```

---

### 6. Code E01 — Picture Identify / Write Word (`picture-recognition::word-entry`)
```json
{
  "id": "ENG-M4-EW017",
  "classLevel": 3,
  "subject": "English",
  "language": "en-IN",
  "module": 4,
  "day": 1,
  "role": "new",
  "targetWord": "apple",
  "level": 1,
  "sourceDifficulty": "Easy",
  "category": "picture-recognition",
  "variant": "word-entry",
  "prompt": "Look at the picture. Write the word.",
  "image": {
    "type": "image",
    "source": "assets/english/apple.webp",
    "alt": "Picture of an apple"
  },
  "correctAnswer": "apple",
  "source": {
    "workbook": "English_Module_4_120_NEW_40_REVIEW_PROCESSED.xlsx",
    "ewId": "EW017",
    "activityCode": "E01",
    "originalActivity": "E01 – Picture → Write"
  }
}
```

---

### 7. Code E12 — Picture → Choose / Write (`picture-recognition::select` or `word-entry`)
```json
{
  "id": "ENG-M1-EW013",
  "classLevel": 3,
  "subject": "English",
  "language": "en-IN",
  "module": 1,
  "day": 1,
  "role": "new",
  "targetWord": "anjaraipetti",
  "level": 2,
  "sourceDifficulty": "Unclassified",
  "category": "picture-recognition",
  "variant": "select",
  "prompt": "Look at the picture. Choose the correct word and write it.",
  "options": [
    { "id": "A", "label": "anjaraipetti" },
    { "id": "B", "label": "anjaraipetty" },
    { "id": "C", "label": "anjaraipeti" }
  ],
  "image": {
    "type": "image",
    "source": "assets/english/anjaraipetti.webp",
    "alt": "Picture of an anjaraipetti spice box"
  },
  "correctAnswer": "anjaraipetti",
  "source": {
    "workbook": "English_Module_1_120_Word_Implementation_Plan.xlsx",
    "ewId": "EW013",
    "activityCode": "E12",
    "originalActivity": "E12 – Picture → Write"
  }
}
```

---

### 8. Code E09 — Meaning → Word (`meaning-match::word-entry`)
```json
{
  "id": "ENG-M4-EW019",
  "classLevel": 3,
  "subject": "English",
  "language": "en-IN",
  "module": 4,
  "day": 1,
  "role": "new",
  "targetWord": "art",
  "level": 1,
  "sourceDifficulty": "Easy",
  "category": "meaning-match",
  "variant": "word-entry",
  "prompt": "This means drawing, painting or making something beautiful.",
  "template": "_ _ _",
  "correctAnswer": "art",
  "source": {
    "workbook": "English_Module_4_120_NEW_40_REVIEW_PROCESSED.xlsx",
    "ewId": "EW019",
    "activityCode": "E09",
    "originalActivity": "E09 – Meaning → Word"
  }
}
```

---

### 9. Code E11 — Context → Complete Word (`context-choice::missing-unit`)
```json
{
  "id": "ENG-M5-EW016",
  "classLevel": 3,
  "subject": "English",
  "language": "en-IN",
  "module": 5,
  "day": 1,
  "role": "new",
  "targetWord": "anything",
  "level": 2,
  "sourceDifficulty": "Medium",
  "category": "context-choice",
  "variant": "missing-unit",
  "prompt": "You can choose ______ you like.",
  "template": "a n y t h _ n g",
  "correctAnswer": "anything",
  "source": {
    "workbook": "English_Module_5_120_NEW_40_REVIEW_PROCESSED.xlsx",
    "ewId": "EW016",
    "activityCode": "E11",
    "originalActivity": "E11 – Context → Complete Word"
  }
}
```

---

## 4. Spaced Review Activity Record Structure

Review instances are stored with `role: "review"` and reference their `reviewSourceModule`:

```json
{
  "id": "ENG-M3-REV-EW002",
  "classLevel": 3,
  "subject": "English",
  "language": "en-IN",
  "module": 3,
  "day": 1,
  "role": "review",
  "reviewSourceModule": 1,
  "targetWord": "achieve",
  "level": 3,
  "sourceDifficulty": "Hard",
  "category": "arrange-word",
  "variant": "arrange",
  "prompt": "Put the letters in the correct order:",
  "units": ["e", "v", "a", "i", "h", "c", "e"],
  "correctAnswer": "achieve",
  "source": {
    "workbook": "English_Module_3_120_NEW_40_REVIEW_PROCESSED.xlsx",
    "ewId": "EW002",
    "activityCode": "E06",
    "originalActivity": "E06 – Arrange Letters"
  }
}
```

---

## 5. Directory & File Placement Proposal

```text
src/content/
├── class-3/
│   ├── tamil/
│   │   └── term-1/
│   │       ├── activities.json       (144 Tamil activities - UNTOUCHED)
│   │       ├── assets.json           (Tamil assets manifest - UNTOUCHED)
│   │       └── manifest.json         (Tamil manifest - UNTOUCHED)
│   │
│   └── english/
│       ├── manifest.json             (Consolidated English Curriculum Manifest)
│       ├── module-1/
│       │   ├── activities.json       (120 activities)
│       │   └── manifest.json
│       ├── module-2/
│       │   ├── activities.json       (120 new + 40 review)
│       │   └── manifest.json
│       ├── ...
│       ├── module-8/
│       │   ├── activities.json       (118 new + 40 review)
│       │   └── manifest.json
│       └── assets.json               (English assets manifest)
```

This layout allows `LocalContentRepository` to load English content dynamically based on the requested subject and module, without mutating or impacting the Tamil namespace.
