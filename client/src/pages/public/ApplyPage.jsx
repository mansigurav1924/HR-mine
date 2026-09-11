import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchPublicJob, fetchPublicJobs } from '../../services/publicApi';
import PublicApplicationForm from '../../components/application/PublicApplicationForm';

export default function ApplyPage() {
  const { positionId } = useParams();

  const [selectedJob, setSelectedJob] = useState(null);
  const [availableJobs, setAvailableJobs] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [positionId]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      if (positionId) {
        // Direct position link
        try {
          const job = await fetchPublicJob(positionId);
          setSelectedJob(job);
        } catch (jobErr) {
          setError(jobErr.response?.data?.detail || 'This position is no longer accepting applications or the link is invalid.');
        }
        const allJobs = await fetchPublicJobs();
        setAvailableJobs(allJobs || []);
      } else {
        // Generic application link
        const jobs = await fetchPublicJobs();
        setAvailableJobs(jobs || []);
        if (jobs && jobs.length > 0) {
          setSelectedJob(jobs[0]);
        }
      }
    } catch (err) {
      console.error('Error loading job details', err);
      if (!error) {
        setError('Unable to load open positions. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const departments = ['All', ...new Set((availableJobs || []).map(j => j.department).filter(Boolean))];

  const filteredJobs = (availableJobs || []).filter(j => {
    if (selectedDepartment === 'All') return true;
    return j.department === selectedDepartment;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-800">
      {/* Public Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              HR
            </div>
            <div>
              <span className="font-bold text-gray-900 tracking-tight text-base">Talent Acquisition Portal</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                Open for Applications
              </span>
            </div>
          </div>

          <Link
            to="/login"
            className="text-xs font-medium text-gray-500 hover:text-indigo-600 transition-colors flex items-center gap-1"
          >
            <span>HR Portal Login</span>
            <span>→</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-gray-500">Loading open positions...</p>
          </div>
        ) : error ? (
          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm text-center space-y-4 max-w-lg mx-auto">
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-2xl mx-auto">
              ⚠️
            </div>
            <h2 className="text-xl font-bold text-gray-900">Position Unavailable</h2>
            <p className="text-sm text-gray-600">{error}</p>
            <div className="pt-2">
              <Link
                to="/apply"
                className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                Browse All Open Positions
              </Link>
            </div>
          </div>
        ) : selectedJob?.effective_status && selectedJob.effective_status !== 'OPEN' ? (
          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm text-center space-y-4 max-w-lg mx-auto mt-12">
            <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center text-3xl mx-auto">
              {selectedJob.effective_status === 'SCHEDULED' ? '⏳' : selectedJob.effective_status === 'PAUSED' ? '⏸️' : '🔒'}
            </div>
            
            {selectedJob.effective_status === 'CLOSED' && (
              <>
                <h2 className="text-2xl font-bold text-gray-900">Applications Closed</h2>
                <p className="text-gray-600 leading-relaxed">
                  Applications for the <strong className="text-gray-900">{selectedJob.position_title}</strong> position closed on <strong className="text-gray-900">{new Date(selectedJob.application_close_at).toLocaleDateString()}</strong>.
                </p>
                <p className="text-sm text-gray-500">Please check other available opportunities.</p>
              </>
            )}

            {selectedJob.effective_status === 'SCHEDULED' && (
              <>
                <h2 className="text-2xl font-bold text-gray-900">Applications Opening Soon</h2>
                <p className="text-gray-600 leading-relaxed">
                  Applications for this position will open on: <br/>
                  <strong className="text-gray-900 text-lg">{new Date(selectedJob.application_open_at).toLocaleString()}</strong>
                </p>
                <p className="text-sm text-gray-500">Please return after the application period begins.</p>
              </>
            )}

            {selectedJob.effective_status === 'PAUSED' && (
              <>
                <h2 className="text-2xl font-bold text-gray-900">Applications Temporarily Paused</h2>
                <p className="text-gray-600 leading-relaxed">
                  Applications for this position are temporarily unavailable.
                </p>
                <p className="text-sm text-gray-500">Please check again later.</p>
              </>
            )}

            <div className="pt-6">
              <Link
                to="/apply"
                className="inline-flex items-center px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow"
              >
                View Open Positions
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Position Overview Banner */}
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
              <div className="relative z-10 space-y-3">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-medium text-indigo-100 border border-white/10">
                  <span>🏢</span>
                  <span>{selectedJob?.department || 'Multiple Departments Open'}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {selectedJob?.position_title || selectedJob?.position || 'Join Our Team'}
                </h1>
                <p className="text-indigo-200 text-sm max-w-2xl leading-relaxed">
                  Explore opportunities across Engineering, Marketing, Sales, HR, AI/ML, Business Analytics, Content Creation, and more.
                </p>

                {selectedJob?.required_skills && selectedJob.required_skills.length > 0 && (
                  <div className="pt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-indigo-200 mr-1">Key Skills:</span>
                    {selectedJob.required_skills.map((skill, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-0.5 bg-indigo-700/60 text-indigo-100 rounded-md text-xs font-medium border border-indigo-500/30"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Department Quick Selection Tabs */}
            {departments.length > 1 && (
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Browse by Department</h3>
                  <span className="text-xs text-gray-400">{availableJobs.length} Open Positions</span>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {departments.map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => setSelectedDepartment(dept)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        selectedDepartment === dept
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>

                {/* Role Quick Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  {filteredJobs.map((job) => (
                    <button
                      key={job.position_id}
                      type="button"
                      onClick={() => setSelectedJob(job)}
                      className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                        selectedJob?.position_id === job.position_id
                          ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500'
                          : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-bold text-gray-900">{job.position_title || job.position}</div>
                        <div className="text-xs text-gray-500">{job.department}</div>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        selectedJob?.position_id === job.position_id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {selectedJob?.position_id === job.position_id ? 'Selected' : 'Select'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Application Form */}
            <PublicApplicationForm
              selectedJob={selectedJob}
              availableJobs={availableJobs}
              onJobSelect={(job) => setSelectedJob(job)}
            />
          </>
        )}
      </main>

      {/* Public Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 text-center text-xs text-gray-500">
        <div className="max-w-5xl mx-auto px-4">
          <p>© {new Date().getFullYear()} HR Recruitment System. All rights reserved. Candidate privacy is protected under strict confidentiality.</p>
        </div>
      </footer>
    </div>
  );
}
