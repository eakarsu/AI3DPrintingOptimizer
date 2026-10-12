import NativeFeatureAI from '../components/NativeFeatureAI';
import Modal from '../components/AIWorkspaceModal';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import { FEATURES } from '../config/features';
import DetailModal from '../components/DetailModal';
import FormModal from '../components/FormModal';
import Pagination from '../components/Pagination';
import { readRecordList } from '../services/nativeRecords';

export default function FeaturePage({ featureKey }) {
  const { feature } = useParams();
  const navigate = useNavigate();
  const config = FEATURES.find(f => f.key === (featureKey || feature));
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const pendingLoad = useRef(null);
  const [nativeAI,setNativeAI]=useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = useCallback(async (page = 1) => {
    if (!config) return;
    pendingLoad.current?.abort();
    const controller = new AbortController(); pendingLoad.current = controller;
    setLoading(true); setLoadError('');
    try {
      const res = await api.get(config.apiPath, { params: { page, limit: 20 }, signal: controller.signal });
      const rows = readRecordList(res.data);
      if (pendingLoad.current !== controller || controller.signal.aborted) return;
      setData(rows);
      setPagination(res.data.pagination || { page: 1, limit: rows.length || 20, total: rows.length, totalPages: 1 });
    } catch (err) {
      if (pendingLoad.current === controller && !controller.signal.aborted) setLoadError(err.response?.data?.error || err.message || 'Records could not be loaded.');
    } finally {
      if (pendingLoad.current === controller && !controller.signal.aborted) { pendingLoad.current = null; setLoading(false); }
    }
  }, [config]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedItem(null); setShowForm(false);setNativeAI(null);
    fetchData(1);
    return () => { pendingLoad.current?.abort(); pendingLoad.current = null; };
  }, [fetchData]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    fetchData(newPage);
  };

  if (!config) {
    return <div>Feature not found. <button onClick={() => navigate('/')}>Go Back</button></div>;
  }

  const handleRowClick = (item) => setSelectedItem(item);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await api.delete(`${config.apiPath}/${id}`);
      toast.success('Deleted successfully');
      setSelectedItem(null);
      fetchData(currentPage);
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
      fetchData(currentPage);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Operation failed';
      toast.error(errMsg);
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
    if (col.type === 'json') {
      return value ? '✓ AI Analysis' : '-';
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
            <button className="btn btn-fill" onClick={()=>setNativeAI({source:null})}>✦ Generate native AI report</button>
          )}
          <button className="btn btn-primary" onClick={handleCreate}>
            + New Item
          </button>
        </div>
      </div>

      {nativeAI&&<Modal title={config.name+' · OpenRouter'} onClose={()=>setNativeAI(null)}><NativeFeatureAI config={config} source={nativeAI.source} onCancel={()=>setNativeAI(null)} onSaved={()=>fetchData(currentPage)}/></Modal>}
      <div className="table-container">
        {loading ? (
          <div className="table-empty">Loading...</div>
        ) : loadError ? (
          <div role="alert" className="native-load-error"><strong>Records could not be loaded.</strong><p>{loadError}</p><button type="button" className="btn btn-secondary" onClick={() => fetchData(currentPage)}>Retry</button></div>
        ) : data.length === 0 ? (
          <div className="table-empty">No records found. Click "New Item" to add one.</div>
        ) : (
          <>
            <div className="table-meta">
              <span>{pagination.total} total records</span>
              <span>Page {pagination.page} of {pagination.totalPages}</span>
            </div>
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
                    <td>{(currentPage - 1) * pagination.limit + idx + 1}</td>
                    {config.columns.map((col) => (
                      <td key={col.key}>{renderCellValue(col, item[col.key])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {pagination.totalPages > 1 && (
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </>
        )}
      </div>

      {selectedItem && (
        <DetailModal
          item={selectedItem}
          config={config}
          onClose={() => setSelectedItem(null)}
          onEdit={() => handleEdit(selectedItem)}
          onDelete={() => handleDelete(selectedItem.id)}
          onAI={source=>{setSelectedItem(null);setNativeAI({source});}}
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
    </div>
  );
}
