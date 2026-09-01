import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=True)
    condition = Column(String(200), default="Knee Rehabilitation / Post-op")
    target_rom_deg = Column(Float, default=130.0)
    baseline_score = Column(Float, default=45.0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    sessions = relationship("RehabSession", back_populates="patient", cascade="all, delete-orphan")


class RehabSession(Base):
    __tablename__ = "rehab_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_uid = Column(String(50), unique=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    exercise_name = Column(String(100), default="knee_flexion_squat")
    video_filename = Column(String(255), nullable=True)
    detection_rate = Column(Float, default=1.0)
    rep_count = Column(Integer, default=0)
    recovery_score = Column(Float, default=0.0)
    knee_rom_deg = Column(Float, default=0.0)
    symmetry_pct = Column(Float, default=0.0)
    stability_pct = Column(Float, default=0.0)
    movement_speed_mps = Column(Float, default=0.0)
    ai_feedback = Column(Text, nullable=True)
    metrics_json = Column(Text, nullable=True)
    frame_data_json = Column(Text, nullable=True)

    patient = relationship("Patient", back_populates="sessions")
    reps = relationship("ExerciseRep", back_populates="session", cascade="all, delete-orphan")


class ExerciseRep(Base):
    __tablename__ = "exercise_reps"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("rehab_sessions.id"))
    rep_number = Column(Integer)
    start_frame = Column(Integer)
    end_frame = Column(Integer)
    peak_flexion_deg = Column(Float)
    depth_deg = Column(Float)
    duration_s = Column(Float, nullable=True)
    quality_score = Column(Float, nullable=True)

    session = relationship("RehabSession", back_populates="reps")
