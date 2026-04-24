import React from 'react';

export default function DetailModal({ item, config, onClose, onEdit, onDelete }) {
  const formatValue = (key, value) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (key === 'created_at' || key === 'updated_at') {
      return new Date(value).toLocaleString();
    }
    if (key === 'next_maintenance_date' && value) {
      return new Date(value).toLocaleDateString();
    }
    return String(value);
  };

  const allFields = config.fields || [];
  const displayFields = [
    { key: 'id', label: 'ID' },
    ...allFields,
    { key: 'created_at', label: 'Created' },
    { key: 'updated_at', label: 'Updated' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{config.icon} Record Details</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="detail-grid">
            {displayFields.map((field) => (
              <div key={field.key} className={`detail-item ${field.type === 'textarea' ? 'full-width' : ''}`}>
                <span className="detail-label">{field.label}</span>
                <span className="detail-value">{formatValue(field.key, item[field.key])}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-danger btn-sm" onClick={onDelete}>Delete</button>
          <button className="btn btn-primary btn-sm" onClick={onEdit}>Edit</button>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
