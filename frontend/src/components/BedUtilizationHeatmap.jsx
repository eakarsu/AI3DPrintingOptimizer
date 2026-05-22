import React, { useEffect, useState } from 'react';
import api from '../services/api';

function utilColor(u) {
  // Interpolate from dark blue (low) -> orange -> red (high)
  if (u < 0.001) return '#0b1220';
  const stops = [
    { t: 0.0, c: [15, 23, 42] },     // slate
    { t: 0.25, c: [37, 99, 235] },   // blue
    { t: 0.55, c: [16, 185, 129] },  // emerald
    { t: 0.75, c: [245, 158, 11] },  // amber
    { t: 1.0, c: [239, 68, 68] }     // red
  ];
  for (let i = 1; i < stops.length; i++) {
    if (u <= stops[i].t) {
      const a = stops[i - 1], b = stops[i];
      const r = (u - a.t) / (b.t - a.t);
      const mix = a.c.map((v, k) => Math.round(v + (b.c[k] - v) * r));
      return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
    }
  }
  return '#ef4444';
}

export default function BedUtilizationHeatmap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/custom-views/bed-utilization-heatmap')
      .then(r => setData(r.data))
      .catch(e => setErr(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 20 }}>Loading heatmap...</div>;
  if (err) return <div style={{ padding: 20, color: '#ef4444' }}>Error: {err}</div>;
  if (!data) return null;

  const CELL = 28;
  const LABEL_W = 200;

  return (
    <div data-testid="bed-heatmap">
      <div style={{ marginBottom: 12, opacity: 0.85 }}>
        Bed Utilization Heatmap &middot; {data.printersCount} printers &times; {data.hours}h
        &middot; Farm avg: <strong>{(data.farmAvgUtilization * 100).toFixed(1)}%</strong>
      </div>

      <div style={{
        overflowX: 'auto',
        background: '#0f172a',
        borderRadius: 10,
        border: '1px solid #1e293b',
        padding: 12
      }}>
        <div style={{ display: 'inline-block', minWidth: '100%' }}>
          {/* hour header */}
          <div style={{ display: 'flex' }}>
            <div style={{ width: LABEL_W }} />
            {Array.from({ length: data.hours }, (_, h) => (
              <div key={h} style={{
                width: CELL,
                textAlign: 'center',
                fontSize: 10,
                color: '#64748b'
              }}>
                {String(h).padStart(2, '0')}
              </div>
            ))}
            <div style={{ width: 80, fontSize: 10, color: '#94a3b8', paddingLeft: 8 }}>Avg</div>
          </div>

          {data.matrix.map(row => (
            <div key={row.printerId} style={{ display: 'flex', alignItems: 'center', marginTop: 2 }}>
              <div style={{ width: LABEL_W, padding: '4px 8px' }}>
                <div style={{ fontSize: 12, fontWeight: 'bold' }}>{row.printerModel}</div>
                <div style={{ fontSize: 10, opacity: 0.65 }}>{row.printerId} &middot; {row.bay}</div>
              </div>
              {row.cells.map(c => (
                <div
                  key={c.hour}
                  data-testid={`heat-${row.printerId}-${c.hour}`}
                  title={`${row.printerModel} hour ${c.hour}: ${(c.utilization * 100).toFixed(0)}% util, ${c.jobs} jobs`}
                  style={{
                    width: CELL - 2,
                    height: CELL - 2,
                    margin: 1,
                    background: utilColor(c.utilization),
                    borderRadius: 3,
                    fontSize: 9,
                    color: c.utilization > 0.55 ? '#0f172a' : '#cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: c.utilization > 0.7 ? 'bold' : 'normal'
                  }}
                >
                  {Math.round(c.utilization * 100)}
                </div>
              ))}
              <div style={{
                width: 80,
                paddingLeft: 8,
                fontSize: 12,
                fontWeight: 'bold',
                color: utilColor(row.avgUtilization)
              }}>
                {(row.avgUtilization * 100).toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
        <span style={{ opacity: 0.8 }}>Scale:</span>
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <span key={v} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 18, height: 14,
              background: utilColor(v),
              display: 'inline-block',
              borderRadius: 3
            }} />
            {(v * 100).toFixed(0)}%
          </span>
        ))}
      </div>
    </div>
  );
}
