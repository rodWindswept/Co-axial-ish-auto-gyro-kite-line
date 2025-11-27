import React, { useState, useMemo } from 'react';
import { ThreeScene } from './components/ThreeScene';
import { Controls } from './components/Controls';
import { Analysis } from './components/Analysis';
import { Assistant } from './components/Assistant';
import { DesignParams, SimulationResult, Tab } from './types';
import { calculatePhysics } from './services/physicsEngine';
import { LayoutGrid, MessageSquare, Settings } from 'lucide-react';
import clsx from 'clsx';

const DEFAULT_PARAMS: DesignParams = {
  bladeLength: 1.2,
  bladeChord: 0.15,
  bladePitch: 4.0,
  rotorMass: 1.5,
  lineTension: 200, // Initial static tension
  lineAngle: 60, // degrees
  windSpeed: 10,
  hubDiameter: 0.05,
  rotorTilt: 0 // Default aligned
};

const App: React.FC = () => {
  const [params, setParams] = useState<DesignParams>(DEFAULT_PARAMS);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DESIGN);

  const results: SimulationResult = useMemo(() => {
    return calculatePhysics(params);
  }, [params]);

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Header */}
      <header className="flex-none h-16 border-b border-slate-800 bg-slate-900 px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center transform rotate-45">
            <div className="w-5 h-1 bg-white rounded-full absolute"></div>
            <div className="w-1 h-5 bg-white rounded-full absolute"></div>
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            GyroKite Designer
          </h1>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg">
          <TabButton 
            active={activeTab === Tab.DESIGN} 
            onClick={() => setActiveTab(Tab.DESIGN)} 
            icon={<Settings className="w-4 h-4" />} 
            label="Design" 
          />
          <TabButton 
            active={activeTab === Tab.ANALYSIS} 
            onClick={() => setActiveTab(Tab.ANALYSIS)} 
            icon={<LayoutGrid className="w-4 h-4" />} 
            label="Analysis" 
          />
          <TabButton 
            active={activeTab === Tab.ASSISTANT} 
            onClick={() => setActiveTab(Tab.ASSISTANT)} 
            icon={<MessageSquare className="w-4 h-4" />} 
            label="Assistant" 
          />
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        
        {/* Left Panel - Dynamic Content based on Tab */}
        <div className={clsx(
          "flex-none transition-all duration-300 ease-in-out border-r border-slate-800 bg-slate-900/50",
          activeTab === Tab.ASSISTANT ? "w-full lg:w-[400px]" : "w-full lg:w-[350px]",
          // On mobile, this takes full screen or is hidden based on viewing need, simplified here for desktop-first responsiveness
          "flex flex-col h-1/2 lg:h-full"
        )}>
           {activeTab === Tab.DESIGN && (
             <Controls params={params} onChange={setParams} />
           )}
           {activeTab === Tab.ANALYSIS && (
             <div className="p-4 h-full overflow-hidden">
                <Analysis currentResults={results} params={params} />
             </div>
           )}
           {activeTab === Tab.ASSISTANT && (
             <div className="p-4 h-full">
               <Assistant params={params} results={results} />
             </div>
           )}
        </div>

        {/* Center/Right - 3D Viewport */}
        <div className="flex-1 h-1/2 lg:h-full relative bg-slate-950">
          <ThreeScene params={params} results={results} />
          
          {/* Overlay Stats */}
          <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-md p-4 rounded-lg border border-slate-700 shadow-xl pointer-events-none">
            <h4 className="text-xs text-slate-400 uppercase font-bold mb-2">Live Simulation</h4>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <span className="text-slate-300">Net Tension:</span>
              <span className="text-emerald-400 font-mono font-bold text-right">{results.generatedThrust} N</span>
              
              <span className="text-slate-300">Rotor Thrust:</span>
              <span className="text-green-500 font-mono font-bold text-right">{results.totalRotorThrust} N</span>

              <span className="text-slate-300">RPM:</span>
              <span className="text-blue-400 font-mono font-bold text-right">{results.rpm}</span>
              
              <span className="text-slate-300">Tip Speed:</span>
              <span className="text-yellow-400 font-mono font-bold text-right">{results.tipSpeed} m/s</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={clsx(
      "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
      active ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
    )}
  >
    {icon}
    <span>{label}</span>
  </button>
);

export default App;