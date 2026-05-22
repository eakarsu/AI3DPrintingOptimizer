import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function PrintJobSpecPDF() {
  const [jobId, setJobId] = useState('JOB-3007');
  const [spec, setSpec] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = (id) => {
    setLoading(true);
    setErr('');
    api.get(`/custom-views/print-job-spec/${id}`)
      .then(r => setSpec(r.data))
      .catch(e => setErr(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(jobId); }, []); // initial

  const handlePrint = () => {
    window.print();
  };

  return (
    <div data-testid="job-spec-pdf">
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <input
          value={jobId}
          onChange={e => setJobId(e.target.value)}
          placeholder="JOB-3007"
          data-testid="job-id-input"
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: 6
          }}
        />
        <button
          onClick={() => load(jobId)}
          data-testid="load-spec-btn"
          style={{
            background: '#3b82f6',
            border: 'none',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 6,
            cursor: 'pointer'
          }}
        >Load Spec</button>
        <button
          onClick={handlePrint}
          data-testid="print-pdf-btn"
          style={{
            background: '#10b981',
            border: 'none',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 6,
            cursor: 'pointer'
          }}
        >Print / Save as PDF</button>
      </div>

      {loading && <div style={{ padding: 20 }}>Loading spec...</div>}
      {err && <div style={{ padding: 20, color: '#ef4444' }}>Error: {err}</div>}

      {spec && (
        <div id="spec-sheet" style={{
          background: '#ffffff',
          color: '#0f172a',
          padding: 32,
          borderRadius: 8,
          maxWidth: 900,
          margin: '0 auto',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          fontFamily: 'Georgia, serif'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 12, marginBottom: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22 }}>{spec.title}</h1>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Issued: {new Date(spec.issuedAt).toLocaleString()}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold' }}>{spec.jobId}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Rev: {spec.revision}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <section>
              <h3 style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: 4 }}>Part</h3>
              <table style={{ width: '100%', fontSize: 13 }}><tbody>
                <tr><td><strong>Name</strong></td><td>{spec.part.name}</td></tr>
                <tr><td><strong>STL</strong></td><td>{spec.part.stlFile}</td></tr>
                <tr><td><strong>Volume</strong></td><td>{spec.part.volumeCm3} cm³</td></tr>
                <tr><td><strong>Weight</strong></td><td>{spec.part.weightGrams} g</td></tr>
                <tr><td><strong>BBox</strong></td><td>{spec.part.boundingBoxMm.x} × {spec.part.boundingBoxMm.y} × {spec.part.boundingBoxMm.z} mm</td></tr>
              </tbody></table>
            </section>

            <section>
              <h3 style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: 4 }}>Printer</h3>
              <table style={{ width: '100%', fontSize: 13 }}><tbody>
                <tr><td><strong>ID</strong></td><td>{spec.printer.id}</td></tr>
                <tr><td><strong>Model</strong></td><td>{spec.printer.model}</td></tr>
                <tr><td><strong>Bay</strong></td><td>{spec.printer.bay}</td></tr>
                <tr><td><strong>Operator</strong></td><td>{spec.operator}</td></tr>
              </tbody></table>
            </section>

            <section>
              <h3 style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: 4 }}>Slicing</h3>
              <table style={{ width: '100%', fontSize: 13 }}><tbody>
                <tr><td><strong>Profile</strong></td><td>{spec.slicing.profileName}</td></tr>
                <tr><td><strong>Slicer</strong></td><td>{spec.slicing.slicer}</td></tr>
                <tr><td><strong>Layer Height</strong></td><td>{spec.slicing.layerHeightMm} mm</td></tr>
                <tr><td><strong>Infill</strong></td><td>{spec.slicing.infillPercent}% ({spec.slicing.infillPattern})</td></tr>
                <tr><td><strong>Walls</strong></td><td>{spec.slicing.walls}</td></tr>
                <tr><td><strong>Nozzle</strong></td><td>{spec.slicing.nozzleDiameterMm} mm @ {spec.slicing.nozzleTempC}°C</td></tr>
                <tr><td><strong>Bed</strong></td><td>{spec.slicing.bedTempC}°C</td></tr>
                <tr><td><strong>Speed</strong></td><td>{spec.slicing.printSpeedMmS} mm/s</td></tr>
                <tr><td><strong>Supports</strong></td><td>{spec.slicing.supportsEnabled ? 'Yes' : 'No'}</td></tr>
                <tr><td><strong>Adhesion</strong></td><td>{spec.slicing.adhesionType}</td></tr>
              </tbody></table>
            </section>

            <section>
              <h3 style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: 4 }}>Material &amp; Estimate</h3>
              <table style={{ width: '100%', fontSize: 13 }}><tbody>
                <tr><td><strong>Material</strong></td><td>{spec.material.name}</td></tr>
                <tr><td><strong>Type</strong></td><td>{spec.material.type} ({spec.material.diameter})</td></tr>
                <tr><td><strong>Supplier</strong></td><td>{spec.material.supplier}</td></tr>
                <tr><td><strong>Print Time</strong></td><td>{spec.estimate.printHours} h</td></tr>
                <tr><td><strong>Filament</strong></td><td>{spec.estimate.filamentMeters} m / {spec.estimate.filamentGrams} g</td></tr>
                <tr><td><strong>Energy</strong></td><td>{spec.estimate.energyKwh} kWh</td></tr>
                <tr><td><strong>Cost</strong></td><td>${spec.estimate.costUsd}</td></tr>
              </tbody></table>
            </section>
          </div>

          <section style={{ marginTop: 18 }}>
            <h3 style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: 4 }}>QC Checklist</h3>
            <ul style={{ fontSize: 13, columns: 2 }}>
              {spec.qcChecklist.map(item => (
                <li key={item}>&#9744; {item}</li>
              ))}
            </ul>
          </section>

          <section style={{ marginTop: 18, fontSize: 12, opacity: 0.8 }}>
            <strong>Notes:</strong> {spec.notes}
          </section>

          <div style={{
            marginTop: 24,
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: '1px solid #cbd5e1',
            paddingTop: 12,
            fontFamily: 'monospace'
          }}>
            <div>{spec.barcode}</div>
            <div>Operator signature: ______________________</div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}
