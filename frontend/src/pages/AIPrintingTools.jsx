import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';

/**
 * AI Printing Tools page — combines three new AI endpoints:
 *   POST /api/ai/build-time-estimation
 *   POST /api/ai/cost-optimization
 *   POST /api/ai/quality-prediction
 *
 * One page, three tabs. Reuses the project's `api` axios wrapper and existing
 * className conventions (page-header, btn, btn-primary, table-container, etc.).
 */

const TABS = [
  { key: 'build-time', label: 'Build Time' },
  { key: 'cost', label: 'Cost Optimization' },
  { key: 'quality', label: 'Quality Prediction' },
];

const DEFAULT_BUILD_TIME = {
  material: 'PLA',
  volume_cm3: 50,
  layer_height: 0.2,
  infill_density: 20,
  print_speed: 60,
  geometry_complexity: 'medium',
  support_required: false,
};

const DEFAULT_COST = {
  material: 'PLA',
  volume_cm3: 50,
  infill_density: 20,
  layer_height: 0.2,
  support_type: 'none',
  electricity_rate_kwh_usd: 0.13,
  material_cost_per_kg_usd: 25,
  batch_size: 1,
};

const DEFAULT_QUALITY = {
  material: 'PLA',
  geometry_type: 'mechanical-part',
  layer_height: 0.2,
  nozzle_temp: 210,
  bed_temp: 60,
  print_speed: 60,
  infill_density: 20,
  printer_age_hours: 200,
  ambient_humidity_percent: 45,
};

