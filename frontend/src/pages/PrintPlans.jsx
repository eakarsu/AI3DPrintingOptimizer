import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';
import Modal from '../components/AIWorkspaceModal';

export const planningFields = [
  { key: 'planningLabel', label: 'Planning draft name', required: true },
  { key: 'material', label: 'Material', required: true, options: ['PLA', 'PETG', 'ABS', 'NYLON'] },
  { key: 'sourceRevision', label: 'Fictional source revision', required: true },
  { key: 'materialCatalogRevision', label: 'Fictional material catalog revision', required: true },
  { key: 'partX', label: 'Part X (mm)', type: 'number', required: true },
  { key: 'partY', label: 'Part Y (mm)', type: 'number', required: true },
  { key: 'partZ', label: 'Part Z (mm)', type: 'number', required: true },
  { key: 'machineX', label: 'Machine X capacity (mm)', type: 'number', required: true },
  { key: 'machineY', label: 'Machine Y capacity (mm)', type: 'number', required: true },
  { key: 'machineZ', label: 'Machine Z capacity (mm)', type: 'number', required: true },
  { key: 'nozzleDiameter', label: 'Nozzle diameter (mm)', type: 'number', step: '0.01', required: true },
  { key: 'maxNozzleTemp', label: 'Maximum nozzle temperature (°C)', type: 'number', required: true },
  { key: 'maxBedTemp', label: 'Maximum bed temperature (°C)', type: 'number', required: true },
  { key: 'layerHeight', label: 'Layer height (mm)', type: 'number', step: '0.01', required: true },
  { key: 'nozzleTemperature', label: 'Planned nozzle temperature (°C)', type: 'number', required: true },
  { key: 'bedTemperature', label: 'Planned bed temperature (°C)', type: 'number', required: true },
  { key: 'printerState', label: 'Fictional printer state', options: ['idle', 'maintenance', 'offline'], required: true },
  { key: 'availableMaterialGrams', label: 'Fictional available material (g)', type: 'number', required: true },
  { key: 'requiredMaterialGrams', label: 'Planned material requirement (g)', type: 'number', required: true },
  { key: 'estimatedMinutes', label: 'Planning estimate (minutes)', type: 'number', required: true },
];

const emptyForm = () => Object.fromEntries(planningFields.map((field) => [field.key, '']));
export const planningExamples = [
  {
    label: 'Demo AI · PLA fixture',
    values: { planningLabel: 'Fictional training draft · PLA calibration coupon', material: 'PLA', sourceRevision: 'FICTIONAL-STL-REV-A01', materialCatalogRevision: 'FICTIONAL-CATALOG-PLA-01', partX: '42', partY: '28', partZ: '8', machineX: '220', machineY: '220', machineZ: '250', nozzleDiameter: '0.4', maxNozzleTemp: '260', maxBedTemp: '100', layerHeight: '0.2', nozzleTemperature: '210', bedTemperature: '60', printerState: 'idle', availableMaterialGrams: '750', requiredMaterialGrams: '24', estimatedMinutes: '38' },
  },
  {
    label: 'Demo AI · PETG enclosure',
    values: { planningLabel: 'Fictional training draft · PETG sensor enclosure', material: 'PETG', sourceRevision: 'FICTIONAL-STL-REV-B07', materialCatalogRevision: 'FICTIONAL-CATALOG-PETG-03', partX: '96', partY: '62', partZ: '34', machineX: '250', machineY: '210', machineZ: '210', nozzleDiameter: '0.6', maxNozzleTemp: '285', maxBedTemp: '110', layerHeight: '0.28', nozzleTemperature: '242', bedTemperature: '78', printerState: 'idle', availableMaterialGrams: '920', requiredMaterialGrams: '118', estimatedMinutes: '176' },
  },
  {
    label: 'Demo AI · ABS bracket',
    values: { planningLabel: 'Fictional training draft · ABS mounting bracket', material: 'ABS', sourceRevision: 'FICTIONAL-STL-REV-C12', materialCatalogRevision: 'FICTIONAL-CATALOG-ABS-02', partX: '74', partY: '44', partZ: '26', machineX: '300', machineY: '300', machineZ: '300', nozzleDiameter: '0.4', maxNozzleTemp: '300', maxBedTemp: '120', layerHeight: '0.16', nozzleTemperature: '250', bedTemperature: '100', printerState: 'idle', availableMaterialGrams: '680', requiredMaterialGrams: '82', estimatedMinutes: '142' },
  },
];

