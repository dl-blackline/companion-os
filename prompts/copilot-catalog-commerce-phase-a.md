# Copilot Prompt - Catalog Commerce Phase A

Use this prompt in GitHub Copilot Chat or Copilot coding agent to begin the Catalog Commerce feature.

---

You are working inside the `dl-blackline/companion-os` repository.

Read these files first and treat them as the source of truth for this task:
- `docs/rebuild/catalog-commerce-feature-spec.md`
- `docs/rebuild/companion-os-v2-rebuild-blueprint.md`
- `docs/rebuild/implementation-roadmap.md`

## Objective

Implement **Phase A of the Catalog Commerce feature**.

This phase is about creating the **foundation** for a private seller-side item library.

Do **not** try to build the entire commerce system in one pass.
Do **not** try to complete public storefront checkout in this phase.

The goal is to establish the catalog data model, private catalog CRUD, and a clean seller-facing library UI that will later support AI item decoding, public publishing, and Stripe checkout.

## Product intent

This feature should allow a user to:
- catalog assets or items they own
- manage them in a private library
- prepare them for sale later
- eventually publish them to a public storefront

In this phase, focus on the private catalog workspace only.

## Phase A scope

### Build now
- seller-side catalog data model
- private catalog item CRUD
- image support for catalog items if practical
- catalog library page
- item detail and edit flow
- status system for items

### Do not build yet
- full AI image decoder
- valuation engine
- public storefront pages
- Stripe checkout
- webhooks
- customer-facing buying experience

## Required seller-side routes
Add or prepare routes such as:
- `/catalog`
- `/catalog/new`
- `/catalog/:itemId`
- `/catalog/:itemId/edit`

These can live in the v2 shell in a sensible way. If Phase 1 and 2 established a clean app shell, integrate this feature carefully without breaking the existing navigation.

## Required frontend structure
Create a feature structure like this:
- `src/features/catalog/pages/CatalogPage.tsx`
- `src/features/catalog/pages/CatalogItemPage.tsx`
- `src/features/catalog/pages/EditCatalogItemPage.tsx`
- `src/features/catalog/components/CatalogLibrary.tsx`
- `src/features/catalog/components/CatalogItemCard.tsx`
- `src/features/catalog/components/CatalogItemForm.tsx`
- `src/features/catalog/components/CatalogStatusBadge.tsx`

If additional small support files are useful, add them.

## Required backend/data work
Create the foundation for catalog persistence.

If the repo uses Supabase migrations for domain features, add a new migration for catalog tables.

Suggested minimum tables:

### `catalog_items`
- id
- user_id
- slug
- title
- category
- subcategory
- brand
- model
- variant
- condition
- description
- internal_notes
- quantity
- asking_price
- currency
- status
- publish_status
- created_at
- updated_at

### `catalog_item_images`
- id
- item_id
- user_id
- storage_path
- sort_order
- alt_text
- created_at

Keep RLS aligned so users only access their own private catalog items.

## Required item states
Support a clean status system for the private library. At minimum:
- `draft`
- `needs_review`
- `ready_to_price`
- `priced`
- `published`
- `pending_sale`
- `sold`
- `archived`

Also support a separate publish state if useful.

## Functional requirements

### 1. Catalog library
The user should be able to:
- view their catalog items
- search by text
- filter by status and category if practical
- open an item detail view
- create a new item manually

### 2. Item form
The user should be able to create and edit:
- title
- category
- brand
- model
- condition
- description
- internal notes
- quantity
- asking price
- status

Keep the form clean and premium.

### 3. Visual direction
Match the product’s dark luxury command-center aesthetic.
The catalog should feel:
- premium
- organized
- operational
- visually sharp

Do not make it feel like a generic ecommerce admin template.

### 4. Future-readiness
Design the model and UI so it is easy to add later:
- AI image decoder
- valuation support
- publish-to-storefront controls
- Stripe payment collection
- order management

## Constraints

- Do not build the AI decoder in this pass.
- Do not build public storefront checkout in this pass.
- Do not add fake payment flows.
- Do not break the v2 shell.
- Favor strong structure over overbuilding.
- Keep code modular.

## Desired outcome

When this pass is complete:
- the repo has a real seller-side catalog foundation
- users can create and manage private catalog items
- the UI feels aligned with Companion OS v2
- the system is ready for a later AI decoder + storefront + Stripe phase

## Output requirements

When you finish:
1. summarize exactly what files you changed
2. explain the new data model you introduced
3. note what is ready now vs deferred to later phases
4. list the best next phase tasks for AI decode and valuation
5. call out any migration or RLS risks

Make the changes directly in code, not just as a plan.