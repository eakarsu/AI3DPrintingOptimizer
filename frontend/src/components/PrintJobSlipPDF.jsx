import React, { useEffect, useState } from 'react';
import api from '../services/api';
import jsPDF from 'jspdf';

export default function PrintJobSlipPDF() {
  const [jobId, setJobId] = useState('JOB-2007');
  const [slip, setSlip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const fetchSlip = async (id) => {
    setLoading(true);
    setErr('');
    try {
      const res = await api.get(`/custom-views/print-job-slip/${id}`);
      setSlip(res.data);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSlip(jobId); }, []);

  const downloadPDF = () => {
    if (!slip) return;
    const doc = new jsPDF();
    let y = 14;
    doc.setFontSize(16);
    doc.text('PRINT JOB SLIP', 14, y); y += 8;
    doc.setFontSize(10);
    doc.text(`Job ID: ${slip.jobId}`, 14, y); y += 5;
    doc.text(`Issued: ${slip.issuedAt}`, 14, y); y += 5;
    doc.text(`Operator: ${slip.operator}`, 14, y); y += 8;

    doc.setFontSize(12); doc.text('Part', 14, y); y += 6;
    doc.setFontSize(10);
    doc.text(`Name: ${slip.part.name}`, 14, y); y += 5;
    doc.text(`STL: ${slip.part.stlFile}`, 14, y); y += 5;
    doc.text(`Volume: ${slip.part.volumeCm3} cm^3 | Weight: ${slip.part.weightGrams} g`, 14, y); y += 8;

    doc.setFontSize(12); doc.text('Printer', 14, y); y += 6;
    doc.setFontSize(10);
    doc.text(`${slip.printer.model} (${slip.printer.id}) @ ${slip.printer.bay}`, 14, y); y += 8;

    doc.setFontSize(12); doc.text('Slicing Parameters', 14, y); y += 6;
    doc.setFontSize(10);
    Object.entries(slip.slicing).forEach(([k, v]) => {
      doc.text(`${k}: ${v}`, 14, y); y += 5;
    });
    y += 3;

    doc.setFontSize(12); doc.text('Material', 14, y); y += 6;
    doc.setFontSize(10);
    doc.text(`${slip.material.name} (${slip.material.type}) - ${slip.material.supplier}`, 14, y); y += 8;

    doc.setFontSize(12); doc.text('Estimate', 14, y); y += 6;
    doc.setFontSize(10);
    Object.entries(slip.estimate).forEach(([k, v]) => {
      doc.text(`${k}: ${v}`, 14, y); y += 5;
    });
    y += 3;

    doc.setFontSize(12); doc.text('QC Checklist', 14, y); y += 6;
    doc.setFontSize(10);
    slip.qcChecklist.forEach(item => { doc.text(`[ ] ${item}`, 14, y); y += 5; });
    y += 3;
    doc.setFontSize(10);
    doc.text(`Barcode: ${slip.barcode}`, 14, y);

    doc.save(`${slip.jobId}.pdf`);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={jobId}
          onChange={e => setJobId(e.target.value)}
          placeholder="JOB-2007"
          style={{
            padding: '8px 12px',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 6,
            color: '#fff'
          }}
        />
        <button
          onClick={() => fetchSlip(jobId)}
          style={{
            padding: '8px 16px',
            background: '#3b82f6',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          Load Slip
        </button>
        <button
          onClick={downloadPDF}
          disabled={!slip}
          style={{
            padding: '8px 16px',
            background: '#10b981',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            cursor: slip ? 'pointer' : 'not-allowed',
            opacity: slip ? 1 : 0.5
          }}
        >
          Download PDF
        </button>
      </div>

      {loading && <div>Loading slip...</div>}
      {err && <div style={{ color: '#ef4444' }}>Error: {err}</div>}

      {slip && (
        <div style={{
          background: '#fff',
          color: '#111',
          padding: 32,
          borderRadius: 8,
          fontFamily: 'monospace',
          maxWidth: 720
        }}>
          <div style={{ borderBottom: '2px solid #111', paddingBottom: 12, marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>PRINT JOB SLIP</h2>
            <div style={{ fontSize: 12 }}>{slip.jobId} &middot; Issued {new Date(slip.issuedAt).toLocaleString()}</div>
            <div style={{ fontSize: 12 }}>Operator: {slip.operator}</div>
          </div>

          <Section title="PART">
            <Row label="Name" value={slip.part.name} />
            <Row label="STL File" value={slip.part.stlFile} />
            <Row label="Volume" value={`${slip.part.volumeCm3} cm³`} />
            <Row label="Weight" value={`${slip.part.weightGrams} g`} />
          </Section>

          <Section title="PRINTER">
            <Row label="Model" value={slip.printer.model} />
            <Row label="ID / Bay" value={`${slip.printer.id} / ${slip.printer.bay}`} />
          </Section>

          <Section title="SLICING PARAMETERS">
            {Object.entries(slip.slicing).map(([k, v]) => (
              <Row key={k} label={k} value={String(v)} />
            ))}
          </Section>

          <Section title="MATERIAL">
            <Row label="Name" value={slip.material.name} />
            <Row label="Type" value={slip.material.type} />
            <Row label="Supplier" value={slip.material.supplier} />
            <Row label="Diameter" value={slip.material.diameter} />
          </Section>

          <Section title="ESTIMATE">
            {Object.entries(slip.estimate).map(([k, v]) => (
              <Row key={k} label={k} value={String(v)} />
            ))}
          </Section>

          <Section title="QC CHECKLIST">
            {slip.qcChecklist.map(c => (
              <div key={c} style={{ marginLeft: 8 }}>[ ] {c}</div>
            ))}
          </Section>

          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 14 }}>
            {slip.barcode}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 'bold', borderBottom: '1px solid #999', marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
