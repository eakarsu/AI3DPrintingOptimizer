const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// =========================================================
// CUSTOM VIEWS for AI 3D Printing Optimizer (Farm Views)
// 4 endpoints (synthesized data, deterministic):
//  VIZ:
//   - GET  /api/custom-views/print-queue-gantt        (Gantt timeline of jobs)
//   - GET  /api/custom-views/bed-utilization-heatmap  (Heatmap per printer / hour)
//  NON-VIZ:
//   - GET  /api/custom-views/print-job-spec/:id       (Job spec PDF-ready data)
//   - GET/POST/PUT/DELETE /api/custom-views/slicer-profiles  (CRUD)
// =========================================================

const PRINTER_MODELS = [
  'Prusa MK4', 'Bambu X1C', 'Ultimaker S5', 'Formlabs Form 3', 'Markforged X7',
  'Creality K1 Max', 'Stratasys F370', 'Raise3D Pro3'
];
const MATERIALS = [
  { name: 'PLA Pro Black', type: 'PLA', diameter: '1.75mm', supplier: 'Polymaker' },
  { name: 'PETG White', type: 'PETG', diameter: '1.75mm', supplier: 'Prusament' },
  { name: 'ABS Carbon', type: 'ABS', diameter: '2.85mm', supplier: 'Polymaker' },
  { name: 'TPU 95A Red', type: 'TPU', diameter: '1.75mm', supplier: 'NinjaTek' },
  { name: 'Nylon CF15', type: 'Nylon', diameter: '1.75mm', supplier: 'Markforged' },
  { name: 'ASA Natural', type: 'ASA', diameter: '1.75mm', supplier: 'Polymaker' },
  { name: 'PEEK Industrial', type: 'PEEK', diameter: '1.75mm', supplier: 'Apium' },
  { name: 'PC Blend Smoke', type: 'PC', diameter: '2.85mm', supplier: 'Polymaker' }
];
const JOB_PARTS = [
  'Bracket V2', 'Drone Frame', 'Enclosure Lid', 'Gear Assembly', 'Phone Stand',
  'Cable Clip', 'Fan Shroud', 'Tool Holder', 'Hinge', 'Knob', 'Prototype Housing',
  'Mounting Plate', 'Custom Jig', 'Filter Cap', 'Sensor Bracket'
];
const OPERATORS = ['Erol A.', 'M. Chen', 'S. Patel', 'J. Rivera', 'K. Yamamoto'];

function seeded(i, salt = 0) {
  const x = Math.sin(i * 9301 + salt * 49297) * 233280;
  return x - Math.floor(x);
}

