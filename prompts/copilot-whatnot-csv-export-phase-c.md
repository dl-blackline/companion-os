# Copilot Prompt - Whatnot CSV Export Phase

Use this prompt in GitHub Copilot Chat or Copilot coding agent after the private catalog foundation exists.

---

You are working inside the `dl-blackline/companion-os` repository.

Read these files first and treat them as the source of truth for this task:
- `docs/rebuild/catalog-commerce-feature-spec.md`
- `docs/rebuild/whatnot-csv-export-addon.md`
- any existing catalog feature files already created in the repo

## Objective

Implement the **Whatnot CSV template export workflow**.

The user wants a function where they can upload a Whatnot CSV template and have the system spit back a properly formatted, pre-filled CSV using catalog item data.

This is not generic CSV export.
It must be **template-conforming export**.

## Scope

Build the internal seller-side export workflow only.

### Build now
- marketplace template upload and parsing
- template header storage
- mapping layer from catalog fields to template columns
- validation of selected catalog items against the template
- downloadable CSV generation for Whatnot

### Do not build now
- public storefront checkout
- order fulfillment logic
- multi-marketplace UI complexity beyond a clean reusable structure

## Product requirements

### 1. Template ingestion
The user should be able to:
- upload a Whatnot CSV template
- save it under their account
- view the parsed column headers
- reuse a saved template later

### 2. Field mapping
The system should:
- attempt smart matching from internal catalog fields to template columns
- allow manual override mapping
- save mapping config for reuse

### 3. Export generation
The system should:
- let the user select one or more catalog items
- generate a CSV preserving the exact uploaded template header order
- fill rows from item data
- keep proper escaping and formatting

### 4. Validation
Before export, the system should flag:
- missing required mapped data
- unmapped template columns
- invalid values like empty title or invalid price where relevant

Warnings are okay for optional data, but blocking errors should prevent export when the output would be broken.

### 5. AI assistance where helpful
If useful, add AI-assisted support for:
- title generation
- description generation
- condition normalization
- fill recommendations for missing text fields

But do not make AI mandatory for export.
The system must still work with manual data.

## Suggested structure

### Frontend
- `src/features/catalog-export/pages/MarketplaceExportPage.tsx`
- `src/features/catalog-export/components/TemplateUploader.tsx`
- `src/features/catalog-export/components/TemplateMapper.tsx`
- `src/features/catalog-export/components/ExportItemsSelector.tsx`
- `src/features/catalog-export/components/ExportValidationPanel.tsx`
- `src/features/catalog-export/components/DownloadExportCard.tsx`

### Backend
- `netlify/functions/marketplace-templates.js`
- `netlify/functions/marketplace-export.js`

### Data model
Add appropriate Supabase tables if needed, such as:
- `marketplace_templates`
- `marketplace_exports`

## Constraints

- Do not hard-code only one exact Whatnot CSV layout if the architecture can stay template-driven.
- Do not break existing catalog features.
- Do not add fake download behavior.
- Keep the export architecture reusable for future marketplaces.

## Desired outcome

When this pass is complete:
- a user can upload a Whatnot CSV template
- the system stores and parses it
- the user can select catalog items
- the system generates a properly formatted pre-filled CSV matching the template
- the flow is clean, seller-focused, and production-minded

## Output requirements

When you finish:
1. summarize exactly what files you changed
2. explain the template parsing and mapping approach
3. explain how validation works
4. note what is reusable for future marketplaces
5. call out any risk or limitations in the first version

Make the changes directly in code, not just as a plan.