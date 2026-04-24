import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import { FEATURES } from '../config/features';
import DetailModal from '../components/DetailModal';
import FormModal from '../components/FormModal';
import AIModal from '../components/AIModal';

export default function FeaturePage() {
  const { feature } = useParams();
  const navigate = useNavigate();
  const config = FEATURES.find(f => f.key === feature);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [showAI, setShowAI] = useState(false);

  const fetchData = useCallback(async () => {
    if (!config) return;
    try {
      setLoading(true);
      const res = await api.get(config.apiPath);
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!config) {
    return <div>Feature not found. <button onClick={() => navigate('/')}>Go Back</button></div>;
  }

  const handleRowClick = (item) => {
    setSelectedItem(item);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await api.delete(`${config.apiPath}/${id}`);
      toast.success('Deleted successfully');
      setSelectedItem(null);
      fetchData();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setSelectedItem(null);
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditItem(null);
    setShowForm(true);
  };

  const handleFormSubmit = async (formData) => {
    try {
      if (editItem) {
        await api.put(`${config.apiPath}/${editItem.id}`, formData);
        toast.success('Updated successfully');
      } else {
        await api.post(config.apiPath, formData);
        toast.success('Created successfully');
      }
      setShowForm(false);
      setEditItem(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Operation failed');
    }
  };

  const renderCellValue = (col, value) => {
    if (value === null || value === undefined) return '-';
    if (col.type === 'status') {
      const statusClass = `status-${String(value).toLowerCase().replace(/\s+/g, '-')}`;
      return <span className={`status-badge ${statusClass}`}>{value}</span>;
    }
    if (col.type === 'risk') {
      return <span className={`risk-${String(value).toLowerCase()}`}>{value}</span>;
    }
    if (col.type === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    return String(value);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <button className="back-btn" onClick={() => navigate('/')}>&#x2190;</button>
          <div className="page-title">
            <h1>{config.icon} {config.name}</h1>
            <p>{config.description}</p>
          </div>
        </div>
        <div className="page-actions">
          {config.isAI && (
            <button className="btn btn-fill" onClick={() => setShowAI(true)}>
              AI Analyze
            </button>
          )}
          <button className="btn btn-primary" onClick={handleCreate}>
            + New Item
          </button>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="table-empty">Loading...</div>
        ) : data.length === 0 ? (
          <div className="table-empty">No records found. Click "New Item" to add one.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                {config.columns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr key={item.id} onClick={() => handleRowClick(item)}>
                  <td>{idx + 1}</td>
                  {config.columns.map((col) => (
                    <td key={col.key}>{renderCellValue(col, item[col.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedItem && (
        <DetailModal
          item={selectedItem}
          config={config}
          onClose={() => setSelectedItem(null)}
          onEdit={() => handleEdit(selectedItem)}
          onDelete={() => handleDelete(selectedItem.id)}
        />
      )}

      {showForm && (
        <FormModal
          config={config}
          editItem={editItem}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          onSubmit={handleFormSubmit}
        />
      )}

      {showAI && (
        <AIModal
          config={config}
          onClose={() => setShowAI(false)}
        />
      )}
    </div>
  );
}
