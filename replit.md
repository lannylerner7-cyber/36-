# Document Renderer

Document Renderer prepares print-accurate deposit-slip previews with protected account data, a browser-only sample watermark, and server-side integration boundaries.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Optional secret: `GOOGLE_MAPS_API_KEY` — enables Google Places address suggestions through the API server
- Optional env: `ROUTING_DIRECTORY_PATH` — path to a current, license-authorized FedACH/FedWire JSON or fixed-width directory file/directory
- Optional env: `ROUTING_DIRECTORY_EFFECTIVE_DATE` — effective date for the installed directory snapshot
- Optional env: `ROUTING_LOGO_GOOGLE_FAVICON=true` — enables an unofficial UI-only favicon fallback when an authorized directory record includes a bank website

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `ROADMAP.md` — feature scope, delivery checklist, blocked integrations, and definition of done
- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `artifacts/api-server/src/lib/integrations.ts` — provider adapters and safe routing validation
- `artifacts/api-server/src/lib/routing-directory.ts` — local FedACH/FedWire directory loader and lookup
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/document-renderer/src/App.tsx` — editor and live physical preview
- `artifacts/document-renderer/src/index.css` — application theme and print surface styling

## Architecture decisions

- The first release defaults to browser preview mode with `SAMPLE / VOID`, while print output removes that browser-only watermark.
- Account data remains protected in the UI and preview; print mode includes the mapped MICR E-13B line.
- GnuMICR is bundled locally and inlined as Base64 at build time; its GPL license is stored beside the font asset.
- The frontend and PDF boundary consume one typed OpenAPI contract; generated hooks are the only client API surface.
- External provider credentials stay server-side. Missing credentials are represented as readiness state, not silent fallbacks.
- Routing numbers receive local ABA checksum validation before an optional local directory lookup; checksum validity never claims bank ownership.
- The renderer's internal paper geometry is fixed at 8 in × 4.5 in; responsive scaling changes presentation, not document dimensions.

## Product

Users enter deposit-slip recipient, bank, and document data while a physical-size preview updates in place. The workspace reports provider readiness, supports address autocomplete when configured, validates routing numbers locally, resolves institution metadata from an authorized local directory when installed, and keeps PDF export behind an explicit server-renderer boundary.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `GOOGLE_MAPS_API_KEY` is intentionally optional; without it, address autocomplete returns a clear not-configured state.
- The routing adapter returns bank metadata only when `ROUTING_DIRECTORY_PATH` points to a current authorized directory snapshot; otherwise it returns checksum status with an explicit metadata-unavailable message.
- Do not bundle the outdated directory files from the Moov repository as production data. The parser supports their documented JSON/fixed-width shapes, but a current authorized file must be supplied separately.
- Bank logo URLs are UI-only metadata. The optional Google favicon fallback is not an authoritative bank-logo source and must not be used for printed branding.
- Browser print is the current available output path; it strips the browser-only sample watermark while preserving the document geometry. Server PDF export remains disabled until its renderer is configured.
- MICR output uses the supplied A / C / D delimiter mapping; bank-equipment scan validation is still required before production use.
- The UI includes a themed local-first policy footer; Canva remains optional and is not required for the renderer to operate.
- After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen` before using generated hooks or Zod schemas.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
