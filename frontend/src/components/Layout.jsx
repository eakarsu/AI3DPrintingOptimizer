import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FEATURES } from '../config/features';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.info('Logged out');
    navigate('/login');
  };

  const aiFeatures = FEATURES.filter(f => f.isAI);
  const nonAiFeatures = FEATURES.filter(f => !f.isAI);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>AI 3D Print Optimizer</h2>
          <p>Additive Manufacturing Platform</p>
        </div>

        <div
          className={`sidebar-link ${location.pathname === '/' ? 'active' : ''}`}
          onClick={() => navigate('/')}
          style={{ margin: '12px 12px 0' }}
        >
          <span className="icon">&#x1F3E0;</span>
          Dashboard
        </div>

        <div
          className={`sidebar-link ${location.pathname === '/analytics' ? 'active' : ''}`}
          onClick={() => navigate('/analytics')}
          style={{ margin: '0 12px' }}
        >
          <span className="icon">&#x1F4CA;</span>
          Analytics
        </div>

        <div
          className={`sidebar-link ${location.pathname === '/ai-printing-tools' ? 'active' : ''}`}
          onClick={() => navigate('/ai-printing-tools')}
          style={{ margin: '0 12px' }}
        >
          <span className="icon">&#x2728;</span>
          AI Printing Tools
          <span className="badge badge-ai">AI</span>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">AI Features</div>
          {aiFeatures.map((f) => (
            <div
              key={f.key}
              className={`sidebar-link ${location.pathname === `/${f.key}` ? 'active' : ''}`}
              onClick={() => navigate(`/${f.key}`)}
            >
              <span className="icon">{f.icon}</span>
              {f.shortName}
              <span className="badge badge-ai">AI</span>
            </div>
          ))}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Management</div>
          {nonAiFeatures.map((f) => (
            <div
              key={f.key}
              className={`sidebar-link ${location.pathname === `/${f.key}` ? 'active' : ''}`}
              onClick={() => navigate(`/${f.key}`)}
            >
              <span className="icon">{f.icon}</span>
              {f.shortName}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{(user.name || 'A')[0]}</div>
            <div className="user-details">
              <div className="user-name">{user.name || 'Admin'}</div>
              <div className="user-email">{user.email || ''}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost btn-full" style={{ marginTop: '8px' }}>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
