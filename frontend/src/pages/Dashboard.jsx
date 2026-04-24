import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { FEATURES } from '../config/features';

export default function Dashboard() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({});

  useEffect(() => {
    const fetchCounts = async () => {
      const results = {};
      for (const f of FEATURES) {
        try {
          const res = await api.get(f.apiPath);
          results[f.key] = res.data.length;
        } catch {
          results[f.key] = 0;
        }
      }
      setCounts(results);
    };
    fetchCounts();
  }, []);

  const totalItems = Object.values(counts).reduce((a, b) => a + b, 0);
  const aiFeatures = FEATURES.filter(f => f.isAI);
  const nonAiFeatures = FEATURES.filter(f => !f.isAI);

  return (
    <div>
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>AI-powered 3D printing optimization and fleet management</p>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-label">Total Features</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{FEATURES.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">AI Features</div>
          <div className="stat-value" style={{ color: 'var(--purple)' }}>{aiFeatures.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Management Features</div>
          <div className="stat-value" style={{ color: 'var(--cyan)' }}>{nonAiFeatures.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Records</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{totalItems}</div>
        </div>
      </div>

      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>AI-Powered Features</h2>
      <div className="feature-grid" style={{ marginBottom: '32px' }}>
        {aiFeatures.map((f) => (
          <div key={f.key} className="feature-card" onClick={() => navigate(`/${f.key}`)}>
            <div className="feature-card-icon" style={{ background: `${f.color}20` }}>
              {f.icon}
            </div>
            <h3>{f.name}</h3>
            <p>{f.description}</p>
            <div className="feature-card-footer">
              <span className="feature-tag tag-ai">AI Powered</span>
              <span className="feature-count">{counts[f.key] || 0} records</span>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Management Features</h2>
      <div className="feature-grid">
        {nonAiFeatures.map((f) => (
          <div key={f.key} className="feature-card" onClick={() => navigate(`/${f.key}`)}>
            <div className="feature-card-icon" style={{ background: `${f.color}20` }}>
              {f.icon}
            </div>
            <h3>{f.name}</h3>
            <p>{f.description}</p>
            <div className="feature-card-footer">
              <span className="feature-tag tag-manage">Management</span>
              <span className="feature-count">{counts[f.key] || 0} records</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
