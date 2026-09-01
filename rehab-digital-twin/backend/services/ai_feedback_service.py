from __future__ import annotations
from typing import Dict, Any, List


def generate_clinical_feedback(
    metrics: Dict[str, Any],
    reps: List[Dict[str, Any]],
    exercise_name: str = "knee_flexion_squat",
    target_rom_deg: float = 130.0
) -> Dict[str, Any]:
    """
    Synthesize kinematic metrics and rep logs into actionable, clinical-grade
    rehabilitation feedback and guidance.
    """
    rom = metrics.get("knee_rom_deg", 0.0) or 0.0
    symmetry = metrics.get("symmetry_pct", 0.0) or 0.0
    stability = metrics.get("stability_pct", 0.0) or 0.0
    speed = metrics.get("movement_speed_mps", 0.0) or 0.0
    score = metrics.get("recovery_score", 0.0) or 0.0
    rep_count = len(reps)

    insights = []
    warnings = []
    recommendations = []

    # 1. ROM Evaluation
    rom_achievement = (rom / target_rom_deg) * 100 if target_rom_deg > 0 else 100
    if rom_achievement >= 90:
        insights.append(f"Excellent functional range of motion ({rom:.1f}°, {rom_achievement:.0f}% of target {target_rom_deg}°).")
    elif rom_achievement >= 75:
        insights.append(f"Moderate range of motion ({rom:.1f}°). Near functional threshold.")
        recommendations.append("Progressively increase depth by 5-10° on the concentric descent using box squat support.")
    else:
        warnings.append(f"Restricted range of motion ({rom:.1f}° vs {target_rom_deg}° target). Guarding pattern detected.")
        recommendations.append("Incorporate active hamstring and quadriceps mobility drills prior to loaded movement.")

    # 2. Symmetry Evaluation
    if symmetry >= 92:
        insights.append(f"High bilateral limb symmetry ({symmetry:.1f}%). Equal load distribution between lower extremities.")
    elif symmetry >= 80:
        warnings.append(f"Mild bilateral asymmetry ({symmetry:.1f}%). Affected limb showing subtle offloading.")
        recommendations.append("Use tactile mirror feedback or biofeedback gauge to maintain equal weight shift.")
    else:
        warnings.append(f"Significant asymmetry ({symmetry:.1f}%). Compensatory weight shift to contralateral limb.")
        recommendations.append("Perform split-stance isometric holds and single-leg assisted knee flexions.")

    # 3. Stability & Smoothness Evaluation
    if stability >= 90:
        insights.append(f"Smooth neuromuscular control and low joint jitter ({stability:.1f}% stability).")
    elif stability >= 75:
        insights.append(f"Acceptable motor control ({stability:.1f}% stability) with minor mid-range deceleration.")
    else:
        warnings.append(f"Elevated trajectory jerk ({stability:.1f}% stability). Indicates motor unit fatigue or pain inhibition.")
        recommendations.append("Slow down tempo: apply 3-second eccentric (down) and 2-second concentric (up) pacing.")

    # 4. Rep Consistency
    if rep_count > 1:
        depths = [r.get("depth_deg", 0.0) for r in reps if r.get("depth_deg") is not None]
        if depths:
            depth_variance = max(depths) - min(depths)
            if depth_variance > 20:
                warnings.append(f"Inconsistent depth between reps (variance {depth_variance:.1f}°). Depth degraded toward end of set.")
                recommendations.append("Maintain set volume at 3-4 high-quality reps to prevent compensatory fatigue.")
            else:
                insights.append(f"Consistent repetition cadence and depth preservation throughout the set.")

    # Status classification
    if score >= 85:
        status = "Optimal Recovery Progress"
        badge_color = "emerald"
    elif score >= 70:
        status = "Satisfactory Progress - Minor Compensation"
        badge_color = "amber"
    else:
        status = "Needs Targeted Intervention"
        badge_color = "rose"

    summary_text = (
        f"Session finished with {rep_count} completed reps and an overall Recovery Score of {score:.1f}/100. "
        + (" ".join(insights[:2]))
        + (" " + " ".join(warnings[:1]) if warnings else "")
    )

    return {
        "status": status,
        "badge_color": badge_color,
        "recovery_score": round(score, 1),
        "summary_text": summary_text,
        "insights": insights,
        "warnings": warnings,
        "recommendations": recommendations,
    }
