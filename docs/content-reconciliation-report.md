# Content Reconciliation Report
## Class 3 Tamil Term I — Q010, Q012, Q013, Q025, Q029, Q032, Q045, Q079, Q085

**Date**: 2026-10-02  
**Phase**: Analysis only — no production content was modified  
**Status**: Complete

---

## 1. Executive Summary

Nine question IDs were reconciled against four source layers (original question bank, consolidated/revised bank, revised questions workbook, interaction mapping). The analysis reveals:

| Finding type | Count |
|---|---|
| Confirmed source conflicts (interaction type) | 7 |
| Critical answer-validity failure | **1** (Q025 — ArrangeWord evaluator always fails) |
| Confirmed missing assets (all sources agree picture needed) | 1 (Q079) |
| Mapping-required missing assets | 2 (Q045, Q085) |
| Conditional asset (disputed interaction) | 1 (Q013) |
| Distractor typo in revised workbook | 1 (Q079 "நிளவு" vs "நிலவு") |
| Items requiring manual source decision | 7 |
| Confirmed duplicates | 0 |

> [!IMPORTANT]
> **Q025 is a confirmed runtime bug**: the ArrangeWord evaluator always returns incorrect for this question because the current units `["வான்","ஒலி"]` join to `"வான்ஒலி"` (7 codepoints) while `correctAnswer` is `"வானொலி"` (6 codepoints). These are distinct Unicode strings.

> [!NOTE]
> **Mapping workbook structure correction**: The file `Class_3_Tamil_Stage_2_Revised_Interaction_Mapping_U001_U144.xlsx` has **three sheets**: `Revised_Mapping` (per-question detail, authoritative), `Interaction_Summary` (pivot count only), `Validation`. All mapping data in this report is from the `Revised_Mapping` sheet (Sheet 0, `U-NNN` ID format).

---

## 2. Source Files Examined

| File | Role | Sheet used |
|---|---|---|
| `src/content/class-3/tamil/term-1/activities.json` | Runtime | — |
| `Class_3_Tamil_Term_I_Consolidated_Question_Bank_Q001_Q144.xlsx` | Original bank | "Question Bank" |
| `Class_3_Tamil_Term_I_Consolidated_Question_Bank_Q001_Q144 (1).xlsx` | Consolidated (revised) bank | "Question Bank" |
| `Tamil_Revised_Questions_Q010_Q012_Q013_Q029_Q032_Q045_Q079_Q085.xlsx` | Revised questions | "Revised Questions" |
| `Class_3_Tamil_Stage_2_Revised_Interaction_Mapping_U001_U144.xlsx` | Interaction mapping | "Revised_Mapping" |

---

## 3. Source-of-Truth Rules Applied

- Audio/TTS columns are **out of scope** and were ignored.
- Q-ID to U-ID mapping: Q010 ↔ U-010, … Q085 ↔ U-085 (strip prefix, compare numeric value).
- **No source was treated as automatically correct.** Conflicts are flagged for manual decision.

---

## 4. Nine-ID Reconciliation Table

