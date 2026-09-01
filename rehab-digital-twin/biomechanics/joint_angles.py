"""
Phase 2 — Biomechanics

    Landmarks -> Hip/Knee/Ankle -> Joint angles -> ROM -> Velocity -> Symmetry

Consumes the long-format landmark CSV produced by computer_vision/pose_estimation.py
and produces a wide, per-frame biomechanics table.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

# Landmark triplets that define each joint angle (proximal - joint - distal),
# using MediaPipe Pose's naming convention.
JOINT_DEFINITIONS = {
    "left_knee": ("left_hip", "left_knee", "left_ankle"),
    "right_knee": ("right_hip", "right_knee", "right_ankle"),
    "left_hip": ("left_shoulder", "left_hip", "left_knee"),
    "right_hip": ("right_shoulder", "right_hip", "right_knee"),
    "left_elbow": ("left_shoulder", "left_elbow", "left_wrist"),
    "right_elbow": ("right_shoulder", "right_elbow", "right_wrist"),
    "left_ankle": ("left_knee", "left_ankle", "left_foot_index"),
    "right_ankle": ("right_knee", "right_ankle", "right_foot_index"),
}


def _angle_3pt(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    """Angle (degrees) at vertex b, formed by points a-b-c, in the xy plane."""
    ba = a - b
    bc = c - b
    denom = np.linalg.norm(ba) * np.linalg.norm(bc)
    if denom == 0:
        return np.nan
    cos_angle = np.clip(np.dot(ba, bc) / denom, -1.0, 1.0)
    return float(np.degrees(np.arccos(cos_angle)))


def long_to_wide(landmarks_df: pd.DataFrame) -> pd.DataFrame:
    """Pivot the long landmark table into one row per frame, columns like
    'left_knee_x', 'left_knee_y', etc."""
    wide = landmarks_df.pivot_table(
        index=["frame", "time_s"], columns="landmark", values=["x", "y", "z", "visibility"]
    )
    wide.columns = [f"{lm}_{coord}" for coord, lm in wide.columns]
    wide = wide.reset_index().sort_values("frame").reset_index(drop=True)
    return wide


def compute_joint_angles(wide_df: pd.DataFrame) -> pd.DataFrame:
    """Add one column per joint in JOINT_DEFINITIONS, e.g. 'left_knee_angle'."""
    df = wide_df.copy()

    for joint_name, (p_name, j_name, d_name) in JOINT_DEFINITIONS.items():
        p_cols = [f"{p_name}_x", f"{p_name}_y"]
        j_cols = [f"{j_name}_x", f"{j_name}_y"]
        d_cols = [f"{d_name}_x", f"{d_name}_y"]

        if not all(c in df.columns for c in p_cols + j_cols + d_cols):
            continue  # landmark missing from this dataset, skip gracefully

        angles = []
        for _, row in df.iterrows():
            p = row[p_cols].to_numpy(dtype=float)
            j = row[j_cols].to_numpy(dtype=float)
            d = row[d_cols].to_numpy(dtype=float)
            if np.any(np.isnan(p)) or np.any(np.isnan(j)) or np.any(np.isnan(d)):
                angles.append(np.nan)
            else:
                angles.append(_angle_3pt(p, j, d))

        df[f"{joint_name}_angle"] = angles

    return df


def compute_velocity(df: pd.DataFrame, angle_col: str, fps: float) -> pd.Series:
    """Angular velocity (deg/s) of a joint angle column via finite differences."""
    dt = 1.0 / fps
    return df[angle_col].diff() / dt


def compute_rom(df: pd.DataFrame, angle_col: str) -> float:
    """Range of motion (degrees) = max - min of a joint angle across the session."""
    series = df[angle_col].dropna()
    if series.empty:
        return float("nan")
    return float(series.max() - series.min())


def compute_symmetry(df: pd.DataFrame, left_col: str, right_col: str) -> float:
    """
    Symmetry score (0-100%) between left/right joint angle traces.
    100% = identical trajectories. Uses normalized mean absolute difference.
    """
    left = df[left_col].dropna()
    right = df[right_col].dropna()
    n = min(len(left), len(right))
    if n == 0:
        return float("nan")

    left = left.iloc[:n].to_numpy()
    right = right.iloc[:n].to_numpy()

    scale = max(np.max(np.abs(left)), np.max(np.abs(right)), 1e-6)
    mad = np.mean(np.abs(left - right))
    symmetry_pct = max(0.0, 100.0 * (1 - mad / scale))
    return float(symmetry_pct)


def compute_stability(df: pd.DataFrame, angle_col: str) -> float:
    """
    Stability score (0-100%): penalizes jitter/high-frequency noise in a joint
    angle trace relative to its overall range. Higher = smoother, more controlled.
    """
    series = df[angle_col].dropna()
    if len(series) < 3:
        return float("nan")

    jerk = series.diff().diff().abs().mean()  # 2nd derivative proxy for jitter
    rom = series.max() - series.min()
    if rom == 0:
        return 100.0
    noise_ratio = jerk / rom
    stability_pct = max(0.0, 100.0 * (1 - min(noise_ratio, 1.0)))
    return float(stability_pct)


def build_biomechanics_report(landmarks_df: pd.DataFrame, fps: float) -> dict:
    """End-to-end: long landmarks -> wide -> angles -> summary metrics dict."""
    wide = long_to_wide(landmarks_df)
    angled = compute_joint_angles(wide)

    if "left_knee_angle" in angled.columns:
        angled["left_knee_velocity"] = compute_velocity(angled, "left_knee_angle", fps)
    if "right_knee_angle" in angled.columns:
        angled["right_knee_velocity"] = compute_velocity(angled, "right_knee_angle", fps)

    summary = {}
    if "left_knee_angle" in angled.columns:
        summary["left_knee_rom_deg"] = compute_rom(angled, "left_knee_angle")
        summary["left_knee_stability_pct"] = compute_stability(angled, "left_knee_angle")
    if "right_knee_angle" in angled.columns:
        summary["right_knee_rom_deg"] = compute_rom(angled, "right_knee_angle")
        summary["right_knee_stability_pct"] = compute_stability(angled, "right_knee_angle")
    if "left_knee_angle" in angled.columns and "right_knee_angle" in angled.columns:
        summary["knee_symmetry_pct"] = compute_symmetry(angled, "left_knee_angle", "right_knee_angle")

    return {"frame_level": angled, "summary": summary}


if __name__ == "__main__":
    import sys

    csv_path = sys.argv[1] if len(sys.argv) > 1 else "data/processed/pose_landmarks.csv"
    fps = float(sys.argv[2]) if len(sys.argv) > 2 else 30.0

    landmarks_df = pd.read_csv(csv_path)
    report = build_biomechanics_report(landmarks_df, fps)

    print("[Phase 2] Biomechanics summary:")
    for k, v in report["summary"].items():
        print(f"  {k}: {v:.2f}")

    out_path = Path("data/features/biomechanics_frame_level.csv")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    report["frame_level"].to_csv(out_path, index=False)
    print(f"  Saved frame-level features -> {out_path}")
