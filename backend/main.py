"""
LastMile.cy - FastAPI Backend
=============================
RESTful API for the demand-responsive microtransit system.

Endpoints:
- POST /request: Create a new ride request
- GET /vehicles: Get all vehicle positions and status
- GET /requests: Get all pending/active requests
- POST /simulate: Run simulation step
- GET /stats: Get system statistics
- WebSocket /ws: Real-time updates
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import asyncio
import json
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from simulation.cyprus_env import (
    CyprusTransitEnv, 
    RideRequest, 
    Vehicle, 
    RequestStatus,
    CYPRUS_LOCATIONS,
    haversine_distance,
    estimate_travel_time
)
from rl_agent.dqn_agent import MultiVehicleDQNAgent

app = FastAPI(
    title="LastMile.cy API",
    description="AI-Powered Demand-Responsive Transit for Cyprus",
    version="1.0.0"
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
env: Optional[CyprusTransitEnv] = None
agent: Optional[MultiVehicleDQNAgent] = None
connected_websockets: List[WebSocket] = []


# Pydantic models
class LocationModel(BaseModel):
    lat: float = Field(..., ge=34.0, le=36.0, description="Latitude")
    lon: float = Field(..., ge=32.0, le=35.0, description="Longitude")


class RideRequestCreate(BaseModel):
    pickup: LocationModel
    dropoff: LocationModel
    passengers: int = Field(1, ge=1, le=8)
    
    
class RideRequestResponse(BaseModel):
    id: int
    pickup_lat: float
    pickup_lon: float
    dropoff_lat: float
    dropoff_lon: float
    passengers: int
    status: str
    wait_time: float
    assigned_vehicle: int
    estimated_pickup: Optional[float] = None
    estimated_dropoff: Optional[float] = None


class VehicleResponse(BaseModel):
    id: int
    lat: float
    lon: float
    capacity: int
    current_passengers: int
    available_capacity: int
    route: List[Dict[str, Any]]


class SystemStats(BaseModel):
    current_time: float
    total_vehicles: int
    active_vehicles: int
    pending_requests: int
    completed_rides: int
    cancelled_rides: int
    avg_wait_time: float
    total_distance_km: float
    completion_rate: float


class SimulationConfig(BaseModel):
    num_vehicles: int = Field(3, ge=1, le=10)
    max_requests: int = Field(10, ge=5, le=50)
    vehicle_capacity: int = Field(8, ge=4, le=20)
    max_wait_time: float = Field(30.0, ge=10.0, le=60.0)
    simulation_hours: float = Field(8.0, ge=1.0, le=24.0)
    demand_rate: float = Field(2.0, ge=0.5, le=10.0)
    seed: Optional[int] = None


class AIDecision(BaseModel):
    action: int
    action_type: str
    vehicle_id: Optional[int] = None
    request_id: Optional[int] = None
    confidence: float
    reasoning: str


# Startup/shutdown events
@app.on_event("startup")
async def startup():
    global env, agent
    print("🚀 Starting LastMile.cy Backend...")
    
    # Initialize environment and agent
    env = CyprusTransitEnv(num_vehicles=3, max_requests=10, seed=42)
    env.reset()
    
    agent = MultiVehicleDQNAgent(
        num_vehicles=3,
        max_requests=10,
        learning_rate=1e-4
    )
    
    print("✅ Environment and AI Agent initialized!")


@app.get("/")
async def root():
    return {
        "service": "LastMile.cy",
        "description": "AI-Powered Demand-Responsive Transit for Cyprus",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/locations")
async def get_locations():
    """Get all predefined Cyprus locations."""
    locations = []
    for key, value in CYPRUS_LOCATIONS.items():
        locations.append({
            "id": key,
            "lat": value[0],
            "lon": value[1],
            "name": value[2],
            "type": value[3]
        })
    return {"locations": locations}


@app.post("/init", response_model=Dict[str, Any])
async def initialize_simulation(config: SimulationConfig):
    """Initialize or reset the simulation with given configuration."""
    global env, agent
    
    env = CyprusTransitEnv(
        num_vehicles=config.num_vehicles,
        max_requests=config.max_requests,
        vehicle_capacity=config.vehicle_capacity,
        max_wait_time=config.max_wait_time,
        simulation_hours=config.simulation_hours,
        demand_rate=config.demand_rate,
        seed=config.seed
    )
    env.reset()
    
    agent = MultiVehicleDQNAgent(
        num_vehicles=config.num_vehicles,
        max_requests=config.max_requests,
        learning_rate=1e-4
    )
    
    return {
        "status": "initialized",
        "config": config.dict(),
        "state_size": env.state_size,
        "action_size": env.action_size
    }


@app.get("/vehicles", response_model=List[VehicleResponse])
async def get_vehicles():
    """Get current state of all vehicles."""
    if env is None:
        raise HTTPException(status_code=503, detail="Simulation not initialized")
    
    vehicles = []
    for v in env.vehicles:
        route_data = []
        for r in v.route:
            route_data.append({
                "lat": r[0],
                "lon": r[1],
                "request_id": r[2],
                "action": r[3]
            })
        
        vehicles.append(VehicleResponse(
            id=v.id,
            lat=v.lat,
            lon=v.lon,
            capacity=v.capacity,
            current_passengers=v.current_passengers,
            available_capacity=v.available_capacity,
            route=route_data
        ))
    
    return vehicles


@app.get("/requests", response_model=List[RideRequestResponse])
async def get_requests(status: Optional[str] = None):
    """Get all ride requests, optionally filtered by status."""
    if env is None:
        raise HTTPException(status_code=503, detail="Simulation not initialized")
    
    requests = []
    for r in env.requests.values():
        if status is None or r.status.value == status:
            requests.append(RideRequestResponse(
                id=r.id,
                pickup_lat=r.pickup_lat,
                pickup_lon=r.pickup_lon,
                dropoff_lat=r.dropoff_lat,
                dropoff_lon=r.dropoff_lon,
                passengers=r.passengers,
                status=r.status.value,
                wait_time=r.wait_time(env.current_time),
                assigned_vehicle=r.assigned_vehicle,
                estimated_pickup=r.pickup_time if r.pickup_time > 0 else None,
                estimated_dropoff=r.dropoff_time if r.dropoff_time > 0 else None
            ))
    
    return requests


@app.post("/request", response_model=RideRequestResponse)
async def create_request(request: RideRequestCreate):
    """Create a new ride request."""
    if env is None:
        raise HTTPException(status_code=503, detail="Simulation not initialized")
    
    # Create new request
    new_request = RideRequest(
        id=env.next_request_id,
        pickup_lat=request.pickup.lat,
        pickup_lon=request.pickup.lon,
        dropoff_lat=request.dropoff.lat,
        dropoff_lon=request.dropoff.lon,
        request_time=env.current_time,
        passengers=request.passengers
    )
    
    env.requests[new_request.id] = new_request
    env.next_request_id += 1
    
    # Broadcast to WebSocket clients
    await broadcast_update({
        "type": "new_request",
        "request_id": new_request.id
    })
    
    return RideRequestResponse(
        id=new_request.id,
        pickup_lat=new_request.pickup_lat,
        pickup_lon=new_request.pickup_lon,
        dropoff_lat=new_request.dropoff_lat,
        dropoff_lon=new_request.dropoff_lon,
        passengers=new_request.passengers,
        status=new_request.status.value,
        wait_time=0.0,
        assigned_vehicle=-1
    )


@app.post("/step", response_model=Dict[str, Any])
async def simulation_step(use_ai: bool = True):
    """Execute one simulation step."""
    if env is None or agent is None:
        raise HTTPException(status_code=503, detail="Simulation not initialized")
    
    state = env._get_state()
    
    if use_ai:
        action = agent.select_action(state, training=False)
    else:
        action = env.action_size - 1  # Wait action
    
    next_state, reward, done, info = env.step(action)
    
    # Decode action for response
    if action == env.action_size - 1:
        action_type = "wait"
        vehicle_id = None
        request_id = None
    else:
        action_type = "assign"
        vehicle_id, request_id = agent.decode_action(action)
    
    # Store experience for training
    agent.store_experience(state, action, reward, next_state, done)
    
    # Broadcast update
    await broadcast_update({
        "type": "step",
        "action": action,
        "reward": reward,
        "done": done,
        "info": info
    })
    
    return {
        "action": action,
        "action_type": action_type,
        "vehicle_id": vehicle_id,
        "request_id": request_id,
        "reward": reward,
        "done": done,
        "info": info
    }


@app.post("/ai/decide", response_model=AIDecision)
async def ai_decide():
    """Get AI agent's decision without executing it."""
    if env is None or agent is None:
        raise HTTPException(status_code=503, detail="Simulation not initialized")
    
    state = env._get_state()
    action = agent.select_action(state, training=False)
    
    # Decode action
    if action == env.action_size - 1:
        action_type = "wait"
        vehicle_id = None
        request_id = None
        reasoning = "No optimal assignment found, waiting for better opportunity"
    else:
        action_type = "assign"
        vehicle_id, request_id = agent.decode_action(action)
        
        pending = [r for r in env.requests.values() if r.status == RequestStatus.PENDING]
        if request_id < len(pending) and vehicle_id < len(env.vehicles):
            request = pending[request_id]
            vehicle = env.vehicles[vehicle_id]
            distance = haversine_distance(
                vehicle.lat, vehicle.lon,
                request.pickup_lat, request.pickup_lon
            )
            reasoning = f"Assigning request {request.id} to vehicle {vehicle_id} (distance: {distance:.1f} km)"
        else:
            reasoning = "Invalid assignment - will fallback to wait"
    
    return AIDecision(
        action=action,
        action_type=action_type,
        vehicle_id=vehicle_id,
        request_id=request_id,
        confidence=1.0 - agent.epsilon,
        reasoning=reasoning
    )


