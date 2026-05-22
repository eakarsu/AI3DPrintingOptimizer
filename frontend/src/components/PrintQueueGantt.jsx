import React, { useEffect, useState } from 'react';
import api from '../services/api';

const PRIORITY_COLORS = {
  low: '#64748b',
  normal: '#3b82f6',
  high: '#f59e0b',
  urgent: '#ef4444'
};
const STATUS_BG = {
  queued: '#1e3a8a',
  printing: '#065f46',
  completed: '#374151'
};

export default function PrintQueueGantt() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/custom-views/print-queue-gantt')
      .then(r => setData(r.data))
      .catch(e => setErr(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 20 }}>Loading Gantt chart...</div>;
  if (err) return <div style={{ padding: 20, color: '#ef4444' }}>Error: {err}</div>;
  if (!data) return null;

  const HOURS = data.windowHours;
  const HOUR_PX = 44;
  const ROW_H = 44;
  const LABEL_W = 200;
  const totalW = LABEL_W + HOURS * HOUR_PX;

  const nowDate = new Date(data.nowISO);
  const startDate = new Date(data.windowStartISO);
  const nowOffsetH = Math.max(0, Math.min(HOURS, (nowDate - startDate) / 3600000));

  return (
    <div data-testid="gantt-chart">
      <div style={{ marginBottom: 12, opacity: 0.85 }}>
        Print Queue Gantt &middot; {data.totalJobs} jobs across {data.printersCount} printers
        &middot; {HOURS}h window starting {startDate.toUTCString().slice(0, 16)}
      </div>

      <div style={{ overflowX: 'auto', background: '#0f172a', borderRadius: 10, border: '1px solid #1e293b' }}>
        <div style={{ width: totalW, minWidth: '100%' }}>
          {/* Header: hour ticks */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid #1e293b',
            position: 'sticky',
            top: 0,
            background: '#0b1220',
            zIndex: 2
          }}>
            <div style={{ width: LABEL_W, padding: '8px 12px', fontWeight: 'bold', color: '#94a3b8' }}>
              Printer
            </div>
            <div style={{ position: 'relative', height: 32, flex: 1 }}>
              {Array.from({ length: HOURS + 1 }, (_, h) => (
                <div key={h} style={{
                  position: 'absolute',
                  left: h * HOUR_PX,
                  top: 0,
                  bottom: 0,
                  borderLeft: '1px solid #1e293b',
                  paddingLeft: 4,
                  fontSize: 10,
                  color: '#64748b',
                  width: HOUR_PX
                }}>
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          {data.rows.map((row, ri) => (
            <div key={row.printerId} style={{
              display: 'flex',
              borderBottom: '1px solid #1e293b',
              background: ri % 2 ? '#0b1220' : '#0f172a',
              minHeight: ROW_H
            }}>
              <div style={{
                width: LABEL_W,
                padding: '8px 12px',
                borderRight: '1px solid #1e293b',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <div style={{ fontWeight: 'bold', fontSize: 13 }}>{row.printerModel}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{row.printerId} &middot; {row.bay}</div>
              </div>
              <div style={{ position: 'relative', flex: 1, height: ROW_H }}>
                {/* hour grid */}
                {Array.from({ length: HOURS }, (_, h) => (
                  <div key={h} style={{
                    position: 'absolute',
                    left: h * HOUR_PX,
                    top: 0,
                    bottom: 0,
                    width: HOUR_PX,
                    borderLeft: '1px solid #1e293b'
                  }} />
                ))}
                {/* now line */}
                <div style={{
                  position: 'absolute',
                  left: nowOffsetH * HOUR_PX,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: '#ef4444',
                  zIndex: 3
                }} title={`Now ${nowDate.toUTCString()}`} />
                {/* job bars */}
                {row.jobs.map(j => {
                  const left = j.startHour * HOUR_PX;
                  const width = Math.max(20, (j.endHour - j.startHour) * HOUR_PX - 2);
                  return (
                    <div
                      key={j.id}
                      data-testid={`gantt-bar-${j.id}`}
                      title={`${j.part} (${j.id}) — ${j.durationHours}h, ${j.priority}, ${j.status}`}
                      style={{
                        position: 'absolute',
                        left,
                        top: 6,
                        height: ROW_H - 12,
                        width,
                        background: STATUS_BG[j.status] || '#1e293b',
                        borderLeft: `4px solid ${PRIORITY_COLORS[j.priority] || '#64748b'}`,
                        borderRadius: 4,
                        padding: '2px 6px',
                        fontSize: 11,
                        color: '#fff',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                        zIndex: 2
                      }}
                    >
                      <strong>{j.part}</strong> &middot; {j.durationHours}h
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12 }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: STATUS_BG.queued, marginRight: 4, verticalAlign: 'middle' }} />Queued</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: STATUS_BG.printing, marginRight: 4, verticalAlign: 'middle' }} />Printing</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: STATUS_BG.completed, marginRight: 4, verticalAlign: 'middle' }} />Completed</span>
        <span style={{ marginLeft: 12, opacity: 0.7 }}>Left border = priority</span>
        <span><span style={{ display: 'inline-block', width: 2, height: 12, background: '#ef4444', marginRight: 4, verticalAlign: 'middle' }} />Now</span>
      </div>
    </div>
  );
}
