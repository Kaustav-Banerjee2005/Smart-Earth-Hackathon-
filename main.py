import time
from typing import List
from dotenv import load_dotenv  # <-- Add this first
load_dotenv()  # <-- Force load the variables right here!

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, status
from pydantic import BaseModel
from config import supabase

app = FastAPI(title="RescueAI Backend API")

# --- DATA VALIDATION MODELS ---
class SOSCreate(BaseModel):
    user_id: str
    name: str
    age: int
    medical_conditions: bool
    latitude: float
    longitude: float

class StatusUpdate(BaseModel):
    status: str  # pending, dispatched, resolved

class LocationUpdate(BaseModel):
    user_id: str
    family_id: str
    latitude: float
    longitude: float

# --- REAL-TIME WEBSOCKET MANAGER ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

# --- AI PRIORITY SCORING ENGINE ---
def calculate_priority_score(age: int, has_medical: bool, lat: float, lng: float) -> int:
    score = 0
    if age < 12 or age > 60:
        score += 30
    if has_medical:
        score += 25
        
    # Example bounding box for high-risk flood zones
    FLOOD_ZONES = [{"min_lat": 12.90, "max_lat": 12.95, "min_lng": 77.55, "max_lng": 77.65}]
    in_danger = any(z["min_lat"] <= lat <= z["max_lat"] and z["min_lng"] <= lng <= z["max_lng"] for z in FLOOD_ZONES)
    if in_danger:
        score += 20
        
    return min(score, 100)

# --- API ROUTES ---
@app.post("/sos", status_code=status.HTTP_201_CREATED)
async def create_sos(payload: SOSCreate):
    score = calculate_priority_score(payload.age, payload.medical_conditions, payload.latitude, payload.longitude)
    
    data = {
        "user_id": payload.user_id,
        "name": payload.name,
        "age": payload.age,
        "medical_conditions": payload.medical_conditions,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "priority_score": score,
        "status": "pending",
        "created_at": int(time.time())
    }
    
    response = supabase.table("sos_signals").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Database insertion failed")
    
    # Hour 8 Milestone: Instantly alert the dashboard web app
    await manager.broadcast({"event": "new_sos", "data": response.data[0]})
    return response.data[0]

@app.get("/sos/list")
async def get_sos_list():
    response = supabase.table("sos_signals").select("*").neq("status", "resolved").order("priority_score", desc=True).execute()
    return response.data

@app.patch("/sos/{sos_id}/status")
async def update_sos_status(sos_id: int, payload: StatusUpdate):
    response = supabase.table("sos_signals").update({"status": payload.status}).eq("id", sos_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    await manager.broadcast({"event": "status_change", "data": response.data[0]})
    return response.data[0]

@app.post("/location")
async def update_location(payload: LocationUpdate):
    data = {**payload.model_dump(), "updated_at": int(time.time())}
    response = supabase.table("family_locations").upsert(data, on_conflict="user_id").execute()
    return {"status": "success", "data": response.data}

@app.get("/family/{family_id}")
async def get_family_locations(family_id: str):
    response = supabase.table("family_locations").select("*").eq("family_id", family_id).execute()
    return response.data

@app.get("/shelters")
async def get_shelters():
    response = supabase.table("shelters").select("*").execute()
    return response.data

@app.get("/stats")
async def get_stats():
    res = supabase.table("sos_signals").select("status").execute()
    return {
        "total": len(res.data),
        "pending": sum(1 for x in res.data if x["status"] == "pending"),
        "dispatched": sum(1 for x in res.data if x["status"] == "dispatched"),
        "resolved": sum(1 for x in res.data if x["status"] == "resolved")
    }

@app.get("/alerts")
async def get_alerts(lat: float, lng: float):
    return {"danger_level": "High", "type": "Weather Alert", "message": "Heavy precipitation detected."}

# --- WEBSOCKET ENDPOINT ---
@app.websocket("/ws/sos")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # Keeps connection open
    except WebSocketDisconnect:
        manager.disconnect(websocket)