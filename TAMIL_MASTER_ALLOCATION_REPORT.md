# Tamil Master Allocation Report: 8 Modules × 5 Days (40 Learning Days)

## Executive Summary

The Tamil curriculum Master Allocation has been structured into **8 Modules × 5 Days per Module = 40 total learning days**, derived from the verified source workbook while preserving all existing module assignments, source records, options, instructions, and verification metadata.

- **Primary Source:** `Tamil_Fresh_Source_Word_List_FINAL_1059 (1).xlsx` (1,178 source records) — preserved untouched.
- **Generated Workbook:** `Tamil_Fresh_Source_Word_List_FINAL_1059_Allocated_40Days.xlsx`
- **Total Worksheets:** 57 (16 original sheets preserved + 40 day-wise sheets `M1_D1` through `M8_D5` + `Day Allocation Summary`)
- **Total Records:** Exactly **1,178** across all 40 days (100% accounted for, 0 dropped, 0 duplicated).
- **Daily Question Counts:** 29–30 questions per day across all 40 days.
- **Activity Balancing:** Each day features an interleaved mixture of **7 to 9 distinct activity types**.

---

## 1. Module-Level 5-Day Distribution Summary

| Module | Day 1 | Day 2 | Day 3 | Day 4 | Day 5 | Module Total | Status |
|:---|---:|---:|---:|---:|---:|---:|:---:|
| **Module 1** | 30 | 30 | 30 | 29 | 29 | **148** | Verified |
| **Module 2** | 30 | 30 | 30 | 29 | 29 | **148** | Verified |
| **Module 3** | 30 | 30 | 29 | 29 | 29 | **147** | Verified |
| **Module 4** | 30 | 30 | 29 | 29 | 29 | **147** | Verified |
| **Module 5** | 30 | 30 | 29 | 29 | 29 | **147** | Verified |
| **Module 6** | 30 | 30 | 29 | 29 | 29 | **147** | Verified |
| **Module 7** | 30 | 30 | 29 | 29 | 29 | **147** | Verified |
| **Module 8** | 30 | 30 | 29 | 29 | 29 | **147** | Verified |
| **Grand Total** | **240** | **240** | **234** | **232** | **232** | **1,178** | **100% Balanced** |

---

## 2. Activity Balancing & Interleaving Per Day

Each module's rows were grouped by their normalized `Activity` type, distributed cyclically across the 5 days according to day capacity, and then interleaved within each day to eliminate long consecutive runs of identical activity types.

### Module 1 Breakdown (148 items)
- **Day 1 (30 items, 8 types):** Correct Spelling (7), English Meaning → Tamil Word (5), Arrange Tamil Units (5), Picture → Select (4), Picture → Arrange (3), Context → Select/Drag (3), Missing Letter (2), Context → Drag Word (1)
- **Day 2 (30 items, 7 types):** Correct Spelling (6), English Meaning → Tamil Word (6), Arrange Tamil Units (4), Picture → Select (4), Picture → Arrange (4), Context → Select/Drag (3), Missing Letter (3)
- **Day 3 (30 items, 7 types):** Correct Spelling (6), English Meaning → Tamil Word (6), Arrange Tamil Units (5), Picture → Select (4), Picture → Arrange (3), Context → Select/Drag (3), Missing Letter (3)
- **Day 4 (29 items, 7 types):** Correct Spelling (6), English Meaning → Tamil Word (5), Arrange Tamil Units (5), Picture → Select (4), Picture → Arrange (3), Context → Select/Drag (3), Missing Letter (3)
- **Day 5 (29 items, 8 types):** Correct Spelling (6), English Meaning → Tamil Word (5), Arrange Tamil Units (5), Picture → Select (4), Picture → Arrange (4), Context → Select/Drag (2), Missing Letter (2), Drag & Drop Missing Unit (1)

*(Full breakdowns for all 40 days are included in the workbook sheet `Day Allocation Summary`.)*

---

## 3. Allocation Columns Added

In `Master Allocation` and in all 40 day sheets (`M1_D1` to `M8_D5`), the 21 original columns are retained and 4 allocation columns are added:

| Column | Type | Example Values | Description |
|---|---|---|---|
| **Day** | String | `Day 1`, `Day 2`, `Day 3`, `Day 4`, `Day 5` | Human-readable day label |
| **Day Number** | Number | `1`, `2`, `3`, `4`, `5` | Numeric day identifier |
| **Position in Day** | Number | `1` to `30` | Interleaved sequence position within the day |
| **Activity Group** | String | `spelling-choice`, `arrange-word`, etc. | Normalized activity category |

