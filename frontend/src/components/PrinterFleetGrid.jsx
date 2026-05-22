import React, { useEffect, useState } from 'react';
import api from '../services/api';

const STATUS_COLORS = {
  printing: '#10b981',
  idle: '#64748b',
  maintenance: '#f59e0b',
  error: '#ef4444',
  queued: '#3b82f6'
};

export default function PrinterFleetGrid() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/custom-views/printer-fleet')
      .then(r => setData(r.data))
      .catch(e => setErr(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 20 }}>Loading fleet status...</div>;
  if (err) return <div style={{ padding: 20, color: '#ef4444' }}>Error: {err}</div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(data.summary).map(([k, v]) => (
          <div key={k} style={{
            padding: '12px 16px',
            background: '#1e293b',
            borderRadius: 8,
            borderLeft: `4px solid ${STATUS_COLORS[k] || '#64748b'}`,
            minWidth: 110
          }}>
            <div style={{ fontSize: 12, opacity: 0.7, textTransform: 'uppercase' }}>{k}</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: STATUS_COLORS[k] }}>{v}</div>
          </div>
        ))}
        <div style={{
          padding: '12px 16px',
          background: '#1e293b',
          borderRadius: 8,
          borderLeft: '4px solid #a855f7',
          minWidth: 110
        }}>
          <div style={{ fontSize: 12, opacity: 0.7, textTransform: 'uppercase' }}>Total</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#a855f7' }}>{data.totalPrinters}</div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16
      }}>
        {data.fleet.map(p => (
          <div key={p.id} style={{
            background: '#1e293b',
            padding: 16,
            borderRadius: 10,
            border: `2px solid ${STATUS_COLORS[p.status] || '#334155'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: 15 }}>{p.model}</div>
                <div style={{ fontSize: 12, opacity: 0.6 }}>{p.id} &middot; {p.bay}</div>
              </div>
              <span style={{
                padding: '2px 8px',
                background: STATUS_COLORS[p.status],
                color: '#fff',
                borderRadius: 4,
                fontSize: 11,
                textTransform: 'uppercase',
                fontWeight: 'bold'
              }}>{p.status}</span>
            </div>

            {p.status === 'printing' && (
              <>
                <div style={{ marginTop: 12, fontSize: 13 }}>
                  <strong>{p.currentJob}</strong>
                </div>
                <div style={{ background: '#0f172a', height: 8, borderRadius: 4, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{
                    width: `${p.progress}%`,
                    height: '100%',
                    background: STATUS_COLORS.printing
                  }} />
                </div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                  {p.progress}% &middot; ETA {p.etaMinutes} min
                </div>
              </>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              marginTop: 12,
              fontSize: 12
            }}>
              <div>Nozzle: <strong>{p.nozzleTemp}&deg;C</strong></div>
              <div>Bed: <strong>{p.bedTemp}&deg;C</strong></div>
              <div>Filament: <strong>{p.filamentRemaining}%</strong></div>
              <div>Uptime: <strong>{p.uptimeHours}h</strong></div>
            </div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
              Last maint: {p.lastMaintenance}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
