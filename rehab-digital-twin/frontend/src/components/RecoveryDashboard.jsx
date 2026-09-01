import React, { useState } from 'react';
import { 
  ResponsiveContainer, LineChart, Line, AreaChart, Area, 
  XAxis, YAxis, Tooltip, CartesianGrid, Legend 
} from 'recharts';
import { 
  Award, Activity, Zap, Compass, RotateCcw, 
  AlertCircle, CheckCircle, FileText, ChevronRight, BarChart3 
} from 'lucide-react';

export default function RecoveryDashboard({ session, onRepClick, onOpenClinicalNotes }) {
  if (!session) {
    return (
      <div className="glass-panel p-8 text-center flex flex-col items-center justify-center gap-3">
        <Activity size={36} className="text-slate-600 animate-pulse" />
        <p className="text-slate-400 text-sm">No session data loaded. Run a simulation or upload an exercise video.</p>
      </div>
    );
  }

  const [activeChartTab, setActiveChartTab] = useState('angles'); // 'angles' | 'velocity'

  const score = session.recovery_score || 0;
  const rom = session.knee_rom_deg || 0;
  const symmetry = session.symmetry_pct || 0;
  const stability = session.stability_pct || 0;
  const speed = session.movement_speed_mps || 0;
  const reps = session.reps || [];
  const frameData = session.frame_data || [];

  // Parse AI feedback if present
  let feedback = null;
  try {
    feedback = typeof session.ai_feedback === 'string' ? JSON.parse(session.ai_feedback) : session.ai_feedback;
  } catch (e) {
    feedback = null;
  }

  // Score color
  const getScoreColor = (s) => {
    if (s >= 85) return 'text-emerald-400';
    if (s >= 70) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getScoreBadge = (s) => {
    if (s >= 85) return { label: 'Optimal Recovery', class: 'badge-emerald' };
    if (s >= 70) return { label: 'Moderate Progress', class: 'badge-amber' };
    return { label: 'Guarding Detected', class: 'badge-rose' };
  };

  const badge = getScoreBadge(score);

  return (
    <div className="flex flex-col gap-5">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Main Composite Recovery Score */}
        <div className="metric-box glass-panel-glow md:col-span-2 lg:col-span-1 flex flex-col justify-between">
          <div className="metric-title">
            <span>Recovery Score</span>
            <Award size={16} className="text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2 my-1">
            <span className={`text-4xl font-extrabold font-mono ${getScoreColor(score)}`}>
              {score.toFixed(1)}
            </span>
            <span className="text-sm text-slate-400 font-bold">/ 100</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <span className={`badge ${badge.class} text-[10px]`}>{badge.label}</span>
            <span className="text-[11px] text-slate-400 font-mono">{reps.length} Reps</span>
          </div>
        </div>

        {/* Knee ROM */}
        <div className="metric-box">
          <div className="metric-title">
            <span>Peak Knee ROM</span>
            <RotateCcw size={16} className="text-emerald-400" />
          </div>
          <div className="metric-value text-emerald-400">
            {rom.toFixed(1)} <span className="metric-unit">deg</span>
          </div>
          <div className="metric-desc">Target: 130.0° ({( (rom/130)*100 ).toFixed(0)}% achieved)</div>
        </div>

        {/* Bilateral Symmetry */}
        <div className="metric-box">
          <div className="metric-title">
            <span>Bilateral Symmetry</span>
            <Activity size={16} className="text-cyan-400" />
          </div>
          <div className="metric-value text-cyan-400">
            {symmetry.toFixed(1)} <span className="metric-unit">%</span>
          </div>
          <div className="metric-desc">Left vs. Right load distribution</div>
        </div>

        {/* Neuromuscular Stability */}
        <div className="metric-box">
          <div className="metric-title">
            <span>Stability / Smoothness</span>
            <Compass size={16} className="text-purple-400" />
          </div>
          <div className="metric-value text-purple-400">
            {stability.toFixed(1)} <span className="metric-unit">%</span>
          </div>
          <div className="metric-desc">Kinematic jerk & jitter filter</div>
        </div>

        {/* Movement Speed */}
        <div className="metric-box">
          <div className="metric-title">
            <span>Avg Movement Speed</span>
            <Zap size={16} className="text-amber-400" />
          </div>
          <div className="metric-value text-amber-400">
            {speed.toFixed(2)} <span className="metric-unit">m/s</span>
          </div>
          <div className="metric-desc">Cadence and control tempo</div>
        </div>
      </div>

      {/* Kinematic Charts & Rep Breakdown Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Kinematic Time-Series Chart */}
        <div className="glass-panel p-4 lg:col-span-2 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-cyan-400" />
              <h4 className="text-sm font-bold text-white">Kinematic Angle & Velocity Profiles</h4>
            </div>

            <div className="flex bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setActiveChartTab('angles')}
                className={`px-2.5 py-1 rounded font-semibold ${
                  activeChartTab === 'angles' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Joint Angles (°)
              </button>
              <button
                onClick={() => setActiveChartTab('velocity')}
                className={`px-2.5 py-1 rounded font-semibold ${
                  activeChartTab === 'velocity' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Angular Velocity (°/s)
              </button>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            {frameData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {activeChartTab === 'angles' ? (
                  <AreaChart data={frameData}>
                    <defs>
                      <linearGradient id="colorLeftKnee" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorRightKnee" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis 
                      dataKey="time_s" 
                      stroke="#64748b" 
                      fontSize={11}
                      tickFormatter={(v) => `${v}s`}
                    />
                    <YAxis stroke="#64748b" fontSize={11} domain={[50, 180]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                      itemStyle={{ fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                    <Area 
                      type="monotone" 
                      dataKey="left_knee_angle" 
                      name="Left Knee Flexion (°)" 
                      stroke="#06b6d4" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorLeftKnee)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="right_knee_angle" 
                      name="Right Knee Flexion (°)" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorRightKnee)" 
                    />
                  </AreaChart>
                ) : (
                  <LineChart data={frameData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis 
                      dataKey="time_s" 
                      stroke="#64748b" 
                      fontSize={11}
                      tickFormatter={(v) => `${v}s`}
                    />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                      itemStyle={{ fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="left_knee_velocity" 
                      name="Left Angular Velocity (°/s)" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="right_knee_velocity" 
                      name="Right Angular Velocity (°/s)" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                No frame kinematic telemetry available for this session.
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Rep Breakdown Table & AI Insights Preview */}
        <div className="glass-panel p-4 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-400" /> Repetition Breakdown
              </h4>
              <span className="badge badge-cyan text-[10px]">{reps.length} Reps</span>
            </div>

            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {reps.map((rep, idx) => (
                <div
                  key={idx}
                  onClick={() => onRepClick && onRepClick(rep)}
                  className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition-all flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-[10px]">
                      {rep.rep_number || idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-white">Depth: {rep.depth_deg?.toFixed(1)}°</div>
                      <div className="text-[10px] text-slate-400">Peak: {rep.peak_flexion_deg?.toFixed(1)}° | {rep.duration_s?.toFixed(1)}s</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`font-mono font-bold ${(rep.quality_score || 85) >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {rep.quality_score?.toFixed(0) || 85}%
                    </span>
                    <div className="text-[9px] text-slate-500 uppercase">Quality</div>
                  </div>
                </div>
              ))}

              {reps.length === 0 && (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No discrete repetitions detected yet.
                </div>
              )}
            </div>
          </div>

          {/* AI Clinical Snippet Card */}
          {feedback && (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-cyan-400 flex items-center gap-1.5">
                  <FileText size={13} /> AI Clinical Assessment
                </span>
                <button
                  onClick={onOpenClinicalNotes}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-0.5"
                >
                  Full Report <ChevronRight size={12} />
                </button>
              </div>
              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                {feedback.summary_text || feedback.insights?.[0]}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
