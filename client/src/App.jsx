import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MFAGuard from './components/auth/MFAGuard';
import Login from './pages/Login';
import MFASetup from './pages/MFASetup';
import MFAVerify from './pages/MFAVerify';

import DashboardLayout from './components/layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import DepartmentsPositions from './pages/DepartmentsPositions';
import Shortlisting from './pages/Shortlisting';
import Assessments from './pages/Assessments';
import AIInterviews from './pages/AIInterviews';
import Interviews from './pages/Interviews';
import MyInterviews from './pages/MyInterviews';
import FinalSelection from './pages/FinalSelection';
import Offers from './pages/Offers';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';

import CandidateAssessment from './pages/candidate/CandidateAssessment';
import CandidateOfferResponse from './pages/CandidateOfferResponse';

import AIInterviewPlaceholder from './pages/candidate/AIInterviewPlaceholder';
import ApplyPage from './pages/public/ApplyPage';
import ApplicationSuccess from './pages/public/ApplicationSuccess';
import SkillVerificationPage from './pages/public/SkillVerificationPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Candidate Routes (No Login / Auth Required) */}
          <Route path="/login" element={<Login />} />
          <Route path="/apply" element={<ApplyPage />} />
          <Route path="/apply/:positionId" element={<ApplyPage />} />
          <Route path="/apply/skills/:token" element={<SkillVerificationPage />} />
          <Route path="/apply-success" element={<ApplicationSuccess />} />
          <Route path="/assessment/:token" element={<CandidateAssessment />} />
          <Route path="/offer-response/:token" element={<CandidateOfferResponse />} />

          <Route path="/ai-interview/:token" element={<AIInterviewPlaceholder />} />
          
          {/* Protected HR Admin & Interviewer Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/mfa-setup" element={<MFASetup />} />
            <Route path="/mfa-verify" element={<MFAVerify />} />
            
            {/* Main Application Layout */}
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="applications" element={<Applications />} />
              <Route path="departments-positions" element={<DepartmentsPositions />} />
              <Route path="shortlisting" element={<Shortlisting />} />
              <Route path="assessments" element={<Assessments />} />
              <Route path="ai-interviews" element={<AIInterviews />} />
              <Route path="interviews" element={<Interviews />} />
              <Route path="my-interviews" element={<MyInterviews />} />
              <Route path="final-selection" element={<FinalSelection />} />
              <Route path="offers" element={<Offers />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="audit" element={<AuditLogs />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
