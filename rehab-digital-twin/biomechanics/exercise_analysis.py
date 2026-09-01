"""
Phase 3 — Exercise Intelligence

    Pose sequence -> Squat detection -> Rep counting -> Movement quality -> Score

Consumes the frame-level biomechanics table (from biomechanics/joint_angles.py)
and produces a per-session exercise report:

    {
        "exercise": "knee_flexion_squat",
        "reps": [...],
        "rep_count": 5,
        "session_metrics": {
            "knee_rom_deg": 108.4,
            "movement_speed_mps": 0.71,   # proxy, see note below
            "symmetry_pct": 91.2,
            "stability_pct": 87.0,
        },
        "recovery_score": 78.0,
    }
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd


@dataclass
class Rep:
    start_frame: int
    end_frame: int
    peak_flexion_deg: float
    depth_deg: float  # ROM covered during this rep


@dataclass
class ExerciseReport:
    exercise: str
    reps: list[Rep] = field(default_factory=list)
    session_metrics: dict = field(default_factory=dict)
    recovery_score: float = 0.0

    @property
    def rep_count(self) -> int:
        return len(self.reps)

    def to_dict(self) -> dict:
        return {
            "exercise": self.exercise,
            "rep_count": self.rep_count,
            "reps": [r.__dict__ for r in self.reps],
            "session_metrics": self.session_metrics,
            "recovery_score": self.recovery_score,
        }


def detect_squat_reps(
    angled_df: pd.DataFrame,
    angle_col: str = "left_knee_angle",
    standing_threshold_deg: float = 160.0,
    flexed_threshold_deg: float = 130.0,
    min_frames_per_rep: int = 5,
) -> list[Rep]:
    """
    Simple state-machine rep counter for a knee flexion / squat exercise.

    STANDING (angle >= standing_threshold) -> DESCENDING -> FLEXED (angle <=
    flexed_threshold) -> ASCENDING -> STANDING counts as one completed rep.
    """
    series = angled_df[angle_col]
    reps: list[Rep] = []

    state = "standing"
    rep_start = None
    peak_flexion = 180.0  # smallest angle seen this rep (deepest point)
    rep_start_angle = None

    for idx, angle in series.items():
        if pd.isna(angle):
            continue

        if state == "standing":
            if angle <= standing_threshold_deg:
                state = "descending"
                rep_start = idx
                rep_start_angle = angle
                peak_flexion = angle

        elif state == "descending":
            peak_flexion = min(peak_flexion, angle)
            if angle <= flexed_threshold_deg:
                state = "ascending"

        elif state == "ascending":
            peak_flexion = min(peak_flexion, angle)
            if angle >= standing_threshold_deg:
                # rep complete
                if rep_start is not None and (idx - rep_start) >= min_frames_per_rep:
                    depth = (rep_start_angle - peak_flexion) if rep_start_angle else np.nan
                    reps.append(
                        Rep(
                            start_frame=int(rep_start),
                            end_frame=int(idx),
                            peak_flexion_deg=float(peak_flexion),
                            depth_deg=float(depth),
                        )
                    )
                state = "standing"
                rep_start = None
                peak_flexion = 180.0

    return reps


def estimate_movement_speed(
    angled_df: pd.DataFrame, angle_col: str = "left_knee_angle", fps: float = 30.0
) -> float:
    """
    Proxy for movement speed in m/s. Without camera calibration we cannot get
    true metric velocity from normalized image coordinates, so this converts
    angular velocity (deg/s) to a rough linear-equivalent using an assumed
    shank length (0.45 m, adult average) as a stand-in scale factor.

    This is clearly flagged as an estimate — replace with OpenSim-calibrated
    values in Phase 4.
    """
    ASSUMED_SHANK_LENGTH_M = 0.45

    dt = 1.0 / fps
    angular_velocity_deg_s = angled_df[angle_col].diff().abs() / dt
    angular_velocity_rad_s = np.radians(angular_velocity_deg_s)
    linear_velocity_mps = angular_velocity_rad_s * ASSUMED_SHANK_LENGTH_M

    return float(linear_velocity_mps.dropna().mean()) if not linear_velocity_mps.dropna().empty else float("nan")


def compute_recovery_score(session_metrics: dict) -> float:
    """
    Composite 0-100 recovery/quality score for this session.

    Weighted blend of ROM (against a healthy-target ROM), symmetry, and
    stability. Weights and target are placeholders — Phase 5/6 should learn
    these from data rather than hardcoding them.
    """
    TARGET_ROM_DEG = 130.0  # a commonly cited functional squat/knee-flexion target

    rom = session_metrics.get("knee_rom_deg", np.nan)
    symmetry = session_metrics.get("symmetry_pct", np.nan)
    stability = session_metrics.get("stability_pct", np.nan)

    rom_score = min(100.0, 100.0 * (rom / TARGET_ROM_DEG)) if not np.isnan(rom) else np.nan

    components = {"rom": (rom_score, 0.4), "symmetry": (symmetry, 0.35), "stability": (stability, 0.25)}
    valid = [(val, weight) for val, weight in components.values() if not (val is None or np.isnan(val))]

    if not valid:
        return float("nan")

    total_weight = sum(w for _, w in valid)
    score = sum(v * w for v, w in valid) / total_weight
    return round(float(score), 1)


def analyze_session(
    angled_df: pd.DataFrame,
    summary_metrics: dict,
    fps: float = 30.0,
    exercise_name: str = "knee_flexion_squat",
) -> ExerciseReport:
    """Full Phase 3 pipeline: detect reps, compute session metrics, score it."""
    reps = detect_squat_reps(angled_df)
    movement_speed = estimate_movement_speed(angled_df, fps=fps)

    session_metrics = {
        "knee_rom_deg": summary_metrics.get("left_knee_rom_deg", np.nan),
        "movement_speed_mps": round(movement_speed, 3) if not np.isnan(movement_speed) else np.nan,
        "symmetry_pct": summary_metrics.get("knee_symmetry_pct", np.nan),
        "stability_pct": summary_metrics.get("left_knee_stability_pct", np.nan),
    }

    score = compute_recovery_score(session_metrics)

    return ExerciseReport(
        exercise=exercise_name, reps=reps, session_metrics=session_metrics, recovery_score=score
    )


if __name__ == "__main__":
    import json
    import sys

    csv_path = sys.argv[1] if len(sys.argv) > 1 else "data/features/biomechanics_frame_level.csv"
    fps = float(sys.argv[2]) if len(sys.argv) > 2 else 30.0

    angled_df = pd.read_csv(csv_path)

    from joint_angles import compute_rom, compute_symmetry, compute_stability

    summary = {}
    if "left_knee_angle" in angled_df.columns:
        summary["left_knee_rom_deg"] = compute_rom(angled_df, "left_knee_angle")
        summary["left_knee_stability_pct"] = compute_stability(angled_df, "left_knee_angle")
    if "left_knee_angle" in angled_df.columns and "right_knee_angle" in angled_df.columns:
        summary["knee_symmetry_pct"] = compute_symmetry(angled_df, "left_knee_angle", "right_knee_angle")

    report = analyze_session(angled_df, summary, fps=fps)
    print("[Phase 3] Exercise report:")
    print(json.dumps(report.to_dict(), indent=2))
