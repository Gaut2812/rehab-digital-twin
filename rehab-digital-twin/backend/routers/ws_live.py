import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.services.pipeline_service import calculate_instant_telemetry

router = APIRouter(tags=["Live Telemetry WebSocket"])


@router.websocket("/ws/live-stream")
async def websocket_live_stream(websocket: WebSocket):
    await websocket.accept()
    state_cache = {"rep_count": 0, "state": "standing", "peak_angle": 180.0}

    try:
        while True:
            raw_data = await websocket.receive_text()
            data = json.loads(raw_data)

            # Expected message: {"type": "landmarks", "landmarks": {"left_hip": {"x": 0.5, "y": 0.4}, ...}}
            # or {"type": "reset"}
            msg_type = data.get("type", "landmarks")
            if msg_type == "reset":
                state_cache = {"rep_count": 0, "state": "standing", "peak_angle": 180.0}
                await websocket.send_text(json.dumps({"status": "reset_ok"}))
                continue

            landmarks_dict = data.get("landmarks", {})
            telemetry = calculate_instant_telemetry(landmarks_dict, state_cache=state_cache)
            state_cache = telemetry.pop("state_cache", state_cache)

            await websocket.send_text(json.dumps({
                "type": "telemetry",
                "timestamp_ms": data.get("timestamp_ms", 0),
                "data": telemetry
            }))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({"error": str(e)}))
        except Exception:
            pass
