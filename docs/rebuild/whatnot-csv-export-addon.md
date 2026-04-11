# Whatnot CSV Export Add-On

## Purpose

This document extends the Catalog Commerce feature with a marketplace-template export workflow.

The user wants the system to support uploaded CSV templates for marketplaces such as Whatnot, and to return properly formatted, pre-filled CSV files that match the uploaded template structure.

This is a critical usability feature because it turns cataloged items into real listing-ready inventory for external selling channels.

---

## Core requirement

The product should support a function where the seller can:
- upload a CSV template from Whatnot or another marketplace
- map catalog item fields into that template
- generate a correctly formatted export file
- download the filled CSV for upload to the marketplace

The system should not just export generic CSV.
It should export **template-conforming CSV** based on the user-provided file.

---

## Product fit

This feature belongs inside Catalog Commerce as a seller-side publishing workflow.

Recommended positioning:
- catalog item library stores the source records
- export tool transforms selected items into marketplace-ready output
- Whatnot export is the first supported template type
- future marketplace templates can reuse the same export architecture

---

## Main user flow

1. Seller uploads or selects a Whatnot CSV template.
2. System parses the header structure and stores the template definition.
3. Seller chooses one or more catalog items.
4. System maps item data into template columns.
5. If required fields are missing, system flags them before export.
6. AI can help generate missing sell-side content such as title, description, category text, or condition wording.
7. Seller downloads a ready-to-upload CSV.

---

## Functional requirements

## 1. Template ingestion

### The system should support
- upload of marketplace CSV templates
- parsing of column headers
- storage of template metadata
- user-friendly naming of templates
- one template marked as default for Whatnot if desired

### Template fields to store
- id
- user_id
- template_name
- marketplace
- original_filename
- column_headers
- sample_row_structure if useful
- mapping_config
- is_default
- created_at
- updated_at

---

## 2. Export generation

### The system should support
- export of a single item
- export of multiple selected items
- correct column order matching the uploaded template
- blank values where optional data is missing
- validation errors where required data is missing

### Output requirements
- valid CSV file
- exact template header order preserved
- proper escaping and quoting
- consistent data formatting
- marketplace-ready download

---

## 3. Mapping layer

### Purpose
Map internal catalog fields to uploaded template columns.

### Example internal source fields
- title
- category
- brand
- model
- condition
- description
- asking_price
- quantity
- image_url
- sku
- internal_reference

### Mapping behavior
- default smart-match by column name similarity
- allow user overrides for each column
- save mapping config for reuse
- support AI assistance when column names are ambiguous

---

## 4. AI assistance for exports

### AI can help with
- creating Whatnot-friendly titles
- creating concise descriptions
- normalizing condition language
- filling category-specific copy
- identifying missing information before export

### Rules
- AI should never silently overwrite seller-entered data without visibility
- seller remains final authority
- generated values should be editable before export

---

## 5. Validation layer

### Required validation behavior
Before generating the CSV, the system should:
- identify missing required fields
- identify invalid prices or quantities
- identify unmapped template columns
- identify empty records that should not export

### Validation outputs
- success state when export is ready
- warnings for optional missing data
- blocking errors for required missing data

---

## 6. Suggested data model

### `marketplace_templates`
- id
- user_id
- marketplace
- template_name
- original_filename
- column_headers_json
- mapping_config_json
- is_default
- created_at
- updated_at

### `marketplace_exports`
- id
- user_id
- marketplace
- template_id
- item_ids_json
- export_filename
- export_status
- validation_summary_json
- created_at

---

## 7. Suggested frontend structure

### Feature folders
- `src/features/catalog-export/`

### Suggested files
- `src/features/catalog-export/pages/MarketplaceExportPage.tsx`
- `src/features/catalog-export/components/TemplateUploader.tsx`
- `src/features/catalog-export/components/TemplateMapper.tsx`
- `src/features/catalog-export/components/ExportValidationPanel.tsx`
- `src/features/catalog-export/components/ExportItemsSelector.tsx`
- `src/features/catalog-export/components/DownloadExportCard.tsx`

---

## 8. Suggested backend/API areas

### Example backend functions
- `netlify/functions/marketplace-templates.js`
- `netlify/functions/marketplace-export.js`

### Responsibilities
#### `marketplace-templates.js`
- upload template metadata
- parse headers
- save mapping config
- list templates

#### `marketplace-export.js`
- accept template + selected item IDs
- validate required fields
- map items to template columns
- generate CSV
- return downloadable file or signed file path

---

## 9. Whatnot-specific first implementation

### Minimum first version
Support Whatnot as the first marketplace template type.

The first implementation should:
- accept uploaded Whatnot template CSV
- preserve exact Whatnot header structure
- prefill rows from catalog items
- allow manual field mapping overrides
- generate downloadable Whatnot-ready CSV

### Important note
The system should be template-driven, not hard-coded to only one CSV layout.
That way the same architecture can support future marketplaces.

---

## 10. Relationship to catalog items

This add-on depends on the Catalog Commerce item library.

The internal catalog remains the source of truth.
Marketplace export is a transformation layer on top of catalog data.

That means:
- seller edits the item once in catalog
- export function reuses structured item data
- AI-generated listing content can be stored or regenerated during export flow

---

## 11. Recommended implementation sequence

### Phase A
Catalog foundation

### Phase B
AI item decoder and valuation

### Phase C
Whatnot CSV template ingestion and export
- upload template
- map fields
- validate items
- generate downloadable CSV

### Phase D
Public storefront and Stripe checkout

This keeps the system coherent and avoids mixing export logic into the earliest foundation work.

---

## 12. Final recommendation

This feature should be treated as a core catalog publishing tool.

The right version is:
- template-aware
- reusable
- validation-driven
- AI-assisted where helpful
- capable of returning correctly formatted pre-filled Whatnot CSV files from catalog records

That makes the platform materially more useful for real selling workflows.