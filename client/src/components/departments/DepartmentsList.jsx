import React, { useState, useEffect } from 'react';
import { getDepartments, disableDepartment, enableDepartment } from '../../services/departmentApi';
import DepartmentModal from './DepartmentModal';

const DepartmentsList = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const data = await getDepartments();
      setDepartments(data);
    } catch (error) {
      console.error('Failed to fetch departments', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleToggleStatus = async (dept) => {
    if (!window.confirm(`Are you sure you want to ${dept.is_active ? 'disable' : 'enable'} ${dept.name}?`)) return;
    try {
      if (dept.is_active) {
        await disableDepartment(dept.department_id);
      } else {
        await enableDepartment(dept.department_id);
      }
      fetchDepartments();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to update department status');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Organizational Departments</h2>
        <button
          onClick={() => { setEditingDept(null); setIsModalOpen(true); }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm transition-colors shadow-sm"
        >
          + Add Department
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading departments...</div>
      ) : departments.length === 0 ? (
        <div className="py-12 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
          No departments found. Create one to get started.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">Department</th>
                <th className="p-4 font-semibold">Code</th>
                <th className="p-4 font-semibold text-center">Positions</th>
                <th className="p-4 font-semibold text-center">Open Jobs</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {departments.map(dept => (
                <tr key={dept.department_id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-medium text-slate-900">{dept.name}</td>
                  <td className="p-4 text-slate-500">{dept.code || '-'}</td>
                  <td className="p-4 text-center text-slate-600">{dept.position_count || 0}</td>
                  <td className="p-4 text-center text-slate-600">{dept.open_position_count || 0}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      dept.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {dept.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="p-4 space-x-3">
                    <button
                      onClick={() => { setEditingDept(dept); setIsModalOpen(true); }}
                      className="text-indigo-600 hover:text-indigo-900 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleStatus(dept)}
                      className={`${dept.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'} font-medium`}
                    >
                      {dept.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <DepartmentModal
          department={editingDept}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => { setIsModalOpen(false); fetchDepartments(); }}
        />
      )}
    </div>
  );
};

export default DepartmentsList;