function toInput(form) {
  return {
    planningLabel: form.planningLabel,
    trainingNotice: 'Fictional training/planning draft only. No print, fabrication, delivery, material result, approval, or provider action has occurred.',
    material: form.material,
    sourceRevision: form.sourceRevision,
    materialCatalogRevision: form.materialCatalogRevision,
    part: { x: Number(form.partX), y: Number(form.partY), z: Number(form.partZ) },
    machine: { x: Number(form.machineX), y: Number(form.machineY), z: Number(form.machineZ), nozzleDiameter: Number(form.nozzleDiameter), maxNozzleTemp: Number(form.maxNozzleTemp), maxBedTemp: Number(form.maxBedTemp) },
    slicer: { layerHeight: Number(form.layerHeight), nozzleTemperature: Number(form.nozzleTemperature), bedTemperature: Number(form.bedTemperature) },
    telemetry: { printerState: form.printerState, availableMaterialGrams: Number(form.availableMaterialGrams), fictional: true },
    job: { requiredMaterialGrams: Number(form.requiredMaterialGrams), estimatedMinutes: Number(form.estimatedMinutes), planningOnly: true },
  };
}

function fromInput(input = {}) {
  return {
    planningLabel: input.planningLabel || '', material: input.material || '', sourceRevision: input.sourceRevision || '', materialCatalogRevision: input.materialCatalogRevision || '',
    partX: String(input.part?.x ?? ''), partY: String(input.part?.y ?? ''), partZ: String(input.part?.z ?? ''),
    machineX: String(input.machine?.x ?? ''), machineY: String(input.machine?.y ?? ''), machineZ: String(input.machine?.z ?? ''), nozzleDiameter: String(input.machine?.nozzleDiameter ?? ''), maxNozzleTemp: String(input.machine?.maxNozzleTemp ?? ''), maxBedTemp: String(input.machine?.maxBedTemp ?? ''),
    layerHeight: String(input.slicer?.layerHeight ?? ''), nozzleTemperature: String(input.slicer?.nozzleTemperature ?? ''), bedTemperature: String(input.slicer?.bedTemperature ?? ''), printerState: input.telemetry?.printerState || '', availableMaterialGrams: String(input.telemetry?.availableMaterialGrams ?? ''), requiredMaterialGrams: String(input.job?.requiredMaterialGrams ?? ''), estimatedMinutes: String(input.job?.estimatedMinutes ?? ''),
  };
}

function PlanForm({ initial, planId, onSaved, onCancel }) {
  const [form, setForm] = useState(() => initial ? fromInput(initial) : emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const complete = useMemo(() => planningFields.every((field) => !field.required || String(form[field.key] ?? '').trim()), [form]);
  const save = async (event) => {
    event.preventDefault();
    if (!complete || saving) return;
    setSaving(true); setError('');
    try {
      const payload = toInput(form);
      const response = planId
        ? await api.patch(`/print-plan-workflows/${planId}`, payload)
        : await api.post('/print-plan-workflows', payload, { headers: { 'Idempotency-Key': `training-${Date.now()}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}` } });
      onSaved(response.data);
    } catch (failure) {
      setError(failure.response?.data?.error || 'The planning draft could not be saved.');
    } finally {
      setSaving(false);
    }
  };
  return <form className="print-plan-form" onSubmit={save} data-plan-form={planId ? 'edit' : 'new'}>
    <div className="ai-preset-bar"><div><strong>Complete fictional examples</strong><p>Each choice fills all {planningFields.length} editable fields from blank without starting a print.</p></div><div className="ai-actions">{planningExamples.map((example) => <button type="button" className="btn btn-secondary" disabled={saving} key={example.label} onClick={() => { setForm({ ...example.values }); setError(''); }}>{example.label}</button>)}</div></div>
    <div className="print-plan-notice" role="note"><strong>Planning only.</strong> Validation checks input compatibility. It does not approve, queue, fabricate, deliver, or verify a physical print.</div>
    <div className="ai-form-grid">{planningFields.map((field) => <div className="ai-form-field" key={field.key}><label htmlFor={`plan-${planId || 'new'}-${field.key}`}>{field.label}<span>{field.required ? 'Required' : 'Optional'}</span></label>{field.options ? <select id={`plan-${planId || 'new'}-${field.key}`} value={form[field.key]} disabled={saving} required={field.required} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}><option value="">Select…</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input id={`plan-${planId || 'new'}-${field.key}`} type={field.type || 'text'} step={field.step} value={form[field.key]} disabled={saving} required={field.required} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} />}</div>)}</div>
    {error && <div className="ai-alert" role="alert">{error}</div>}
    <div className="ai-workspace-footer"><p className="ai-muted">All values are explicitly fictional training inputs.</p><div className="ai-actions"><button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button><button type="submit" className="btn btn-primary" disabled={!complete || saving}>{saving ? 'Saving draft…' : planId ? 'Save changes' : 'Save planning draft'}</button></div></div>
  </form>;
}