@app.post("/ai/train", response_model=Dict[str, Any])
async def train_agent(steps: int = 100):
    """Train the AI agent for specified number of steps."""
    if env is None or agent is None:
        raise HTTPException(status_code=503, detail="Simulation not initialized")
    
    losses = []
    rewards = []
    
    for _ in range(steps):
        state = env._get_state()
        action = agent.select_action(state, training=True)
        next_state, reward, done, info = env.step(action)
        
        agent.store_experience(state, action, reward, next_state, done)
        loss = agent.train_step()
        
        if loss is not None:
            losses.append(loss)
        rewards.append(reward)
        
        if done:
            env.reset()
    
    return {
        "steps_completed": steps,
        "avg_loss": sum(losses) / len(losses) if losses else 0,
        "avg_reward": sum(rewards) / len(rewards),
        "epsilon": agent.epsilon,
        "training_step": agent.training_step
    }


@app.get("/stats", response_model=SystemStats)
async def get_stats():
    """Get current system statistics."""
    if env is None:
        raise HTTPException(status_code=503, detail="Simulation not initialized")
    
    completed = len(env.completed_requests)
    cancelled = len(env.cancelled_requests)
    total = completed + cancelled
    
    avg_wait = (env.total_wait_time / completed) if completed > 0 else 0
    completion_rate = (completed / total * 100) if total > 0 else 100
    
    active_vehicles = sum(1 for v in env.vehicles if v.current_passengers > 0)
    
    return SystemStats(
        current_time=env.current_time,
        total_vehicles=len(env.vehicles),
        active_vehicles=active_vehicles,
        pending_requests=len([r for r in env.requests.values() 
                            if r.status == RequestStatus.PENDING]),
        completed_rides=completed,
        cancelled_rides=cancelled,
        avg_wait_time=avg_wait,
        total_distance_km=env.total_distance,
        completion_rate=completion_rate
    )


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for real-time updates."""
    await websocket.accept()
    connected_websockets.append(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            
    except WebSocketDisconnect:
        connected_websockets.remove(websocket)


async def broadcast_update(data: dict):
    """Broadcast update to all connected WebSocket clients."""
    for ws in connected_websockets:
        try:
            await ws.send_json(data)
        except:
            pass


# Run with: uvicorn backend.main:app --reload --port 8000
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
