import React, { useState, useEffect } from 'react';
import { 
  Activity, Video, Camera, Cpu, BarChart2, TrendingUp, 
  User, FileText, Sparkles, RefreshCw, Award, ChevronDown 
} from 'lucide-react';

import DigitalTwin3D from './components/DigitalTwin3D';
import LiveTracker from './components/LiveTracker';
import VideoAnalysis from './components/VideoAnalysis';
import Simulator from './components/Simulator';
import RecoveryDashboard from './components/RecoveryDashboard';
import ClinicalNotes from './components/ClinicalNotes';
import PatientHistory from './components/PatientHistory';

export default function App() {
  const [activeTab, setActiveTab] = useState('twin'); // 'twin' | 'live' | 'video' | 'dashboard' | 'history'
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClinicalModalOpen, setIsClinicalModalOpen] = useState(false);

  // 3D Playback Scrubbing State
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Fetch Patients on mount
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const res = await fetch('/api/patients');
        if (res.ok) {
          const list = await res.json();
          setPatients(list);
          if (list.length > 0 && !selectedPatientId) {
            setSelectedPatientId(list[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching patients:', err);
      }
    };
    fetchPatients();
  }, []);

  // Fetch Latest Session for Patient
  const loadLatestSession = async (patientId) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/sessions?patient_id=${patientId || ''}`);
      if (res.ok) {
        const list = await res.json();
        if (list.length > 0) {
          // Fetch full detail for the latest session
          const detailRes = await fetch(`/api/sessions/${list[0].id}`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            setCurrentSession(detail);
            setCurrentFrame(0);
          }
        }
      }
    } catch (err) {
      console.error('Error loading session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPatientId) {
      loadLatestSession(selectedPatientId);
    }
  }, [selectedPatientId]);

  // Handle Playback animation loop for 3D Twin
  useEffect(() => {
    let animId = null;
    if (isPlaying && currentSession?.frame_data?.length > 0) {
      animId = setInterval(() => {
        setCurrentFrame((prev) => {
          if (prev >= currentSession.frame_data.length - 1) {
            return 0;
          }
          return prev + 1;
        });
      }, 33); // ~30 fps
    }
    return () => clearInterval(animId);
  }, [isPlaying, currentSession]);

  // Extract angles for current frame in playback
  const activeFrameData = currentSession?.frame_data?.[currentFrame] || {};
  const currentJointAngles = {
    left_knee_angle: activeFrameData.left_knee_angle ?? currentSession?.knee_rom_deg ?? 170,
    right_knee_angle: activeFrameData.right_knee_angle ?? currentSession?.knee_rom_deg ?? 170,
    left_hip_angle: activeFrameData.left_hip_angle ?? 170,
    right_hip_angle: activeFrameData.right_hip_angle ?? 170,
    symmetry_pct: currentSession?.symmetry_pct ?? 96,
  };

  const activePatient = patients.find((p) => p.id === selectedPatientId) || patients[0];

  const handleSessionLoaded = (newSession) => {
    setCurrentSession(newSession);
    setCurrentFrame(0);
    setIsPlaying(true);
  };

  const handleRepClick = (rep) => {
    if (rep && rep.start_frame !== undefined) {
      setCurrentFrame(rep.start_frame);
      setIsPlaying(false);
      setActiveTab('twin');
    }
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25">
            <Activity size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-white tracking-tight">
                AI REHAB DIGITAL TWIN
              </h1>
              <span className="badge badge-cyan text-[10px]">Orthopedic v1.0</span>
            </div>
            <p className="text-xs text-slate-400">
              Musculoskeletal Kinematics & AI Recovery Intelligence
            </p>
          </div>
        </div>

        {/* Patient Selector & Quick Stats */}
        <div className="flex items-center gap-4">
          {/* Patient Selector */}
          <div className="flex items-center gap-2 bg-slate-900/80 px-3.5 py-1.5 rounded-xl border border-slate-800 text-xs">
            <User size={15} className="text-cyan-400" />
            <span className="text-slate-400 font-semibold">Patient:</span>
            <select
              value={selectedPatientId || ''}
              onChange={(e) => setSelectedPatientId(Number(e.target.value))}
              className="bg-transparent text-white font-bold outline-none cursor-pointer pr-2"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recovery Score Pill */}
          {currentSession && (
            <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl text-xs">
              <Award size={15} className="text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Recovery Index:</span>
              <span className="font-mono font-extrabold text-white">
                {currentSession.recovery_score?.toFixed(1)} / 100
              </span>
            </div>
          )}

          {/* AI Clinical Notes Button */}
          <button
            onClick={() => setIsClinicalModalOpen(true)}
            className="btn btn-secondary text-xs px-3.5 py-1.5 text-cyan-300 border-cyan-500/30 shadow-sm"
          >
            <FileText size={14} /> AI Clinical Notes
          </button>
        </div>
      </header>

      {/* Navigation Tabs Bar */}
      <div className="bg-slate-950/40 border-b border-slate-800/60 px-6 py-2 flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('twin')}
          className={`nav-tab ${activeTab === 'twin' ? 'active' : ''}`}
        >
          <Cpu size={16} /> 3D Digital Twin & Simulation
        </button>
        <button
          onClick={() => setActiveTab('live')}
          className={`nav-tab ${activeTab === 'live' ? 'active' : ''}`}
        >
          <Camera size={16} /> Live Webcam Tracker
        </button>
        <button
          onClick={() => setActiveTab('video')}
          className={`nav-tab ${activeTab === 'video' ? 'active' : ''}`}
        >
          <Video size={16} /> Video File Analyzer
        </button>
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
        >
          <BarChart2 size={16} /> Clinical Analytics
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`nav-tab ${activeTab === 'history' ? 'active' : ''}`}
        >
          <TrendingUp size={16} /> Longitudinal Trajectory
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto flex flex-col gap-6">
        {/* Tab 1: 3D Twin & Simulation */}
        {activeTab === 'twin' && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 3D Viewport (7 Cols) */}
              <div className="lg:col-span-7">
                <DigitalTwin3D
                  jointAngles={currentJointAngles}
                  frameData={currentSession?.frame_data || []}
                  currentFrame={currentFrame}
                  onSeek={(f) => setCurrentFrame(f)}
                  isPlaying={isPlaying}
                  onTogglePlay={() => setIsPlaying(!isPlaying)}
                  title={`3D Avatar: ${activePatient?.name || 'Active Patient'}`}
                  subtitle={`Session: ${currentSession?.session_uid || 'Simulated Routine'} • ${currentSession?.rep_count || 0} Reps Detected`}
                />
              </div>

              {/* Instant Simulator & Quick Controls (5 Cols) */}
              <div className="lg:col-span-5 flex flex-col gap-5">
                <Simulator
                  onSessionGenerated={handleSessionLoaded}
                  activePatientId={selectedPatientId}
                />
              </div>
            </div>

            {/* Recovery Summary Below 3D Twin */}
            {currentSession && (
              <RecoveryDashboard
                session={currentSession}
                onRepClick={handleRepClick}
                onOpenClinicalNotes={() => setIsClinicalModalOpen(true)}
              />
            )}
          </div>
        )}

        {/* Tab 2: Live Webcam Rehab Tracker */}
        {activeTab === 'live' && (
          <div className="flex flex-col gap-6">
            <LiveTracker
              onSessionSaved={(saved) => {
                handleSessionLoaded(saved);
                setActiveTab('twin');
              }}
              activePatientId={selectedPatientId}
            />
          </div>
        )}

        {/* Tab 3: Video File Analysis */}
        {activeTab === 'video' && (
          <div className="flex flex-col gap-6">
            <VideoAnalysis
              onSessionLoaded={(loaded) => {
                handleSessionLoaded(loaded);
                setActiveTab('twin');
              }}
              activePatientId={selectedPatientId}
            />
          </div>
        )}

        {/* Tab 4: Full Clinical Analytics Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="flex flex-col gap-6">
            <RecoveryDashboard
              session={currentSession}
              onRepClick={handleRepClick}
              onOpenClinicalNotes={() => setIsClinicalModalOpen(true)}
            />
          </div>
        )}

        {/* Tab 5: Longitudinal Patient History */}
        {activeTab === 'history' && (
          <div className="flex flex-col gap-6">
            <PatientHistory
              patientId={selectedPatientId}
              currentSessionId={currentSession?.id}
              onSelectSession={async (sid) => {
                const res = await fetch(`/api/sessions/${sid}`);
                if (res.ok) {
                  const detail = await res.json();
                  handleSessionLoaded(detail);
                  setActiveTab('twin');
                }
              }}
            />
          </div>
        )}
      </main>

      {/* AI Clinical Notes Modal */}
      {isClinicalModalOpen && (
        <ClinicalNotes
          session={currentSession}
          patient={activePatient}
          onClose={() => setIsClinicalModalOpen(false)}
        />
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/60 px-6 py-4 text-center text-xs text-slate-500 flex flex-wrap justify-between items-center gap-2">
        <div>
          AI Musculoskeletal Digital Twin • 3D Biomechanics & Rehabilitation Intelligence
        </div>
        <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
          <span>FastAPI Backend: :8000</span>
          <span>•</span>
          <span>Vite + Three.js: :5173</span>
        </div>
      </footer>
    </div>
  );
}