export default function PrintPlans({initialPlanId,initialMode}) {
  const appliedIntent=useRef(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const response = await api.get('/print-plan-workflows', { params: { scope: 'mine' } });
      if (!Array.isArray(response.data)) throw new Error('The planning API returned an invalid response.');
      setPlans(response.data);
    } catch (failure) {
      setPlans([]); setLoadError(failure.response?.data?.error || failure.message || 'Planning drafts are unavailable.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(()=>{const key=`${initialPlanId}:${initialMode}`;if(!loading&&!loadError&&initialPlanId&&appliedIntent.current!==key){const plan=plans.find(row=>String(row.id)===String(initialPlanId));if(plan){appliedIntent.current=key;setSelected(plan);setMode(['edit','delete'].includes(initialMode)?initialMode:'details');}}},[initialPlanId,initialMode,loading,loadError,plans]);
  const close = () => { setMode(null); setSelected(null); setDeleting(false); setDeleteError(''); };
  const saved = async (item) => { toast.success(`Planning draft #${item.id} saved`); close(); await load(); };
  const remove = async () => {
    if (!selected || deleting) return;
    setDeleting(true); setDeleteError('');
    try { await api.delete(`/print-plan-workflows/${selected.id}`); toast.success('Planning draft deleted'); close(); await load(); }
    catch (failure) { setDeleteError(failure.response?.data?.error || 'The planning draft could not be deleted.'); setDeleting(false); }
  };
  return <section className="print-plans-page">
    <div className="page-header"><div className="page-title"><h1>Print planning drafts</h1><p>Actor-owned, persisted compatibility planning with approval and evidence gates preserved.</p></div><button type="button" className="btn btn-primary" onClick={() => setMode('new')}>+ New planning draft</button></div>
    <div className="print-plan-notice" role="note"><strong>No execution claims.</strong> These are fictional training/planning drafts. “Validated” means only that the supplied fictional inputs passed deterministic compatibility checks.</div>
    <div className="table-container">{loading ? <div className="table-empty" role="status">Loading planning drafts…</div> : loadError ? <div className="native-load-error" role="alert"><strong>Planning drafts could not be loaded.</strong><p>{loadError}</p><button type="button" className="btn btn-secondary" onClick={load}>Retry</button></div> : plans.length === 0 ? <div className="table-empty">No planning drafts have been saved for this signed-in actor.</div> : <><div className="table-meta"><span>{plans.length} actor-owned persisted records</span><span>Unsubmitted planning only</span></div><table className="data-table"><thead><tr><th>Draft</th><th>Material</th><th>Status</th><th>Part</th><th>Updated</th></tr></thead><tbody>{plans.map((plan) => <tr key={plan.id} onClick={() => { setSelected(plan); setMode('details'); }} data-plan-id={plan.id}><td><strong>{plan.input?.planningLabel || `Planning draft #${plan.id}`}</strong><br /><small>{plan.input?.sourceRevision}</small></td><td>{plan.input?.material}</td><td><span className={`status-badge status-${plan.status}`}>{plan.status}</span></td><td>{plan.input?.part ? `${plan.input.part.x} × ${plan.input.part.y} × ${plan.input.part.z} mm` : '—'}</td><td>{new Date(plan.updated_at).toLocaleString()}</td></tr>)}</tbody></table></>}</div>
    {mode === 'new' && <Modal title="New fictional planning draft" onClose={close}><PlanForm onSaved={saved} onCancel={close} /></Modal>}
    {mode === 'edit' && selected && <Modal title={`Edit planning draft #${selected.id}`} onClose={close}><PlanForm initial={selected.input} planId={selected.id} onSaved={saved} onCancel={close} /></Modal>}
    {mode === 'details' && selected && <Modal title={`Planning draft #${selected.id}`} onClose={close} footer={<><button type="button" className="btn btn-secondary" onClick={close}>Cancel</button><button type="button" className="btn btn-secondary" onClick={() => setMode('edit')}>Edit</button><button type="button" className="btn btn-danger" onClick={() => setMode('delete')}>Delete</button></>}><div className="print-plan-detail"><div className="print-plan-notice"><strong>Fictional planning draft — not executed.</strong><br />{selected.input?.trainingNotice}</div><dl className="ai-report-facts"><div><dt>Name</dt><dd>{selected.input?.planningLabel}</dd></div><div><dt>Status</dt><dd>{selected.status}</dd></div><div><dt>Material</dt><dd>{selected.input?.material}</dd></div><div><dt>Compatible</dt><dd>{selected.decision?.compatible ? 'Yes — inputs only' : 'No'}</dd></div><div><dt>Source revision</dt><dd>{selected.input?.sourceRevision}</dd></div><div><dt>Catalog revision</dt><dd>{selected.input?.materialCatalogRevision}</dd></div></dl><h3>Compatibility decision</h3>{selected.decision?.violations?.length ? <ul>{selected.decision.violations.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No deterministic input compatibility violations. Independent approval and physical evidence are still required before any action or outcome claim.</p>}</div></Modal>}
    {mode === 'delete' && selected && <Modal title="Delete planning draft?" onClose={close} footer={<><button type="button" className="btn btn-secondary" onClick={() => setMode('details')} disabled={deleting}>Cancel</button><button type="button" className="btn btn-danger" onClick={remove} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete draft'}</button></>}><p>This permanently deletes only actor-owned unsubmitted draft #{selected.id}. Submitted, approved, or evidence-bearing records cannot be deleted here.</p>{deleteError && <div className="ai-alert" role="alert">{deleteError}</div>}</Modal>}
  </section>;
}
