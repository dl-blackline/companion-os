# Catalog Seller Workspace and Decode Integration Phase

## Purpose

The current catalog branch establishes strong backend and data groundwork:
- catalog tables
- dimensions and weight fields
- listing readiness logic
- marketplace template/export scaffolding
- publication tracking groundwork

The next phase should turn that groundwork into a real in-app seller workflow.

This phase is about making the catalog usable inside Companion OS as an end-to-end internal selling workspace.

---

## What already exists conceptually

The repo now has strong foundations for:
- catalog item persistence
- dimensions and weight storage
- marketplace template support
- channel publication tracking
- review components for decoded items

What is still missing is the actual **seller experience** that ties these pieces together.

---

## Main objective

Build the in-app seller workspace so a user can:
- open a catalog section in the active shell
- view a private item library
- create items manually
- open and edit an item detail page
- upload images for an item
- run an AI decode flow
- review and correct decoded fields
- save the item back into the catalog
- see listing readiness clearly

This phase should make the catalog feature operational.

---

## Product scope

### Build now
- seller-side catalog pages and routes
- private catalog library UI
- item detail and edit views
- image upload entry point
- AI decode request and response flow
- decoded item review form wired to save logic
- listing readiness visibility in the UI

### Do not build now
- public storefront checkout
- Stripe order flow
- advanced multi-channel sync
- full fulfillment tooling

---

## Required routes

Add and wire routes such as:
- `/catalog`
- `/catalog/new`
- `/catalog/:itemId`
- `/catalog/:itemId/edit`

If the v2 shell currently only has the six core sections, integrate catalog in a way that does not break that structure.

Recommended options:
- expose Catalog as a sub-route under Assistant or Finance temporarily only if clearly intentional
- or add Catalog as a controlled new section only if the owner wants it active now

The key is to integrate it cleanly, not awkwardly.

---

## Required frontend structure

Create or complete a feature structure like:
- `src/features/catalog/pages/CatalogPage.tsx`
- `src/features/catalog/pages/CatalogItemPage.tsx`
- `src/features/catalog/pages/EditCatalogItemPage.tsx`
- `src/features/catalog/components/CatalogLibrary.tsx`
- `src/features/catalog/components/CatalogItemCard.tsx`
- `src/features/catalog/components/CatalogItemForm.tsx`
- `src/features/catalog/components/ItemDecoderUploader.tsx`
- `src/features/catalog/components/DecodedItemReviewForm.tsx`
- `src/features/catalog/components/ListingReadinessCard.tsx`

Use existing components where possible instead of duplicating effort.

---

## Decoder integration requirements

## 1. Image upload and decode trigger
The seller should be able to upload one or more images for an item and trigger decode.

### Minimum decode workflow
1. seller uploads image(s)
2. seller clicks decode
3. backend analyzes image(s)
4. system returns structured suggestions
5. review form appears
6. seller edits or confirms
7. item saves into catalog

---

## 2. Decoder output must include operational fields
The decode flow should support:
- title
- category
- brand
- model
- condition
- description
- value estimate range
- dimensions
- weight
- follow-up questions when confidence is low

If H/W/L/weight are missing or low-confidence, the review form must require seller input before marketplace-ready state can be achieved.

---

## 3. Decoder endpoint
If one does not already exist, add a dedicated backend endpoint such as:
- `netlify/functions/item-decoder.js`

### Responsibilities
- accept uploaded image references or payloads
- run multimodal/vision analysis through existing AI infrastructure
- return structured decode output
- include confidence and follow-up questions
- avoid pretending certainty where confidence is weak

---

## UI requirements

## 4. Catalog library page
The library should support:
- grid view of items
- quick status visibility
- search by text
- optional filtering by status or category
- quick open into item detail
- clear create-new CTA

## 5. Item detail page
The item detail page should show:
- images
- core item details
- dimensions and weight
- status
- listing readiness
- pricing/value estimate summary
- edit actions
- decode/re-decode action if images exist

## 6. Edit page
The edit page should support manual changes to:
- title
- category
- brand/model
- condition
- description
- quantity
- asking price
- dimensions
- weight
- notes

---

## Service layer expectations

The current branch already introduces catalog service and types.
This phase should wire them into the active feature pages rather than adding parallel service logic.

Goal:
- one clean catalog service path
- one clean item decode path
- pages/components layered on top of those services

---

## Listing readiness expectations

The UI should clearly communicate:
- what is complete
- what is missing
- whether the item is only catalog-ready, marketplace-ready, or channel-ready

A seller should not have to guess why an item is blocked from export or publish.

---

## Visual direction

Keep the catalog workspace aligned with the product’s premium dark command-center style.

It should feel:
- private
- operational
- premium
- high-signal
- resale-focused

Avoid making it feel like a generic ecommerce admin dashboard.

---

## Recommended implementation sequence

### Step 1
Wire routes and page entries

### Step 2
Build library page and item detail flow

### Step 3
Wire create/edit form to catalog CRUD

### Step 4
Add image upload and decoder trigger

### Step 5
Wire decoded review form to save/update logic

### Step 6
Expose listing readiness clearly in library and detail screens

---

## Exit criteria

This phase is successful when:
- the user can open a real catalog area in the app
- the user can create and edit catalog items
- the user can upload images and run a decode flow
- decoded results can be reviewed and saved
- dimensions and weight are visible and editable
- listing readiness is understandable in the UI

At that point the catalog becomes a usable internal selling system, ready for the next outward-facing phase.

---

## Next phase after this one

Once the seller workspace and decode flow are working, the next best phase is:
- public storefront pages
- publish controls
- Stripe checkout
- order creation and webhook-backed payment state

That should come after the internal workflow is usable, not before.