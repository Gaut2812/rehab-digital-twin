"""
End-to-end MVP sanity test — no real video required.

We can't run MediaPipe detection meaningfully without an actual patient
video, so this test synthesizes a plausible landmark sequence for 3 squat
reps directly (bypassing computer_vision/pose_estimation.py) and pushes it
through Phase 2 (biomechanics) and Phase 3 (exercise analysis) to prove the
rest of the MVP pipeline works end to end.

Run:
    python tests/test_mvp_pipeline.py
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "biomechanics"))

from joint_angles import build_biomechanics_report  # noqa: E402
from exercise_analysis import analyze_session  # noqa: E402


def synthesize_squat_landmarks(n_reps=3, frames_per_rep=30, fps=30.0, noise=0.003) -> pd.DataFrame:
    """
    Build a long-format landmark DataFrame (same schema as
    pose_estimation.extract_landmarks_from_video output) simulating a
    standing->squat->standing cycle repeated n_reps times, for both legs
    (roughly symmetric, with a little noise so symmetry/stability aren't
    trivially 100%).
    """
    rng = np.random.default_rng(42)
    rows = []
    frame = 0

    # Simple 2-link leg model in normalized image coords: hip fixed, knee and
    # ankle swing as the knee angle changes from ~170 deg (standing) to ~90 deg
    # (squat) and back, via a triangle wave.
    hip = np.array([0.5, 0.4])
    thigh_len, shank_len = 0.2, 0.2

    total_frames = n_reps * frames_per_rep
    t = np.arange(total_frames)
    # Triangle wave between 170 (standing) and 90 (deep squat) degrees.
    phase = (t % frames_per_rep) / frames_per_rep
    knee_angle_deg = np.where(
        phase < 0.5,
        170 - (170 - 90) * (phase / 0.5),
        90 + (170 - 90) * ((phase - 0.5) / 0.5),
    )

    for i in range(total_frames):
        time_s = i / fps
        theta = np.radians(180 - knee_angle_deg[i])  # knee bend from vertical

        knee = hip + np.array([0.0, thigh_len])
        ankle = knee + np.array([thigh_len * np.sin(theta) * 0.6, shank_len * np.cos(theta)])
        foot = ankle + np.array([0.05, 0.02])

        shoulder = hip - np.array([0.0, 0.25])
        elbow = shoulder + np.array([0.15, 0.1])
        wrist = elbow + np.array([0.1, 0.1])

        def jitter(pt):
            return pt + rng.normal(0, noise, size=2)

        for side, side_noise in (("left", 1.0), ("right", 1.05)):
            pts = {
                f"{side}_hip": jitter(hip),
                f"{side}_knee": jitter(knee * side_noise),
                f"{side}_ankle": jitter(ankle * side_noise),
                f"{side}_foot_index": jitter(foot * side_noise),
                f"{side}_shoulder": jitter(shoulder),
                f"{side}_elbow": jitter(elbow),
                f"{side}_wrist": jitter(wrist),
            }
            for name, (x, y) in pts.items():
                rows.append(
                    {
                        "frame": i,
                        "time_s": round(time_s, 4),
                        "landmark": name,
                        "x": float(x),
                        "y": float(y),
                        "z": 0.0,
                        "visibility": 0.99,
                    }
                )
        frame = i

    return pd.DataFrame(rows)


def run():
    print("=" * 60)
    print("MVP end-to-end test (synthetic squat data, no video needed)")
    print("=" * 60)

    fps = 30.0
    landmarks_df = synthesize_squat_landmarks(n_reps=3, frames_per_rep=30, fps=fps)
    print(f"\n[synthetic data] {landmarks_df['frame'].nunique()} frames, "
          f"{landmarks_df['landmark'].nunique()} landmarks/frame")

    # --- Phase 2: Biomechanics ---
    report = build_biomechanics_report(landmarks_df, fps=fps)
    summary = report["summary"]
    print("\n[Phase 2] Biomechanics summary:")
    for k, v in summary.items():
        print(f"  {k}: {v:.2f}")

    assert "left_knee_angle" in report["frame_level"].columns, "knee angle column missing"
    assert not np.isnan(summary.get("left_knee_rom_deg", np.nan)), "ROM computation failed"
    assert summary["left_knee_rom_deg"] > 50, f"ROM implausibly low: {summary['left_knee_rom_deg']}"

    # --- Phase 3: Exercise analysis ---
    exercise_report = analyze_session(report["frame_level"], summary, fps=fps)
    print("\n[Phase 3] Exercise report:")
    print(f"  reps detected: {exercise_report.rep_count} (expected ~3)")
    print(f"  session metrics: {exercise_report.session_metrics}")
    print(f"  recovery score: {exercise_report.recovery_score}")

    assert exercise_report.rep_count in (2, 3, 4), f"rep count off: {exercise_report.rep_count}"
    assert 0 <= exercise_report.recovery_score <= 100, "recovery score out of range"

    print("\n[SUCCESS] ALL CHECKS PASSED - Phase 1->3 MVP pipeline (minus live video) works end to end.")


if __name__ == "__main__":
    run()