// -------- VIZ 1: Print Queue Gantt Chart --------
router.get('/print-queue-gantt', auth, (req, res) => {
  // Anchor timeline at start of today (UTC)
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const HOURS_WINDOW = 24;
  const rows = [];

  PRINTER_MODELS.forEach((model, pi) => {
    let cursorH = +(seeded(pi, 1) * 2).toFixed(2); // first job starts 0-2h into the day
    const jobs = [];
    let n = 0;
    while (cursorH < HOURS_WINDOW && n < 6) {
      const durH = +(seeded(pi * 11 + n, 2) * 4 + 1).toFixed(2); // 1-5h jobs
      const startH = cursorH;
      const endH = Math.min(HOURS_WINDOW, cursorH + durH);
      const ji = (pi * 7 + n) % JOB_PARTS.length;
      const mi = (pi + n) % MATERIALS.length;
      const startDate = new Date(dayStart.getTime() + startH * 3600 * 1000);
      const endDate = new Date(dayStart.getTime() + endH * 3600 * 1000);
      const priorities = ['low', 'normal', 'high', 'urgent'];
      const statusPool = ['queued', 'printing', 'completed'];
      jobs.push({
        id: `JOB-${3000 + pi * 100 + n}`,
        part: JOB_PARTS[ji],
        material: MATERIALS[mi].name,
        priority: priorities[Math.floor(seeded(pi * 17 + n, 3) * priorities.length)],
        status: startH < (now.getUTCHours() + now.getUTCMinutes() / 60) && endH > (now.getUTCHours() + now.getUTCMinutes() / 60)
          ? 'printing'
          : (endH <= (now.getUTCHours() + now.getUTCMinutes() / 60) ? 'completed' : 'queued'),
        startISO: startDate.toISOString(),
        endISO: endDate.toISOString(),
        startHour: +startH.toFixed(2),
        endHour: +endH.toFixed(2),
        durationHours: +(endH - startH).toFixed(2),
        operator: OPERATORS[(pi + n) % OPERATORS.length]
      });
      cursorH = endH + +(seeded(pi * 31 + n, 4) * 0.6).toFixed(2); // small gap
      n++;
    }
    rows.push({
      printerId: `PRN-${1000 + pi}`,
      printerModel: model,
      bay: `Bay ${String.fromCharCode(65 + (pi % 4))}${(pi % 3) + 1}`,
      jobs
    });
  });

  const totalJobs = rows.reduce((s, r) => s + r.jobs.length, 0);
  res.json({
    windowStartISO: dayStart.toISOString(),
    windowHours: HOURS_WINDOW,
    nowISO: now.toISOString(),
    rows,
    totalJobs,
    printersCount: rows.length,
    generatedAt: now.toISOString()
  });
});

// -------- VIZ 2: Bed Utilization Heatmap (per printer x hour) --------
router.get('/bed-utilization-heatmap', auth, (req, res) => {
  const HOURS = 24;
  const matrix = PRINTER_MODELS.map((model, pi) => {
    const cells = [];
    for (let h = 0; h < HOURS; h++) {
      // duty-cycle pattern: warmer during 8-20
      const base = (h >= 8 && h <= 20) ? 0.55 : 0.2;
      const noise = seeded(pi * 41 + h, 5) * 0.45;
      const utilization = Math.min(1, Math.max(0, +(base + noise - 0.1).toFixed(3)));
      cells.push({ hour: h, utilization, jobs: Math.floor(utilization * 2 + (utilization > 0.7 ? 1 : 0)) });
    }
    const avg = +(cells.reduce((s, c) => s + c.utilization, 0) / cells.length).toFixed(3);
    return {
      printerId: `PRN-${1000 + pi}`,
      printerModel: model,
      bay: `Bay ${String.fromCharCode(65 + (pi % 4))}${(pi % 3) + 1}`,
      cells,
      avgUtilization: avg,
      peakHour: cells.reduce((b, c) => c.utilization > b.utilization ? c : b, cells[0]).hour
    };
  });
  const farmAvg = +(matrix.reduce((s, m) => s + m.avgUtilization, 0) / matrix.length).toFixed(3);
  res.json({
    hours: HOURS,
    printersCount: matrix.length,
    matrix,
    farmAvgUtilization: farmAvg,
    generatedAt: new Date().toISOString()
  });
});

