"""
MVP pipeline runner (Phases 1-3):

    VIDEO -> MediaPipe -> BODY LANDMARKS -> JOINT ANGLES -> EXERCISE ANALYSIS -> SCORE

Usage:
    python run_mvp.py data/raw/exercise.mp4 [--session-id S1] [--fps 30]

Writes:
    data/processed/pose_landmarks.csv          (Phase 1)
    data/features/biomechanics_frame_level.csv (Phase 2)
    data/features/session_report.json          (Phase 2 + 3 summary)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "computer_vision"))
sys.path.insert(0, str(Path(__file__).resolve().parent / "biomechanics"))

from pose_estimation import extract_landmarks_from_video, save_landmarks_csv  # noqa: E402
from joint_angles import build_biomechanics_report  # noqa: E402
from exercise_analysis import analyze_session  # noqa: E402


def run(video_path: str, session_id: str = "session_1", fps_override: float | None = None) -> dict:
    print(f"=== Rehab Digital Twin — MVP pipeline: {session_id} ===")

    # Phase 1 — Pose estimation
    print(f"\n[Phase 1] Pose estimation: {video_path}")
    extraction = extract_landmarks_from_video(video_path)
    fps = fps_override or extraction.fps
    landmarks_csv = save_landmarks_csv(extraction, "data/processed/pose_landmarks.csv")
    print(f"  frames: {extraction.frame_count} | detection rate: {extraction.detection_rate:.1%}")
    print(f"  saved -> {landmarks_csv}")

    if extraction.detection_rate == 0.0:
        print("  No landmarks detected — cannot compute biomechanics/exercise metrics for this video.")
        report = {
            "session_id": session_id,
            "video": str(video_path),
            "detection_rate": extraction.detection_rate,
            "error": "no_pose_detected",
        }
        _save_report(report)
        return report

    # Phase 2 — Biomechanics
    print("\n[Phase 2] Biomechanics")
    bio = build_biomechanics_report(extraction.landmarks_df, fps=fps)
    for k, v in bio["summary"].items():
        print(f"  {k}: {v:.2f}")

    # Phase 3 — Exercise analysis / score
    print("\n[Phase 3] Exercise analysis")
    exercise_report = analyze_session(bio["frame_level"], bio["summary"], fps=fps)
    print(f"  reps: {exercise_report.rep_count}")
    print(f"  recovery score: {exercise_report.recovery_score}")

    report = {
        "session_id": session_id,
        "video": str(video_path),
        "detection_rate": extraction.detection_rate,
        "biomechanics_summary": bio["summary"],
        **exercise_report.to_dict(),
    }
    _save_report(report)
    return report


def _save_report(report: dict, out_path: str = "data/features/session_report.json"):
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"\nSaved session report -> {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the rehab digital twin MVP pipeline on one video.")
    parser.add_argument("video", help="Path to patient exercise video")
    parser.add_argument("--session-id", default="session_1")
    parser.add_argument("--fps", type=float, default=None, help="Override detected FPS")
    args = parser.parse_args()

    run(args.video, session_id=args.session_id, fps_override=args.fps)