| ID | Target | Orig activity | Cons(1)/Revised activity | Runtime | Mapping interaction | Sources agree? | Classification |
|---|---|---|---|---|---|---|---|
| Q010 | பள்ளி | Correct Spelling | Missing Letter | spelling-choice/select | Correct Spelling | **No** | SOURCE_CONFLICT |
| Q012 | புலி | Correct Spelling | Missing Letter | spelling-choice/select | Correct Spelling | **No** | SOURCE_CONFLICT |
| Q013 | எலி | Correct Spelling | Picture → Select | spelling-choice/select | Correct Spelling | **No** | SOURCE_CONFLICT + ASSET_REQUIRED (conditional) |
| Q025 | வானொலி | Arrange Tamil Units | Arrange Tamil Units | arrange-word/arrange | Arrange Tamil Units | Partial | **ANSWER_VALIDITY_FAILURE** + OPTION_CHANGE |
| Q029 | மருத்துவமனை | Correct Spelling | Missing Letter | spelling-choice/select | Arrange Tamil Units | **No** | THREE-WAY SOURCE_CONFLICT |
| Q032 | ஒலி | Correct Spelling | Missing Letter | spelling-choice/select | Correct Spelling | **No** | SOURCE_CONFLICT |
| Q045 | கிழங்கு | Correct Spelling | Missing Letter | spelling-choice/select | Picture → Correct Spelling | **No** | SOURCE_CONFLICT + ASSET_REQUIRED |
| Q079 | நிலா | Picture → Select | Picture → Select | picture-recognition/select | Picture → Select | Partial | ASSET_REQUIRED (confirmed) + OPTION_CHANGE (typo) |
| Q085 | படம் | Correct Spelling | Missing Letter | spelling-choice/select | Picture → Correct Spelling | **No** | SOURCE_CONFLICT + ASSET_REQUIRED |

---

## 5. Detailed Analysis

---

### Q010 — Target: பள்ளி

| Layer | Activity | Options / Units | Correct Answer |
|---|---|---|---|
| Original Bank | Correct Spelling | பள்ளி \| பல்லி \| பள்ளம் \| நூலகம் | பள்ளி |
| Consolidated (1) | Missing Letter | பள்\_ \| ளி \| லி \| ழி \| னி | ளி |
| Revised workbook | Missing Letter | *(identical to Consolidated)* | ளி |
| Runtime | spelling-choice/select | ["பள்ளி","பல்லி","பள்ளம்","நூலகம்"] | பள்ளி |
| Mapping (U-010) | Correct Spelling | Show 3–4 spelling alternatives; one correct | — |

**Conflict**: Original Bank + Mapping + Runtime → "Correct Spelling". Consolidated(1) + Revised → "Missing Letter".  
**Runtime answer validity**: ✅ Correct answer "பள்ளி" exists in options.  
**Classification**: SOURCE_CONFLICT — requires content owner decision.

---

### Q012 — Target: புலி

| Layer | Activity | Options / Units | Correct Answer |
|---|---|---|---|
| Original Bank | Correct Spelling | புலி \| புளி \| புலம் \| புலன் | புலி |
| Consolidated (1) | Missing Letter | பு\_ \| லி \| ளி \| ழி \| ரி | லி |
| Revised workbook | Missing Letter | *(identical to Consolidated)* | லி |
| Runtime | spelling-choice/select | ["புலி","புளி","புலம்","புலன்"] | புலி |
| Mapping (U-012) | Correct Spelling | லி/ளி discrimination; Show 3–4 alternatives | — |

**Same pattern as Q010.** Runtime + Original + Mapping agree (Correct Spelling). Consolidated/Revised say Missing Letter.  
**Runtime answer validity**: ✅  
**Classification**: SOURCE_CONFLICT — requires content owner decision.

---

### Q013 — Target: எலி

| Layer | Activity | Options / Units | Correct Answer |
|---|---|---|---|
| Original Bank | Correct Spelling | எலி \| எளி \| எழில் \| எரி | எலி |
| Consolidated (1) | **Picture → Select** | எலி \| எளி \| எழில் \| எரி | எலி |
| Revised workbook | **Picture → Select** | *(identical to Consolidated)* | எலி |
| Runtime | spelling-choice/select | ["எலி","எளி","எழில்","எரி"] | எலி |
| Mapping (U-013) | Correct Spelling | ல/ள discrimination | — |

**Options and correct answer are identical across all sources** — the ONLY dispute is the interaction type. Mapping + Original → "Correct Spelling" (no picture). Consolidated/Revised → "Picture → Select" (picture of a rat/mouse required). Runtime has no imagePath.  
**Runtime answer validity**: ✅  
**Classification**: SOURCE_CONFLICT + ASSET_REQUIRED (conditional on which interaction is chosen).

---

