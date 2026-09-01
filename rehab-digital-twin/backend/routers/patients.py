from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database import get_db
from backend.models import Patient, RehabSession
from backend.schemas import PatientCreate, PatientResponse

router = APIRouter(prefix="/api/patients", tags=["Patients"])


@router.get("", response_model=List[PatientResponse])
def get_patients(db: Session = Depends(get_db)):
    patients = db.query(Patient).all()
    if not patients:
        # Seed default demo patients for immediate testing
        demo_patients = [
            Patient(
                name="Alex Vance (ACL Rehab)",
                age=28,
                condition="Right ACL Reconstruction - Week 6",
                target_rom_deg=130.0,
                baseline_score=42.0,
                notes="Focus on quadriceps control and progressive flexion to 125°+."
            ),
            Patient(
                name="Sarah Chen (Meniscus Post-op)",
                age=35,
                condition="Lateral Meniscus Repair - Week 10",
                target_rom_deg=135.0,
                baseline_score=55.0,
                notes="Regaining bilateral squat symmetry and eccentric stability."
            ),
            Patient(
                name="Marcus Miller (Patellar Tendinopathy)",
                age=42,
                condition="Chronic Patellar Tendinopathy",
                target_rom_deg=120.0,
                baseline_score=60.0,
                notes="Isometric loading and controlled cadence squatting."
            ),
        ]
        for p in demo_patients:
            db.add(p)
        db.commit()
        patients = db.query(Patient).all()
    return patients


@router.post("", response_model=PatientResponse)
def create_patient(payload: PatientCreate, db: Session = Depends(get_db)):
    patient = Patient(
        name=payload.name,
        age=payload.age,
        condition=payload.condition,
        target_rom_deg=payload.target_rom_deg or 130.0,
        baseline_score=payload.baseline_score or 45.0,
        notes=payload.notes,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.get("/{patient_id}/trends")
def get_patient_trends(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    sessions = (
        db.query(RehabSession)
        .filter(RehabSession.patient_id == patient_id)
        .order_by(RehabSession.timestamp.asc())
        .all()
    )

    timeline = [
        {
            "session_id": s.id,
            "session_uid": s.session_uid,
            "date": s.timestamp.strftime("%b %d, %H:%M"),
            "recovery_score": s.recovery_score,
            "knee_rom_deg": s.knee_rom_deg,
            "symmetry_pct": s.symmetry_pct,
            "stability_pct": s.stability_pct,
            "rep_count": s.rep_count,
        }
        for s in sessions
    ]

    return {
        "patient": {
            "id": patient.id,
            "name": patient.name,
            "condition": patient.condition,
            "target_rom_deg": patient.target_rom_deg,
            "baseline_score": patient.baseline_score,
        },
        "total_sessions": len(sessions),
        "timeline": timeline,
    }
