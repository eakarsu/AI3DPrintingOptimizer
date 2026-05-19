import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function Analytics() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [utilization, setUtilization] = useState(null);
  const [consumption, setConsumption] = useState(null);
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [ov, ut, co, mx] = await Promise.all([
          api.get('/analytics/fleet-overview'),
          api.get('/analytics/printer-utilization'),
          api.get('/analytics/material-consumption?period=30'),
          api.get('/analytics/success-rate-matrix'),
        ]);
        setOverview(ov.data);
        setUtilization(ut.data);
        setConsumption(co.data);
        setMatrix(mx.data);
      } catch (err) {
        console.error('Analytics load error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  const tabs = [
    { key: 'overview', label: 'Fleet Overview' },
    { key: 'utilization', label: 'Printer Utilization' },
    { key: 'consumption', label: 'Material Consumption' },
    { key: 'matrix', label: 'Success Matrix' },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <button className="back-btn" onClick={() => navigate('/')}>&#x2190;</button>
          <div className="page-title">
            <h1>&#x1F4CA; Fleet Analytics</h1>
            <p>Comprehensive insights across your entire 3D printing operation</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="analytics-tabs">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`analytics-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && overview && (
        <div>
          <div className="analytics-kpi-row">
            <div className="kpi-card">
              <div className="kpi-label">Total Printers</div>
              <div className="kpi-value">{overview.printers.total_printers}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Fleet Hours</div>
              <div className="kpi-value" style={{ color: 'var(--accent)' }}>{overview.printers.total_fleet_hours}h</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Success Rate</div>
              <div className="kpi-value" style={{ color: 'var(--success)' }}>{overview.jobs.success_rate_pct ?? 'N/A'}%</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Avg Quality</div>
              <div className="kpi-value" style={{ color: 'var(--cyan)' }}>{overview.quality.avg_quality_score ?? 'N/A'}/10</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Maintenance Cost</div>
              <div className="kpi-value" style={{ color: 'var(--warning)' }}>${overview.maintenance.total_cost_usd}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">AI Calls</div>
              <div className="kpi-value" style={{ color: 'var(--purple)' }}>{overview.ai_usage.total_ai_calls}</div>
            </div>
          </div>

          <div className="analytics-two-col">
            <div className="analytics-section-card">
              <h3>Printer Status Distribution</h3>
              <div className="status-dist">
                {[
                  { label: 'Printing', val: overview.printers.printing_count, color: 'var(--success)' },
                  { label: 'Idle', val: overview.printers.idle_count, color: 'var(--text-secondary)' },
                  { label: 'Maintenance', val: overview.printers.maintenance_count, color: 'var(--warning)' },
                  { label: 'Offline', val: overview.printers.offline_count, color: 'var(--danger)' },
                ].map(s => (
                  <div className="status-dist-row" key={s.label}>
                    <span className="status-dist-label">{s.label}</span>
                    <div className="status-dist-bar-wrap">
                      <div
                        className="status-dist-bar"
                        style={{
                          width: `${(s.val / overview.printers.total_printers * 100) || 0}%`,
                          background: s.color,
                        }}
                      />
                    </div>
                    <span className="status-dist-val" style={{ color: s.color }}>{s.val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="analytics-section-card">
              <h3>Jobs by Priority</h3>
              <div className="status-dist">
                {(overview.jobs_by_priority || []).map(p => (
                  <div className="status-dist-row" key={p.priority}>
                    <span className="status-dist-label">{p.priority || 'Unknown'}</span>
                    <div className="status-dist-bar-wrap">
                      <div
                        className="status-dist-bar"
                        style={{
                          width: `${(p.count / overview.jobs.total_jobs * 100) || 0}%`,
                          background: 'var(--accent)',
                        }}
                      />
                    </div>
                    <span className="status-dist-val">{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {overview.recent_activity?.length > 0 && (
            <div className="analytics-section-card" style={{ marginTop: '20px' }}>
              <h3>Recent Activity (Last 7 Days)</h3>
              <div className="recent-activity-grid">
                {overview.recent_activity.map(a => (
                  <div key={a.date} className="activity-day">
                    <div className="activity-count">{a.jobs_created}</div>
                    <div className="activity-date">{new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Utilization Tab */}
      {activeTab === 'utilization' && utilization && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Printer</th>
                <th>Model</th>
                <th>Status</th>
                <th>Total Hours</th>
                <th>Total Jobs</th>
                <th>Completed</th>
                <th>Failed</th>
                <th>Success %</th>
              </tr>
            </thead>
            <tbody>
              {utilization.printers.map(p => (
                <tr key={p.name}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.model}</td>
                  <td><span className={`status-badge status-${p.status?.toLowerCase()}`}>{p.status}</span></td>
                  <td>{p.total_print_hours}h</td>
                  <td>{p.total_jobs}</td>
                  <td style={{ color: 'var(--success)' }}>{p.completed_jobs}</td>
                  <td style={{ color: 'var(--danger)' }}>{p.failed_jobs}</td>
                  <td style={{ color: p.success_rate_pct >= 80 ? 'var(--success)' : 'var(--warning)' }}>
                    {p.success_rate_pct ?? 'N/A'}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Consumption Tab */}
      {activeTab === 'consumption' && consumption && (
        <div>
          {consumption.low_stock_alerts?.length > 0 && (
            <div className="alert-banner">
              ⚠ {consumption.low_stock_alerts.length} material(s) low on stock or out of stock
            </div>
          )}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Jobs (30d)</th>
                  <th>Weight Used (g)</th>
                  <th>Print Hours</th>
                  <th>Completed</th>
                  <th>Failed</th>
                </tr>
              </thead>
              <tbody>
                {consumption.consumption.map(c => (
                  <tr key={c.material_type}>
                    <td><strong>{c.material_type}</strong></td>
                    <td>{c.job_count}</td>
                    <td>{c.total_grams}g</td>
                    <td>{c.total_hours}h</td>
                    <td style={{ color: 'var(--success)' }}>{c.completed}</td>
                    <td style={{ color: 'var(--danger)' }}>{c.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {consumption.low_stock_alerts?.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <h3 style={{ marginBottom: '12px' }}>Low Stock Alerts</h3>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Type</th>
                      <th>Brand</th>
                      <th>Weight (g)</th>
                      <th>In Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumption.low_stock_alerts.map((m, i) => (
                      <tr key={i}>
                        <td>{m.name}</td>
                        <td>{m.type}</td>
                        <td>{m.brand}</td>
                        <td style={{ color: m.weight_grams < 100 ? 'var(--danger)' : 'var(--warning)' }}>
                          {m.weight_grams}g
                        </td>
                        <td>{m.in_stock ? 'Yes' : <span style={{ color: 'var(--danger)' }}>No</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success Rate Matrix */}
      {activeTab === 'matrix' && matrix && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Printer</th>
                <th>Material</th>
                <th>Total Jobs</th>
                <th>Completed</th>
                <th>Failed</th>
                <th>Success Rate</th>
              </tr>
            </thead>
            <tbody>
              {matrix.matrix.map((row, i) => (
                <tr key={i}>
                  <td>{row.printer_name}</td>
                  <td>{row.material_type}</td>
                  <td>{row.total}</td>
                  <td style={{ color: 'var(--success)' }}>{row.completed}</td>
                  <td style={{ color: 'var(--danger)' }}>{row.failed}</td>
                  <td>
                    <span style={{
                      color: row.success_rate_pct >= 80 ? 'var(--success)' :
                             row.success_rate_pct >= 50 ? 'var(--warning)' : 'var(--danger)',
                      fontWeight: 700,
                    }}>
                      {row.success_rate_pct ?? 'N/A'}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
