import React, { useState } from 'react';
import DepartmentsList from '../components/departments/DepartmentsList';
import PositionsList from '../components/positions/PositionsList';

const DepartmentsPositions = () => {
  const [activeTab, setActiveTab] = useState('positions');

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Departments & Positions</h1>
          <p className="text-sm text-slate-500 mt-1">Manage organizational structure and job openings</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('positions')}
              className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                activeTab === 'positions'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Job Positions
            </button>
            <button
              onClick={() => setActiveTab('departments')}
              className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                activeTab === 'departments'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Departments
            </button>
          </nav>
        </div>
        
        <div className="p-6">
          {activeTab === 'departments' ? <DepartmentsList /> : <PositionsList />}
        </div>
      </div>
    </div>
  );
};

export default DepartmentsPositions;
