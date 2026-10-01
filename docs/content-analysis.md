# Content Analysis Report

## Source Files

1. **Mapping File:** `Class_3_Tamil_Stage_2_Revised_Interaction_Mapping_U001_U144.xlsx`
2. **Question Bank:** `Class_3_Tamil_Term_I_Consolidated_Question_Bank_Q001_Q144.xlsx`

## Inspection Summary

- **Rows:** 144 items in both files.
- **Sheets:**
  - Mapping File: `Revised_Mapping`, `Interaction_Summary`, `Validation`
  - Question Bank: `Question Bank`, `Coverage Check`
- **Columns in Mapping File:**
  `Unique ID`, `Tamil Word`, `Difficulty`, `Current Type`, `Proposed Primary Interaction`, `Learning Objective`, `Interaction Detail`
- **Columns in Question Bank:**
  `Question ID`, `Target Word`, `Level`, `Activity`, `Question / Instruction`, `Options / Units`, `Correct Answer`

## Relationship Between Files

The two workbooks have a strict 1-to-1 relationship.
- **Join Key:** The numerical suffix of `Unique ID` in the Mapping File (e.g., `U-001`) corresponds exactly to the numerical suffix of `Question ID` in the Question Bank (e.g., `Q001`). 
- **Verifying Key:** The `Tamil Word` in the Mapping File matches the `Target Word` in the Question Bank.
- **Activity Mapping:** The `Proposed Primary Interaction` from the Mapping File matches the `Activity` column in the Question Bank.

## Normalized Activity Taxonomy

To avoid building unmaintainable UI components for every unique string in the `Activity` column, the 16 distinct string variations are normalized into 6 reusable base categories:

1. **`picture-recognition`**
   - *Originals:* `Picture → Select`, `Picture → Context/Select`
   - *Variant:* `select`

2. **`word-completion`**
   - *Originals:* `Drag & Drop Missing Unit`, `Drag & Drop Missing Ending`, `English Meaning + Missing Unit`, `Picture → Missing Unit`
   - *Variant:* `missing-unit`

3. **`arrange-word`**
   - *Originals:* `Arrange Tamil Units`, `Picture → Arrange`, `English Meaning → Arrange Tamil Word`, `English Meaning → Arrange Tamil Units`
   - *Variant:* `arrange`

4. **`spelling-choice`**
   - *Originals:* `Correct Spelling`, `Picture → Correct Spelling`, `Context → Correct Spelling`
   - *Variant:* `select`

5. **`context-choice`**
   - *Originals:* `Context → Drag Word`, `Context → Select/Drag`
   - *Variant:* `fill-blank`

6. **`meaning-match`**
   - *Originals:* `English Meaning → Tamil Word`
   - *Variant:* `translate-select`

Normalization preserves the original string under `source.originalActivity` for auditing purposes.
