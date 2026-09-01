from __future__ import annotations
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class PatientBase(BaseModel):
    name: str
    age: Optional[int] = None
    condition: Optional[str] = "Knee Rehabilitation"
    target_rom_deg: Optional[float] = 130.0
    baseline_score: Optional[float] = 45.0
    notes: Optional[str] = None


class PatientCreate(PatientBase):
    pass


class PatientResponse(PatientBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ExerciseRepResponse(BaseModel):
    id: Optional[int] = None
    rep_number: int
    start_frame: int
    end_frame: int
    peak_flexion_deg: float
    depth_deg: float
    duration_s: Optional[float] = None
    quality_score: Optional[float] = None

    class Config:
        from_attributes = True


class BiomechanicsSummary(BaseModel):
    left_knee_rom_deg: Optional[float] = None
    right_knee_rom_deg: Optional[float] = None
    knee_symmetry_pct: Optional[float] = None
    left_knee_stability_pct: Optional[float] = None
    right_knee_stability_pct: Optional[float] = None
    movement_speed_mps: Optional[float] = None
    recovery_score: Optional[float] = None


class SessionSummaryResponse(BaseModel):
    id: int
    session_uid: str
    patient_id: Optional[int] = None
    timestamp: datetime
    exercise_name: str
    rep_count: int
    recovery_score: float
    knee_rom_deg: float
    symmetry_pct: float
    stability_pct: float
    movement_speed_mps: float
    ai_feedback: Optional[str] = None

    class Config:
        from_attributes = True


class SessionDetailResponse(SessionSummaryResponse):
    video_filename: Optional[str] = None
    detection_rate: float
    reps: List[ExerciseRepResponse] = []
    metrics: Optional[Dict[str, Any]] = None
    frame_data: Optional[List[Dict[str, Any]]] = None


class SyntheticSessionRequest(BaseModel):
    exercise_name: str = "knee_flexion_squat"
    n_reps: int = 4
    rom_target_deg: float = 110.0
    symmetry_noise: float = 0.05
    jitter_noise: float = 0.003
    patient_id: Optional[int] = None


class LiveLandmark(BaseModel):
    name: str
    x: float
    y: float
    z: float = 0.0
    visibility: float = 1.0


class LiveFramePayload(BaseModel):
    frame_idx: int
    timestamp_ms: float
    landmarks: List[LiveLandmark]


class LiveTelemetryResponse(BaseModel):
    left_knee_angle: float
    right_knee_angle: float
    left_hip_angle: float
    right_hip_angle: float
    left_ankle_angle: float
    right_ankle_angle: float
    symmetry_pct: float
    current_rep: int
    rep_state: str
    instant_recovery_score: float
    feedback: str
