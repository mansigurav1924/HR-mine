import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SkillsInput from './SkillsInput';
import ResumeUploadField from './ResumeUploadField';
import { submitPublicApplication, parsePublicResume } from '../../services/publicApi';

export default function PublicApplicationForm({ selectedJob, availableJobs = [], onJobSelect }) {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    position_id: selectedJob?.position_id || '',
    custom_role: '',
    full_name: '',
    email: '',
    phone: '',
    college: '',
    degree: '',
    current_year: '',
    skills: [],
    experience: '',
    projects: '',
    github_url: '',
    linkedin_url: '',
    portfolio_url: '',
    consent_given: false
  });

  const [resumeFile, setResumeFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseStatus, setParseStatus] = useState(null); // { type: 'success' | 'warning', message: string }
  const [autoFilledFields, setAutoFilledFields] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (selectedJob) {
      setFormData(prev => ({
        ...prev,
        position_id: selectedJob.position_id
      }));
    }
  }, [selectedJob]);

  const isOtherRole = (selectedJob?.position_title || '').toLowerCase().includes('other') ||
                      (selectedJob?.position_title || '').toLowerCase().includes('general');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handlePositionChange = (e) => {
    const posId = e.target.value;
    setFormData(prev => ({ ...prev, position_id: posId }));
    if (onJobSelect) {
      const job = availableJobs.find(j => j.position_id === posId);
      onJobSelect(job);
    }
  };

  // Handle Resume File Selection & Full Auto-Parsing
  const handleResumeSelect = async (file) => {
    setResumeFile(file);
    if (fieldErrors.resume) {
      setFieldErrors(prev => ({ ...prev, resume: '' }));
    }

    // Trigger auto-extraction
    setIsParsing(true);
    setParseStatus(null);

    try {
      const res = await parsePublicResume(file);
      const payload = res?.data || res;
      if (payload && payload.parsed) {
        const pName = payload.personal?.full_name || payload.full_name || '';
        const pEmail = payload.personal?.email || payload.email || '';
        const pPhone = payload.personal?.phone || payload.phone || '';
        const pCollege = payload.education?.college || payload.college || '';
        const pDegree = payload.education?.degree || payload.degree || '';
        const pYear = payload.education?.current_year || payload.current_year || '';
        const pExp = payload.experience?.summary || payload.experience_summary || '';
        const pProj = payload.projects_summary || (Array.isArray(payload.projects) ? payload.projects.map(p => typeof p === 'string' ? p : `${p.name}: ${p.description}`).join('\n\n') : '') || '';
        
        const links = payload.links || {};
        const pGithub = links.github_url || payload.github_url || '';
        const pLinkedin = links.linkedin_url || payload.linkedin_url || '';
        const pPortfolio = links.portfolio_url || payload.portfolio_url || '';

        const newFilled = {};

        // Auto-fill extracted values non-destructively
        setFormData(prev => {
          // Merge skills case-insensitively
          const existingSkillsLower = new Set((prev.skills || []).map(s => s.toLowerCase()));
          const newSkills = [...(prev.skills || [])];
          (payload.skills || []).forEach(skill => {
            if (!existingSkillsLower.has(skill.toLowerCase())) {
              newSkills.push(skill);
              existingSkillsLower.add(skill.toLowerCase());
            }
          });

          if (payload.skills && payload.skills.length > 0) newFilled.skills = true;
          if (!prev.full_name.trim() && pName) newFilled.full_name = true;
          if (!prev.email.trim() && pEmail) newFilled.email = true;
          if (!prev.phone.trim() && pPhone) newFilled.phone = true;
          if (!prev.college.trim() && pCollege) newFilled.college = true;
          if (!prev.degree.trim() && pDegree) newFilled.degree = true;
          if (!prev.current_year.trim() && pYear) newFilled.current_year = true;
          if (!prev.experience.trim() && pExp) newFilled.experience = true;
          if (!prev.projects.trim() && pProj) newFilled.projects = true;
          if (!prev.github_url.trim() && pGithub) newFilled.github_url = true;
          if (!prev.linkedin_url.trim() && pLinkedin) newFilled.linkedin_url = true;
          if (!prev.portfolio_url.trim() && pPortfolio) newFilled.portfolio_url = true;

          return {
            ...prev,
            full_name: prev.full_name.trim() ? prev.full_name : pName,
            email: prev.email.trim() ? prev.email : pEmail,
            phone: prev.phone.trim() ? prev.phone : pPhone,
            college: prev.college.trim() ? prev.college : pCollege,
            degree: prev.degree.trim() ? prev.degree : pDegree,
            current_year: prev.current_year.trim() ? prev.current_year : pYear,
            skills: newSkills,
            experience: prev.experience.trim() ? prev.experience : pExp,
            projects: prev.projects.trim() ? prev.projects : pProj,
            github_url: prev.github_url.trim() ? prev.github_url : pGithub,
            linkedin_url: prev.linkedin_url.trim() ? prev.linkedin_url : pLinkedin,
            portfolio_url: prev.portfolio_url.trim() ? prev.portfolio_url : pPortfolio
          };
        });

        setAutoFilledFields(newFilled);

        setParseStatus({
          type: 'success',
          message: 'Resume details extracted successfully. Please review the information before submitting.'
        });
      } else {
        setParseStatus({
          type: 'warning',
          message: res?.message || "We could not extract text from this resume. Please fill the form manually."
        });
      }
    } catch (err) {
      console.warn('Resume parsing failed or was cancelled', err);
      setParseStatus({
        type: 'warning',
        message: "We couldn't automatically extract all resume details. Please review and enter any missing information manually."
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleResumeRemove = () => {
    setResumeFile(null);
    setParseStatus(null);
    setAutoFilledFields({});
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.position_id) errors.position_id = 'Please select a target position.';
    if (isOtherRole && !formData.custom_role.trim()) {
      errors.custom_role = 'Please specify your desired role or domain of interest.';
    }
    if (!formData.full_name.trim()) errors.full_name = 'Full name is required.';
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'A valid email address is required (e.g. name@example.com).';
    }
    if (!formData.phone.trim() || formData.phone.trim().length < 7) {
      errors.phone = 'A valid contact phone number is required.';
    }
    if (!formData.skills || formData.skills.length === 0) {
      errors.skills = 'Please specify at least one skill or select from suggestions.';
    }
    if (!resumeFile) {
      errors.resume = 'Please upload your resume (PDF or DOCX).';
    }
    if (!formData.consent_given) {
      errors.consent_given = 'You must check the consent checkbox to submit your application.';
    }

    setFieldErrors(errors);
    const errorList = Object.values(errors).filter(Boolean);
    if (errorList.length > 0) {
      setErrorMsg(`Please complete all required fields: ${errorList.join(' • ')}`);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      // Auto-normalize URLs to prevent protocol issues
      let gh = formData.github_url.trim();
      if (gh && !/^https?:\/\//i.test(gh)) gh = 'https://' + gh;

      let li = formData.linkedin_url.trim();
      if (li && !/^https?:\/\//i.test(li)) li = 'https://' + li;

      let pf = formData.portfolio_url.trim();
      if (pf && !/^https?:\/\//i.test(pf)) pf = 'https://' + pf;

      const data = new FormData();
      data.append('position_id', formData.position_id);
      data.append('full_name', formData.full_name.trim());
      data.append('email', formData.email.trim());
      data.append('phone', formData.phone.trim());
      data.append('college', formData.college.trim());
      data.append('degree', formData.degree.trim());
      data.append('current_year', formData.current_year.trim());
      
      const allSkills = [...formData.skills];
      if (formData.custom_role.trim() && isOtherRole) {
        allSkills.unshift(`Target: ${formData.custom_role.trim()}`);
      }
      data.append('skills', allSkills.join(', '));
      
      const expText = formData.custom_role.trim() && isOtherRole
        ? `[Desired Role: ${formData.custom_role.trim()}]\n${formData.experience.trim()}`
        : formData.experience.trim();
      data.append('experience', expText);
      data.append('projects', formData.projects.trim());
      data.append('github_url', gh);
      data.append('linkedin_url', li);
      data.append('portfolio_url', pf);
      data.append('consent_given', formData.consent_given ? 'true' : 'false');
      data.append('resume', resumeFile);

      const res = await submitPublicApplication(data);

      const finalPositionTitle = isOtherRole && formData.custom_role.trim()
        ? `${formData.custom_role.trim()} (General Application)`
        : (selectedJob?.position_title || selectedJob?.position || 'Selected Position');

      navigate('/apply-success', {
        state: {
          candidate_name: formData.full_name,
          email: formData.email,
          position: finalPositionTitle,
          application_id: res.application_id,
          verification_token: res.verification_token,
          verification_url: res.verification_url
        }
      });
    } catch (err) {
      console.error('Submission failed', err);
      const msg = err.response?.data?.detail || err.response?.data?.error?.message || err.message || 'Application could not be submitted. Please try again.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // Combine suggested skills from selected job
  const suggestedSkills = [
    ...(selectedJob?.required_skills || []),
    ...(selectedJob?.preferred_skills || [])
  ];

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-8">
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-semibold">Submission Error</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Section 1: Position Selection / Details */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="border-b border-gray-100 pb-3">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">1</span>
            Target Position & Department
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Select your target position or choose General Application for custom roles.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Position <span className="text-red-500">*</span>
            </label>
            <select
              name="position_id"
              value={formData.position_id}
              onChange={handlePositionChange}
              className={`w-full px-3.5 py-2.5 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                fieldErrors.position_id ? 'border-red-400' : 'border-gray-300'
              }`}
            >
              <option value="">-- Select an Open Position --</option>
              {availableJobs.map(job => (
                <option key={job.position_id} value={job.position_id}>
                  {job.position_title || job.position} — ({job.department})
                </option>
              ))}
            </select>
            {fieldErrors.position_id && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.position_id}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Department
            </label>
            <input
              type="text"
              readOnly
              value={selectedJob?.department || (formData.position_id ? availableJobs.find(j => j.position_id === formData.position_id)?.department || 'General' : 'Select a position')}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-600 cursor-not-allowed font-medium"
            />
          </div>
        </div>

        {/* Custom Role Input if "Other / General Application" is chosen */}
        {isOtherRole && (
          <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-2 animate-fade-in">
            <label className="block text-xs font-bold text-indigo-950 uppercase tracking-wider">
              Specify Your Desired Role / Area of Interest <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="custom_role"
              placeholder="e.g. UI/UX Designer, DevOps Engineer, Legal Intern, Financial Analyst..."
              value={formData.custom_role}
              onChange={handleChange}
              className={`w-full px-3.5 py-2.5 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 ${
                fieldErrors.custom_role ? 'border-red-400' : 'border-indigo-200'
              }`}
            />
            {fieldErrors.custom_role ? (
              <p className="text-xs text-red-500 font-medium">{fieldErrors.custom_role}</p>
            ) : (
              <p className="text-xs text-indigo-700">Tell us the specific role or specialty you would like our HR recruitment team to consider you for.</p>
            )}
          </div>
        )}
      </div>

      {/* Section 2: Resume Upload with Auto-Extract */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">2</span>
              Resume Attachment <span className="text-red-500">*</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Upload your updated resume in PDF or DOCX format (Max 5 MB). The form below will automatically auto-fill for your review.</p>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200 hidden sm:inline-block">
            ⚡ Complete Auto-Fill
          </span>
        </div>

        <ResumeUploadField
          file={resumeFile}
          onFileSelect={handleResumeSelect}
          onFileRemove={handleResumeRemove}
          error={fieldErrors.resume}
          isParsing={isParsing}
          parseStatus={parseStatus}
        />
      </div>

      {/* Section 3: Personal Information */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">3</span>
              Personal Details
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">How our recruitment team can reach you.</p>
          </div>
          {(autoFilledFields.full_name || autoFilledFields.email || autoFilledFields.phone) && (
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Auto-filled from resume
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Full Name <span className="text-red-500">*</span>
              </label>
              {autoFilledFields.full_name && (
                <span className="text-[10px] text-emerald-600 font-semibold">Auto-filled</span>
              )}
            </div>
            <input
              type="text"
              name="full_name"
              placeholder="e.g. Jane Doe"
              value={formData.full_name}
              onChange={handleChange}
              className={`w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                fieldErrors.full_name ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {fieldErrors.full_name && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.full_name}</p>
            )}
          </div>

          <div className="md:col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Email Address <span className="text-red-500">*</span>
              </label>
              {autoFilledFields.email && (
                <span className="text-[10px] text-emerald-600 font-semibold">Auto-filled</span>
              )}
            </div>
            <input
              type="email"
              name="email"
              placeholder="jane.doe@example.com"
              value={formData.email}
              onChange={handleChange}
              className={`w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                fieldErrors.email ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {fieldErrors.email && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>
            )}
          </div>

          <div className="md:col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Phone Number <span className="text-red-500">*</span>
              </label>
              {autoFilledFields.phone && (
                <span className="text-[10px] text-emerald-600 font-semibold">Auto-filled</span>
              )}
            </div>
            <input
              type="tel"
              name="phone"
              placeholder="+91 98765 43210"
              value={formData.phone}
              onChange={handleChange}
              className={`w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                fieldErrors.phone ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {fieldErrors.phone && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>
            )}
          </div>
        </div>
      </div>

      {/* Section 4: Education */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">4</span>
              Education Background
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Your academic institution and qualifications.</p>
          </div>
          {(autoFilledFields.college || autoFilledFields.degree) && (
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Auto-filled from resume
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                College / University <span className="text-red-500">*</span>
              </label>
              {autoFilledFields.college && (
                <span className="text-[10px] text-emerald-600 font-semibold">Auto-filled</span>
              )}
            </div>
            <input
              type="text"
              name="college"
              placeholder="e.g. Stanford University"
              value={formData.college}
              onChange={handleChange}
              className={`w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                fieldErrors.college ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {fieldErrors.college && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.college}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Degree / Major <span className="text-red-500">*</span>
              </label>
              {autoFilledFields.degree && (
                <span className="text-[10px] text-emerald-600 font-semibold">Auto-filled</span>
              )}
            </div>
            <input
              type="text"
              name="degree"
              placeholder="e.g. B.E. in Computer Science"
              value={formData.degree}
              onChange={handleChange}
              className={`w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                fieldErrors.degree ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {fieldErrors.degree && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.degree}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Current Year / Semester
              </label>
              {autoFilledFields.current_year && (
                <span className="text-[10px] text-emerald-600 font-semibold">Auto-filled</span>
              )}
            </div>
            <input
              type="text"
              name="current_year"
              placeholder="e.g. Class of 2026 / Final Year"
              value={formData.current_year}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Section 5: Skills & Profile */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">5</span>
              Technical & Professional Skills
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Extracted from your resume. You can freely add or remove any skill tag.</p>
          </div>
          {autoFilledFields.skills && (
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Auto-filled from resume
            </span>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
            Key Skills <span className="text-red-500">*</span>
          </label>
          <SkillsInput
            skills={formData.skills}
            onChange={(newSkills) => {
              setFormData(prev => ({ ...prev, skills: newSkills }));
              if (fieldErrors.skills) {
                setFieldErrors(prev => ({ ...prev, skills: '' }));
              }
            }}
            suggestedSkills={suggestedSkills}
          />
          {fieldErrors.skills && (
            <p className="text-xs text-red-500 mt-1">{fieldErrors.skills}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Experience Summary
              </label>
              <div className="flex items-center gap-1.5">
                {autoFilledFields.experience && (
                  <span className="text-[10px] text-emerald-600 font-semibold">Auto-filled</span>
                )}
                <span className="text-[11px] text-gray-400">Editable</span>
              </div>
            </div>
            <textarea
              name="experience"
              rows={4}
              placeholder="Summary of internships, work experience, or student leadership..."
              value={formData.experience}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Key Projects / Portfolios
              </label>
              <div className="flex items-center gap-1.5">
                {autoFilledFields.projects && (
                  <span className="text-[10px] text-emerald-600 font-semibold">Auto-filled</span>
                )}
                <span className="text-[11px] text-gray-400">Editable</span>
              </div>
            </div>
            <textarea
              name="projects"
              rows={4}
              placeholder="Description of key technical projects, achievements, or portfolios..."
              value={formData.projects}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Section 6: Online Profiles */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">6</span>
              Online Profiles & Links
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Share your LinkedIn, GitHub, portfolio, or social channels.</p>
          </div>
          {(autoFilledFields.github_url || autoFilledFields.linkedin_url || autoFilledFields.portfolio_url) && (
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Auto-filled from resume
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                GitHub URL
              </label>
              {autoFilledFields.github_url && (
                <span className="text-[10px] text-emerald-600 font-semibold">Auto-filled</span>
              )}
            </div>
            <input
              type="url"
              name="github_url"
              placeholder="https://github.com/username"
              value={formData.github_url}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                LinkedIn URL
              </label>
              {autoFilledFields.linkedin_url && (
                <span className="text-[10px] text-emerald-600 font-semibold">Auto-filled</span>
              )}
            </div>
            <input
              type="url"
              name="linkedin_url"
              placeholder="https://linkedin.com/in/username"
              value={formData.linkedin_url}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Portfolio / Website
              </label>
              {autoFilledFields.portfolio_url && (
                <span className="text-[10px] text-emerald-600 font-semibold">Auto-filled</span>
              )}
            </div>
            <input
              type="url"
              name="portfolio_url"
              placeholder="https://yourportfolio.com"
              value={formData.portfolio_url}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Section 7: Consent & Submission */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <input
            type="checkbox"
            id="consent_given"
            name="consent_given"
            checked={formData.consent_given}
            onChange={handleChange}
            className="w-4 h-4 mt-0.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
          />
          <label htmlFor="consent_given" className="text-sm text-gray-700 cursor-pointer leading-relaxed">
            I consent to the processing of my application data for recruitment and evaluation purposes in accordance with the company privacy policy. <span className="text-red-500">*</span>
          </label>
        </div>
        {fieldErrors.consent_given && (
          <p className="text-xs text-red-500 font-medium">{fieldErrors.consent_given}</p>
        )}

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="font-semibold text-red-800">Cannot Submit Application</p>
              <p className="text-xs text-red-700 mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <p className="text-xs text-gray-500">
            Fields marked with <span className="text-red-500 font-bold">*</span> are required.
          </p>

          <button
            type="submit"
            disabled={loading || isParsing}
            className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Submitting application...</span>
              </>
            ) : (
              <>
                <span>Submit Application</span>
                <span className="text-lg">🚀</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
