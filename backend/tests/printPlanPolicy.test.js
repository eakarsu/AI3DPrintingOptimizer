'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPrintPlan, evaluatePrintOutcome } = require('../domain/printPlanPolicy');
const { validateRuntime } = require('../config/runtime');

const valid = {
  material: 'PLA', sourceRevision: 'slicer:42', materialCatalogRevision: 'catalog:9',
  machine: { x: 220, y: 220, z: 250, nozzleDiameter: 0.4, maxNozzleTemp: 260, maxBedTemp: 100 },
  part: { x: 20, y: 30, z: 40 },
  slicer: { layerHeight: 0.2, nozzleTemperature: 210, bedTemperature: 60 },
  telemetry: { printerState: 'idle', availableMaterialGrams: 500 },
  job: { requiredMaterialGrams: 100, estimatedMinutes: 37 },
};

test('builds a deterministic compatible plan', () => {
  assert.deepEqual(buildPrintPlan(valid), {
    compatible: true, violations: [],
    plan: { material: 'PLA', nozzleTemperature: 210, bedTemperature: 60, layerHeight: 0.2, estimatedMinutes: 37, sourceRevision: 'slicer:42', materialCatalogRevision: 'catalog:9' },
  });
});
test('blocks machine, telemetry and inventory violations', () => {
  const result = buildPrintPlan({ ...valid, part: { x: 999, y: 30, z: 40 }, telemetry: { printerState: 'printing', availableMaterialGrams: 1 } });
  assert.equal(result.compatible, false);
  assert.equal(result.plan, null);
  assert.deepEqual(result.violations.sort(), ['insufficient_material', 'part_exceeds_x_build_volume', 'printer_not_idle']);
});
test('runtime rejects weak credentials', () => assert.throws(() => validateRuntime({ DATABASE_URL: 'postgres://db', JWT_SECRET: 'short' }), /32/));
test('runtime quarantines legacy routes and forbids production opt-in', () => {
  assert.equal(validateRuntime({ DATABASE_URL: 'postgres://db', JWT_SECRET: 'x'.repeat(32) }).legacyPrototypeRoutesEnabled, false);
  assert.throws(() => validateRuntime({ NODE_ENV: 'production', DATABASE_URL: 'postgres://db', CLIENT_URL: 'https://app.example', JWT_SECRET: 'x'.repeat(32), ENABLE_LEGACY_PROTOTYPE_ROUTES: 'true' }), /cannot be enabled/);
});
test('benchmarks only provenanced real outcomes', () => {
  const result = evaluatePrintOutcome({ evidenceChecksum: 'd'.repeat(64), result: 'completed', actualMinutes: 40, materialUsedGrams: 95, defectCount: 0 });
  assert.equal(result.valid, true); assert.equal(result.benchmark.actualMinutes, 40);
  assert.equal(evaluatePrintOutcome({ result: 'completed' }).valid, false);
});
