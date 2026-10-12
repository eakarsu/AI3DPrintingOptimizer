import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AIWorkspace from '../components/AIWorkspace';
import features from '../components/aiWorkspaceFeatures.json';
import '../components/AIWorkspace.css';

const FEATURE_IDS = [
  'gap-ai-build-time-estimator-material',
  'gap-ai-cost-optimization-material-waste',
  'gap-ai-pre-print-quality-defect',
];

export default function AIPrintingTools() {
  const navigate = useNavigate();
  const available = useMemo(() => FEATURE_IDS.map((id) => features.find((item) => item.id === id)).filter(Boolean), []);
  const [activeId, setActiveId] = useState(FEATURE_IDS[0]);
  const selected = available.find((item) => item.id === activeId) || available[0];
  return <div>
    <div className="page-header">
      <div className="page-header-left"><button className="back-btn" onClick={() => navigate('/')}>&#x2190;</button><div className="page-title"><h1>✦ AI printing reports</h1><p>Explicit OpenRouter advisory reports. Review output before any separately authorized action.</p></div></div>
    </div>
    <nav className="ai-tool-tabs" aria-label="AI report type">{available.map((feature) => <button type="button" key={feature.id} className={`btn ${selected?.id === feature.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveId(feature.id)}>{feature.title.replace(/^No AI /, '').replace(/^AI /, '')}</button>)}</nav>
    {selected ? <AIWorkspace key={selected.id} feature={selected} /> : <div className="ai-alert" role="alert">No configured AI report is available.</div>}
  </div>;
}
