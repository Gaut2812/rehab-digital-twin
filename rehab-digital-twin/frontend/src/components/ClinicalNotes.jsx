import React from 'react';
import { 
  FileText, ShieldCheck, AlertTriangle, Lightbulb, 
  Printer, Download, CheckCircle2, Award, Calendar, User 
} from 'lucide-react';

export default function ClinicalNotes({ session, patient, onClose }) {
  if (!session) return null;

  let feedback = {};
  try {
    feedback = typeof session.ai_feedback === 'string' ? JSON.parse(session.ai_feedback) : session.ai_feedback || {};
  } catch (e) {
    feedback = {};
  }

  const score = session.recovery_score || 0;
  const rom = session.knee_rom_deg || 0;
  const symmetry = session.symmetry_pct || 0;
  const stability = session.stability_pct || 0;
  const speed = session.movement_speed_mps || 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6 flex flex-col gap-6 text-slate-200">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">AI Clinical Rehabilitation Assessment</h2>
              <p className="text-xs text-slate-400">
                Automated Orthopedic Biomechanics & Recovery Prescription Report
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="btn btn-secondary text-xs px-3 py-1.5">
              <Printer size={14} /> Print / Export
            </button>
            <button onClick={onClose} className="btn btn-outline text-xs px-3 py-1.5">
              Close
            </button>
          </div>
        </div>

        {/* Patient & Session Meta Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 block uppercase text-[10px] font-bold">Patient</span>
            <span className="font-bold text-white">{patient?.name || 'Alex Vance (ACL Rehab)'}</span>
          </div>
          <div>
            <span className="text-slate-500 block uppercase text-[10px] font-bold">Clinical Condition</span>
            <span className="text-slate-300">{patient?.condition || 'Right Knee ACL Reconstruction'}</span>
          </div>
          <div>
            <span className="text-slate-500 block uppercase text-[10px] font-bold">Session Timestamp</span>
            <span className="font-mono text-slate-300">{new Date(session.timestamp).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-slate-500 block uppercase text-[10px] font-bold">Recovery Index</span>
            <span className="font-mono font-bold text-cyan-400">{score.toFixed(1)} / 100</span>
          </div>
        </div>

        {/* Status Classification Banner */}
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          score >= 85 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
            : score >= 70 
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-3">
            <Award size={24} />
            <div>
              <div className="text-xs uppercase font-bold tracking-wider">Clinical Status</div>
              <div className="text-base font-bold text-white">
                {feedback.status || (score >= 80 ? 'Optimal Rehabilitation Progress' : 'Moderate Guarding Pattern')}
              </div>
            </div>
          </div>
          <span className="text-2xl font-black font-mono">{score.toFixed(1)}</span>
        </div>

        {/* Biomechanical Telemetry Matrix */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
            Objective Biomechanical Measures
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800">
              <span className="text-slate-500 block">Peak Knee ROM</span>
              <span className="text-base font-bold text-emerald-400 font-mono">{rom.toFixed(1)}°</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Target: 130.0°</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800">
              <span className="text-slate-500 block">Bilateral Symmetry</span>
              <span className="text-base font-bold text-cyan-400 font-mono">{symmetry.toFixed(1)}%</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">L/R Load Balance</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800">
              <span className="text-slate-500 block">Stability Index</span>
              <span className="text-base font-bold text-purple-400 font-mono">{stability.toFixed(1)}%</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Trajectory Smoothness</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800">
              <span className="text-slate-500 block">Movement Cadence</span>
              <span className="text-base font-bold text-amber-400 font-mono">{speed.toFixed(2)} m/s</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">{session.rep_count} completed reps</span>
            </div>
          </div>
        </div>

        {/* Positive Insights */}
        {feedback.insights && feedback.insights.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
              <CheckCircle2 size={15} /> Biomechanical Strengths
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside">
              {feedback.insights.map((ins, i) => (
                <li key={i} className="leading-relaxed">{ins}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Clinical Form Warnings */}
        {feedback.warnings && feedback.warnings.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
              <AlertTriangle size={15} /> Observed Compensations & Guarding Alerts
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside">
              {feedback.warnings.map((warn, i) => (
                <li key={i} className="leading-relaxed">{warn}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Prescriptive Recommendations for Next Session */}
        {feedback.recommendations && feedback.recommendations.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2 flex items-center gap-1.5">
              <Lightbulb size={15} /> Prescriptive Action Plan for Next Session
            </h4>
            <div className="p-3.5 bg-slate-950/70 border border-cyan-500/30 rounded-xl space-y-2 text-xs text-slate-300">
              {feedback.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Disclaimer */}
        <div className="text-[11px] text-slate-500 border-t border-slate-800 pt-3 flex justify-between items-center">
          <span>AI Musculoskeletal Digital Twin Platform • Research/Clinical Prototype</span>
          <span>Validated on MediaPipe 33-Landmark Kinematics</span>
        </div>
      </div>
    </div>
  );
}
