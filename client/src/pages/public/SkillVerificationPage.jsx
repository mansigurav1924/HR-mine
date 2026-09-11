import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
});

export default function SkillVerificationPage() {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [candidateData, setCandidateData] = useState(null);

  // Skill items state: [{ skill: string, rating: string, isCustom: boolean }]
  const [skillsList, setSkillsList] = useState([]);
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    loadSkills();
  }, [token]);

  const loadSkills = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/public/applications/skills/${token}`);
      setCandidateData(res.data);

      // Combine required, preferred, and initial skills uniquely
      const initialSkills = new Set([
        ...(res.data.required_skills || []),
        ...(res.data.preferred_skills || []),
        ...(res.data.initial_skills || [])
      ]);

      const items = Array.from(initialSkills).map(s => ({
        skill: s,
        rating: 'intermediate', // sensible default
        isCustom: false
      }));

      setSkillsList(items.length > 0 ? items : [
        { skill: 'Core Technical Concepts', rating: 'intermediate', isCustom: false }
      ]);
    } catch (err) {
      console.error('Failed to load skill verification', err);
      setError(err.response?.data?.detail || 'This skill verification link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleRatingChange = (index, rating) => {
    const updated = [...skillsList];
    updated[index].rating = rating;
    setSkillsList(updated);
  };

  const handleAddCustomSkill = (e) => {
    e.preventDefault();
    const trimmed = customSkillInput.trim();
    if (!trimmed) return;

    if (skillsList.some(s => s.skill.toLowerCase() === trimmed.toLowerCase())) {
      setValidationError(`Skill "${trimmed}" is already in the list.`);
      return;
    }

    setSkillsList([...skillsList, { skill: trimmed, rating: 'intermediate', isCustom: true }]);
    setCustomSkillInput('');
    setValidationError('');
  };

  const handleRemoveCustomSkill = (index) => {
    setSkillsList(skillsList.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    if (!confirmed) {
      setValidationError('Please check the confirmation box to verify your skills.');
      return;
    }

    if (skillsList.length === 0) {
      setValidationError('Please rate at least one skill.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/api/public/applications/skills/${token}/verify`, {
        skills: skillsList.map(s => ({ skill: s.skill, rating: s.rating })),
        confirmed: true
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Verification failed', err);
      setValidationError(err.response?.data?.detail || 'Skill verification could not be submitted. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const ratingOptions = [
    { value: 'none', label: 'None', desc: 'No experience' },
    { value: 'beginner', label: 'Beginner', desc: 'Basic knowledge' },
    { value: 'intermediate', label: 'Intermediate', desc: 'Working proficiency' },
    { value: 'advanced', label: 'Advanced', desc: 'Strong mastery' }
  ];

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
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                Step 2 of 2: Skill Verification
              </span>
            </div>
          </div>
          <span className="text-xs text-gray-500 font-medium">Candidate Verification</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-gray-500">Loading skill verification details...</p>
          </div>
        ) : error ? (
          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm text-center space-y-4 max-w-lg mx-auto">
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-2xl mx-auto">
              ⚠️
            </div>
            <h2 className="text-xl font-bold text-gray-900">Verification Link Unavailable</h2>
            <p className="text-sm text-gray-600">{error}</p>
            <div className="pt-2">
              <Link
                to="/apply"
                className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                Back to Application Portal
              </Link>
            </div>
          </div>
        ) : submitted ? (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xl p-8 sm:p-10 text-center space-y-6 max-w-xl mx-auto animate-fade-in">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-4xl shadow-inner">
              ✓
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                Skill Verification Complete!
              </h1>
              <p className="text-sm text-gray-600">
                Thank you, <span className="font-semibold text-gray-900">{candidateData?.candidate_name}</span>. Your verified skill profile for <span className="font-semibold text-indigo-600">{candidateData?.position}</span> has been saved and queued for recruitment evaluation.
              </p>
            </div>

            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-left space-y-2 text-xs text-indigo-900">
              <h4 className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span>📋</span> Next Steps
              </h4>
              <ul className="space-y-1 list-disc list-inside leading-relaxed text-indigo-800">
                <li>Our AI evaluation and recruitment team will review your complete profile.</li>
                <li>Shortlisted applicants will receive a skill assessment link via email.</li>
                <li>Please keep an eye on your inbox for interview updates.</li>
              </ul>
            </div>

            <div className="pt-2">
              <Link
                to="/apply"
                className="inline-flex items-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
              >
                Back to Careers Portal
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold border border-indigo-200">
                  <span>🏢</span>
                  <span>{candidateData?.department || 'Department'}</span>
                </div>
                <span className="text-xs font-semibold text-gray-500">Step 2 of 2</span>
              </div>

              <h1 className="text-2xl font-bold text-gray-900">
                Verify Your Technical Skills
              </h1>
              <p className="text-sm text-gray-600">
                Hi <span className="font-semibold text-gray-900">{candidateData?.candidate_name}</span>, please rate your proficiency for each job-relevant skill required for the <span className="font-semibold text-indigo-600">{candidateData?.position}</span> position.
              </p>
            </div>

            {/* Validation Banner */}
            {validationError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2">
                <span>⚠️</span>
                <p className="font-medium">{validationError}</p>
              </div>
            )}

            {/* Skills Verification Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Job-Relevant Skills & Proficiency</h3>
                    <p className="text-xs text-gray-500">Rate your current confidence and expertise level.</p>
                  </div>
                  <span className="text-xs text-indigo-600 font-semibold">{skillsList.length} Skills</span>
                </div>

                <div className="space-y-4 divide-y divide-gray-100">
                  {skillsList.map((item, idx) => (
                    <div key={idx} className="pt-4 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.skill}</p>
                          {item.isCustom && (
                            <span className="text-[10px] text-gray-400">Custom added</span>
                          )}
                        </div>
                        {item.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomSkill(idx)}
                            className="text-xs text-red-500 hover:text-red-700 ml-2"
                            title="Remove skill"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {/* Rating Radio Buttons */}
                      <div className="grid grid-cols-4 gap-1.5 bg-slate-50 p-1 rounded-xl border border-gray-200 text-xs font-medium max-w-sm sm:max-w-md w-full">
                        {ratingOptions.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleRatingChange(idx, opt.value)}
                            className={`py-1.5 px-2 rounded-lg text-center transition-all ${
                              item.rating === opt.value
                                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                                : 'text-gray-600 hover:bg-white/80 hover:text-gray-900'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Custom Skill */}
                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                    Add Additional Skill
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customSkillInput}
                      onChange={(e) => setCustomSkillInput(e.target.value)}
                      placeholder="e.g. PyTorch, Kubernetes, GraphQL"
                      className="flex-1 px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomSkill}
                      className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-sm rounded-lg border border-indigo-200 transition-colors"
                    >
                      + Add Skill
                    </button>
                  </div>
                </div>
              </div>

              {/* Confirmation & Submit */}
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm space-y-5">
                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-gray-200">
                  <input
                    type="checkbox"
                    id="skill_confirm"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="skill_confirm" className="text-sm text-gray-700 cursor-pointer leading-relaxed">
                    I confirm that the skill information I provided is accurate and reflects my true experience. <span className="text-red-500">*</span>
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-xs text-gray-500">
                    Your responses will be securely reviewed by our recruitment team.
                  </p>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Saving & Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span>Save & Complete Verification</span>
                        <span>✓</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Public Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 text-center text-xs text-gray-500">
        <p>© {new Date().getFullYear()} HR Recruitment System. All rights reserved.</p>
      </footer>
    </div>
  );
}