### Q025 — Target: வானொலி ⚠️ CRITICAL BUG

| Layer | Activity | Options / Units | Correct Answer |
|---|---|---|---|
| Original Bank | Arrange Tamil Units | வான் \| ஒலி | வானொலி |
| Consolidated (1) | Arrange Tamil Units | **வா \| லி \| னொ** | வானொலி |
| Revised workbook | Arrange Tamil Units | **வா \| லி \| னொ** | வானொலி |
| Runtime | arrange-word/arrange | units: ["வான்","ஒலி"] | வானொலி |
| Mapping (U-025) | Arrange Tamil Units | Show explicit units; drag to form word | — |

**Critical finding — ArrangeWordEvaluator always fails:**

| Joined string | Unicode codepoints | Length |
|---|---|---|
| "வான்" + "ஒலி" (current runtime) | BB5 BBE BA9 **BCD B92** BB2 BBF | 7 chars |
| "வானொலி" (correct answer) | BB5 BBE BA9 **BCA** BB2 BBF | 6 chars |

These are **not equal**. The pulli (BCD) + independent vowel ஒ (B92) do not merge into the combined vowel sign ொ (BCA) at the string level. The evaluator compares exact Unicode strings and will always return incorrect.

**Verified fix**: The Consolidated/Revised unit split `["வா","னொ","லி"]` produces the correct answer when joined in order `வா + னொ + லி = வானொலி` (BB5 BBE + BA9 BCA + BB2 BBF = BB5 BBE BA9 BCA BB2 BBF ✅).

**Classification**: ANSWER_VALIDITY_FAILURE + OPTION_CHANGE (pending content owner approval of new unit split).

---

### Q029 — Target: மருத்துவமனை

| Layer | Activity | Options / Units | Correct Answer |
|---|---|---|---|
| Original Bank | Correct Spelling | மருத்துவமனை \| மருத்துவர் \| மருத்துவமணி \| மருத்துவம் | மருத்துவமனை |
| Consolidated (1) | Missing Letter | மருத்துவம\_ \| னை \| ணை \| நை \| லை | னை |
| Revised workbook | Missing Letter | *(identical to Consolidated)* | னை |
| Runtime | spelling-choice/select | ["மருத்துவமனை","மருத்துவர்","மருத்துவமணி","மருத்துவம்"] | மருத்துவமனை |
| Mapping (U-029) | **Arrange Tamil Units** | Long-word spelling sequence | — |

**Three-way conflict**: Original (Correct Spelling) vs Consolidated/Revised (Missing Letter) vs Mapping (Arrange Tamil Units). Each suggests a different interaction. Runtime matches Original.  
**Runtime answer validity**: ✅  
**Classification**: THREE-WAY SOURCE_CONFLICT — requires content owner to specify which interaction wins. Choosing Arrange Tamil Units would require defining unit tiles for this 11-character word.

---

### Q032 — Target: ஒலி

| Layer | Activity | Options / Units | Correct Answer |
|---|---|---|---|
| Original Bank | Correct Spelling | ஒலி \| ஒளி \| ஒல \| ஒலீ | ஒலி |
| Consolidated (1) | Missing Letter | ஒ\_ \| லி \| ளி \| ழி \| ரி | லி |
| Revised workbook | Missing Letter | *(identical to Consolidated)* | லி |
| Runtime | spelling-choice/select | ["ஒலி","ஒளி","ஒல","ஒலீ"] | ஒலி |
| Mapping (U-032) | Correct Spelling | ஒலி/ஒளி discrimination | — |

**Same pattern as Q010/Q012.** Distractors "ஒல" (incomplete) and "ஒலீ" (long-i) are deliberate pedagogical distractors consistent with the mapping objective.  
**Runtime answer validity**: ✅  
**Classification**: SOURCE_CONFLICT — requires content owner decision.

---

### Q045 — Target: கிழங்கு

