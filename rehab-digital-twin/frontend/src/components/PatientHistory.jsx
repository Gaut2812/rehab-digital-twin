import React, { useEffect, useState } from 'react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  Tooltip, CartesianGrid, Legend 
} from 'recharts';
import { 
  History, TrendingUp, Calendar, ArrowUpRight, 
  User, CheckCircle2, Award, ChevronRight 
} from 'lucide-react';

export default function PatientHistory({ patientId, onSelectSession, currentSessionId }) {
  const [historyData, setHistoryData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!patientId) return;

    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/patients/${patientId}/trends`);
        if (res.ok) {
          const data = await res.json();
          setHistoryData(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [patientId, currentSessionId]);

  if (!historyData) return null;

  const timeline = historyData.timeline || [];
  const patient = historyData.patient || {};

  return (
    <div className="glass-panel p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <TrendingUp size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Longitudinal Recovery Trajectory & Progress Trends
            </h3>
            <p className="text-xs text-slate-400">
              Tracking functional ROM and bilateral symmetry improvement across rehabilitation sessions
            </p>
          </div>
        </div>

        <div className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
          {timeline.length} Total Sessions Tracked
        </div>
      </div>

      {/* Trajectory Trend Chart */}
      <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
          <span>Recovery Score & ROM Gains Over Time</span>
          <span className="text-emerald-400 font-mono flex items-center gap-1">
            <ArrowUpRight size={14} /> +{(timeline[timeline.length - 1]?.recovery_score - (patient.baseline_score || 45)).toFixed(1)} pts vs baseline
          </span>
        </div>

        <div className="h-56 w-full pt-2">
          {timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} domain={[30, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                <Line
                  type="monotone"
                  dataKey="recovery_score"
                  name="Recovery Score (/100)"
                  stroke="#06b6d4"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#06b6d4' }}
                />
                <Line
                  type="monotone"
                  dataKey="symmetry_pct"
                  name="Bilateral Symmetry (%)"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs">
              No longitudinal sessions logged yet for this patient.
            </div>
          )}
        </div>
      </div>

      {/* Historical Sessions Table */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          Recorded Clinical Sessions
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {timeline.map((s, idx) => (
            <div
              key={s.session_id}
              onClick={() => onSelectSession && onSelectSession(s.session_id)}
              className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition-all flex flex-col justify-between gap-2.5 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Calendar size={13} className="text-slate-400" /> {s.date}
                </span>
                <span className="font-mono font-extrabold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  {s.recovery_score?.toFixed(1)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1 text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800">
                <div>
                  <span className="text-[9px] block text-slate-500 uppercase">ROM</span>
                  <span className="text-slate-200">{s.knee_rom_deg?.toFixed(0)}°</span>
                </div>
                <div>
                  <span className="text-[9px] block text-slate-500 uppercase">Symm</span>
                  <span className="text-slate-200">{s.symmetry_pct?.toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-[9px] block text-slate-500 uppercase">Reps</span>
                  <span className="text-slate-200">{s.rep_count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
