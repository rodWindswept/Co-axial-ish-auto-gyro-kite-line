import React from 'react';
import { SimulationResult, DesignParams } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Activity, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import { calculatePhysics } from '../services/physicsEngine';

interface AnalysisProps {
  currentResults: SimulationResult;
  params: DesignParams;
}

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
          title="Tip Speed" 
          value={currentResults.tipSpeed} 
          unit="m/s" 
          icon={<Zap className="text-yellow-400" />}
          color="bg-yellow-900/30 border-yellow-800"
        />
        <MetricCard 
          title="Stability" 
          value={currentResults.stabilityScore} 
          unit="%" 
          icon={<AlertTriangle className={currentResults.stabilityScore < 40 ? "text-red-500" : "text-slate-400"} />}
          color={currentResults.stabilityScore < 40 ? "bg-red-900/30 border-red-800" : "bg-slate-800 border-slate-700"}
        />
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
