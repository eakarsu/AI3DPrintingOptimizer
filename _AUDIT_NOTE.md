# Audit Apply Note — AI3DPrintingOptimizer

## Audit recommendations (from batch_00.md)

### Missing AI counterparts
- AI build time estimation (material + complexity)
- AI cost optimization (material waste, energy per print)
- AI quality prediction (defect likelihood before printing)
- AI printer health anomaly detection (streaming sensor data)

### Missing non-AI features
- Multi-material scheduling
- Design file validation (printability check before submission)
- Filament inventory auto-reorder

### Custom feature suggestions
- Slicing parameter search (Cura/Simplify3D API integration)
- Multi-printer load balancing
- Defect vision inspection (camera + computer vision)
- Supplier inventory sync (Stratasys/Ultimaker catalogs)
- CAD optimization (mesh simplification, support reduction)

## Implemented in this pass

Three new AI endpoints appended to `backend/routes/aiRoutes.js` matching the existing OpenRouter + ai_results audit pattern:

1. `POST /api/ai/build-time-estimation` — predicts print duration, filament usage, breakdown by phase.
2. `POST /api/ai/cost-optimization` — estimates per-part cost and recommends material/infill/support savings.
3. `POST /api/ai/quality-prediction` — predicts quality score, defect risk, parameter warnings before printing.

All three use `queryOpenRouter` + `parseAIJson` + `saveAiResult` per the project's house style. Routes mounted under existing `/api/ai` prefix in `server.js` automatically (no server.js change required).

Files touched:
- `backend/routes/aiRoutes.js`

Syntax check: PASS (`node --check`).

## Backlog (not implemented)

| Item | Category | Reason |
|---|---|---|
| AI printer health streaming anomaly detection | TOO-RISKY | Requires sensor ingestion pipeline / WebSocket infra not present |
| Multi-material scheduling | NEEDS-PRODUCT-DECISION | Workflow / scheduling design |
| Design file validation (printability check) | TOO-RISKY | Needs STL parsing libs and frontend integration |
| Filament inventory auto-reorder | NEEDS-CREDS | Supplier APIs (Stratasys, Ultimaker) |
| Slicer parameter search | NEEDS-CREDS | Cura / Simplify3D API integration |
| Multi-printer load balancing | NEEDS-PRODUCT-DECISION | Scheduler design choice |
| Defect vision inspection | TOO-RISKY | CV model + camera pipeline |
| Supplier inventory sync | NEEDS-CREDS | External vendor APIs |
| CAD optimization (mesh simplification) | TOO-RISKY | Heavy compute / library deps |

## Apply pass 3 (frontend)

FE already wired. `frontend/src/pages/AIPrintingTools.jsx` exists with three-tab UI calling `/api/ai/build-time-estimation`, `/api/ai/cost-optimization`, `/api/ai/quality-prediction`, plus auth via shared `services/api.js` and an inline `AIPrintingTools` route in `App.jsx`. No frontend changes required this pass.

## Apply pass 4 (mechanical backlog)

**SKIPPED.** All remaining backlog items are tagged TOO-RISKY (sensor streaming, STL parsing, CV pipelines, mesh-simplification compute), NEEDS-CREDS (Stratasys / Ultimaker / Cura / Simplify3D vendor APIs), or NEEDS-PRODUCT-DECISION (multi-material scheduling, multi-printer load balancing). No mechanical candidates remain.

## Apply pass 5 (all backlog)

Three additive endpoints (different categories, all gated):

1. `POST /api/ai/multi-printer-load-balance` — **PRODUCT-DECISION**: greedy LLM-driven scheduler (NOT a constraint solver). Comment in route documents the choice.
2. `POST /api/ai/filament-auto-reorder` — **NEEDS-CREDS**: returns `503 {error, missing:"FILAMENT_SUPPLIER_API_KEY"}` when env var unset; LLM produces re-order packet only (no outbound HTTP from this endpoint).
3. `POST /api/ai/printer-health-anomaly` — **TOO-RISKY** (in-memory stub): caller supplies a recent telemetry window in the request body. No new sensor pipeline / WebSocket infra introduced.

All three reuse the existing `queryOpenRouter` + `parseAIJson` + `saveAiResult` + `auth` + `validationResult` pattern. New `requireKey()` helper returns `503 {missing:"OPENROUTER_API_KEY"}` when unset.

Files touched:
- `backend/routes/aiRoutes.js`

Syntax check: `node --check` PASS.

Smoke test: backend booted on port 4806 (parallel-session conflict on default 4000), `admin@3dprint.com / admin123` → JWT issued. `POST /api/ai/filament-auto-reorder` (no FILAMENT_SUPPLIER_API_KEY) → **503** with `{"missing":"FILAMENT_SUPPLIER_API_KEY"}`. Other two endpoints reach the OpenRouter stage (placeholder key in `.env` returns 401 from upstream — pre-existing config issue, not a regression).