| Layer | Activity | Options / Units | Correct Answer |
|---|---|---|---|
| Original Bank | Correct Spelling | கிழங்கு \| கிலங்கு \| கிளங்கு \| கிழக்கு | கிழங்கு |
| Consolidated (1) | Missing Letter | கி\_ \| ழங்கு \| லங்கு \| ளங்கு \| ரங்கு | ழங்கு |
| Revised workbook | Missing Letter | *(identical to Consolidated)* | ழங்கு |
| Runtime | spelling-choice/select | ["கிழங்கு","கிலங்கு","கிளங்கு","கிழக்கு"] | கிழங்கு |
| Mapping (U-045) | **Picture → Correct Spelling** | Repeated word gets spelling task | — |

Mapping requires a picture of the root vegetable. Runtime has no imagePath. Original bank says "Correct Spelling" (no picture). Consolidated/Revised say "Missing Letter". Three-way conflict with the mapping adding a picture requirement.  
**Runtime answer validity**: ✅  
**Classification**: SOURCE_CONFLICT + ASSET_REQUIRED (if mapping or picture-variant is chosen).

---

### Q079 — Target: நிலா

| Layer | Activity | Options / Units | Correct Answer |
|---|---|---|---|
| Original Bank | Picture → Select | நிலா \| நிலை \| நிலம் \| **நிலவு** | நிலா |
| Consolidated (1) | Picture → Select | நிலா \| நிலை \| நிலம் \| **நிளவு** | நிலா |
| Revised workbook | Picture → Select | நிலா \| நிலை \| நிலம் \| **நிளவு** | நிலா |
| Runtime | picture-recognition/select | ["நிலா","நிலை","நிலம்","**நிலவு**"] | நிலா |
| Mapping (U-079) | Picture → Select | Meaning recognition | — |

**All sources agree** on interaction type (Picture → Select) and correct answer (நிலா).

**Two issues found:**

1. **Confirmed missing asset**: `imagePath` is null; no moon image exists. All sources require a picture.

2. **Distractor typo in Consolidated/Revised**: Option 4 differs between sources:
   - Original Bank + Runtime: `"நிலவு"` (ல, U+0BB2) — valid Tamil word for "moonlight"
   - Consolidated(1) + Revised: `"நிளவு"` (ள, U+0BB3) — not a standard Tamil word, likely a typo

**Runtime answer validity**: ✅ (answer exists in options; but picture is missing making the question non-functional).  
**Classification**: ASSET_REQUIRED (confirmed) + OPTION_CHANGE (distractor typo in revised workbook).

---

### Q085 — Target: படம்

| Layer | Activity | Options / Units | Correct Answer |
|---|---|---|---|
| Original Bank | Correct Spelling | படம் \| பாடம் \| படை \| படன் | படம் |
| Consolidated (1) | Missing Letter | ப\_ \| டம் \| ணம் \| தம் \| லம் | டம் |
| Revised workbook | Missing Letter | *(identical to Consolidated)* | டம் |
| Runtime | spelling-choice/select | ["படம்","பாடம்","படை","படன்"] | படம் |
| Mapping (U-085) | **Picture → Correct Spelling** | Repeated word gets spelling task | — |

Same structural conflict as Q045. Mapping requires a picture of படம் (painting/picture). Runtime has no imagePath.  
**Runtime answer validity**: ✅  
**Classification**: SOURCE_CONFLICT + ASSET_REQUIRED (if mapping or picture-variant is chosen).

---

## 6. Duplicate Analysis

No duplicates confirmed among the 9 affected IDs. Q025 (வானொலி) and Q032 (ஒலி) are related words but are distinct pedagogical items.

**Previously noted concern** (not in scope): Q020 and Q037 both target `கதைகள்`. Not examined in this report.

---

## 7. Asset Summary