// -------- NON-VIZ 1: Print Job Spec PDF (PDF-ready spec sheet) --------
router.get('/print-job-spec/:id', auth, (req, res) => {
  const idNum = parseInt((req.params.id || '0').replace(/\D/g, '')) || 1;
  const i = idNum % JOB_PARTS.length;
  const material = MATERIALS[i % MATERIALS.length];
  const layerHeights = [0.1, 0.16, 0.2, 0.28];
  const infills = [10, 15, 20, 30, 50];
  const adhesions = ['Skirt', 'Brim', 'Raft'];
  const spec = {
    jobId: `JOB-${3000 + idNum}`,
    title: 'Print Job Spec Sheet',
    issuedAt: new Date().toISOString(),
    revision: 'A',
    part: {
      name: JOB_PARTS[i],
      stlFile: `${JOB_PARTS[i].toLowerCase().replace(/\s+/g, '_')}.stl`,
      volumeCm3: +(seeded(idNum, 21) * 200 + 5).toFixed(2),
      weightGrams: +(seeded(idNum, 22) * 300 + 8).toFixed(1),
      boundingBoxMm: {
        x: +(seeded(idNum, 23) * 150 + 20).toFixed(1),
        y: +(seeded(idNum, 24) * 150 + 20).toFixed(1),
        z: +(seeded(idNum, 25) * 120 + 10).toFixed(1)
      }
    },
    printer: {
      id: `PRN-${1000 + (idNum % PRINTER_MODELS.length)}`,
      model: PRINTER_MODELS[idNum % PRINTER_MODELS.length],
      bay: `Bay ${String.fromCharCode(65 + (idNum % 4))}${(idNum % 3) + 1}`
    },
    slicing: {
      profileName: 'Default 0.2mm Standard',
      slicer: 'PrusaSlicer 2.7',
      layerHeightMm: layerHeights[Math.floor(seeded(idNum, 26) * layerHeights.length)],
      infillPercent: infills[Math.floor(seeded(idNum, 27) * infills.length)],
      infillPattern: ['gyroid', 'cubic', 'grid', 'lightning'][Math.floor(seeded(idNum, 28) * 4)],
      walls: 3,
      topBottomLayers: 4,
      nozzleDiameterMm: 0.4,
      nozzleTempC: 210 + Math.floor(seeded(idNum, 29) * 40),
      bedTempC: 60 + Math.floor(seeded(idNum, 30) * 30),
      printSpeedMmS: 60 + Math.floor(seeded(idNum, 31) * 80),
      supportsEnabled: seeded(idNum, 32) > 0.5,
      adhesionType: adhesions[Math.floor(seeded(idNum, 33) * adhesions.length)]
    },
    material,
    estimate: {
      printHours: +(seeded(idNum, 34) * 14 + 0.5).toFixed(2),
      filamentMeters: +(seeded(idNum, 35) * 60 + 1).toFixed(2),
      filamentGrams: +(seeded(idNum, 36) * 180 + 5).toFixed(1),
      energyKwh: +(seeded(idNum, 37) * 3 + 0.1).toFixed(3),
      costUsd: +(seeded(idNum, 38) * 40 + 1.25).toFixed(2)
    },
    operator: OPERATORS[idNum % OPERATORS.length],
    qcChecklist: [
      'Bed leveled and clean',
      'Filament loaded and primed',
      'First layer adhesion verified',
      'Slicer profile matches material',
      'Enclosure temperature stable',
      'Post-print part removal verified'
    ],
    notes: 'Spec sheet auto-generated for PDF export. Sign below upon completion.',
    barcode: `||| JOB-${3000 + idNum} |||`
  };
  res.json(spec);
});

// -------- NON-VIZ 2: Slicer Config Editor (CRUD profiles, in-memory) --------
const slicerProfiles = [
  {
    id: 'SP-001',
    name: 'PLA Standard 0.2mm',
    slicer: 'PrusaSlicer',
    material: 'PLA',
    layerHeightMm: 0.2,
    infillPercent: 20,
    nozzleTempC: 210,
    bedTempC: 60,
    printSpeedMmS: 80,
    walls: 3,
    supports: false,
    createdAt: '2026-01-12T09:00:00Z',
    updatedAt: '2026-04-02T11:30:00Z'
  },
  {
    id: 'SP-002',
    name: 'PETG Strong 0.16mm',
    slicer: 'Cura',
    material: 'PETG',
    layerHeightMm: 0.16,
    infillPercent: 35,
    nozzleTempC: 235,
    bedTempC: 80,
    printSpeedMmS: 50,
    walls: 4,
    supports: false,
    createdAt: '2026-02-04T08:15:00Z',
    updatedAt: '2026-04-18T14:22:00Z'
  },
  {
    id: 'SP-003',
    name: 'ABS Carbon HighDetail',
    slicer: 'Simplify3D',
    material: 'ABS',
    layerHeightMm: 0.1,
    infillPercent: 40,
    nozzleTempC: 250,
    bedTempC: 100,
    printSpeedMmS: 45,
    walls: 5,
    supports: true,
    createdAt: '2026-02-22T10:00:00Z',
    updatedAt: '2026-05-01T16:00:00Z'
  },
  {
    id: 'SP-004',
    name: 'TPU Flexible 0.28mm',
    slicer: 'PrusaSlicer',
    material: 'TPU',
    layerHeightMm: 0.28,
    infillPercent: 15,
    nozzleTempC: 230,
    bedTempC: 50,
    printSpeedMmS: 25,
    walls: 3,
    supports: false,
    createdAt: '2026-03-10T13:00:00Z',
    updatedAt: '2026-05-10T09:45:00Z'
  },
  {
    id: 'SP-005',
    name: 'Nylon CF Industrial',
    slicer: 'Cura',
    material: 'Nylon',
    layerHeightMm: 0.2,
    infillPercent: 60,
    nozzleTempC: 270,
    bedTempC: 110,
    printSpeedMmS: 40,
    walls: 6,
    supports: true,
    createdAt: '2026-03-20T11:20:00Z',
    updatedAt: '2026-05-15T10:00:00Z'
  }
];

