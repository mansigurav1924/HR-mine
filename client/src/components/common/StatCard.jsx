import React from 'react';

const StatCard = ({ title, value, subtitle, color = 'indigo', icon, badge }) => {
  const colorMap = {
    indigo: 'border-indigo-100 bg-white hover:border-indigo-300 text-indigo-600',
    emerald: 'border-emerald-100 bg-white hover:border-emerald-300 text-emerald-600',
    amber: 'border-amber-100 bg-white hover:border-amber-300 text-amber-600',
    rose: 'border-rose-100 bg-white hover:border-rose-300 text-rose-600',
    purple: 'border-purple-100 bg-white hover:border-purple-300 text-purple-600',
    blue: 'border-blue-100 bg-white hover:border-blue-300 text-blue-600',
    slate: 'border-slate-200 bg-white hover:border-slate-300 text-slate-700',
  };

  return (
    <div className={`p-5 rounded-xl shadow-sm border transition-all duration-200 hover:shadow-md flex flex-col justify-between ${colorMap[color] || colorMap.indigo}`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{title}</h3>
        {icon && <span className="text-xl">{icon}</span>}
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-700">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-1">
        <span className="text-3xl font-extrabold text-gray-900 tracking-tight">{value ?? 0}</span>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};

export default StatCard;