function ResultPanel({ data }) {
  if (!data) return null;
  return (
    <div className="ai-nested" style={{ marginTop: '16px', padding: '16px', background: 'var(--surface, #1a1a1a)', borderRadius: '8px' }}>
      <h3 style={{ marginBottom: '12px' }}>Result</h3>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '13px' }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function NumberOrTextInput({ value, onChange, type = 'text', step }) {
  return (
    <input
      type={type}
      step={step}
      value={value ?? ''}
      onChange={(e) => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
      className="form-input"
      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border, #333)', background: 'var(--bg, #111)', color: 'var(--text, #eee)' }}
    />
  );
}

function FieldRow({ label, children }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

export default function AIPrintingTools() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('build-time');
  const [buildForm, setBuildForm] = useState(DEFAULT_BUILD_TIME);
  const [costForm, setCostForm] = useState(DEFAULT_COST);
  const [qualityForm, setQualityForm] = useState(DEFAULT_QUALITY);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const setBuildField = (k, v) => setBuildForm({ ...buildForm, [k]: v });
  const setCostField = (k, v) => setCostForm({ ...costForm, [k]: v });
  const setQualityField = (k, v) => setQualityForm({ ...qualityForm, [k]: v });

  const submit = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      let url, payload;
      if (activeTab === 'build-time') {
        url = '/ai/build-time-estimation';
        payload = buildForm;
      } else if (activeTab === 'cost') {
        url = '/ai/cost-optimization';
        payload = costForm;
      } else {
        url = '/ai/quality-prediction';
        payload = qualityForm;
      }
      const res = await api.post(url, payload);
      setResult(res.data);
      toast.success('Analysis complete');
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || err.message;
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (key) => {
    setActiveTab(key);
    setResult(null);
    setError(null);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <button className="back-btn" onClick={() => navigate('/')}>&#x2190;</button>
          <div className="page-title">
            <h1>&#x2728; AI Printing Tools</h1>
            <p>Estimate build time, optimize cost, and predict quality before printing</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border, #333)', paddingBottom: '8px' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`btn ${activeTab === t.key ? 'btn-primary' : 'btn-ghost'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="table-container" style={{ padding: '16px' }}>
        {activeTab === 'build-time' && (
          <div>
            <h2>Build Time Estimation</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Predict print duration and filament usage from slicer + geometry parameters.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <FieldRow label="Material"><NumberOrTextInput value={buildForm.material} onChange={(v) => setBuildField('material', v)} /></FieldRow>
              <FieldRow label="Volume (cm³)"><NumberOrTextInput type="number" step="0.1" value={buildForm.volume_cm3} onChange={(v) => setBuildField('volume_cm3', v)} /></FieldRow>
              <FieldRow label="Layer Height (mm)"><NumberOrTextInput type="number" step="0.05" value={buildForm.layer_height} onChange={(v) => setBuildField('layer_height', v)} /></FieldRow>
              <FieldRow label="Infill Density (%)"><NumberOrTextInput type="number" value={buildForm.infill_density} onChange={(v) => setBuildField('infill_density', v)} /></FieldRow>
              <FieldRow label="Print Speed (mm/s)"><NumberOrTextInput type="number" value={buildForm.print_speed} onChange={(v) => setBuildField('print_speed', v)} /></FieldRow>
              <FieldRow label="Geometry Complexity"><NumberOrTextInput value={buildForm.geometry_complexity} onChange={(v) => setBuildField('geometry_complexity', v)} /></FieldRow>
              <FieldRow label="Support Required">
                <select
                  value={buildForm.support_required ? 'yes' : 'no'}
                  onChange={(e) => setBuildField('support_required', e.target.value === 'yes')}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border, #333)', background: 'var(--bg, #111)', color: 'var(--text, #eee)' }}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </FieldRow>
            </div>
          </div>
        )}

        {activeTab === 'cost' && (
          <div>
            <h2>Cost Optimization</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Estimate per-part cost and discover savings on material, infill, support, batching.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <FieldRow label="Material"><NumberOrTextInput value={costForm.material} onChange={(v) => setCostField('material', v)} /></FieldRow>
              <FieldRow label="Volume (cm³)"><NumberOrTextInput type="number" step="0.1" value={costForm.volume_cm3} onChange={(v) => setCostField('volume_cm3', v)} /></FieldRow>
              <FieldRow label="Infill Density (%)"><NumberOrTextInput type="number" value={costForm.infill_density} onChange={(v) => setCostField('infill_density', v)} /></FieldRow>
              <FieldRow label="Layer Height (mm)"><NumberOrTextInput type="number" step="0.05" value={costForm.layer_height} onChange={(v) => setCostField('layer_height', v)} /></FieldRow>
              <FieldRow label="Support Type"><NumberOrTextInput value={costForm.support_type} onChange={(v) => setCostField('support_type', v)} /></FieldRow>
              <FieldRow label="Electricity Rate ($/kWh)"><NumberOrTextInput type="number" step="0.01" value={costForm.electricity_rate_kwh_usd} onChange={(v) => setCostField('electricity_rate_kwh_usd', v)} /></FieldRow>
              <FieldRow label="Material Cost ($/kg)"><NumberOrTextInput type="number" step="0.01" value={costForm.material_cost_per_kg_usd} onChange={(v) => setCostField('material_cost_per_kg_usd', v)} /></FieldRow>
              <FieldRow label="Batch Size"><NumberOrTextInput type="number" value={costForm.batch_size} onChange={(v) => setCostField('batch_size', v)} /></FieldRow>
            </div>
          </div>
        )}

        {activeTab === 'quality' && (
          <div>
            <h2>Quality Prediction</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Predict surface finish, dimensional accuracy, and defect risk before starting the print.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <FieldRow label="Material"><NumberOrTextInput value={qualityForm.material} onChange={(v) => setQualityField('material', v)} /></FieldRow>
              <FieldRow label="Geometry Type"><NumberOrTextInput value={qualityForm.geometry_type} onChange={(v) => setQualityField('geometry_type', v)} /></FieldRow>
              <FieldRow label="Layer Height (mm)"><NumberOrTextInput type="number" step="0.05" value={qualityForm.layer_height} onChange={(v) => setQualityField('layer_height', v)} /></FieldRow>
              <FieldRow label="Nozzle Temp (°C)"><NumberOrTextInput type="number" value={qualityForm.nozzle_temp} onChange={(v) => setQualityField('nozzle_temp', v)} /></FieldRow>
              <FieldRow label="Bed Temp (°C)"><NumberOrTextInput type="number" value={qualityForm.bed_temp} onChange={(v) => setQualityField('bed_temp', v)} /></FieldRow>
              <FieldRow label="Print Speed (mm/s)"><NumberOrTextInput type="number" value={qualityForm.print_speed} onChange={(v) => setQualityField('print_speed', v)} /></FieldRow>
              <FieldRow label="Infill Density (%)"><NumberOrTextInput type="number" value={qualityForm.infill_density} onChange={(v) => setQualityField('infill_density', v)} /></FieldRow>
              <FieldRow label="Printer Age (hours)"><NumberOrTextInput type="number" value={qualityForm.printer_age_hours} onChange={(v) => setQualityField('printer_age_hours', v)} /></FieldRow>
              <FieldRow label="Ambient Humidity (%)"><NumberOrTextInput type="number" value={qualityForm.ambient_humidity_percent} onChange={(v) => setQualityField('ambient_humidity_percent', v)} /></FieldRow>
            </div>
          </div>
        )}

        <div style={{ marginTop: '20px' }}>
          <button className="btn btn-fill" disabled={loading} onClick={submit}>
            {loading ? 'Analyzing...' : '✦ Run AI Analysis'}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: '16px', padding: '12px', borderRadius: '4px', background: 'rgba(220,38,38,0.15)', color: 'var(--danger, #f87171)', border: '1px solid var(--danger, #f87171)' }}>
            Error: {error}
          </div>
        )}

        {result && <ResultPanel data={result} />}
      </div>
    </div>
  );
}
