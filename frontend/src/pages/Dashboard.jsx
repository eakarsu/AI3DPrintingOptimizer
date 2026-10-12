import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { FEATURES } from '../config/features';

export default function Dashboard() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({});
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  const [countsLoading, setCountsLoading] = useState(true);
  const [countsError, setCountsError] = useState('');
  const [analyticsError, setAnalyticsError] = useState('');
  const countsRequest = useRef(null), analyticsRequest = useRef(null);
  const fetchCounts = useCallback(async () => {
    countsRequest.current?.abort(); const controller = new AbortController(); countsRequest.current = controller;
    setCountsLoading(true); setCountsError('');
    try {
      const values = await Promise.all(FEATURES.map(async (feature) => {
        const res = await api.get(feature.apiPath, { params: { page: 1, limit: 1 }, signal: controller.signal });
        const total = res.data?.pagination?.total ?? (Array.isArray(res.data) ? res.data.length : undefined);
        if (total === undefined || total === null || !Number.isInteger(Number(total)) || Number(total) < 0) throw Error('The record service returned an invalid count.');
        return [feature.key, Number(total)];
      }));
      if (countsRequest.current === controller && !controller.signal.aborted) setCounts(Object.fromEntries(values));
    } catch (failure) {
      if (countsRequest.current === controller && !controller.signal.aborted) setCountsError(failure.response?.data?.message || failure.message || 'Record totals could not be loaded.');
    } finally { if (countsRequest.current === controller && !controller.signal.aborted) { countsRequest.current = null; setCountsLoading(false); } }
  }, []);
  const fetchAnalytics = useCallback(async () => {
    analyticsRequest.current?.abort(); const controller = new AbortController(); analyticsRequest.current = controller;
    setLoadingAnalytics(true); setAnalyticsError('');
    try {
      const res = await api.get('/analytics/fleet-overview', { signal: controller.signal });
      if (!res.data?.jobs || !res.data?.printers || !res.data?.quality || !res.data?.maintenance || !res.data?.ai_usage) throw Error('The analytics service returned an invalid overview.');
      if (analyticsRequest.current === controller && !controller.signal.aborted) setAnalytics(res.data);
    } catch (failure) { if (analyticsRequest.current === controller && !controller.signal.aborted) { setAnalytics(null); setAnalyticsError(failure.response?.data?.message || failure.message || 'Analytics could not be loaded.'); } }
    finally { if (analyticsRequest.current === controller && !controller.signal.aborted) { analyticsRequest.current = null; setLoadingAnalytics(false); } }
  }, []);
  useEffect(() => { fetchCounts(); fetchAnalytics(); return () => { countsRequest.current?.abort(); analyticsRequest.current?.abort(); countsRequest.current = null; analyticsRequest.current = null; }; }, [fetchCounts, fetchAnalytics]);

  const totalItems = Object.values(counts).reduce((a, b) => a + b, 0);
  const aiFeatures = FEATURES.filter(f => f.isAI);
  const nonAiFeatures = FEATURES.filter(f => !f.isAI);

  return (
    <div>
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>AI-powered 3D printing optimization and fleet management</p>
      </div>

      {countsError && <section role="alert" className="native-load-error"><strong>Record totals could not be loaded.</strong><p>{countsError}</p><button type="button" className="btn btn-secondary" onClick={fetchCounts}>Retry record totals</button></section>}
      {analyticsError && <section role="alert" className="native-load-error"><strong>Fleet analytics could not be loaded.</strong><p>{analyticsError}</p><button type="button" className="btn btn-secondary" onClick={fetchAnalytics}>Retry fleet analytics</button></section>}
      {/* Key Metrics */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-label">Total Records</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{countsLoading ? 'Loading…' : countsError ? 'Unavailable' : totalItems}</div>
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
            {analytics?.jobs?.success_rate_pct !== undefined && analytics?.jobs?.success_rate_pct !== null ? `${analytics.jobs.success_rate_pct}%` : '—'}
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
              <span className="feature-count">{countsLoading ? 'Loading…' : countsError ? 'Unavailable' : `${counts[f.key]} records`}</span>
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
              <span className="feature-count">{countsLoading ? 'Loading…' : countsError ? 'Unavailable' : `${counts[f.key]} records`}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
