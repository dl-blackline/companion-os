# Copilot Prompt - Catalog Next Phase: Seller Workspace and Decode Integration

Use this prompt in GitHub Copilot Chat or Copilot coding agent after the current catalog groundwork branch is complete.

---

You are working inside the `dl-blackline/companion-os` repository.

Read these files first and treat them as the source of truth for this task:
- `docs/rebuild/catalog-commerce-feature-spec.md`
- `docs/rebuild/catalog-dimensions-marketplace-syndication.md`
- `docs/rebuild/whatnot-csv-export-addon.md`
- `docs/rebuild/catalog-seller-workspace-decode-phase.md`
- any catalog files already added in the repo

## Objective

Implement the next major catalog phase so the current backend and data groundwork becomes a real in-app seller workflow.

The current catalog work appears to have added strong foundations such as:
- catalog tables and types
- dimensions and weight support
- listing readiness logic
- marketplace template/export groundwork
- catalog service layer
- decoded review-related components

Now make that usable inside the app.

## Main goals

1. Create the actual seller-facing catalog pages and routes
2. Wire catalog CRUD into a real library/detail/edit experience
3. Add image upload + decode trigger flow
4. Wire decoded review form into save/update logic
5. Make listing readiness visible and understandable in the UI

## Required routes

Add and wire routes such as:
- `/catalog`
- `/catalog/new`
- `/catalog/:itemId`
- `/catalog/:itemId/edit`

Integrate this cleanly into the active app shell without breaking the v2 structure.

If needed, add Catalog as a controlled new section or mount it as a sub-route in a clearly intentional place. Do not jam it into the shell in a confusing way.

## Required frontend structure

Create or complete:
- `src/features/catalog/pages/CatalogPage.tsx`
- `src/features/catalog/pages/CatalogItemPage.tsx`
- `src/features/catalog/pages/EditCatalogItemPage.tsx`
- `src/features/catalog/components/CatalogLibrary.tsx`
- `src/features/catalog/components/CatalogItemCard.tsx`
- `src/features/catalog/components/CatalogItemForm.tsx`
- `src/features/catalog/components/ItemDecoderUploader.tsx`
- `src/features/catalog/components/DecodedItemReviewForm.tsx`
- `src/features/catalog/components/ListingReadinessCard.tsx`

Reuse existing catalog components where possible.

## Functional requirements

### 1. Catalog library page
The user should be able to:
- view all private catalog items
- search items
- optionally filter by status or category
- open item detail pages
- create a new item manually

### 2. Item detail page
The detail page should show:
- images
- core item details
- dimensions and weight
- asking price and estimate values if present
- status and listing readiness
- edit action
- decode/re-decode action where appropriate

### 3. Edit page / form
The edit form should support:
- title
- category
- brand
- model
- condition
- description
- quantity
- asking price
- internal notes
- H / W / L
- weight
- units

### 4. Decode workflow
The user should be able to:
- upload one or more images
- trigger decode
- receive structured item suggestions
- answer follow-up questions if needed
- review and edit the decoded output
- save the result into the catalog

### 5. Required handling for missing H/W/L/weight
If decode cannot confidently determine dimensions or weight:
- show manual input boxes
- preserve unit selection
- clearly label source/confidence where useful
- do not allow the item to appear channel-ready when required shipping data is missing

### 6. Listing readiness UI
Make listing readiness visible in:
- library cards where practical
- item detail page
- decoded review flow

A seller should immediately understand what is missing and why an item is blocked.

## Backend expectations

If the repo does not yet have a dedicated decoder endpoint, add one such as:
- `netlify/functions/item-decoder.js`

Responsibilities:
- accept image references or upload payloads
- run decode through existing AI/vision infrastructure
- return structured output for title/category/brand/model/condition/description/value range/dimensions/weight/questions
- avoid fake certainty

Do not overbuild the valuation engine in this pass.
Focus on decode + structured output + reviewability.

## Constraints

- Do not break the current catalog service layer if it already exists.
- Do not duplicate service logic unnecessarily.
- Do not build full storefront checkout in this pass.
- Do not hard-code fake values for dimensions or weight.
- Favor modular pages and components.
- Keep the UX premium and operational.

## Desired outcome

When this pass is complete:
- the app has a usable seller-side catalog workspace
- users can create, edit, and browse items in-app
- users can upload images and run decode
- decoded output can be reviewed and saved
- dimensions and weight are fully visible and editable
- listing readiness is understandable and actionable

## Output requirements

When you finish:
1. summarize exactly what files you changed
2. explain how you integrated catalog into the app shell and routes
3. explain how the decode flow works end to end
4. explain what is still deferred for storefront, Stripe checkout, and channel publishing
5. call out any weak spots or incomplete integration points

Make the changes directly in code, not just as a plan.