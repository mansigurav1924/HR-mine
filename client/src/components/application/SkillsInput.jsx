import React, { useState } from 'react';

export default function SkillsInput({ skills, onChange, suggestedSkills = [] }) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(inputValue);
    }
  };

  const addSkill = (skillText) => {
    const trimmed = skillText.trim().replace(/^,|,$/g, '');
    if (!trimmed) return;

    // Check if already in skills list
    if (!skills.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...skills, trimmed]);
    }
    setInputValue('');
  };

  const removeSkill = (skillToRemove) => {
    onChange(skills.filter(s => s !== skillToRemove));
  };

  const addSuggested = (skill) => {
    if (!skills.some(s => s.toLowerCase() === skill.toLowerCase())) {
      onChange([...skills, skill]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 p-2.5 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 bg-white min-h-[46px]">
        {skills.map((skill, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-md border border-indigo-200"
          >
            {skill}
            <button
              type="button"
              onClick={() => removeSkill(skill)}
              className="text-indigo-400 hover:text-indigo-600 focus:outline-none"
              title="Remove skill"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addSkill(inputValue)}
          placeholder={skills.length === 0 ? "Type skill and press Enter or comma (e.g. React, Python)" : "Add another skill..."}
          className="flex-1 min-w-[140px] border-none p-1 text-sm focus:ring-0 focus:outline-none"
        />
      </div>

      {suggestedSkills.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 mt-1.5">
          <span className="font-medium text-gray-600">Suggested:</span>
          {suggestedSkills.map((skill, idx) => {
            const isAdded = skills.some(s => s.toLowerCase() === skill.toLowerCase());
            return (
              <button
                key={idx}
                type="button"
                onClick={() => addSuggested(skill)}
                disabled={isAdded}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  isAdded
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-default'
                    : 'bg-white hover:bg-indigo-50 hover:text-indigo-700 text-gray-600 border-gray-300 cursor-pointer'
                }`}
              >
                + {skill}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