---

## 4. Application Architecture & React Integration

The React application now natively supports the full hierarchy:
**Tamil → Module (1–8) → Day (1–5) → Activities → Questions**

1. **Routing:**
   - `/classes/:classId/subjects/tamil` → `TamilLearningAreaPage` (presents Modules 1–8 with curriculum progress)
   - `/classes/:classId/subjects/tamil/modules/:moduleId` → `TamilModuleDetailPage` (presents Days 1–5 for the selected module)
   - `/session/:classId/tamil/play?module=M&day=D&size=all` → `SessionPage` (loads only the allocated questions for Module M Day D)
2. **Content Ingestion:**
   - `scripts/import-tamil.ts` normalizes from `Tamil_Fresh_Source_Word_List_FINAL_1059_Allocated_40Days.xlsx`
   - Generated `src/content/class-3/tamil/manifest.json` includes the 8-module × 5-day curriculum definition
   - Generated `src/content/class-3/tamil/module-[1..8]/manifest.json` includes day allocations and activity breakdowns
   - Generated `src/content/class-3/tamil/activities.json` includes `day`, `positionInDay`, `dayNumber`, and `activityGroup`
3. **Session & Attempt Pipeline:**
   - `SessionActivitySelector.ts` respects curriculum ordering (`positionInDay`) when `module` and `day` are provided
   - `AssessmentTrackingService.ts` and `LocalProgressRepository.ts` maintain atomic attempt logging, offline outbox queuing, and student session continuation
   - `ResultsPage.tsx` provides "Next Day ▶", "Next Module ▶", "Practice Again", and "Back to Module" actions for Tamil
4. **Decoupling from English:**
   - Zero modifications to English content manifests, activities, or navigation logic.

---

## 5. Mandatory Validation Checklist (Requirement 10)

| # | Validation Requirement | Expected | Actual Result | Status |
|---|---|---|---|:---:|
| 1 | All 1,178 source records accounted for | 1,178 | 1,178 | PASS |
| 2 | Every record belongs to exactly one module | Modules 1–8 | 148, 148, 147 × 6 | PASS |
| 3 | Every record belongs to exactly one day | Days 1–5 | Day 1–5 in all modules | PASS |
| 4 | Each module has exactly five days | 8 modules × 5 days | 40 days total | PASS |
| 5 | Each day has 29–30 questions | 29 or 30 | 29 or 30 for all 40 days | PASS |
| 6 | Activity diversity balanced across days | Varied mix | 7–9 activity types / day | PASS |
| 7 | No duplicate source IDs introduced | 0 duplicates | 1,178 unique source IDs | PASS |
| 8 | No original source IDs missing | 0 missing | 100% matched to original | PASS |
| 9 | Question instructions, options, and answers unchanged | Unchanged | Exact character-level match | PASS |
| 10 | Picture requirements preserved | Preserved | Exact match | PASS |
| 11 | No English data modified | 0 English changes | Verified via git diff | PASS |
| 12 | Total across all 40 days equals 1,178 | 1,178 | Exactly 1,178 | PASS |

---

## 6. Pre-Existing vs. New Test Results

### Automated Test Suite Runs:
- `src/content/class-3/tamil/__tests__/tamil-day-allocation.test.ts`: **14 / 14 passed**
- `src/features/Navigation/__tests__/TamilNavigation.test.tsx`: **3 / 3 passed**
- `src/features/Session/__tests__/ResultsPage.test.tsx`: **1 / 1 passed**
- `src/features/Session/__tests__/EnglishResultsActions.test.tsx`: **4 / 4 passed**
- `src/repositories/__tests__/LocalContentRepository.test.ts`: **14 / 14 passed**
- `src/engine/__tests__/SessionActivitySelector.test.ts`: **6 / 6 passed**
- `src/features/Activity/__tests__/tamil-verified-flow.test.tsx`: **5 / 5 passed**
- Production Build & Question Validator (`npm run build`): **Build passed cleanly (0 errors)**

### Pre-Existing Test Failures (Documented per Requirement 8):
1. `src/features/Navigation/__tests__/EnglishNavigation.test.tsx` (1 test):
   - **Reason:** Test used `screen.getAllByText('English')` (strict exact match). The subject selection card heading was previously updated to `'English (ஆங்கிலம்)'`.
2. `src/app/__tests__/App.test.tsx` (1 test):
   - **Reason:** Test looks for legacy landing page text `"Kids Learning"` / `"Learn. Play. Grow."`. The root route (`/`) was previously updated to `StudentSelectionPage` ("Welcome to TAMIL-LEARN / வணக்கம்").
