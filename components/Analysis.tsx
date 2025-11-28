
import React from 'react';
import { SimulationResult, DesignParams } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Activity, Zap, TrendingUp, AlertTriangle, ArrowDownRight, Anchor } from 'lucide-react';
import { calculatePhysics } from '../services/physicsEngine';

interface AnalysisProps {
  currentResults: SimulationResult;
  params: DesignParams;
}

const SystemDeformation: React.FC<{ params: DesignParams; results: SimulationResult }> = ({ params, results }) => {
  const { anchorAnalysis } = results;
  
  // SVG Canvas Scale
  const width = 500;
  const height = 300;
  const padding = 40;
  
  // Normalize Coordinates
  // We want to draw: Anchor(0,0) -> Hub(x1, y1) -> Kite(x2, y2)
  // X is Downwind distance, Y is Altitude.
  
  // Scale factor to fit in view
  // Let's assume the lower line segment is length 100px for visualization
  const seg1Len = 100;
  const angle1Rad = anchorAnalysis.anchorAngle * (Math.PI / 180);
  const hubX = padding + seg1Len * Math.cos(angle1Rad);
  const hubY = height - padding - seg1Len * Math.sin(angle1Rad); // Invert Y for SVG
  
  // Segment 2 (to Kite)
  // Assume same length 100px for visual clarity
  const seg2Len = 100;
  const angle2Rad = params.lineAngle * (Math.PI / 180);
  const kiteX = hubX + seg2Len * Math.cos(angle2Rad);
  const kiteY = hubY - seg2Len * Math.sin(angle2Rad); // Invert Y
  
  // Anchor Pos
  const anchorX = padding;
  const anchorY = height - padding;

  // Analysis Calculations
  const totalVerticalForce = anchorAnalysis.lowerLineTensionY;
  const rotorVerticalForce = results.lift - results.gravity;

  return (
    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-col h-full">
      <h3 className="text-slate-300 font-semibold mb-4 text-sm flex items-center gap-2">
        <ArrowDownRight className="w-4 h-4 text-amber-400" />
        System Deformation & Vector Resolution
      </h3>
      
      <div className="flex-1 w-full flex items-center justify-center bg-slate-900/50 rounded-lg relative overflow-hidden">
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
            
            {/* Ground Line */}
            <line x1="0" y1={height - padding} x2={width} y2={height - padding} stroke="#475569" strokeWidth="2" />
            <text x={width - padding} y={height - 10} fill="#64748b" fontSize="10" textAnchor="end">Downwind Distance</text>
            
            {/* Anchor Point */}
            <circle cx={anchorX} cy={anchorY} r="4" fill="#fbbf24" />
            <text x={anchorX} y={anchorY + 20} fill="#fbbf24" fontSize="12" textAnchor="middle">Anchor</text>
            
            {/* Lower Line */}
            <line x1={anchorX} y1={anchorY} x2={hubX} y2={hubY} stroke="#fbbf24" strokeWidth="2" />
            
            {/* Upper Line */}
            <line x1={hubX} y1={hubY} x2={kiteX} y2={kiteY} stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 2" />
            <text x={kiteX} y={kiteY - 10} fill="#fbbf24" fontSize="12" textAnchor="middle">To Kite</text>

            {/* Hub Point */}
            <circle cx={hubX} cy={hubY} r="5" fill="#94a3b8" stroke="white" strokeWidth="2" />

            {/* FORCE VECTORS AT HUB */}
            
            {/* Lift (Green) - UP */}
            {results.lift > 0 && (
                <g>
                    <line x1={hubX} y1={hubY} x2={hubX} y2={hubY - 40} stroke="#10b981" strokeWidth="2" markerEnd="url(#arrow-green)" />
                    <text x={hubX + 5} y={hubY - 40} fill="#10b981" fontSize="10">Lift {results.lift}N</text>
                </g>
            )}

             {/* Gravity (Purple) - DOWN */}
             <g>
                <line x1={hubX} y1={hubY} x2={hubX} y2={hubY + 30} stroke="#a855f7" strokeWidth="2" markerEnd="url(#arrow-purple)" />
                <text x={hubX + 5} y={hubY + 30} fill="#a855f7" fontSize="10">Weight {results.gravity}N</text>
            </g>

             {/* Drag (Red) - RIGHT (Downwind) */}
             {results.drag > 0 && (
                <g>
                    <line x1={hubX} y1={hubY} x2={hubX + 40} y2={hubY} stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrow-red)" />
                    <text x={hubX + 40} y={hubY + 15} fill="#ef4444" fontSize="10">Drag {results.drag}N</text>
                </g>
             )}

            {/* DEFINITIONS */}
            <defs>
                <marker id="arrow-green" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,6 L9,3 z" fill="#10b981" />
                </marker>
                <marker id="arrow-red" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,6 L9,3 z" fill="#ef4444" />
                </marker>
                <marker id="arrow-purple" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,6 L9,3 z" fill="#a855f7" />
                </marker>
            </defs>

        </svg>
        
        {/* Info Box */}
        <div className="absolute top-2 left-2 bg-slate-900/90 p-3 rounded-lg border border-slate-700 text-xs shadow-xl backdrop-blur-sm min-w-[180px]">
            <div className="font-bold text-slate-300 mb-2 pb-1 border-b border-slate-700">Anchor Loads</div>
            
            <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
              <span className="text-slate-400">Tension Magnitude:</span>
              <span className="text-amber-400 font-bold">{anchorAnalysis.anchorTension} N</span>
              
              <span className="text-slate-400">Exit Angle:</span>
              <span className="text-white font-mono">{anchorAnalysis.anchorAngle}°</span>
              
              <div className="col-span-2 h-px bg-slate-700 my-1"></div>
              
              <span className="text-slate-400">Total Vertical Force:</span>
              <span className="text-blue-300 font-mono">{totalVerticalForce} N</span>
              
              <span className="text-slate-400">Rotor Share:</span>
              <span className={`${rotorVerticalForce >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-mono font-bold`}>
                 {rotorVerticalForce > 0 ? '+' : ''}{rotorVerticalForce.toFixed(2)} N
              </span>
              
              <div className="col-span-2 h-px bg-slate-700 my-1"></div>

               <span className="text-slate-500">Kite Angle:</span>
               <span className="text-slate-500 font-mono">{params.lineAngle}°</span>
            </div>
        </div>

      </div>
    </div>
  );
};

