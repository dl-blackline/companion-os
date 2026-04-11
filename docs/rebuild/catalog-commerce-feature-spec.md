# Catalog Commerce Feature Spec

## Purpose

This feature adds a seller-side catalog and a customer-facing storefront to Companion OS.

The user should be able to:
- catalog assets or items they own
- upload one or more images of an item
- use AI to decode the item from photos
- receive a suggested category, title, specs, attributes, and estimated value range
- answer follow-up questions when AI confidence is low
- save the item into a structured library
- publish selected items to a customer-facing storefront
- accept payment through Stripe on the public side

This is not just a photo upload tool.
It is a full **catalog-to-sale workflow**.

---

## Product goal

Create a high-trust item selling system with two sides:

### 1. Internal seller workspace
A private catalog for the owner to manage sellable assets.

### 2. Public storefront
A customer-facing experience where selected items can be listed, viewed, and purchased.

---

## Core user flow

### Seller flow
1. Seller opens the catalog workspace.
2. Seller uploads one or more photos of an item.
3. AI analyzes the item.
4. System extracts likely title, type, brand, model, condition signals, and value range.
5. If confidence is low, AI asks the seller targeted questions.
6. Seller confirms or edits the structured record.
7. Item is saved to library.
8. Seller can mark item as draft, priced, published, sold, or archived.
9. Seller can publish the item to the public storefront.
10. Seller can collect payment via Stripe when a buyer checks out.

### Buyer flow
1. Buyer visits the public storefront.
2. Buyer browses available listings.
3. Buyer opens an item detail page.
4. Buyer sees images, title, specs, condition, price, and purchase CTA.
5. Buyer pays through Stripe Checkout.
6. System records the order and marks the item appropriately.

---

## Main feature areas

## 1. Catalog library

### Seller-side requirements
- private item library
- grid and table views
- search
- filter by category, condition, status, price, value band, and publish state
- item statuses:
  - draft
  - needs_review
  - ready_to_price
  - priced
  - published
  - pending_sale
  - sold
  - archived

### Core item fields
- id
- owner_user_id
- title
- category
- subcategory
- brand
- model
- variant
- condition
- description
- internal_notes
- asking_price
- estimated_low_value
- estimated_high_value
- ai_confidence_score
- publish_status
- sale_status
- quantity
- sku or internal_reference
- created_at
- updated_at

---

## 2. AI item decoder

### Primary function
Use uploaded images to create a structured catalog record.

### AI should attempt to infer
- likely item category
- title suggestion
- brand or maker
- model or series if visible
- condition clues
- notable attributes
- likely resale-relevant details
- value range estimate
- missing information that needs seller confirmation

### Decoder behavior
- when confidence is high, prefill structured fields
- when confidence is medium or low, ask follow-up questions
- preserve seller override ability for every field
- never silently lock values as final truth

### Example follow-up questions
- What brand is stamped on the item?
- Is this new, used, or damaged?
- Do you know the model number?
- Are there included accessories or original packaging?
- Does it power on or function correctly?
- Are there defects, wear, or missing pieces?

### Output model
AI should return:
- structured fields
- confidence scores per major field
- value estimate range
- reasoning summary
- questions array if clarification is needed

---

## 3. Item valuation support

### Goal
Provide seller support, not fake certainty.

### System should produce
- estimated low value
- estimated likely value
- estimated high value
- confidence score
- short explanation of what drove the estimate

### Rules
- valuation should be clearly labeled as estimate
- seller can override final asking price
- system should distinguish between:
  - AI estimate
  - seller-set price
  - final sold price

### Future upgrade path
Later phases can add external market comps and comparable-sales ingestion if desired.

---

## 4. Listing editor

### Seller should be able to edit
- images
- title
- description
- condition
- attributes
- price
- quantity
- shipping or pickup options
- public visibility

### Listing quality features
- AI-generated polished title
- AI-generated product description
- AI-generated bullet highlights
- required-fields validation before publish

---

## 5. Public storefront

### Public requirements
- storefront home page
- product grid
- category filtering
- search
- item detail page
- price and availability
- Stripe checkout CTA

### Public item detail should include
- images
- title
- category
- key attributes
- condition
- description
- price
- quantity or availability status
- buy button

### Public listing states
- hidden
- published
- sold_out
- removed

---

## 6. Stripe payment flow

### Required behavior
- use Stripe Checkout or equivalent hosted payment flow
- create order records in app database
- associate order with listing and seller
- mark item or quantity state after successful payment

### Order states
- pending
- paid
- canceled
- refunded
- fulfilled

### Important note
Do not implement fake payment collection.
Use real Stripe flows and webhook-backed order state updates.

