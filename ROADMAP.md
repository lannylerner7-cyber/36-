# Document Renderer Roadmap

## Product boundary

Document Renderer is a print-accurate deposit-slip workspace. Deposit slips are bank-processing vouchers rather than negotiable checks; the renderer still protects account data and keeps an explicit browser preview mode so print behavior is deliberate.

## Current milestone — printable sample renderer

### Shipped in this milestone

- [x] Responsive data-entry workspace
- [x] Live 6 in × 2.75 in document preview
- [x] `SAMPLE / VOID` browser preview watermark and safety messaging
- [x] Preview-mode toggle that removes the watermark from print output
- [x] Form validation for routing number, account number, payee, date, amount, memo, and check number
- [x] Account number is visible exactly as entered in the preview and UI
- [x] Integration readiness status in the UI
- [x] Typed API contract and server routes
- [x] Browser print styles with exact physical dimensions
- [x] Local GnuMICR E-13B font asset with adjacent GPL license notice
- [x] Build-time inline Base64 font embedding
- [x] MICR line mapping for routing, account, check, and delimiter symbols
- [x] Reference-matched deposit-slip layout with logo, metadata, payee, check details, note, total, and perforated edge

### In progress

- [x] Google Places address autocomplete adapter through the server
- [x] Local routing-number ABA checksum validation
- [x] Routing-directory provider adapter boundary
- [ ] Deterministic PDF export through the server
- [ ] Cross-browser print regression checks

### Blocked until configuration is available

- [ ] Live Google Maps Places requests require `GOOGLE_MAPS_API_KEY`
- [ ] A production routing-directory provider and credentials still need to be selected
- [ ] Production PDF generation requires a server PDF runtime and font licensing review

## Scope checklist

### Form engine

- [ ] Routing number: exactly 9 digits and ABA checksum validation
- [ ] Physical bank address with helper note
- [x] Account number / DDA with entered-value display
- [ ] Routine-number terminology resolved or removed
- [ ] Payee / account holder name
- [ ] Check number
- [ ] Date on document
- [ ] Check amount with currency formatting
- [ ] Memo / reference note
- [ ] Reset-to-sample action
- [ ] Accessible labels, focus states, and inline errors

### Live render engine

- [ ] Canonical document component shared by preview and print
- [ ] Fixed internal size of 6 in × 2.75 in
- [ ] Responsive scaling without changing document geometry
- [ ] Overflow and long-text handling
- [x] Browser preview watermark with print-only removal
- [ ] No bank-authenticating logos in sample mode
- [ ] Validate printed MICR output against authorized target equipment

### Address integration

- [ ] Server-side Google Places adapter
- [ ] Address and establishment type restrictions
- [ ] Debounced client requests
- [ ] Manual-entry fallback
- [ ] Provider errors shown without exposing credentials
- [ ] Rate limiting and request logging without address/account values

### Routing integration

- [ ] Local ABA checksum validation
- [ ] Provider adapter interface
- [ ] Server-side lookup only
- [ ] Bank name and address result normalization
- [ ] No claim that a routing lookup proves account ownership
- [ ] Provider selection and credential setup documented

### Print and PDF

- [ ] `@page` with zero margins
- [ ] Exact physical dimensions in print CSS
- [ ] Print-only removal of editor chrome
- [ ] Browser print flow
- [ ] Server PDF export
- [ ] Deterministic output filename without financial data
- [ ] PDF font and asset licensing review

### Privacy and security

- [ ] Never log full account or routing values
- [ ] Never put financial values in URLs
- [ ] No persistence of sensitive values until a retention model is approved
- [ ] Secrets stored through Replit Secrets
- [ ] Provider calls made server-side
- [ ] Production authorization/compliance review before removing sample-only safeguards

## API contract

- `GET /api/healthz` — service health
- `GET /api/integrations/status` — provider readiness without revealing secrets
- `POST /api/places/autocomplete` — address suggestions
- `POST /api/routing/lookup` — normalized bank metadata and validation result
- `POST /api/documents/pdf` — PDF export boundary

## Definition of done for sample milestone

1. A user can enter sample data and see the document update immediately.
2. The preview remains physically 6 in × 2.75 in when printed or exported.
3. Full account numbers are never shown in the rendered document.
4. Missing integrations produce an actionable, non-breaking setup state.
5. Invalid routing numbers are rejected before provider lookup.
6. Browser preview clearly indicates `SAMPLE / VOID`; print mode removes only the browser watermark and retains the deposit-slip safety label.
7. The roadmap is updated whenever a feature is completed, deferred, or blocked.

## Later milestones

### Provider-ready integrations

- [ ] Add Google Maps key and enable Places API
- [ ] Select and connect an authorized routing-directory provider
- [ ] Add provider health checks and quotas
- [ ] Add integration-specific error telemetry with redaction

### Production review

- [ ] Confirm business use case and authorization for any negotiable instrument output
- [ ] Review applicable banking, payments, fraud-prevention, and record-retention requirements
- [x] Record the GnuMICR GPL license beside the local font asset
- [ ] Confirm MICR dimensions and scan behavior with the intended bank/equipment
- [ ] Define authentication, user roles, audit trail, and secure storage
- [ ] Only then revisit production document output scope