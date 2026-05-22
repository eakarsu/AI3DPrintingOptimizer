import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const STATUS_COLORS = {
  ok: '#10b981',
  reorder: '#f59e0b',
  critical: '#ef4444'
};

export default function MaterialInventoryTracker() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/custom-views/material-inventory')
      .then(r => setData(r.data))
      .catch(e => setErr(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.inventory.filter(row => {
      if (filter !== 'all' && row.status !== filter) return false;
      if (search && !`${row.name} ${row.sku} ${row.type} ${row.supplier}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data, filter, search]);

  if (loading) return <div style={{ padding: 20 }}>Loading inventory...</div>;
  if (err) return <div style={{ padding: 20, color: '#ef4444' }}>Error: {err}</div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Tile label="SKUs" value={data.totals.skuCount} color="#a855f7" />
        <Tile label="Total kg" value={data.totals.totalKg} color="#3b82f6" />
        <Tile label="Total value" value={`$${data.totals.totalValueUsd}`} color="#10b981" />
        <Tile label="Reorder" value={data.totals.reorderCount} color="#f59e0b" />
        <Tile label="Critical" value={data.totals.criticalCount} color="#ef4444" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          placeholder="Search material..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '8px 12px',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 6,
            color: '#fff',
            flex: 1
          }}
        />
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 6,
            color: '#fff'
          }}
        >
          <option value="all">All statuses</option>
          <option value="ok">OK</option>
          <option value="reorder">Reorder</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div style={{ overflowX: 'auto', background: '#1e293b', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#0f172a' }}>
              <Th>SKU</Th>
              <Th>Material</Th>
              <Th>Type</Th>
              <Th>Supplier</Th>
              <Th>Location</Th>
              <Th>Lot</Th>
              <Th>On hand (kg)</Th>
              <Th>Reserved</Th>
              <Th>Reorder@</Th>
              <Th>$/kg</Th>
              <Th>7d use</Th>
              <Th>Days stock</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.sku} style={{ borderTop: '1px solid #334155' }}>
                <Td>{r.sku}</Td>
                <Td><strong>{r.name}</strong></Td>
                <Td>{r.type}</Td>
                <Td>{r.supplier}</Td>
                <Td>{r.location}</Td>
                <Td>{r.lotNumber}</Td>
                <Td>{r.onHandKg}</Td>
                <Td>{r.reservedKg}</Td>
                <Td>{r.reorderAtKg}</Td>
                <Td>${r.pricePerKg}</Td>
                <Td>{r.consumedKg7d}</Td>
                <Td>{r.daysOfStock === 999 ? '—' : r.daysOfStock}</Td>
                <Td>
                  <span style={{
                    background: STATUS_COLORS[r.status],
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    fontWeight: 'bold'
                  }}>{r.status}</span>
                </Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><Td colSpan={13}><div style={{ textAlign: 'center', opacity: 0.6, padding: 24 }}>No matches.</div></Td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value, color }) {
  return (
    <div style={{
      padding: '12px 16px',
      background: '#1e293b',
      borderRadius: 8,
      borderLeft: `4px solid ${color}`,
      minWidth: 130
    }}>
      <div style={{ fontSize: 12, opacity: 0.7, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 'bold', color }}>{value}</div>
    </div>
  );
}

function Th({ children }) {
  return <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', opacity: 0.7 }}>{children}</th>;
}
function Td({ children, colSpan }) {
  return <td colSpan={colSpan} style={{ padding: '10px 12px' }}>{children}</td>;
}