---

## 7. Order and inventory handling

### Minimum inventory logic
- quantity-based support for items where multiples exist
- single-item behavior for unique assets
- reserve inventory during checkout where practical
- reduce available quantity after payment confirmation

### Seller-side order data
- order id
- item id
- buyer email
- stripe session id
- amount paid
- payment status
- fulfillment status
- timestamps

---

## 8. Suggested route structure

### Seller-side private routes
- `/catalog`
- `/catalog/new`
- `/catalog/:itemId`
- `/catalog/:itemId/edit`
- `/catalog/orders`

### Public routes
- `/shop`
- `/shop/:slug`
- `/checkout/:itemId` or Stripe-hosted route handoff

---

## 9. Suggested frontend structure

### Feature folders
- `src/features/catalog/`
- `src/features/storefront/`
- `src/features/orders/`

### Suggested seller-side files
- `src/features/catalog/pages/CatalogPage.tsx`
- `src/features/catalog/pages/CatalogItemPage.tsx`
- `src/features/catalog/components/CatalogLibrary.tsx`
- `src/features/catalog/components/ItemDecoderUploader.tsx`
- `src/features/catalog/components/ItemReviewForm.tsx`
- `src/features/catalog/components/ValueEstimateCard.tsx`
- `src/features/catalog/components/PublishControls.tsx`

### Suggested storefront files
- `src/features/storefront/pages/StorefrontPage.tsx`
- `src/features/storefront/pages/ProductDetailPage.tsx`
- `src/features/storefront/components/ProductGrid.tsx`
- `src/features/storefront/components/ProductCard.tsx`
- `src/features/storefront/components/BuyNowButton.tsx`

### Suggested order files
- `src/features/orders/pages/OrdersPage.tsx`
- `src/features/orders/components/OrdersTable.tsx`

---

## 10. Suggested backend/API areas

### New backend functions or domains
- catalog items CRUD
- item decoder and valuation endpoint
- storefront listing query endpoint
- create Stripe checkout session
- Stripe webhook for order state updates
- order list and detail endpoints

### Example backend functions
- `netlify/functions/catalog-items.js`
- `netlify/functions/item-decoder.js`
- `netlify/functions/storefront.js`
- `netlify/functions/storefront-checkout.js`
- `netlify/functions/storefront-webhook.js`
- `netlify/functions/catalog-orders.js`

---

## 11. Suggested data model

### Tables
#### catalog_items
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
- estimated_low_value
- estimated_high_value
- estimated_likely_value
- ai_confidence_score
- ai_summary
- status
- publish_status
- created_at
- updated_at

#### catalog_item_images
- id
- item_id
- user_id
- storage_path
- sort_order
- alt_text
- created_at

#### catalog_item_attributes
- id
- item_id
- key
- value
- source

#### catalog_item_questions
- id
- item_id
- question
- answer
- answered_at

#### storefront_orders
- id
- user_id
- item_id
- stripe_checkout_session_id
- stripe_payment_intent_id
- buyer_email
- amount_total
- currency
- payment_status
- fulfillment_status
- created_at
- updated_at

---

## 12. Security and trust rules

### Seller side
- item library must be private by default
- only published items appear publicly
- seller-only edit and order views

### Public side
- no exposure of private notes
- no exposure of hidden inventory data
- only explicitly publishable fields leave the private system

### AI safety
- AI estimates must be labeled as estimates
- seller must remain final authority on title, condition, and price

---

## 13. Recommended implementation sequence

### Phase A
Catalog foundation
- create item tables
- create private catalog CRUD
- create library UI

### Phase B
AI decoder
- image upload
- AI extraction
- review form with follow-up questions
- save structured catalog record

### Phase C
Storefront
- public listing pages
- publish controls
- product detail pages

### Phase D
Stripe commerce
- checkout session creation
- webhook handling
- order recording
- sold status updates

### Phase E
Operational polish
- search and filters
- listing quality helpers
- order management
- sold and archived workflows

---

## 14. Product fit inside Companion OS

This feature should be treated as a **Catalog Commerce** capability.

It can live as:
- a dedicated top-level section later
- or a sub-area of the broader operating system if the product evolves into an asset, resale, or commerce-oriented command center

Because this is a substantial workflow, it should not be buried as a tiny utility.

---

## 15. Final recommendation

Build this feature as a structured commerce workflow, not as an image toy.

The winning version is:
- private catalog library
- AI decode and valuation support
- seller review and publish flow
- clean public storefront
- Stripe-backed payment collection
- tracked order state

That turns Companion OS into something materially more useful for real-world asset cataloging and resale.