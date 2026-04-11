# Catalog Dimensions, Weight, and Marketplace Syndication Spec

## Purpose

This document extends the Catalog Commerce workflow with three critical operational requirements:

1. **AI extraction of dimensions**
2. **Prompted capture of missing shipping fields**
3. **Marketplace export and syndication paths** for channels such as Whatnot, eBay, and future listing destinations

The seller wants catalog items to be operationally useful for selling, shipping, and exporting — not just visually identified.

---

## Core requirement

Every catalog item should be able to carry commerce-ready physical data, including:
- height
- width
- length
- weight

During AI decode, the system should attempt to identify or infer those values where possible.
If they cannot be reliably determined, the system must prompt the seller to fill them in manually before the item is considered fully listing-ready for channels that require them.

---

## Why this matters

Dimensions and weight are required or highly useful for:
- shipping estimates
- listing completeness
- marketplace CSV exports
- storefront fulfillment logic
- eBay-style listing templates
- future multi-channel listing workflows

Without these fields, the system cannot become a serious inventory and selling platform.

---

## Decoder requirements

## 1. AI should attempt to decode or infer
From images and seller follow-up responses, the system should attempt to decode:
- title
- category
- brand
- model
- condition
- dimensions
  - height
  - width
  - length
- weight
- key selling attributes
- likely value range

### Important rule
The system must distinguish between:
- **observed from image or label**
- **estimated or inferred**
- **seller confirmed**

Dimensions and weight should never be presented as certain when they are not.

---

## 2. Missing-field prompt behavior

If the decoder cannot confidently extract height, width, length, or weight, the UI must prompt the seller to enter them.

### Required behavior
- show dedicated boxes for height, width, length, and weight
- clearly label units
- indicate whether the value is AI-detected, AI-estimated, or seller-entered
- prevent the item from being marked fully listing-ready when required marketplace fields remain missing

### Suggested field model
- height_value
- width_value
- length_value
- weight_value
- measurement_unit
- weight_unit
- dimension_source
- weight_source
- dimensions_confirmed
- weight_confirmed

### Example sources
- `image_detected`
- `label_detected`
- `ai_estimated`
- `seller_entered`
- `seller_confirmed`

---

## 3. Units

The system should support explicit units.

### Minimum units
#### Dimensions
- inches
- centimeters

#### Weight
- pounds
- ounces
- kilograms
- grams

### Recommendation
For the initial US-first build, default to:
- inches
- pounds

But preserve the data model so unit flexibility exists.

---

## 4. Listing readiness rules

An item should have a structured readiness state.

### Suggested readiness gates
#### Basic catalog-ready
- title present
- category present
- condition present

#### Marketplace-ready
- asking price present
- description present
- images present
- required dimensions present when needed
- required weight present when needed

#### Channel-ready
A given channel can impose extra requirements, such as:
- eBay CSV-required fields
- Whatnot template-required fields
- storefront publish requirements

This means readiness should be channel-aware, not just globally binary.

---

## eBay template support

## 5. CSV template support should include eBay as well as Whatnot

The platform should support uploaded marketplace CSV templates from:
- Whatnot
- eBay
- future marketplaces

The export engine should be template-driven, not hard-coded to only one marketplace.

### eBay requirements
The system should support:
- upload of eBay CSV templates
- parsing and storage of column headers
- mapping of catalog item fields into eBay columns
- validation against required fields
- downloadable, properly formatted eBay-ready CSV output

### Catalog field mapping should include
- title
- description
- price
- category
- condition
- quantity
- dimensions
- weight
- image URLs if needed
- SKU/internal reference

---

## Marketplace syndication vision

## 6. Multi-channel listing distribution

The user also wants the system set up for eventual auto-feed or syndication to platforms such as:
- eBay
- Facebook Marketplace
- future channels

This should be treated as a **marketplace syndication layer**.

### Important note
Direct integrations and auto-posting behavior must follow each marketplace’s current policies, permissions, and official integration capabilities.
The architecture should be built to support channel publishing, but implementation details should remain compliant with whatever each platform officially allows at the time of build.

Do not assume identical automation support across all marketplaces.

---

## 7. Recommended syndication architecture

The catalog item remains the source of truth.

Then each selling channel becomes a publish target.

### Proposed flow
1. Seller completes catalog item.
2. System validates listing readiness.
3. Seller selects one or more channels.
4. System transforms internal data into channel-specific payloads or CSV/template outputs.
5. Channel publication records are stored.
6. Errors, sync status, and publish state are tracked per channel.

### Suggested publishing targets
- internal storefront
- Whatnot CSV export
- eBay CSV export
- future direct marketplace connectors

---

## 8. Suggested data model additions

### Add to `catalog_items`
- height_value
- width_value
- length_value
- dimension_unit
- weight_value
- weight_unit
- dimensions_source
- weight_source
- dimensions_confirmed
- weight_confirmed
- listing_readiness_status

### Add `catalog_channel_publications`
- id
- item_id
- user_id
- channel
- publication_type
- publication_status
- external_listing_id
- export_template_id
- last_synced_at
- last_error
- created_at
- updated_at

### Add `marketplace_templates`
If not already created:
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

---

## 9. Suggested frontend structure

### Catalog decode and review
- `src/features/catalog/components/ItemDecoderUploader.tsx`
- `src/features/catalog/components/DecodedItemReviewForm.tsx`
- `src/features/catalog/components/DimensionsWeightFields.tsx`
- `src/features/catalog/components/ListingReadinessCard.tsx`

### Export and syndication
- `src/features/catalog-export/pages/MarketplaceExportPage.tsx`
- `src/features/catalog-export/components/TemplateUploader.tsx`
- `src/features/catalog-export/components/TemplateMapper.tsx`
- `src/features/catalog-export/components/ExportValidationPanel.tsx`
- `src/features/catalog-export/components/ChannelPublishPanel.tsx`

---

## 10. Validation behavior

### Before export or publish
The system should validate:
- title present
- price present
- category present
- required dimensions present if channel needs them
- required weight present if channel needs it
- required mapped columns present for template export

### Validation outcomes
- `ready`
- `warning`
- `blocked`

### Example blocked reasons
- missing weight
- missing length
- missing required eBay field mapping
- missing image set

---

## 11. Recommended implementation sequence

### Phase A
Private catalog foundation

### Phase B
AI item decoder and valuation support
- include dimensions and weight extraction logic
- include seller prompts for missing H/W/L/weight fields

### Phase C
Marketplace template export
- Whatnot first
- then eBay
- shared template-driven export architecture

### Phase D
Channel publication layer
- internal storefront first
- then selective external syndication support where compliant

### Phase E
Operational sync and order-state intelligence

---

## 12. Final recommendation

Treat dimensions, weight, and template/channel export as first-class commerce data — not optional afterthoughts.

The correct version of this system:
- decodes what it can from photos
- prompts for missing H/W/L/weight when needed
- stores those values structurally
- uses them in listing readiness
- exports properly formatted Whatnot and eBay template files
- is architected for future channel syndication such as eBay, Facebook Marketplace, and other outlets where policy-compliant publishing paths exist

That is what turns the catalog into a real selling engine.