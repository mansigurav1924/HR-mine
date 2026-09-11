import React, { useState } from 'react';
import ReadyForHandoffTab from '../components/onboarding/ReadyForHandoffTab';
import OnboardingListTab from '../components/onboarding/OnboardingListTab';

export default function Onboarding() {
  const [activeTab, setActiveTab] = useState('Ready for Handoff');
  const tabs = ['Ready for Handoff', 'In Progress', 'Completed'];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Onboarding Handoff</h1>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="pt-4">
        {activeTab === 'Ready for Handoff' && <ReadyForHandoffTab />}
        {activeTab === 'In Progress' && <OnboardingListTab statusFilter="pending" />}
        {activeTab === 'Completed' && <OnboardingListTab statusFilter="completed" />}
      </div>
    </div>
  );
}
