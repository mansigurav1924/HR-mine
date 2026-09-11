import React, { useState, useEffect } from 'react';
import { getTemplates, createTemplate, createNewVersion, updateTemplateStatus } from '../../services/offerTemplateApi';

export default function OfferTemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'version' or 'view'
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    region: '',
    html_body: ''
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setModalMode('create');
    setFormData({ name: '', department: '', region: '', html_body: '<h1>Offer Letter</h1>\n<p>Dear {{candidate_name}},</p>' });
    setShowModal(true);
  };

  const handleOpenVersion = (tpl) => {
    setModalMode('version');
    setSelectedTemplate(tpl);
    setFormData({
      name: tpl.name,
      department: tpl.department || '',
      region: tpl.region || '',
      html_body: tpl.html_body
    });
    setShowModal(true);
  };
  
  const handleOpenView = (tpl) => {
    setModalMode('view');
    setSelectedTemplate(tpl);
    setFormData({ ...tpl });
    setShowModal(true);
  };

  const handleToggleActive = async (tpl) => {
    try {
      await updateTemplateStatus(tpl.template_id, !tpl.is_active);
      loadTemplates();
    } catch (err) {
      alert("Failed to update status");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalMode === 'create') {
        await createTemplate(formData);
      } else if (modalMode === 'version') {
        await createNewVersion(selectedTemplate.template_id, { html_body: formData.html_body });
      }
      setShowModal(false);
      loadTemplates();
    } catch (err) {
      alert("Failed to save template: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Offer Templates</h2>
        <button onClick={handleOpenCreate} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
          + Create Template
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Template Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dept/Region</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {templates.map(tpl => (
              <tr key={tpl.template_id}>
                <td className="px-6 py-4 font-medium">{tpl.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{tpl.department || 'All'} / {tpl.region || 'All'}</td>
                <td className="px-6 py-4 text-sm">v{tpl.version}</td>
                <td className="px-6 py-4">
                  <button 
                    onClick={() => handleToggleActive(tpl)}
                    className={`px-3 py-1 rounded-full text-xs font-bold ${tpl.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                  >
                    {tpl.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-6 py-4 text-sm space-x-3">
                  <button onClick={() => handleOpenView(tpl)} className="text-blue-600 hover:underline">View</button>
                  {tpl.is_active && <button onClick={() => handleOpenVersion(tpl)} className="text-indigo-600 hover:underline">New Version</button>}
                </td>
              </tr>
            ))}
            {templates.length === 0 && !loading && <tr><td colSpan="5" className="px-6 py-4 text-center text-gray-500">No templates found.</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-lg shadow-xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg">
                {modalMode === 'create' ? 'Create New Template' : modalMode === 'version' ? `New Version: ${selectedTemplate.name}` : `View: ${selectedTemplate.name}`}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-xl">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-4 shrink-0">
                <div>
                  <label className="block text-sm font-bold mb-1">Name</label>
                  <input type="text" required disabled={modalMode !== 'create'} className="w-full border rounded p-2" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Department</label>
                  <input type="text" disabled={modalMode !== 'create'} className="w-full border rounded p-2" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Region</label>
                  <input type="text" disabled={modalMode !== 'create'} className="w-full border rounded p-2" value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} />
                </div>
              </div>
              
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-end mb-1">
                  <label className="block text-sm font-bold">HTML Body (Jinja2 format)</label>
                  <span className="text-xs text-gray-500">Placeholders: {"{{candidate_name}}"}, {"{{stipend}}"}, {"{{joining_date}}"} etc.</span>
                </div>
                <textarea 
                  required 
                  disabled={modalMode === 'view'}
                  className="w-full flex-1 border rounded p-3 font-mono text-sm bg-gray-50 min-h-[300px]" 
                  value={formData.html_body} 
                  onChange={e => setFormData({...formData, html_body: e.target.value})}
                />
              </div>

              {modalMode !== 'view' && (
                <div className="shrink-0 flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                  <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700">Save</button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
