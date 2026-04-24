import React, { useState } from 'react';
import api from '../services/api';

function parseAIResponse(text) {
  if (!text) return [];

  const sections = [];
  const lines = text.split('\n');
  let currentSection = null;
  let currentContent = [];

  for (const line of lines) {
    // Detect section headers (## Header, **Header**, ### Header, or CAPS HEADER:)
    const headerMatch = line.match(/^#{1,3}\s+(.+)/) ||
                        line.match(/^\*\*(.+?)\*\*\s*$/) ||
                        line.match(/^([A-Z][A-Z\s]{3,}):?\s*$/);

    if (headerMatch) {
      if (currentSection) {
        sections.push({ title: currentSection, content: currentContent.join('\n').trim() });
      }
      currentSection = headerMatch[1].replace(/\*\*/g, '').replace(/:$/, '').trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentSection) {
    sections.push({ title: currentSection, content: currentContent.join('\n').trim() });
  }

  // If no sections detected, return the whole text as one section
  if (sections.length === 0) {
    sections.push({ title: 'AI Analysis', content: text });
  }

  return sections;
}

function AIResponseDisplay({ response }) {
  if (!response) return null;

  const sections = parseAIResponse(response.content);

  return (
    <div>
      <div className="ai-response-content">
        {sections.map((section, idx) => (
          <div key={idx} className="ai-section-block">
            <h4>{section.title}</h4>
            <div>
              {section.content.split('\n').map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return null;

                // Bullet points
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.match(/^\d+\./)) {
                  const text = trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s*/, '');
                  return (
                    <ul key={i}>
                      <li>
                        {text.split(/\*\*(.+?)\*\*/).map((part, j) =>
                          j % 2 === 1 ? <strong key={j} style={{ color: 'var(--text-primary)' }}>{part}</strong> : part
                        )}
                      </li>
                    </ul>
                  );
                }

                // Regular paragraph with bold support
                return (
                  <p key={i} style={{ marginBottom: '6px' }}>
                    {trimmed.split(/\*\*(.+?)\*\*/).map((part, j) =>
                      j % 2 === 1 ? <strong key={j} style={{ color: 'var(--text-primary)' }}>{part}</strong> : part
                    )}
                  </p>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {response.model && (
        <div className="ai-meta">
          <span>Model: {response.model}</span>
          {response.usage && (
            <>
              <span>Tokens: {response.usage.total_tokens}</span>
              <span>Prompt: {response.usage.prompt_tokens} | Completion: {response.usage.completion_tokens}</span>
            </>
          )}
        </div>
      )}
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
      setResult(res.data.ai_response);
    } catch (err) {
      setError(err.response?.data?.error || 'AI analysis failed. Check your OpenRouter API key.');
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
        <label>{field.label}</label>
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
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
                {loading ? 'Analyzing...' : 'Run AI Analysis'}
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
              <span style={{ fontSize: '20px' }}>&#x2728;</span>
              <h3>AI Analysis Results</h3>
            </div>
            <AIResponseDisplay response={result} />
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
