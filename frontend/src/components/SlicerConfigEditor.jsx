import React, { useEffect, useState } from 'react';
import api from '../services/api';

const SLICERS = ['PrusaSlicer', 'Cura', 'Simplify3D', 'Bambu Studio', 'OrcaSlicer'];
const MATERIALS = ['PLA', 'PETG', 'ABS', 'TPU', 'Nylon', 'PEEK', 'PC', 'ASA'];

const EMPTY = {
  name: '',
  slicer: 'PrusaSlicer',
  material: 'PLA',
  layerHeightMm: 0.2,
  infillPercent: 20,
  nozzleTempC: 210,
  bedTempC: 60,
  printSpeedMmS: 60,
  walls: 3,
  supports: false
};

export default function SlicerConfigEditor() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/custom-views/slicer-profiles')
      .then(r => setProfiles(r.data.profiles || []))
      .catch(e => setErr(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleEdit = (p) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      slicer: p.slicer,
      material: p.material,
      layerHeightMm: p.layerHeightMm,
      infillPercent: p.infillPercent,
      nozzleTempC: p.nozzleTempC,
      bedTempC: p.bedTempC,
      printSpeedMmS: p.printSpeedMmS,
      walls: p.walls,
      supports: p.supports
    });
  };

  const handleReset = () => {
    setEditingId(null);
    setForm(EMPTY);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.material) {
      setErr('Name and material are required');
      return;
    }
    setSaving(true);
    setErr('');
    const req = editingId
      ? api.put(`/custom-views/slicer-profiles/${editingId}`, form)
      : api.post('/custom-views/slicer-profiles', form);
    req.then(() => {
      handleReset();
      load();
    })
      .catch(e => setErr(e.response?.data?.error || e.message))
      .finally(() => setSaving(false));
  };

  const handleDelete = (id) => {
    if (!window.confirm(`Delete profile ${id}?`)) return;
    api.delete(`/custom-views/slicer-profiles/${id}`)
      .then(() => {
        if (editingId === id) handleReset();
        load();
      })
      .catch(e => setErr(e.response?.data?.error || e.message));
  };

  const inputStyle = {
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#fff',
    padding: '6px 10px',
    borderRadius: 6,
    width: '100%'
  };
  const labelStyle = { display: 'block', fontSize: 11, opacity: 0.7, marginBottom: 2 };

  return (
    <div data-testid="slicer-config-editor">
      <div style={{ marginBottom: 12, opacity: 0.85 }}>
        Slicer Config Profiles &middot; {profiles.length} profile{profiles.length === 1 ? '' : 's'}
      </div>

      {err && (
        <div style={{ padding: 10, marginBottom: 12, background: '#7f1d1d', color: '#fff', borderRadius: 6 }}>
          {err}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Profiles list */}
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Profiles</h3>
          {loading && <div>Loading...</div>}
          {!loading && profiles.length === 0 && <div style={{ opacity: 0.6 }}>No profiles.</div>}
          {!loading && profiles.map(p => (
            <div
              key={p.id}
              data-testid={`profile-${p.id}`}
              style={{
                background: editingId === p.id ? '#1e3a5f' : '#1e293b',
                padding: 10,
                borderRadius: 6,
                marginBottom: 8,
                border: editingId === p.id ? '1px solid #3b82f6' : '1px solid transparent'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{p.name}</strong>
                  <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>
                    {p.id} &middot; {p.slicer} &middot; {p.material}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => handleEdit(p)}
                    data-testid={`edit-${p.id}`}
                    style={{ background: '#3b82f6', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                  >Edit</button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    data-testid={`delete-${p.id}`}
                    style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                  >Delete</button>
                </div>
              </div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                Layer {p.layerHeightMm}mm &middot; Infill {p.infillPercent}% &middot;
                Nozzle {p.nozzleTempC}°C &middot; Bed {p.bedTempC}°C &middot;
                Speed {p.printSpeedMmS}mm/s &middot; Walls {p.walls} &middot;
                Supports {p.supports ? 'Yes' : 'No'}
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? `Edit ${editingId}` : 'Create New Profile'}</h3>

          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Name *</label>
            <input data-testid="form-name" style={inputStyle} value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>Slicer</label>
              <select style={inputStyle} value={form.slicer}
                onChange={e => setForm({ ...form, slicer: e.target.value })}>
                {SLICERS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Material *</label>
              <select data-testid="form-material" style={inputStyle} value={form.material}
                onChange={e => setForm({ ...form, material: e.target.value })}>
                {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>Layer (mm)</label>
              <input type="number" step="0.01" style={inputStyle} value={form.layerHeightMm}
                onChange={e => setForm({ ...form, layerHeightMm: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Infill %</label>
              <input type="number" min="0" max="100" style={inputStyle} value={form.infillPercent}
                onChange={e => setForm({ ...form, infillPercent: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Walls</label>
              <input type="number" min="1" style={inputStyle} value={form.walls}
                onChange={e => setForm({ ...form, walls: e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>Nozzle °C</label>
              <input type="number" style={inputStyle} value={form.nozzleTempC}
                onChange={e => setForm({ ...form, nozzleTempC: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Bed °C</label>
              <input type="number" style={inputStyle} value={form.bedTempC}
                onChange={e => setForm({ ...form, bedTempC: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Speed mm/s</label>
              <input type="number" style={inputStyle} value={form.printSpeedMmS}
                onChange={e => setForm({ ...form, printSpeedMmS: e.target.value })} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13 }}>
              <input type="checkbox" checked={form.supports}
                onChange={e => setForm({ ...form, supports: e.target.checked })}
                style={{ marginRight: 6 }} />
              Supports enabled
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={saving}
              data-testid="form-submit"
              style={{
                background: editingId ? '#f59e0b' : '#10b981',
                border: 'none', color: '#fff',
                padding: '8px 16px', borderRadius: 6,
                cursor: 'pointer', fontWeight: 'bold'
              }}>
              {saving ? 'Saving...' : (editingId ? 'Update Profile' : 'Create Profile')}
            </button>
            {editingId && (
              <button type="button" onClick={handleReset}
                style={{ background: '#475569', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