let nextProfileSeq = slicerProfiles.length + 1;

// GET (list)
router.get('/slicer-profiles', auth, (req, res) => {
  res.json({ profiles: slicerProfiles, count: slicerProfiles.length });
});

// POST (create)
router.post('/slicer-profiles', auth, (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.material) {
    return res.status(400).json({ error: 'name and material are required' });
  }
  const now = new Date().toISOString();
  const id = `SP-${String(nextProfileSeq++).padStart(3, '0')}`;
  const profile = {
    id,
    name: String(body.name).slice(0, 80),
    slicer: body.slicer || 'PrusaSlicer',
    material: body.material,
    layerHeightMm: +body.layerHeightMm || 0.2,
    infillPercent: Math.max(0, Math.min(100, +body.infillPercent || 20)),
    nozzleTempC: +body.nozzleTempC || 210,
    bedTempC: +body.bedTempC || 60,
    printSpeedMmS: +body.printSpeedMmS || 60,
    walls: +body.walls || 3,
    supports: !!body.supports,
    createdAt: now,
    updatedAt: now
  };
  slicerProfiles.push(profile);
  res.status(201).json(profile);
});

// PUT (update)
router.put('/slicer-profiles/:id', auth, (req, res) => {
  const idx = slicerProfiles.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Profile not found' });
  const body = req.body || {};
  const updated = {
    ...slicerProfiles[idx],
    ...(body.name !== undefined ? { name: String(body.name).slice(0, 80) } : {}),
    ...(body.slicer !== undefined ? { slicer: body.slicer } : {}),
    ...(body.material !== undefined ? { material: body.material } : {}),
    ...(body.layerHeightMm !== undefined ? { layerHeightMm: +body.layerHeightMm } : {}),
    ...(body.infillPercent !== undefined ? { infillPercent: Math.max(0, Math.min(100, +body.infillPercent)) } : {}),
    ...(body.nozzleTempC !== undefined ? { nozzleTempC: +body.nozzleTempC } : {}),
    ...(body.bedTempC !== undefined ? { bedTempC: +body.bedTempC } : {}),
    ...(body.printSpeedMmS !== undefined ? { printSpeedMmS: +body.printSpeedMmS } : {}),
    ...(body.walls !== undefined ? { walls: +body.walls } : {}),
    ...(body.supports !== undefined ? { supports: !!body.supports } : {}),
    updatedAt: new Date().toISOString()
  };
  slicerProfiles[idx] = updated;
  res.json(updated);
});

// DELETE
router.delete('/slicer-profiles/:id', auth, (req, res) => {
  const idx = slicerProfiles.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Profile not found' });
  const [removed] = slicerProfiles.splice(idx, 1);
  res.json({ deleted: true, profile: removed });
});

module.exports = router;