| ID | imagePath | File exists | All sources need picture? | Status |
|---|---|---|---|---|
| Q010 | null | — | No | No asset needed |
| Q012 | null | — | No | No asset needed |
| Q013 | null | — | Disputed | Conditional on source decision |
| Q025 | null | — | No | No asset needed |
| Q029 | null | — | No | No asset needed |
| Q032 | null | — | No | No asset needed |
| Q045 | null | — | Mapping: yes | ASSET_REQUIRED (if mapping wins) |
| Q079 | null | — | **All sources: yes** | **ASSET_REQUIRED — confirmed** |
| Q085 | null | — | Mapping: yes | ASSET_REQUIRED (if mapping wins) |

---

## 8. Answer Validity Summary

| ID | Correct answer in options? | Evaluator correct? | Notes |
|---|---|---|---|
| Q010 | ✅ | ✅ | — |
| Q012 | ✅ | ✅ | — |
| Q013 | ✅ | ✅ | — |
| Q025 | N/A (arrange) | ❌ **ALWAYS FAILS** | Join of units ≠ correctAnswer |
| Q029 | ✅ | ✅ | — |
| Q032 | ✅ | ✅ | Distractors "ஒல","ஒலீ" are intentional |
| Q045 | ✅ | ✅ | — |
| Q079 | ✅ | ✅ | Picture missing makes question non-functional |
| Q085 | ✅ | ✅ | — |

---

## 9. Recommended Changes (Pending Content Owner Approval)

### Tier 1 — Unambiguous / high confidence

| ID | Action |
|---|---|
| **Q025** | Change units from `["வான்","ஒலி"]` to `["வா","னொ","லி"]`. Correct answer unchanged. **Requires Tamil language expert confirmation.** |
| **Q079** | Add moon image asset. Retain distractor `"நிலவு"` from original bank (do NOT use `"நிளவு"` from revised). |

### Tier 2 — Clear but requires image sourcing decision

| ID | Action |
|---|---|
| **Q045** | If mapping is authoritative: source a கிழங்கு (root vegetable) image; decide whether to keep Correct Spelling or change to Picture→Correct Spelling. |
| **Q085** | If mapping is authoritative: source a படம் (painting/picture) image; same decision required. |

### Tier 3 — Cannot proceed without content owner choice

| ID | Decision needed |
|---|---|
| Q010 | Correct Spelling (mapping/orig) vs Missing Letter (revised)? |
| Q012 | Correct Spelling (mapping/orig) vs Missing Letter (revised)? |
| Q013 | Correct Spelling (no picture) vs Picture → Select (picture required)? |
| Q029 | Correct Spelling vs Missing Letter vs Arrange Tamil Units? |
| Q032 | Correct Spelling (mapping/orig) vs Missing Letter (revised)? |

---

## 10. Items Requiring Manual Decision

1. **Authority hierarchy**: For Q010, Q012, Q013, Q032, Q045, Q085 — the `Revised_Mapping` sheet and the revised question workbooks contradict each other. Which takes precedence?
2. **Q013 picture**: Show rat/mouse image or not?
3. **Q029 three-way conflict**: Which of the three interactions should be implemented?
4. **Q025 unit split**: Confirm `["வா","னொ","லி"]` with a Tamil language expert before implementation.
5. **Q079 image**: Confirm what visual representation of நிலா (moon) is appropriate.
6. **Q045/Q085 images**: Conditional on whether picture-variant interaction is chosen.

---

## 11. Validation

No production files were modified. The repository remains clean:

| Check | Status |
|---|---|
| npm test | ✅ 128/128 (verified before this phase) |
| npm run lint | ✅ 0 errors (verified before this phase) |
| npm run build | ✅ Passing |
| content:check | ✅ 144/144 |
| content:runtime-check | ✅ 144/144 |
| content:assets-check | ✅ 21/21 |

---

## Appendix: Temporary files created

The following temporary files were created during this analysis and can be deleted:

- `scripts/_tmp-extract-recon.cjs`
- `scripts/_tmp-gen-report.cjs`
- `.recon-raw.json`
