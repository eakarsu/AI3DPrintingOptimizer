# Operations and trust boundary

`start.sh` only starts this project's two processes. It never kills port owners, installs packages, creates a database, migrates, or seeds. Use `scripts/bootstrap.sh` once, `scripts/migrate.sh` for versioned schema changes, and the confirmation-gated `scripts/seed-demo.sh` only in an isolated demo database.

Only authentication, health, and the governed print-plan API are supported by default. Historical generated/demo routes return `410 prototype_route_quarantined`. Developers may inspect them with `ENABLE_LEGACY_PROTOTYPE_ROUTES=true`; runtime validation refuses that setting in production.

The governed API is `/api/print-plan-workflows`. It validates machine volume and temperature, nozzle/layer, material inventory, telemetry state, and source revisions before an operator can submit a plan. A different approver must approve it. An approved record is authorization evidence, not proof that a printer or slicer received the job.

Printer/slicer adapters, authoritative material synchronization, and real-outcome benchmarks require configured external systems. Provider/model output is not accepted as a print plan by this workflow.
