import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PrintQueueGantt from '../components/PrintQueueGantt';
import BedUtilizationHeatmap from '../components/BedUtilizationHeatmap';
import PrintJobSpecPDF from '../components/PrintJobSpecPDF';
import SlicerConfigEditor from '../components/SlicerConfigEditor';

const TABS = [
  { key: 'gantt', label: 'Print Queue Gantt (Viz)', icon: '\u{1F4CA}' },
  { key: 'heatmap', label: 'Bed Utilization Heatmap (Viz)', icon: '\u{1F525}' },
  { key: 'spec', label: 'Job Spec PDF', icon: '\u{1F4C4}' },
  { key: 'slicer', label: 'Slicer Profiles (CRUD)', icon: '\u{2699}\u{FE0F}' }
];

export default function CustomViewsPage() {
  const [active, setActive] = useState('gantt');
  const navigate = useNavigate();

  return (
    <div data-testid="custom-views-page">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-header-left" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-btn" onClick={() => navigate('/')} style={{
            background: '#1e293b', border: '1px solid #334155', color: '#fff',
            padding: '6px 12px', borderRadius: 6, cursor: 'pointer'
          }}>&larr;</button>
          <div className="page-title">
            <h1 style={{ margin: 0 }}>Farm Views</h1>
            <p style={{ margin: 0, opacity: 0.7 }}>
              Operational dashboards for queue, bed utilization, job specs and slicer profiles
            </p>
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: 6,
        marginBottom: 20,
        borderBottom: '1px solid #334155',
        flexWrap: 'wrap'
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            data-testid={`tab-${t.key}`}
            onClick={() => setActive(t.key)}
            style={{
              padding: '10px 16px',
              background: active === t.key ? '#3b82f6' : 'transparent',
              border: 'none',
              borderBottom: active === t.key ? '3px solid #60a5fa' : '3px solid transparent',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: active === t.key ? 'bold' : 'normal'
            }}
          >
            <span style={{ marginRight: 6 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <div>
        {active === 'gantt' && <PrintQueueGantt />}
        {active === 'heatmap' && <BedUtilizationHeatmap />}
        {active === 'spec' && <PrintJobSpecPDF />}
        {active === 'slicer' && <SlicerConfigEditor />}
      </div>
    </div>
  );
}
