from __future__ import annotations
import os
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd

# Add parent project directories for modules
ROOT_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT_DIR / "computer_vision"))
sys.path.insert(0, str(ROOT_DIR / "biomechanics"))

from joint_angles import build_biomechanics_report, compute_rom, compute_symmetry, compute_stability, _angle_3pt, JOINT_DEFINITIONS
from exercise_analysis import analyze_session, detect_squat_reps, compute_recovery_score, estimate_movement_speed

# Try importing pose estimation
try:
    from pose_estimation import extract_landmarks_from_video, save_landmarks_csv
    MEDIA_PIPE_AVAILABLE = True
except Exception:
    MEDIA_PIPE_AVAILABLE = False


def generate_synthetic_squat_data(
    n_reps: int = 3,
    frames_per_rep: int = 30,
    fps: float = 30.0,
    min_knee_angle: float = 85.0,
    max_knee_angle: float = 170.0,
    symmetry_factor: float = 1.02,
    jitter: float = 0.003,
) -> pd.DataFrame:
    """
    Generate synthetic landmark dataset for squats with realistic 3D joint trajectories.
    """
    rng = np.random.default_rng(42)
    rows = []
    total_frames = n_reps * frames_per_rep

    t = np.arange(total_frames)
    phase = (t % frames_per_rep) / frames_per_rep
    knee_angle_deg = np.where(
        phase < 0.5,
        max_knee_angle - (max_knee_angle - min_knee_angle) * (phase / 0.5),
        min_knee_angle + (max_knee_angle - min_knee_angle) * ((phase - 0.5) / 0.5),
    )

    hip_base = np.array([0.5, 0.45])
    thigh_len = 0.22
    shank_len = 0.22

    for i in range(total_frames):
        time_s = i / fps
        angle = knee_angle_deg[i]
        # Squat motion: hips drop slightly on descent
        descent_ratio = (max_knee_angle - angle) / (max_knee_angle - min_knee_angle)
        hip = hip_base + np.array([0.0, 0.08 * descent_ratio])

        theta = np.radians(180 - angle)
        knee = hip + np.array([0.02 * descent_ratio, thigh_len * np.cos(theta * 0.5)])
        ankle = knee + np.array([thigh_len * np.sin(theta) * 0.6, shank_len * np.cos(theta)])
        foot = ankle + np.array([0.04, 0.02])

        shoulder = hip - np.array([0.0, 0.28])
        elbow = shoulder + np.array([0.12, 0.12])
        wrist = elbow + np.array([0.08, 0.12])

        def add_noise(pt):
            return pt + rng.normal(0, jitter, size=2)

        for side, scale in (("left", 1.0), ("right", symmetry_factor)):
            pts = {
                f"{side}_hip": add_noise(hip),
                f"{side}_knee": add_noise(knee * scale),
                f"{side}_ankle": add_noise(ankle * scale),
                f"{side}_foot_index": add_noise(foot * scale),
                f"{side}_shoulder": add_noise(shoulder),
                f"{side}_elbow": add_noise(elbow),
                f"{side}_wrist": add_noise(wrist),
            }
            for name, (x, y) in pts.items():
                rows.append({
                    "frame": int(i),
                    "time_s": round(float(time_s), 4),
                    "landmark": name,
                    "x": float(x),
                    "y": float(y),
                    "z": float(0.05 * descent_ratio if "knee" in name else 0.0),
                    "visibility": 0.99,
                })

    return pd.DataFrame(rows)


def process_landmarks_dataframe(landmarks_df: pd.DataFrame, fps: float = 30.0) -> Dict[str, Any]:
    """
    Run Phase 2 (Biomechanics) and Phase 3 (Exercise Analysis) on landmark DataFrame.
    """
    bio_report = build_biomechanics_report(landmarks_df, fps=fps)
    frame_level = bio_report["frame_level"]
    summary = bio_report["summary"]

    exercise_report = analyze_session(frame_level, summary, fps=fps)

    # Convert frame_level to lightweight serializable records for frontend 3D & chart playback
    chart_cols = [
        "frame", "time_s",
        "left_knee_angle", "right_knee_angle",
        "left_hip_angle", "right_hip_angle",
        "left_ankle_angle", "right_ankle_angle",
        "left_knee_velocity", "right_knee_velocity"
    ]
    avail_cols = [c for c in chart_cols if c in frame_level.columns]
    frame_records = frame_level[avail_cols].replace({np.nan: None}).to_dict(orient="records")

    # Round floating values in frame records for speed and payload compactness
    for row in frame_records:
        for k, v in row.items():
            if isinstance(v, float):
                row[k] = round(v, 2)

    return {
        "summary": {
            **summary,
            "rep_count": exercise_report.rep_count,
            "recovery_score": exercise_report.recovery_score,
            **exercise_report.session_metrics,
        },
        "reps": [
            {
                "rep_number": idx + 1,
                "start_frame": r.start_frame,
                "end_frame": r.end_frame,
                "peak_flexion_deg": round(r.peak_flexion_deg, 1),
                "depth_deg": round(r.depth_deg, 1),
                "duration_s": round((r.end_frame - r.start_frame) / fps, 2),
                "quality_score": round(min(100.0, (r.depth_deg / 110.0) * 100), 1),
            }
            for idx, r in enumerate(exercise_report.reps)
        ],
        "frame_data": frame_records,
    }


