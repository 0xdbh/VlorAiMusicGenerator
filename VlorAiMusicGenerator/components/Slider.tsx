
import React from 'react';

interface SliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const Slider: React.FC<SliderProps> = ({
  label,
  min,
  max,
  step,
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs text-gray-400">
        <label htmlFor={label}>{label}</label>
        <span>{value.toFixed(label === 'BPM' ? 0 : 2)}</span>
      </div>
      <input
        id={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500
                   [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-purple-500"
      />
    </div>
  );
};

export default Slider;
