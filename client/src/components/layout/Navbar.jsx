import { useEffect, useState, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { globalSearch } from '../../services/analyticsApi';

const Navbar = () => {
  const [status, setStatus] = useState('Checking...');
  const [supabaseStatus, setSupabaseStatus] = useState('Checking...');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Search state
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ applications: [], interviews: [], offers: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  const isHrAdmin = user?.role !== 'interviewer';

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await api.get('/api/health');
        if (response.data.status === 'healthy') {
          setStatus('Connected');
        } else {
          setStatus('Disconnected');
        }
      } catch (error) {
        setStatus('Disconnected');
      }
    };

    const checkSupabaseHealth = async () => {
      try {
        const response = await api.get('/api/health/supabase');
        if (response.data.status === 'connected') {
          setSupabaseStatus('Connected');
        } else {
          setSupabaseStatus('Disconnected');
        }
      } catch (error) {
        setSupabaseStatus('Disconnected');
      }
    };

    checkHealth();
    checkSupabaseHealth();
  }, []);

  // Debounced search effect (300ms)
  useEffect(() => {
    if (!isHrAdmin || query.trim().length < 2) {
      setSearchResults({ applications: [], interviews: [], offers: [] });
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await globalSearch(query);
        setSearchResults(res);
        setShowDropdown(true);
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, isHrAdmin]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSelectResult = (path) => {
    setShowDropdown(false);
    setQuery('');
    navigate(path);
  };

  const hasResults =
    (searchResults.applications?.length || 0) > 0 ||
    (searchResults.interviews?.length || 0) > 0 ||
    (searchResults.offers?.length || 0) > 0;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-3 flex justify-between items-center relative z-30">
      <div className="flex items-center gap-6 flex-1 max-w-2xl">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight shrink-0">HR Recruitment System</h2>

        {/* Global Search Bar (HR Admin Only) */}
        {isHrAdmin && (
          <div className="relative flex-1" ref={searchRef}>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 text-sm">
                🔍
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (e.target.value.length >= 2) setShowDropdown(true);
                }}
                onFocus={() => {
                  if (query.length >= 2) setShowDropdown(true);
                }}
                placeholder="Search candidates, positions, emails, departments..."
                className="w-full pl-9 pr-8 py-1.5 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
              {isSearching && (
                <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-400">
                  ...
                </span>
              )}
            </div>

            {/* Search Dropdown */}
            {showDropdown && query.trim().length >= 2 && (
              <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-gray-200 max-h-96 overflow-y-auto py-2 z-50 animate-fade-in divide-y divide-gray-100">
                {/* Applications Group */}
                {searchResults.applications?.length > 0 && (
                  <div className="py-2">
                    <div className="px-3 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Candidates & Applications
                    </div>
                    {searchResults.applications.map((app) => (
                      <div
                        key={app.application_id}
                        onClick={() => handleSelectResult('/applications')}
                        className="px-4 py-2 hover:bg-indigo-50 cursor-pointer flex justify-between items-center transition-colors"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{app.candidate_name}</p>
                          <p className="text-xs text-gray-500">{app.email} • {app.position || 'General'}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                          {app.current_status || 'applied'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Interviews Group */}
                {searchResults.interviews?.length > 0 && (
                  <div className="py-2">
                    <div className="px-3 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Interviews
                    </div>
                    {searchResults.interviews.map((intv) => (
                      <div
                        key={intv.interview_id}
                        onClick={() => handleSelectResult('/interviews')}
                        className="px-4 py-2 hover:bg-indigo-50 cursor-pointer flex justify-between items-center transition-colors"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {intv.candidate_name} ({intv.type})
                          </p>
                          <p className="text-xs text-gray-500">{intv.position} • {intv.date || 'TBD'}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                          {intv.status || 'scheduled'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Offers Group */}
                {searchResults.offers?.length > 0 && (
                  <div className="py-2">
                    <div className="px-3 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Offers
                    </div>
                    {searchResults.offers.map((off) => (
                      <div
                        key={off.offer_id}
                        onClick={() => handleSelectResult('/offers')}
                        className="px-4 py-2 hover:bg-indigo-50 cursor-pointer flex justify-between items-center transition-colors"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{off.candidate_name}</p>
                          <p className="text-xs text-gray-500">{off.designation} • {off.department}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold uppercase">
                          {off.offer_status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {!hasResults && !isSearching && (
                  <div className="py-6 text-center text-sm text-gray-400">
                    No results found for "{query}".
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <span className={`px-3 py-1 text-xs rounded-full font-medium flex items-center gap-1.5 ${
          supabaseStatus === 'Connected' ? 'bg-emerald-100 text-emerald-800' : 
          supabaseStatus === 'Checking...' ? 'bg-amber-100 text-amber-800' : 
          'bg-rose-100 text-rose-800'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            supabaseStatus === 'Connected' ? 'bg-emerald-500' : 
            supabaseStatus === 'Checking...' ? 'bg-amber-500' : 
            'bg-rose-500'
          }`}></span>
          Supabase: {supabaseStatus}
        </span>
        <span className={`px-3 py-1 text-xs rounded-full font-medium flex items-center gap-1.5 ${
          status === 'Connected' ? 'bg-emerald-100 text-emerald-800' : 
          status === 'Checking...' ? 'bg-amber-100 text-amber-800' : 
          'bg-rose-100 text-rose-800'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            status === 'Connected' ? 'bg-emerald-500' : 
            status === 'Checking...' ? 'bg-amber-500' : 
            'bg-rose-500'
          }`}></span>
          Backend: {status}
        </span>
        
        <div className="flex items-center gap-3 pl-4 border-l border-gray-200 ml-2">
          <div className="text-xs font-semibold text-gray-700">
            {user?.email || 'HR Admin'}
          </div>
          <button 
            onClick={handleLogout}
            className="text-xs text-gray-500 hover:text-rose-600 transition-colors font-medium px-2 py-1 rounded hover:bg-rose-50"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
