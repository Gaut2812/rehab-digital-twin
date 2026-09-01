"""
Phase 1 — Pose Estimation

    VIDEO -> MediaPipe -> 33 landmarks -> data/processed/pose_landmarks.csv

Run standalone:
    python computer_vision/pose_estimation.py data/raw/exercise.mp4
"""

from __future__ import annotations

import sys
from pathlib import Path
from dataclasses import dataclass

import cv2
import mediapipe as mp
import numpy as np
import pandas as pd

mp_pose = mp.solutions.pose

# The 33 MediaPipe Pose landmark names, in index order (0-32).
LANDMARK_NAMES = [lm.name.lower() for lm in mp_pose.PoseLandmark]


@dataclass
class PoseExtractionResult:
    """Container for one processed video."""

    landmarks_df: pd.DataFrame
    fps: float
    frame_count: int
    frames_with_detection: int

    @property
    def detection_rate(self) -> float:
        if self.frame_count == 0:
            return 0.0
        return self.frames_with_detection / self.frame_count


def extract_landmarks_from_video(
    video_path: str | Path,
    model_complexity: int = 1,
    min_detection_confidence: float = 0.5,
    min_tracking_confidence: float = 0.5,
) -> PoseExtractionResult:
    """
    Run MediaPipe Pose over every frame of a video and return a tidy
    long-format DataFrame of landmarks:

        frame | time_s | landmark | x | y | z | visibility

    x, y are normalized [0, 1] image coordinates (as MediaPipe emits them);
    z is roughly in the same scale as x, with the hip as depth origin.
    """
    video_path = Path(video_path)
    if not video_path.exists():
        raise FileNotFoundError(f"Video not found: {video_path}")

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise IOError(f"Could not open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    rows = []
    frame_idx = 0
    frames_with_detection = 0

    with mp_pose.Pose(
        static_image_mode=False,
        model_complexity=model_complexity,
        min_detection_confidence=min_detection_confidence,
        min_tracking_confidence=min_tracking_confidence,
    ) as pose:
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb.flags.writeable = False
            result = pose.process(rgb)

            time_s = frame_idx / fps

            if result.pose_landmarks is not None:
                frames_with_detection += 1
                for name, lm in zip(LANDMARK_NAMES, result.pose_landmarks.landmark):
                    rows.append(
                        {
                            "frame": frame_idx,
                            "time_s": round(time_s, 4),
                            "landmark": name,
                            "x": lm.x,
                            "y": lm.y,
                            "z": lm.z,
                            "visibility": lm.visibility,
                        }
                    )
            # If no detection, we simply emit no rows for this frame
            # (downstream code should handle gaps, e.g. via interpolation).

            frame_idx += 1

    cap.release()

    df = pd.DataFrame(rows, columns=["frame", "time_s", "landmark", "x", "y", "z", "visibility"])
    return PoseExtractionResult(
        landmarks_df=df,
        fps=fps,
        frame_count=frame_idx,
        frames_with_detection=frames_with_detection,
    )


def save_landmarks_csv(result: PoseExtractionResult, out_path: str | Path) -> Path:
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    result.landmarks_df.to_csv(out_path, index=False)
    return out_path


def main():
    if len(sys.argv) < 2:
        print("Usage: python pose_estimation.py <video_path> [output_csv]")
        sys.exit(1)

    video_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else "data/processed/pose_landmarks.csv"

    print(f"[Phase 1] Extracting pose landmarks from: {video_path}")
    result = extract_landmarks_from_video(video_path)

    print(
        f"  frames: {result.frame_count} | fps: {result.fps:.2f} | "
        f"detection rate: {result.detection_rate:.1%}"
    )

    if result.detection_rate == 0.0:
        print("  WARNING: no pose detected in any frame. Check video quality/lighting.")

    saved = save_landmarks_csv(result, out_path)
    print(f"  Saved landmarks -> {saved}")


if __name__ == "__main__":
    main()
