import React, { useEffect, useState } from 'react';
import api from '../services/api';

const COL_COLORS = {
  queued: '#3b82f6',
  slicing: '#a855f7',
  printing: '#10b981',
  post_processing: '#f59e0b',
  completed: '#64748b'
};
const PRIORITY_COLORS = {
  low: '#64748b',
  normal: '#3b82f6',
  high: '#f59e0b',
  urgent: '#ef4444'
};

export default function PrintQueueKanban() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/custom-views/print-queue')
      .then(r => setData(r.data))
      .catch(e => setErr(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 20 }}>Loading print queue...</div>;
  if (err) return <div style={{ padding: 20, color: '#ef4444' }}>Error: {err}</div>;

  return (
    <div>
      <div style={{ marginBottom: 16, opacity: 0.8 }}>
        {data.totalJobs} jobs across {data.columns.length} stages
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${data.board.length}, minmax(220px, 1fr))`,
        gap: 12,
        overflowX: 'auto'
      }}>
        {data.board.map(col => (
          <div key={col.column} style={{
            background: '#0f172a',
            borderRadius: 10,
            padding: 12,
            borderTop: `4px solid ${COL_COLORS[col.column] || '#64748b'}`,
            minHeight: 400
          }}>
            <div style={{
              fontWeight: 'bold',
              marginBottom: 12,
              display: 'flex',
              justifyContent: 'space-between',
              color: COL_COLORS[col.column]
            }}>
              <span>{col.label}</span>
              <span style={{
                background: COL_COLORS[col.column],
                color: '#fff',
                padding: '0 8px',
                borderRadius: 10,
                fontSize: 12
              }}>{col.jobs.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {col.jobs.map(j => (
                <div key={j.id} style={{
                  background: '#1e293b',
                  padding: 10,
                  borderRadius: 6,
                  borderLeft: `3px solid ${PRIORITY_COLORS[j.priority]}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 13 }}>{j.part}</strong>
                    <span style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      background: PRIORITY_COLORS[j.priority],
                      borderRadius: 3,
                      color: '#fff',
                      textTransform: 'uppercase'
                    }}>{j.priority}</span>
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                    {j.id} &middot; {j.printer}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 6 }}>
                    {j.material} <span style={{ opacity: 0.6 }}>({j.materialType})</span>
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                    {j.estimatedHours}h &middot; {j.operator}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
                    Due: {j.dueDate}
                  </div>
                </div>
              ))}
              {col.jobs.length === 0 && (
                <div style={{ opacity: 0.4, fontSize: 12, textAlign: 'center', padding: 20 }}>
                  No jobs
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