def process_video_pipeline(video_path: str, fps_override: Optional[float] = None) -> Dict[str, Any]:
    """
    Execute full video analysis pipeline from video file on disk.
    """
    if not MEDIA_PIPE_AVAILABLE:
        raise RuntimeError("MediaPipe is not available in the current environment.")

    extraction = extract_landmarks_from_video(video_path)
    fps = fps_override or extraction.fps

    if extraction.detection_rate == 0.0 or extraction.landmarks_df.empty:
        return {
            "error": "No pose detected in video",
            "detection_rate": 0.0,
            "summary": {},
            "reps": [],
            "frame_data": []
        }

    results = process_landmarks_dataframe(extraction.landmarks_df, fps=fps)
    results["detection_rate"] = extraction.detection_rate
    results["fps"] = fps
    results["frame_count"] = extraction.frame_count
    return results


def calculate_instant_telemetry(
    landmarks_dict: Dict[str, Dict[str, float]],
    state_cache: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Compute real-time joint angles and state machine updates from a single frame dictionary.
    landmarks_dict format: { 'left_hip': {'x': 0.5, 'y': 0.4}, ... }
    """
    state_cache = state_cache or {"rep_count": 0, "state": "standing", "peak_angle": 180.0}

    def get_pt(name: str):
        if name in landmarks_dict:
            d = landmarks_dict[name]
            return np.array([d.get("x", 0.0), d.get("y", 0.0)])
        return None

    angles = {}
    for joint_name, (p_name, j_name, d_name) in JOINT_DEFINITIONS.items():
        p, j, d = get_pt(p_name), get_pt(j_name), get_pt(d_name)
        if p is not None and j is not None and d is not None:
            angle = _angle_3pt(p, j, d)
            angles[f"{joint_name}_angle"] = round(angle, 1) if not np.isnan(angle) else 180.0
        else:
            angles[f"{joint_name}_angle"] = 180.0

    left_knee = angles.get("left_knee_angle", 180.0)
    right_knee = angles.get("right_knee_angle", 180.0)

    # Instant symmetry
    knee_diff = abs(left_knee - right_knee)
    max_k = max(left_knee, right_knee, 1.0)
    symmetry_pct = max(0.0, round(100.0 * (1.0 - (knee_diff / max_k)), 1))

    # Real-time state machine for squats
    cur_state = state_cache.get("state", "standing")
    rep_count = state_cache.get("rep_count", 0)
    peak = state_cache.get("peak_angle", 180.0)
    feedback = "Keep chest up and maintain balance"

    avg_knee = (left_knee + right_knee) / 2.0
    if cur_state == "standing":
        if avg_knee <= 160.0:
            cur_state = "descending"
            peak = avg_knee
            feedback = "Descending: Keep knees tracked over toes"
    elif cur_state == "descending":
        peak = min(peak, avg_knee)
        if avg_knee <= 115.0:
            cur_state = "ascending"
            feedback = "Optimal depth reached! Push through heels to stand"
        elif avg_knee <= 135.0:
            feedback = "Good depth - push a bit lower if comfortable"
    elif cur_state == "ascending":
        if avg_knee >= 160.0:
            cur_state = "standing"
            rep_count += 1
            feedback = f"Rep {rep_count} completed! Excellent form."
            peak = 180.0

    state_cache["state"] = cur_state
    state_cache["rep_count"] = rep_count
    state_cache["peak_angle"] = peak

    # Instant score proxy
    rom_score = min(100.0, max(0.0, ((180.0 - peak) / 70.0) * 100)) if cur_state != "standing" else 85.0
    instant_score = round(0.5 * rom_score + 0.5 * symmetry_pct, 1)

    return {
        "angles": angles,
        "symmetry_pct": symmetry_pct,
        "current_rep": rep_count,
        "rep_state": cur_state,
        "instant_recovery_score": instant_score,
        "feedback": feedback,
        "state_cache": state_cache,
    }
