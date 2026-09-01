# AI Musculoskeletal Digital Twin for Rehabilitation

Portfolio/research prototype. **Not a clinically validated medical system.**

## Status: MVP (Phases 0–3) working end to end ✅

```
VIDEO -> MediaPipe -> BODY LANDMARKS -> JOINT ANGLES -> EXERCISE ANALYSIS -> SCORE
```

Phases 4–8 (OpenSim, ML, Deep Learning, Digital Twin store, React/Three.js
product) are not built yet — this is intentionally staged, per the project
plan. Build on top of this once you're ready to move to Phase 4.

## What's implemented

| Phase | Module | What it does |
|---|---|---|
| 0 | `requirements.txt` | Environment: OpenCV, MediaPipe, NumPy, Pandas |
| 1 | `computer_vision/pose_estimation.py` | Video → 33 MediaPipe landmarks → CSV |
| 2 | `biomechanics/joint_angles.py` | Landmarks → knee/hip/elbow/ankle angles → ROM, velocity, symmetry, stability |
| 3 | `biomechanics/exercise_analysis.py` | Squat/knee-flexion rep detection, rep counting, composite recovery score |
| — | `run_mvp.py` | Wires Phases 1→3 into one command: video in, score out |
| — | `tests/test_mvp_pipeline.py` | End-to-end sanity test using synthesized squat landmarks (no video needed) |

## Important implementation note: MediaPipe version is pinned

`mediapipe>=0.10.14` removed the legacy `mp.solutions.pose` API in favor of
the newer Tasks API, which requires downloading a separate `.task` model
file from `storage.googleapis.com` at runtime. That domain wasn't reachable
in the build sandbox, so this project pins **`mediapipe==0.10.13`**, the
last release that ships `solutions.pose` with the model bundled in the pip
wheel — fully offline, no model download needed. If you have unrestricted
network access and want the newer Tasks API instead, see the comment at the
top of `requirements.txt` for the migration note.

## Quickstart

```bash
pip install -r requirements.txt

# Put a real patient exercise video here:
#   data/raw/exercise.mp4

python run_mvp.py data/raw/exercise.mp4 --session-id session_1
```

Outputs:
- `data/processed/pose_landmarks.csv` — raw per-frame landmarks (Phase 1)
- `data/features/biomechanics_frame_level.csv` — per-frame joint angles (Phase 2)
- `data/features/session_report.json` — reps, ROM, symmetry, stability, recovery score (Phase 2+3)

## Verifying it actually works (no camera/video needed)

```bash
python tests/test_mvp_pipeline.py
```

This synthesizes a 3-rep squat landmark sequence directly (bypassing video
capture, since MediaPipe detection quality can't be meaningfully tested
without a real person on camera) and pushes it through Phases 2 and 3,
asserting that rep counting, ROM, symmetry, stability, and the recovery
score all come out sane. Last run: **3/3 reps detected, all checks passed.**

## Known limitations of the current MVP

- **`movement_speed_mps` is an estimate, not calibrated.** MediaPipe gives
  normalized image coordinates, not real-world metric distances, so
  converting knee angular velocity to linear velocity currently assumes a
  fixed 0.45 m shank length. Phase 4 (OpenSim) is where this becomes a real,
  subject-scaled measurement.
- **`compute_recovery_score` weights (0.4 / 0.35 / 0.25) and the 130°
  target ROM are placeholders**, not clinically derived. Phase 5/6 should
  learn or validate these instead of hardcoding them.
- Rep detection (`detect_squat_reps`) is a simple threshold state machine on
  one knee's angle. It works for a clean single-leg squat pattern but will
  need tuning (or a learned classifier) for other exercises.
- No handling yet for multiple people in frame, occlusion recovery, or
  camera-angle correction — all normal MediaPipe/single-camera caveats.

## Next steps (Phase 4+)

1. **Phase 4 — OpenSim**: feed joint angle time series into inverse
   kinematics against a scaled musculoskeletal model for real biomechanical
   (not just kinematic) analysis, and to calibrate movement speed properly.
2. **Phase 5/6 — ML/DL**: replace the hardcoded recovery-score formula with
   a model trained on (or validated against) real session progressions.
3. **Phase 7 — Digital twin store**: persist per-patient session history
   (this MVP only handles one video at a time).
4. **Phase 8 — Product**: FastAPI + PostgreSQL backend, React + Three.js
   avatar/dashboard frontend.

## Project structure

```
rehab-digital-twin/
├── data/{raw,processed,features}/
├── computer_vision/       # Phase 1
├── biomechanics/          # Phase 2 + 3
├── opensim/                # Phase 4 (not yet built)
├── ml/                      # Phase 5/6 (not yet built)
├── backend/                # Phase 8 (not yet built)
├── frontend/                # Phase 8 (not yet built)
├── notebooks/
├── tests/
├── run_mvp.py
└── requirements.txt
```
