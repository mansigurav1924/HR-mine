import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
  const { user } = useAuth();
  
  const hrLinks = [
    { name: 'Dashboard', path: '/' },
    { name: 'Applications', path: '/applications' },
    { name: 'Departments & Positions', path: '/departments-positions' },
    { name: 'ML Shortlisting', path: '/shortlisting' },
    { name: 'Assessments', path: '/assessments' },
    { name: 'AI Interviews', path: '/ai-interviews' },
    { name: 'Human Interviews', path: '/interviews' },
    { name: 'Final Selection', path: '/final-selection' },
    { name: 'Offer Letters', path: '/offers' },
    { name: 'Audit Logs', path: '/audit-logs' },
    { name: 'Settings', path: '/settings' },
  ];

  const interviewerLinks = [
    { name: 'My Interviews', path: '/my-interviews' }
  ];

  const userRole = user?.role || user?.user_metadata?.role || 'hr_admin';
  const links = userRole === 'interviewer' ? interviewerLinks : hrLinks;

  return (
    <div className="w-64 bg-slate-900 text-white min-h-screen flex flex-col shrink-0">
      <div className="p-4 text-xl font-bold border-b border-slate-800 flex items-center gap-2">
        <span>🏢</span> HR Portal
      </div>
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {links.map((link) => {
          if (link.requiresHrAdmin && userRole !== 'hr_admin') return null;
          return (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {link.icon && <span>{link.icon}</span>}
              <span>{link.name}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;
