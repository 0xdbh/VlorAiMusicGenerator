
import React, { useState, useRef, useEffect } from 'react';

interface MultiSelectProps {
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ options, selectedOptions, onChange, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleSelect = (option: string) => {
    const newSelected = selectedOptions.includes(option)
      ? selectedOptions.filter((o) => o !== option)
      : [...selectedOptions, option];
    onChange(newSelected);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-left text-sm flex justify-between items-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate text-gray-300">
          {selectedOptions.length > 0 ? selectedOptions.join(', ') : 'Select instruments...'}
        </span>
        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
          <ul className="py-1">
            {options.map((option) => (
              <li
                key={option}
                onClick={() => handleSelect(option)}
                className="px-3 py-2 text-sm text-gray-200 cursor-pointer hover:bg-purple-600 flex items-center justify-between"
              >
                <span>{option}</span>
                {selectedOptions.includes(option) && (
                  <svg className="h-5 w-5 text-purple-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