export const Analysis: React.FC<AnalysisProps> = ({ currentResults, params }) => {
  
  // Generate data for Wind Speed vs Thrust curve
  const performanceData = React.useMemo(() => {
    const data = [];
    for (let w = 2; w <= 25; w += 2) {
      const res = calculatePhysics({ ...params, windSpeed: w });
      data.push({
        wind: w,
        thrust: res.generatedThrust,
        rpm: res.rpm
      });
    }
    return data;
  }, [params]);

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto pr-2">
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Generated Tension" 
          value={currentResults.generatedThrust} 
          unit="N" 
          icon={<TrendingUp className="text-emerald-400" />}
          color="bg-emerald-900/30 border-emerald-800"
        />
        <MetricCard 
          title="Rotor RPM" 
          value={currentResults.rpm} 
          unit="rpm" 
          icon={<Activity className="text-blue-400" />}
          color="bg-blue-900/30 border-blue-800"
        />
         <MetricCard 
          title="Anchor Tension" 
          value={currentResults.anchorAnalysis.anchorTension} 
          unit="N" 
          icon={<Anchor className="text-amber-400" />}
          color="bg-amber-900/30 border-amber-800"
        />
        <MetricCard 
          title="Stability" 
          value={currentResults.stabilityScore} 
          unit="%" 
          icon={<AlertTriangle className={currentResults.stabilityScore < 40 ? "text-red-500" : "text-slate-400"} />}
          color={currentResults.stabilityScore < 40 ? "bg-red-900/30 border-red-800" : "bg-slate-800 border-slate-700"}
        />
      </div>

       {/* System Deformation Visualization (Takes full width) */}
       <div className="w-full h-[350px]">
          <SystemDeformation params={params} results={currentResults} />
       </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-[300px]">
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-col">
          <h3 className="text-slate-300 font-semibold mb-4 text-sm">Thrust vs Wind Speed</h3>
          <div className="flex-1 w-full min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="wind" stroke="#94a3b8" label={{ value: 'Wind (m/s)', position: 'insideBottom', offset: -5 }} />
                <YAxis stroke="#94a3b8" label={{ value: 'Thrust (N)', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <Line type="monotone" dataKey="thrust" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-col">
          <h3 className="text-slate-300 font-semibold mb-4 text-sm">RPM vs Wind Speed</h3>
          <div className="flex-1 w-full min-h-[200px]">
             <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="wind" stroke="#94a3b8" label={{ value: 'Wind (m/s)', position: 'insideBottom', offset: -5 }} />
                <YAxis stroke="#94a3b8" label={{ value: 'RPM', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                  itemStyle={{ color: '#3b82f6' }}
                />
                <Line type="monotone" dataKey="rpm" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  title: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  color: string;
}> = ({ title, value, unit, icon, color }) => (
  <div className={`p-4 rounded-lg border ${color} flex items-center justify-between`}>
    <div>
      <p className="text-slate-400 text-xs font-medium uppercase">{title}</p>
      <div className="flex items-end gap-1 mt-1">
        <span className="text-2xl font-bold text-white">{value}</span>
        <span className="text-sm text-slate-400 mb-1">{unit}</span>
      </div>
    </div>
    <div className="p-2 bg-slate-900/50 rounded-md">
      {icon}
    </div>
  </div>
);
