import React, { useState } from 'react';
import api from '../services/api';

/**
 * Renders a structured JSON AI result in a readable format.
 */
function StructuredAIResult({ data }) {
  if (!data) return null;

  const renderValue = (key, value) => {
    if (value === null || value === undefined) return null;

    // Arrays of strings — render as bullets
    if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
      return (
        <ul className="ai-list" key={key}>
          {value.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      );
    }

    // Arrays of objects — render as cards
    if (Array.isArray(value) && value.every(v => typeof v === 'object')) {
      return (
        <div className="ai-sub-cards" key={key}>
          {value.map((obj, i) => (
            <div className="ai-sub-card" key={i}>
              {Object.entries(obj).map(([k, v]) => (
                <div key={k}>
                  <span className="ai-sub-label">{formatLabel(k)}: </span>
                  <span>{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }

    // Nested object
    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <div className="ai-nested" key={key}>
          {Object.entries(value).map(([k, v]) => (
            <div key={k} className="ai-nested-row">
              <span className="ai-sub-label">{formatLabel(k)}: </span>
              <span>{Array.isArray(v) ? v.join(', ') : String(v)}</span>
            </div>
          ))}
        </div>
      );
    }

    // Boolean
    if (typeof value === 'boolean') {
      return <span className={`ai-badge ${value ? 'ai-badge-yes' : 'ai-badge-no'}`}>{value ? 'Yes' : 'No'}</span>;
    }

    // Number with special color coding
    if (typeof value === 'number' && key.includes('score')) {
      const pct = value <= 1 ? value * 100 : value * 10; // normalize
      const color = pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)';
      return <span style={{ color, fontWeight: 700 }}>{value}</span>;
    }

    return <span>{String(value)}</span>;
  };

  const formatLabel = (key) => {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
      .replace(/^\w/, c => c.toUpperCase());
  };

  // Top-level risk/grade badge
  const riskLevel = data.risk_level || data.quality_grade || data.urgency;
  const riskColor = {
    Low: 'var(--success)',
    Medium: 'var(--warning)',
    High: 'var(--danger)',
    Critical: '#ff0080',
    'A+': 'var(--success)', A: 'var(--success)', 'B+': '#7dd3a8', B: 'var(--cyan)',
    'C+': 'var(--warning)', C: 'var(--warning)', D: 'var(--danger)', F: 'var(--danger)',
  }[riskLevel] || 'var(--accent)';

  const PRIORITY_KEYS = ['risk_level', 'quality_grade', 'urgency', 'recommended_material',
    'top_recommendation', 'reasoning', 'summary', 'root_cause_summary', 'risk_assessment'];
  const SKIP_KEYS = ['confidence_score', 'probability_of_failure'];

  const priorityEntries = PRIORITY_KEYS.filter(k => data[k] !== undefined).map(k => [k, data[k]]);
  const remainingEntries = Object.entries(data).filter(([k]) => !PRIORITY_KEYS.includes(k) && !SKIP_KEYS.includes(k));

  const allEntries = [...priorityEntries, ...remainingEntries];

  return (
    <div className="ai-structured-result">
      {riskLevel && (
        <div className="ai-highlight-badge" style={{ borderColor: riskColor, color: riskColor }}>
          {riskLevel}
        </div>
      )}
      {data.confidence_score !== undefined && (
        <div className="ai-confidence">
          Confidence: <strong>{Math.round(data.confidence_score * 100)}%</strong>
        </div>
      )}
      {allEntries.map(([key, value]) => {
        const rendered = renderValue(key, value);
        if (!rendered) return null;
        return (
          <div className="ai-section-block" key={key}>
            <h4>{formatLabel(key)}</h4>
            {rendered}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Fallback: parse markdown text into sections for non-JSON responses.
 */
function parseAITextSections(text) {
  const sections = [];
  const lines = text.split('\n');
  let currentSection = null;
  let currentContent = [];

  for (const line of lines) {
    const headerMatch = line.match(/^#{1,3}\s+(.+)/) ||
                        line.match(/^\*\*(.+?)\*\*\s*$/) ||
                        line.match(/^([A-Z][A-Z\s]{3,}):?\s*$/);
    if (headerMatch) {
      if (currentSection) sections.push({ title: currentSection, content: currentContent.join('\n').trim() });
      currentSection = headerMatch[1].replace(/\*\*/g, '').replace(/:$/, '').trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentSection) sections.push({ title: currentSection, content: currentContent.join('\n').trim() });
  if (sections.length === 0) sections.push({ title: 'AI Analysis', content: text });
  return sections;
}

function TextAIResponseDisplay({ content }) {
  const sections = parseAITextSections(content);
  return (
    <div className="ai-response-content">
      {sections.map((section, idx) => (
        <div key={idx} className="ai-section-block">
          <h4>{section.title}</h4>
          <div>
            {section.content.split('\n').map((line, i) => {
              const trimmed = line.trim();
              if (!trimmed) return null;
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.match(/^\d+\./)) {
                const text = trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s*/, '');
                return <ul key={i}><li>{text}</li></ul>;
              }
              return <p key={i} style={{ marginBottom: '6px' }}>{trimmed}</p>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AIModal({ config, onClose }) {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post(config.aiEndpoint, formData);
      setResult(res.data);
    } catch (err) {
      const errMsg = err.response?.data?.error ||
        err.response?.data?.errors?.[0]?.msg ||
        'AI analysis failed. Check your OpenRouter API key.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const aiFields = config.aiFields || [];

  const renderField = (field) => {
    if (field.type === 'select') {
      return (
        <div className="form-group" key={field.key}>
          <label>{field.label}</label>
          <select
            className="form-input"
            value={formData[field.key] || ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
            required={field.required}
          >
            <option value="">Select...</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );
    }
    if (field.type === 'textarea') {
      return (
        <div className="form-group full-width" key={field.key}>
          <label>{field.label}</label>
          <textarea
            className="form-input"
            value={formData[field.key] || ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
            rows={3}
          />
        </div>
      );
    }
    return (
      <div className="form-group" key={field.key}>
        <label>{field.label}{field.required && <span style={{ color: 'var(--danger)' }}> *</span>}</label>
        <input
          type={field.type || 'text'}
          className="form-input"
          value={formData[field.key] || ''}
          onChange={(e) => handleChange(field.key, e.target.value)}
          step={field.step}
          required={field.required}
        />
      </div>
    );
  };

  // Determine what kind of result we have
  const resultKey = config.aiResultKey;
  const aiResult = (resultKey && result?.[resultKey]) ||
                   result?.recommendation || result?.suggested_parameters ||
                   result?.prediction || result?.estimate || result?.analysis ||
                   result?.forecast || null;
  const isStructuredResult = aiResult && typeof aiResult === 'object' && !aiResult.content;
  const rawContent = result?.ai_response?.content || result?.ai_response;
  const modelUsed = result?.model_used;
  const usage = result?.usage;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '860px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{config.icon} AI {config.shortName}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              {aiFields.map(renderField)}
            </div>
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Analyzing...' : '✦ Run AI Analysis'}
              </button>
            </div>
          </div>
        </form>

        {loading && (
          <div className="ai-loading">
            <div className="spinner"></div>
            <p>AI is analyzing your request...</p>
          </div>
        )}

        {error && (
          <div style={{ padding: '20px 28px' }}>
            <div className="ai-section-block" style={{ borderLeftColor: 'var(--danger)' }}>
              <h4 style={{ color: 'var(--danger)' }}>Error</h4>
              <p>{error}</p>
            </div>
          </div>
        )}

        {result && (
          <div className="ai-section">
            <div className="ai-section-header">
              <span style={{ fontSize: '20px' }}>✦</span>
              <h3>AI Analysis Results</h3>
              {result.saved_record && (
                <span className="ai-saved-badge">Saved to DB #{result.saved_record.id}</span>
              )}
            </div>

            {isStructuredResult ? (
              <StructuredAIResult data={aiResult} />
            ) : rawContent ? (
              <TextAIResponseDisplay content={typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent, null, 2)} />
            ) : (
              <StructuredAIResult data={result} />
            )}

            <div className="ai-meta">
              {modelUsed && <span>Model: {modelUsed}</span>}
              {usage && (
                <>
                  <span>Tokens: {usage.total_tokens}</span>
                  <span>Prompt: {usage.prompt_tokens} | Completion: {usage.completion_tokens}</span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
