import React, { useState, useRef } from 'react';
import { 
  Upload, Film, Play, Pause, CheckCircle2, 
  AlertCircle, RefreshCw, Layers, Sparkles 
} from 'lucide-react';

export default function VideoAnalysis({ onSessionLoaded, activePatientId }) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setVideoUrl(URL.createObjectURL(selected));
      setStatusMsg(null);
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!file) {
      alert('Please select a video file first');
      return;
    }

    setIsUploading(true);
    setStatusMsg('Uploading and running MediaPipe & Biomechanical analysis...');

    const formData = new FormData();
    formData.append('file', file);
    if (activePatientId) {
      formData.append('patient_id', activePatientId.toString());
    }
    formData.append('exercise_name', 'knee_flexion_squat');

    try {
      const response = await fetch('/api/sessions/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Video processing failed on server');
      const sessionData = await response.json();

      setStatusMsg(`Analysis complete! Recovery score: ${sessionData.recovery_score}/100 with ${sessionData.rep_count} reps.`);
      if (onSessionLoaded) {
        onSessionLoaded(sessionData);
      }
    } catch (err) {
      console.error(err);
      setStatusMsg('Error analyzing video: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="glass-panel p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Film size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Patient Exercise Video Upload & Kinematic Inspector
            </h3>
            <p className="text-xs text-slate-400">
              Upload patient session footage (MP4/WebM) to extract 33 3D landmarks, rep metrics, and recovery indices
            </p>
          </div>
        </div>

        <button
          onClick={handleUploadAndAnalyze}
          disabled={!file || isUploading}
          className="btn btn-primary text-xs px-4 py-2 font-bold shadow-lg"
        >
          {isUploading ? (
            <>
              <RefreshCw size={15} className="animate-spin" /> Processing AI Pipeline...
            </>
          ) : (
            <>
              <Sparkles size={15} /> Analyze Exercise Video
            </>
          )}
        </button>
      </div>

      {/* Upload Box & Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Drag & Drop Upload Container */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
            file
              ? 'border-cyan-500/60 bg-cyan-500/5'
              : 'border-slate-800 hover:border-slate-700 bg-slate-900/30 hover:bg-slate-900/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="p-4 rounded-full bg-slate-900 border border-slate-800 text-cyan-400">
            <Upload size={28} />
          </div>

          <div className="text-center">
            <div className="text-sm font-bold text-white">
              {file ? file.name : 'Click to select patient exercise video'}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Supports MP4, WebM, MOV files (recorded from phone or clinic camera)
            </p>
          </div>

          {file && (
            <div className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
              {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready to analyze
            </div>
          )}
        </div>

        {/* Video Preview Player */}
        <div className="rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center min-h-[220px]">
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              className="w-full h-full max-h-[260px] object-contain"
            />
          ) : (
            <div className="text-center p-6 text-slate-500 text-xs flex flex-col items-center gap-2">
              <Film size={24} className="text-slate-600" />
              <span>Video playback preview will appear here upon file selection</span>
            </div>
          )}
        </div>
      </div>

      {/* Status Message Banner */}
      {statusMsg && (
        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center gap-2 text-slate-300 text-xs">
          {isUploading ? (
            <RefreshCw size={15} className="animate-spin text-cyan-400" />
          ) : (
            <CheckCircle2 size={15} className="text-emerald-400" />
          )}
          <span>{statusMsg}</span>
        </div>
      )}
    </div>
  );
}
