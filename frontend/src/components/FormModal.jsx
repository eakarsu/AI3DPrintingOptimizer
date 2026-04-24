import React, { useState } from 'react';

export default function FormModal({ config, editItem, onClose, onSubmit }) {
  const initialData = {};
  config.fields.forEach((field) => {
    if (editItem) {
      initialData[field.key] = editItem[field.key] ?? '';
    } else {
      initialData[field.key] = field.type === 'checkbox' ? false : '';
    }
  });

  const [formData, setFormData] = useState(initialData);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    // Convert numeric fields
    const processedData = { ...formData };
    config.fields.forEach((field) => {
      if (field.type === 'number' && processedData[field.key] !== '') {
        processedData[field.key] = Number(processedData[field.key]);
      }
    });
    await onSubmit(processedData);
    setSubmitting(false);
  };

  const renderField = (field) => {
    if (field.type === 'checkbox') {
      return (
        <div className="checkbox-group" key={field.key}>
          <input
            type="checkbox"
            id={field.key}
            checked={!!formData[field.key]}
            onChange={(e) => handleChange(field.key, e.target.checked)}
          />
          <label htmlFor={field.key}>{field.label}</label>
        </div>
      );
    }

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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editItem ? 'Edit' : 'New'} {config.name}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              {config.fields.map(renderField)}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? 'Saving...' : editItem ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
