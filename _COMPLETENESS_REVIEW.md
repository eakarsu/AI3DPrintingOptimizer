# Completeness Review: AI3DPrintingOptimizer

- **Review date:** 2026-07-18
- **Assessment basis:** Static source and configuration inspection only. Dependencies were not installed, and no build, database migration, external integration, or runtime workflow was executed.

## Classification

**Prototype-demo**

## Verdict

The repository presents a broad additive-manufacturing optimization surface (80 source files and 31 route modules), but the static evidence is characteristic of a generated prototype. Pages and endpoints demonstrate concepts; they do not establish a verified execution path for ingest slicer, printer, material, and job telemetry and emit constraint-checked print plans.

## Why it is not complete

- 27 files are explicitly named as gap/gap-feature implementations; route/page count therefore overstates completed product capability.
- 24 files reference model-provider or chat-completion behavior; these generic LLM paths are not a substitute for deterministic domain execution, grounding, or evaluation.
- 24 files contain mock, sample, placeholder, or random-data signals, leaving important outcomes disconnected from authoritative systems.
- No recognizable application test files were found in the inspected tree.
- No CI workflow was found to continuously verify builds, tests, migrations, or security checks.
- No environment example/template was found, so required configuration and secret boundaries are undocumented.

## Needed features

- 1. Implement a workflow to ingest slicer, printer, material, and job telemetry and emit constraint-checked print plans.
- 2. Connect printer and slicer APIs, material catalogs, and production job queues; replace seed/demo records with durable, synchronized data and explicit failure handling.
- 3. Benchmark optimization results against real print outcomes.
- 4. Enforce machine/material compatibility checks, provenance, and operator approval.
- 5. Add contract, integration, authorization, migration, and end-to-end tests in CI, plus a documented non-destructive deployment/run path.

## Risks or launch blockers

- The root launcher can terminate unrelated processes occupying configured ports.
- The root launcher seeds, creates, migrates, or otherwise mutates database state during startup.
- The root launcher installs dependencies at run time, reducing reproducibility and expanding supply-chain risk.
- Ungrounded or malformed model output can become a domain action unless schemas, evidence, evaluations, and approval gates are added.

## Evidence inspected

- `backend/package.json` — declared scripts, runtime dependencies, and application boundaries.
- `frontend/package.json` — declared scripts, runtime dependencies, and application boundaries.
- `backend/server.js` — service composition, middleware, and registered routes.
- `frontend/src/App.jsx` — front-end navigation and visible workflow surface.
- `backend/routes/aiRoutes.js` — implemented API surface and domain/AI request handling.
- `backend/routes/analytics.js` — implemented API surface and domain/AI request handling.

## Recommended next action

Treat this as a prototype: select one narrow additive-manufacturing optimization outcome, remove or quarantine generated gap routes, and implement that outcome end to end with real data, deterministic rules, and tests before adding features.

## Implementation progress

**2026-07-18 — locally actionable foundation implemented; external production validation remains.**

- **1:** `backend/domain/printPlanPolicy.js`, `backend/routes/printPlanWorkflow.js`, and migration `001_governed_print_plans.sql` now provide a durable ingest → compatibility validation → independent approval → outcome-recording workflow. The deterministic plan checks build volume, material/temperature, nozzle/layer, inventory, telemetry state, and source revisions; model output is not an executable plan.
- **2:** Tenant-scoped state, idempotency, explicit failure codes, outcome evidence, and an audit trail are implemented. Printer/slicer execution, authoritative material synchronization, and job-queue adapters remain blocked on real provider endpoints, credentials, and contracts; approval deliberately stops short of claiming dispatch.
- **3:** Approved plans can record one checksum-backed real print outcome for benchmark data. A representative production outcome set and physical print evaluation remain external validation work.
- **4:** Machine/material constraints, provenance, operator/approver role gates, separation of duties, tenant boundaries, and audited reasons are enforced by the primary workflow.
- **5:** `.env.example`, runtime secret validation, versioned SQL, dependency/bootstrap/migrate/guarded-seed scripts, frontend build/migration CI, an HTTP health-and-authorization smoke test, and four passing policy/config tests were added. `start.sh` now refuses occupied ports and never installs, migrates, seeds, creates a database, or kills unrelated processes.
- **Risk remediation:** Batch-generated stub/gap/model routes and demo-credential UI were removed from the default product boundary. Historical routes return a tested `410` unless explicitly enabled for local inspection, and production rejects that opt-in. Destructive demo seeding requires `CONFIRM_DEMO_SEED=YES`, non-production mode, and a caller-supplied 12+ character password.
- **Validation performed:** four Node policy/config tests and the production frontend build passed; edited backend JavaScript, JSON manifests, and shell scripts passed syntax checks. No database, printer, slicer, provider, or physical benchmark was run locally.

## Runtime and login acceptance — 2026-07-20

- **Status:** BLOCKED
- **Startup safety:** `start.sh` was inspected before execution. Frontend and backend listeners were corrected to default to `127.0.0.1`; startup still refuses occupied ports and does not install dependencies, migrate, seed, create databases, or terminate unrelated processes.
- **Startup:** `./start.sh` succeeded against a disposable PostgreSQL 14 database and project-owned test identity. Backend and frontend became ready at `http://127.0.0.1:4000` and `http://127.0.0.1:3000`; both listeners were verified as loopback-only.
- **Readiness:** `/api/health` returned `200` with `status=ok`; the frontend returned `200` with the expected application title.
- **Login:** invalid test credentials returned `401`; the seeded test operator authenticated successfully through `/api/auth/login`, returned a tenant-scoped token, and exposed no credential defaults. Browser login remains unverified because this session reported no available controllable browser.
- **Primary journey:** the authenticated operator created a compatible, persisted print-plan workflow with a unique idempotency key and received `status=validated`; a quarantined legacy route returned the expected `410`.
- **Browser/server evidence:** server output contained normal backend and Vite readiness messages with no runtime error. Browser-console and browser-network evidence remain unavailable, so API success is not represented as browser success.
- **Build/tests:** 5/5 backend tests and the production frontend build passed after the listener correction.
- **Cleanup:** `start.sh` children, PostgreSQL, all three listeners, and the disposable runtime directory were stopped or removed.
- **Residual issue:** rerun the visible login and primary screen through an available browser, inspect console/failed requests, then change this status to `VERIFIED` only if that browser pass succeeds. Printer, slicer, provider, and physical-print validation remain separate external blockers.
