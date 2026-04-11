# Copilot Prompt - Catalog Phase B: Dimensions, Weight, eBay Templates, and Syndication Preparation

Use this prompt in GitHub Copilot Chat or Copilot coding agent after the private catalog foundation exists.

---

You are working inside the `dl-blackline/companion-os` repository.

Read these files first and treat them as the source of truth for this task:
- `docs/rebuild/catalog-commerce-feature-spec.md`
- `docs/rebuild/whatnot-csv-export-addon.md`
- `docs/rebuild/catalog-dimensions-marketplace-syndication.md`
- any existing catalog feature files already created in the repo

## Objective

Implement the next major catalog upgrade so the system supports:
- dimensions and weight capture during decode and review
- required prompts when H/W/L/weight cannot be confidently decoded
- eBay template-ready export support in the same architecture as Whatnot
- groundwork for future multi-channel syndication such as eBay and Facebook Marketplace

This pass should make the catalog operationally useful for real selling workflows.

## Core requirements

### 1. Dimensions and weight are first-class item data
Add structured support for:
- height
- width
- length
- weight
- units
- source and confirmation state

These must be part of the catalog item model, not loose notes.

### 2. Decoder and review flow must handle missing fields
If AI cannot confidently decode height, width, length, or weight, the UI must prompt the seller to fill those boxes manually.

Required behavior:
- show dedicated inputs for H / W / L / weight
- preserve unit selection
- label whether values are AI-detected, AI-estimated, or seller-entered
- block marketplace-ready state when required shipping fields are still missing

### 3. Listing readiness must account for shipping fields
Introduce or refine listing readiness so an item cannot be marked fully channel-ready when a target channel requires dimensions and weight but they are missing.

### 4. eBay template support
Extend the marketplace template/export architecture so it supports eBay CSV templates alongside Whatnot.

Required behavior:
- upload eBay CSV template
- parse header structure
- map catalog fields into eBay columns
- include dimensions and weight in mapping where needed
- validate required fields before export
- generate properly formatted downloadable CSV matching the uploaded template

### 5. Prepare for future channel syndication
Set up the architecture so catalog items can later publish to multiple channels.

This pass should prepare a reusable model for channel publication tracking, but should not overbuild unsupported direct posting flows.

Treat external channel automation as policy-dependent and connector-dependent. The architecture should be ready for compliant syndication later.

## Suggested implementation areas

### Data model
Add or extend catalog item fields such as:
- `height_value`
- `width_value`
- `length_value`
- `dimension_unit`
- `weight_value`
- `weight_unit`
- `dimensions_source`
- `weight_source`
- `dimensions_confirmed`
- `weight_confirmed`
- `listing_readiness_status`

If useful, add a publication tracking table like:
- `catalog_channel_publications`

### Frontend
Add or refine components such as:
- `DimensionsWeightFields.tsx`
- `DecodedItemReviewForm.tsx`
- `ListingReadinessCard.tsx`
- eBay-capable marketplace export UI components

### Backend
Add or refine:
- catalog item update logic for dimensions and weight
- decoder response schema to include dimensions and weight support
- marketplace template/export logic to support eBay templates in addition to Whatnot

## Constraints

- Do not fake exact dimensions or weight when the system does not know them.
- Do not hard-code only one Whatnot layout or one eBay layout if the export architecture can remain template-driven.
- Do not break existing catalog CRUD.
- Do not build full public storefront checkout in this pass.
- Do not assume all external marketplaces support the same automation path.

## Desired outcome

When this pass is complete:
- catalog items can structurally store H / W / L / weight
- the review flow prompts for missing shipping fields
- listing readiness reflects missing required shipping data
- eBay template upload and export can fit into the same marketplace-template system as Whatnot
- the architecture is ready for future channel syndication

## Output requirements

When you finish:
1. summarize exactly what files you changed
2. explain how dimensions and weight are stored and validated
3. explain how the review flow handles missing H/W/L/weight
4. explain how eBay support fits into the same export system as Whatnot
5. identify what is prepared now vs deferred for future direct channel syndication

Make the changes directly in code, not just as a plan.