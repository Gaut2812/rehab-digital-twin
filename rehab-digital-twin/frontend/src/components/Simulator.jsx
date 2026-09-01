import React, { useState } from 'react';
import { 
  Play, Cpu, Sparkles, Sliders, ShieldCheck, 
  RefreshCw, CheckCircle2, TrendingUp, AlertTriangle 
} from 'lucide-react';

const PRESETS = [
  {
    id: 'normal',
    name: 'Standard Recovery Squat',
    desc: 'Optimal symmetry (96%), smooth neuromuscular control, 115° depth',
    badge: 'Healthy Recovery',
    badgeColor: 'badge-emerald',
    reps: 3,
    rom: 115,
    symmetryNoise: 0.03,
    jitter: 0.002,
  },
  {
    id: 'asymmetric',
    name: 'Post-Op Compensatory Guarding',
    desc: 'Unilateral ACL guarding pattern, 82% symmetry, slight trajectory hesitation',
    badge: 'Guarding Pattern',
    badgeColor: 'badge-amber',
    reps: 4,
    rom: 105,
    symmetryNoise: 0.16,
    jitter: 0.006,
  },
  {
    id: 'restricted',
    name: 'Restricted Range of Motion',
    desc: 'Early-stage post-surgery (75° max ROM), cautious descent speed',
    badge: 'Early Stage',
    badgeColor: 'badge-rose',
    reps: 3,
    rom: 75,
    symmetryNoise: 0.05,
    jitter: 0.003,
  },
  {
    id: 'dynamic',
    name: 'Advanced Cadence & Mobility',
    desc: 'Full deep squat (130° ROM), rapid cadence with 5 consecutive reps',
    badge: 'Advanced Phase',
    badgeColor: 'badge-cyan',
    reps: 5,
    rom: 130,
    symmetryNoise: 0.02,
    jitter: 0.001,
  },
];

export default function Simulator({ onSessionGenerated, activePatientId = null }) {
  const [selectedPreset, setSelectedPreset] = useState('normal');
  const [reps, setReps] = useState(3);
  const [targetRom, setTargetRom] = useState(115);
  const [asymmetryNoise, setAsymmetryNoise] = useState(0.04);
  const [isSimulating, setIsSimulating] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  const applyPreset = (preset) => {
    setSelectedPreset(preset.id);
    setReps(preset.reps);
    setTargetRom(preset.rom);
    setAsymmetryNoise(preset.symmetryNoise);
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setSuccessMsg(null);

    try {
      const response = await fetch('/api/sessions/synthetic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise_name: 'knee_flexion_squat',
          n_reps: Number(reps),
          rom_target_deg: Number(targetRom),
          symmetry_noise: Number(asymmetryNoise),
          jitter_noise: 0.003,
          patient_id: activePatientId,
        }),
      });

      if (!response.ok) throw new Error('Simulation failed on server');
      const data = await response.json();

      setSuccessMsg(`Simulated ${reps} reps successfully! Recovery Score: ${data.recovery_score}/100`);
      if (onSessionGenerated) {
        onSessionGenerated(data);
      }
    } catch (err) {
      console.error(err);
      alert('Error running simulation: ' + err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="glass-panel p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Cpu size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Biomechanical Movement Simulator
              <span className="badge badge-cyan text-[10px]">Zero-Hardware Demo</span>
            </h3>
            <p className="text-xs text-slate-400">
              Instantly synthesize clinical kinematic trajectories to test the 3D twin & scoring engine
            </p>
          </div>
        </div>

        <button
          onClick={handleRunSimulation}
          disabled={isSimulating}
          className="btn btn-primary text-xs px-4 py-2 font-bold shadow-lg"
        >
          {isSimulating ? (
            <>
              <RefreshCw size={15} className="animate-spin" /> Simulating...
            </>
          ) : (
            <>
              <Play size={15} /> Run Biomechanics Simulation
            </>
          )}
        </button>
      </div>

      {/* Preset Cards Grid */}
      <div>
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Sparkles size={14} className="text-cyan-400" />
          Select Clinical Preset Routine
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRESETS.map((p) => {
            const isSelected = selectedPreset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => applyPreset(p)}
                className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-slate-800/90 border-cyan-500/80 shadow-lg shadow-cyan-500/10'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-white">{p.name}</span>
                    <span className={`badge ${p.badgeColor} text-[9px] py-0.5 px-2`}>{p.badge}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{p.desc}</p>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-mono text-slate-300 pt-2 border-t border-slate-800/60">
                  <span>🎯 {p.rom}° ROM</span>
                  <span>🔄 {p.reps} Reps</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Parameter Sliders */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col gap-4">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Sliders size={14} className="text-cyan-400" /> Custom Kinematic Parameters
          </span>
          <span className="text-slate-400 lowercase font-mono">fine-tune simulation physics</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Rep Count */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Repetitions:</span>
              <span className="font-bold text-cyan-400">{reps} reps</span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              value={reps}
              onChange={(e) => {
                setReps(Number(e.target.value));
                setSelectedPreset('custom');
              }}
            />
          </div>

          {/* Target ROM Depth */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Knee ROM Flexion:</span>
              <span className="font-bold text-emerald-400">{targetRom}° (depth)</span>
            </div>
            <input
              type="range"
              min={50}
              max={135}
              value={targetRom}
              onChange={(e) => {
                setTargetRom(Number(e.target.value));
                setSelectedPreset('custom');
              }}
            />
          </div>

          {/* Asymmetry Noise */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Bilateral Asymmetry:</span>
              <span className="font-bold text-amber-400">{(asymmetryNoise * 100).toFixed(0)}% offload</span>
            </div>
            <input
              type="range"
              min={0.0}
              max={0.25}
              step={0.01}
              value={asymmetryNoise}
              onChange={(e) => {
                setAsymmetryNoise(Number(e.target.value));
                setSelectedPreset('custom');
              }}
            />
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-300 text-xs">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}
    </div>
  );
}
