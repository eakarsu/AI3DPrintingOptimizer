import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { FEATURES } from '../config/features';

export default function Dashboard() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({});
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      const results = {};
      for (const f of FEATURES) {
        try {
          const res = await api.get(f.apiPath, { params: { page: 1, limit: 1 } });
          // Handle paginated { data, pagination } response
          if (res.data?.pagination?.total !== undefined) {
            results[f.key] = res.data.pagination.total;
          } else if (Array.isArray(res.data)) {
            results[f.key] = res.data.length;
          } else {
            results[f.key] = 0;
          }
        } catch {
          results[f.key] = 0;
        }
      }
      setCounts(results);
    };

    const fetchAnalytics = async () => {
      try {
        const res = await api.get('/analytics/fleet-overview');
        setAnalytics(res.data);
      } catch {
        setAnalytics(null);
      } finally {
        setLoadingAnalytics(false);
      }
    };

    fetchCounts();
    fetchAnalytics();
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

      {/* Key Metrics */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-label">Total Records</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{totalItems}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Print Jobs</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>
            {analytics?.jobs?.active_jobs ?? '—'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Success Rate</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {analytics?.jobs?.success_rate_pct ? `${analytics.jobs.success_rate_pct}%` : '—'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">AI Calls Total</div>
          <div className="stat-value" style={{ color: 'var(--purple)' }}>
            {analytics?.ai_usage?.total_ai_calls ?? '—'}
          </div>
        </div>
      </div>

      {/* Fleet Status Row */}
      {analytics && (
        <div className="analytics-row" style={{ marginBottom: '32px' }}>
          <div className="analytics-card">
            <h3>Printer Fleet</h3>
            <div className="analytics-grid-small">
              <div><span className="metric-label">Total</span><span className="metric-val">{analytics.printers.total_printers}</span></div>
              <div><span className="metric-label">Printing</span><span className="metric-val" style={{ color: 'var(--success)' }}>{analytics.printers.printing_count}</span></div>
              <div><span className="metric-label">Idle</span><span className="metric-val" style={{ color: 'var(--text-secondary)' }}>{analytics.printers.idle_count}</span></div>
              <div><span className="metric-label">Maintenance</span><span className="metric-val" style={{ color: 'var(--warning)' }}>{analytics.printers.maintenance_count}</span></div>
              <div><span className="metric-label">Offline</span><span className="metric-val" style={{ color: 'var(--danger)' }}>{analytics.printers.offline_count}</span></div>
              <div><span className="metric-label">Fleet Hours</span><span className="metric-val">{analytics.printers.total_fleet_hours}h</span></div>
            </div>
          </div>

          <div className="analytics-card">
            <h3>Print Jobs</h3>
            <div className="analytics-grid-small">
              <div><span className="metric-label">Total</span><span className="metric-val">{analytics.jobs.total_jobs}</span></div>
              <div><span className="metric-label">Queued</span><span className="metric-val" style={{ color: 'var(--accent)' }}>{analytics.jobs.queued_jobs}</span></div>
              <div><span className="metric-label">Active</span><span className="metric-val" style={{ color: 'var(--warning)' }}>{analytics.jobs.active_jobs}</span></div>
              <div><span className="metric-label">Completed</span><span className="metric-val" style={{ color: 'var(--success)' }}>{analytics.jobs.completed_jobs}</span></div>
              <div><span className="metric-label">Failed</span><span className="metric-val" style={{ color: 'var(--danger)' }}>{analytics.jobs.failed_jobs}</span></div>
              <div><span className="metric-label">Success %</span><span className="metric-val" style={{ color: 'var(--success)' }}>{analytics.jobs.success_rate_pct ?? 'N/A'}%</span></div>
            </div>
          </div>

          <div className="analytics-card">
            <h3>Quality & Maintenance</h3>
            <div className="analytics-grid-small">
              <div><span className="metric-label">Avg Quality</span><span className="metric-val" style={{ color: 'var(--cyan)' }}>{analytics.quality.avg_quality_score ?? 'N/A'}/10</span></div>
              <div><span className="metric-label">Quality Tests</span><span className="metric-val">{analytics.quality.total_quality_assessments}</span></div>
              <div><span className="metric-label">Maintenance Cost</span><span className="metric-val">${analytics.maintenance.total_cost_usd}</span></div>
              <div><span className="metric-label">Overdue</span><span className="metric-val" style={{ color: 'var(--danger)' }}>{analytics.maintenance.overdue}</span></div>
              <div><span className="metric-label">Scheduled</span><span className="metric-val" style={{ color: 'var(--warning)' }}>{analytics.maintenance.scheduled}</span></div>
              <div><span className="metric-label">AI Calls</span><span className="metric-val" style={{ color: 'var(--purple)' }}>{analytics.ai_usage.total_ai_calls}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Material Usage */}
      {analytics?.material_usage?.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>Material Usage Breakdown</h2>
          <div className="material-usage-grid">
            {analytics.material_usage.slice(0, 6).map(m => (
              <div className="material-usage-card" key={m.material_type}>
                <div className="material-name">{m.material_type}</div>
                <div className="material-stats">
                  <span>{m.job_count} jobs</span>
                  <span>{m.total_weight_g}g used</span>
                  <span style={{ color: 'var(--success)' }}>{m.completed} done</span>
                  {m.failed > 0 && <span style={{ color: 'var(--danger)' }}>{m.failed} failed</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              <span className="feature-count">{counts[f.key] ?? '...'} records</span>
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
              <span className="feature-count">{counts[f.key] ?? '...'} records</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
