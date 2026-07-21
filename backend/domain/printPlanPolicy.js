'use strict';

const MATERIALS = Object.freeze({
  PLA: { minNozzle: 190, maxNozzle: 230, maxBed: 70 },
  PETG: { minNozzle: 220, maxNozzle: 260, maxBed: 95 },
  ABS: { minNozzle: 230, maxNozzle: 270, maxBed: 115 },
  NYLON: { minNozzle: 245, maxNozzle: 285, maxBed: 110 },
});

function positiveNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function buildPrintPlan(input) {
  const violations = [];
  const material = MATERIALS[String(input.material || '').toUpperCase()];
  const machine = input.machine || {};
  const part = input.part || {};
  const slicer = input.slicer || {};

  if (!input.sourceRevision || !input.materialCatalogRevision) violations.push('provenance_required');
  if (!material) violations.push('unsupported_material');
  for (const axis of ['x', 'y', 'z']) {
    if (!positiveNumber(part[axis]) || !positiveNumber(machine[axis])) violations.push(`invalid_${axis}_dimension`);
    else if (Number(part[axis]) > Number(machine[axis])) violations.push(`part_exceeds_${axis}_build_volume`);
  }
  if (!positiveNumber(slicer.layerHeight) || !positiveNumber(machine.nozzleDiameter)) {
    violations.push('invalid_layer_or_nozzle');
  } else if (Number(slicer.layerHeight) > Number(machine.nozzleDiameter) * 0.8) {
    violations.push('layer_height_exceeds_nozzle_limit');
  }
  if (material && Number(machine.maxNozzleTemp) < material.minNozzle) violations.push('machine_nozzle_temperature_incompatible');
  if (material && Number(machine.maxBedTemp) < Math.min(material.maxBed, 60)) violations.push('machine_bed_temperature_incompatible');
  if (input.telemetry?.printerState !== 'idle') violations.push('printer_not_idle');
  if (!positiveNumber(input.job?.requiredMaterialGrams)) violations.push('invalid_material_requirement');
  if (positiveNumber(input.job?.requiredMaterialGrams) && Number(input.telemetry?.availableMaterialGrams) < Number(input.job.requiredMaterialGrams)) {
    violations.push('insufficient_material');
  }

  return {
    compatible: violations.length === 0,
    violations,
    plan: violations.length ? null : {
      material: String(input.material).toUpperCase(),
      nozzleTemperature: Math.min(material.maxNozzle, Math.max(material.minNozzle, Number(slicer.nozzleTemperature || material.minNozzle))),
      bedTemperature: Math.min(material.maxBed, Number(slicer.bedTemperature || 60)),
      layerHeight: Number(slicer.layerHeight),
      estimatedMinutes: Math.ceil(Number(input.job.estimatedMinutes || 1)),
      sourceRevision: input.sourceRevision,
      materialCatalogRevision: input.materialCatalogRevision,
    },
  };
}

function evaluatePrintOutcome(outcome) {
  const violations = [];
  if (!outcome.evidenceChecksum || !/^[a-f0-9]{64}$/i.test(outcome.evidenceChecksum)) violations.push('outcome_provenance_required');
  if (!['completed', 'failed'].includes(outcome.result)) violations.push('invalid_result');
  if (!positiveNumber(outcome.actualMinutes) || !positiveNumber(outcome.materialUsedGrams)) violations.push('positive_actuals_required');
  if (!Number.isInteger(Number(outcome.defectCount)) || Number(outcome.defectCount) < 0) violations.push('invalid_defect_count');
  return {
    valid: violations.length === 0,
    violations,
    benchmark: violations.length ? null : {
      result: outcome.result,
      actualMinutes: Number(outcome.actualMinutes),
      materialUsedGrams: Number(outcome.materialUsedGrams),
      defectCount: Number(outcome.defectCount),
      evidenceChecksum: outcome.evidenceChecksum.toLowerCase(),
    },
  };
}

module.exports = { MATERIALS, buildPrintPlan, evaluatePrintOutcome };
