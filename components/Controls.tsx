
import React from 'react';
import { DesignParams } from '../types';
import { Sliders, Wind, Ruler, Compass } from 'lucide-react';

interface ControlsProps {
  params: DesignParams;
  onChange: (newParams: DesignParams) => void;
}

export const Controls: React.FC<ControlsProps> = ({ params, onChange }) => {
  
  const handleChange = (key: keyof DesignParams, value: number) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <div className="space-y-6 p-4 bg-slate-800 rounded-lg shadow-lg h-full overflow-y-auto border border-slate-700">
      <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4 border-b border-slate-700 pb-2">
        <Sliders className="w-5 h-5 text-indigo-400" />
        Parameters
      </h2>

      {/* Geometry Group */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Ruler className="w-4 h-4" /> Rotor Geometry
        </h3>
        
        <ControlInput 
          label="Blade Length (Radius)" 
          value={params.bladeLength} 
          min={0.2} max={3.0} step={0.1} unit="m"
          onChange={(v) => handleChange('bladeLength', v)} 
        />
        <ControlInput 
          label="Blade Chord" 
          value={params.bladeChord} 
          min={0.05} max={0.4} step={0.01} unit="m"
          onChange={(v) => handleChange('bladeChord', v)} 
        />
        <ControlInput 
          label="Blade Pitch" 
          value={params.bladePitch} 
          min={-5} max={15} step={0.5} unit="deg"
          onChange={(v) => handleChange('bladePitch', v)} 
        />
         <ControlInput 
          label="Rotor Mass" 
          value={params.rotorMass} 
          min={0.1} max={5.0} step={0.1} unit="kg"
          onChange={(v) => handleChange('rotorMass', v)} 
        />
      </div>

      <div className="border-t border-slate-700 my-4"></div>

      {/* Control / Bearing Group */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Compass className="w-4 h-4" /> Spherical Bearing Control
        </h3>
        
        <ControlInput 
          label="Rotor Tilt" 
          value={params.rotorTilt || 0} 
          min={-20} max={20} step={1} unit="deg"
          onChange={(v) => handleChange('rotorTilt', v)} 
        />
        <p className="text-xs text-slate-500 italic">
          Positive tilts rotor back (increasing angle of attack). Negative tilts forward.
        </p>
      </div>

      <div className="border-t border-slate-700 my-4"></div>

      {/* Environment Group */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Wind className="w-4 h-4" /> Environment
        </h3>
        
        <ControlInput 
          label="Wind Speed" 
          value={params.windSpeed} 
          min={0} max={30} step={0.5} unit="m/s"
          onChange={(v) => handleChange('windSpeed', v)} 
        />
         <ControlInput 
          label="Line Elevation" 
          value={params.lineAngle} 
          min={5} max={85} step={1} unit="deg"
          onChange={(v) => handleChange('lineAngle', v)} 
        />
        <p className="text-xs text-slate-500 italic">
          Angle of the kite line relative to the ground (0° = Horizontal, 90° = Vertical).
        </p>
      </div>
    </div>
  );
};

const ControlInput: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (val: number) => void;
}> = ({ label, value, min, max, step, unit, onChange }) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between text-sm text-slate-300">
      <span>{label}</span>
      <span className="font-mono text-indigo-300">{value} {unit}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
    />
  </div>
);