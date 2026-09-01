import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.database import engine, Base, SessionLocal
from backend.models import Patient, RehabSession
from backend.routers import sessions, patients, ws_live

# Initialize DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Musculoskeletal Digital Twin API",
    description="Full-stack AI biomechanics and digital twin platform for orthopedic rehabilitation",
    version="1.0.0",
)

# CORS config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount raw video static directory
RAW_VIDEO_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"
RAW_VIDEO_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static/videos", StaticFiles(directory=str(RAW_VIDEO_DIR)), name="videos")

# Include Routers
app.include_router(sessions.router)
app.include_router(patients.router)
app.include_router(ws_live.router)


@app.on_event("startup")
def startup_event():
    # Ensure at least one initial demo session exists for immediate exploration
    db = SessionLocal()
    try:
        patients_count = db.query(Patient).count()
        if patients_count == 0:
            # Trigger patient creation
            patients.get_patients(db=db)

        sessions_count = db.query(RehabSession).count()
        if sessions_count == 0:
            from backend.schemas import SyntheticSessionRequest
            first_patient = db.query(Patient).first()
            sessions.create_synthetic_session(
                SyntheticSessionRequest(
                    exercise_name="knee_flexion_squat",
                    n_reps=4,
                    rom_target_deg=115.0,
                    symmetry_noise=0.04,
                    jitter_noise=0.002,
                    patient_id=first_patient.id if first_patient else None,
                ),
                db=db
            )
    finally:
        db.close()


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "AI Musculoskeletal Digital Twin Backend",
        "version": "1.0.0",
        "database": "connected",
    }


# Frontend static files serving (when built)
FRONTEND_DIST = Path(__file__).resolve().parents[1] / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
