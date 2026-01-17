"""
LastMile.cy - FastAPI Backend
Cyprus Transport Hackathon 2026

API endpoints for:
- Ride requests
- Route optimization
- Real-time vehicle tracking
- GTFS-RT integration
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import asyncio
import httpx

# Import our RL agent
from rl_agent import LastMileAgent, RideRequest, Location

app = FastAPI(
    title="LastMile.cy API",
    description="AI-Powered Demand-Responsive Transit for Cyprus",
    version="1.0.0",
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the RL agent
agent = LastMileAgent(num_vehicles=5)

# GTFS-RT endpoints for Cyprus
GTFS_RT_ENDPOINT = "https://www.traffic4cyprus.org.cy"  # Cyprus National Access Point


# Pydantic models for API
class LocationModel(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    type: str
    region: Optional[str] = None

class RideRequestModel(BaseModel):
    origin: LocationModel
    destination: LocationModel
    passengers: int
    flexibility_minutes: Optional[int] = 15

class RideRequestResponse(BaseModel):
    request_id: str
    status: str
    estimated_pickup_time: int  # minutes
    estimated_arrival_time: int
    co2_savings_estimate: float
    matched_vehicle: Optional[str] = None

class RouteAssignmentModel(BaseModel):
    vehicle_id: str
    route: List[LocationModel]
    total_passengers: int
    total_distance_km: float
    estimated_time_minutes: float
    co2_saved_kg: float
    efficiency_score: float

class SystemStatsModel(BaseModel):
    total_vehicles: int
    active_routes: int
    pending_requests: int
    total_co2_saved_today: float
    average_wait_time_minutes: float


# In-memory request queue (would be Redis in production)
request_queue: List[RideRequest] = []
processed_assignments = []


@app.get("/")
async def root():
    """API root - health check and info"""
    return {
        "service": "LastMile.cy",
        "status": "operational",
        "version": "1.0.0",
        "hackathon": "Cyprus Transport Hackathon 2026",
    }


@app.get("/api/locations/cities", response_model=List[LocationModel])
async def get_cities():
    """Get all city pickup points"""
    return [
        LocationModel(
            id=loc.id,
            name=loc.name,
            lat=loc.lat,
            lng=loc.lng,
            type=loc.location_type,
            region=loc.region
        )
        for loc in agent.env.CITIES.values()
    ]


@app.get("/api/locations/destinations", response_model=List[LocationModel])
async def get_destinations():
    """Get all available destinations (villages, beaches, archaeological sites)"""
    all_dests = {**agent.env.VILLAGES, **agent.env.BEACHES, **agent.env.ARCHAEOLOGICAL}
    return [
        LocationModel(
            id=loc.id,
            name=loc.name,
            lat=loc.lat,
            lng=loc.lng,
            type=loc.location_type,
            region=loc.region
        )
        for loc in all_dests.values()
    ]


@app.post("/api/rides/request", response_model=RideRequestResponse)
async def request_ride(request: RideRequestModel, background_tasks: BackgroundTasks):
    """
    Submit a new ride request.
    The RL agent will cluster this with other requests and optimize routing.
    """
    # Convert to internal format
    origin = Location(
        request.origin.id,
        request.origin.name,
        request.origin.lat,
        request.origin.lng,
        request.origin.type,
        request.origin.region
    )
    destination = Location(
        request.destination.id,
        request.destination.name,
        request.destination.lat,
        request.destination.lng,
        request.destination.type,
        request.destination.region
    )
    
    ride_request = RideRequest(
        id=f"REQ-{datetime.now().strftime('%H%M%S')}-{len(request_queue):04d}",
        origin=origin,
        destination=destination,
        passengers=request.passengers,
        timestamp=datetime.now().timestamp(),
        flexibility_minutes=request.flexibility_minutes,
    )
    
    # Add to queue
    request_queue.append(ride_request)
    
    # Calculate estimated distance for CO2 estimate
    distance = agent.env.haversine_distance(origin, destination)
    co2_estimate = distance * agent.env.CAR_CO2_PER_KM * 0.7  # Assume 30% savings
    
    # Trigger optimization in background if we have enough requests
    if len(request_queue) >= 3:
        background_tasks.add_task(run_optimization)
    
    return RideRequestResponse(
        request_id=ride_request.id,
        status="pending",
        estimated_pickup_time=10 + len(request_queue) * 2,  # Simple estimate
        estimated_arrival_time=int(distance / 40 * 60 + 15),  # 40 km/h + buffer
        co2_savings_estimate=co2_estimate,
        matched_vehicle=None,
    )


async def run_optimization():
    """Background task to run route optimization"""
    global request_queue, processed_assignments
    
    if len(request_queue) < 3:
        return
    
    # Process current queue
    requests_to_process = request_queue.copy()
    request_queue = []
    
    # Run RL optimization
    assignments = agent.process_requests(requests_to_process)
    processed_assignments = assignments
    
    # Reset vehicles for next batch (in production, this would be more sophisticated)
    for v in agent.env.vehicles:
        v.route = []
        v.current_passengers = 0


@app.get("/api/routes/active", response_model=List[RouteAssignmentModel])
async def get_active_routes():
    """Get all currently active/optimized routes"""
    return [
        RouteAssignmentModel(
            vehicle_id=a.vehicle_id,
            route=[
                LocationModel(
                    id=loc.id,
                    name=loc.name,
                    lat=loc.lat,
                    lng=loc.lng,
                    type=loc.location_type,
                    region=loc.region
                ) for loc in a.route
            ],
            total_passengers=sum(r.passengers for r in a.requests),
            total_distance_km=a.total_distance_km,
            estimated_time_minutes=a.estimated_time_minutes,
            co2_saved_kg=a.co2_saved_kg,
            efficiency_score=a.efficiency_score,
        )
        for a in processed_assignments
    ]


@app.get("/api/stats", response_model=SystemStatsModel)
async def get_system_stats():
    """Get overall system statistics"""
    stats = agent.get_stats()
    return SystemStatsModel(
        total_vehicles=stats['total_vehicles'],
        active_routes=len(processed_assignments),
        pending_requests=len(request_queue),
        total_co2_saved_today=sum(a.co2_saved_kg for a in processed_assignments),
        average_wait_time_minutes=12.5,  # Would be calculated from actual data
    )


@app.post("/api/optimize")
async def trigger_optimization():
    """Manually trigger route optimization"""
    if len(request_queue) < 2:
        raise HTTPException(
            status_code=400,
            detail="Not enough requests to optimize (minimum 2)"
        )
    
    await run_optimization()
    
    return {
        "status": "optimization_complete",
        "routes_created": len(processed_assignments),
        "total_co2_saved": sum(a.co2_saved_kg for a in processed_assignments),
    }


# GTFS-RT Integration
@app.get("/api/gtfs/vehicle-positions")
async def get_gtfs_vehicle_positions():
    """
    Fetch real-time bus positions from Cyprus GTFS-RT feed.
    This integrates with the actual Cyprus public transport data!
    """
    # Note: In production, you'd use the actual GTFS-RT endpoint
    # For the hackathon demo, we'll simulate if the endpoint is unavailable
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Try to fetch real GTFS-RT data
            response = await client.get(
                f"{GTFS_RT_ENDPOINT}/api/gtfs-rt/vehicle-positions",
                headers={"Accept": "application/json"}
            )
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        print(f"GTFS-RT fetch error: {e}")
    
    # Return simulated data for demo
    return {
        "header": {
            "gtfs_realtime_version": "2.0",
            "timestamp": datetime.now().timestamp(),
        },
        "entity": [
            {
                "id": f"vehicle_{i}",
                "vehicle": {
                    "trip": {"route_id": f"route_{i % 5}"},
                    "position": {
                        "latitude": 34.7 + (i * 0.1),
                        "longitude": 33.0 + (i * 0.15),
                    },
                    "timestamp": datetime.now().timestamp(),
                }
            }
            for i in range(10)
        ],
        "note": "Simulated data for hackathon demo",
    }


@app.get("/api/gtfs/service-alerts")
async def get_gtfs_service_alerts():
    """Fetch service alerts from GTFS-RT"""
    return {
        "alerts": [
            {
                "id": "alert_1",
                "header_text": "Mountain routes may have delays due to weather",
                "description": "Troodos area services affected",
                "affected_routes": ["kakopetria", "platres", "pedoulas"],
            }
        ],
        "timestamp": datetime.now().isoformat(),
    }


# Simulation endpoints for demo
@app.post("/api/demo/generate-requests")
async def generate_demo_requests(count: int = 10):
    """Generate random requests for demonstration"""
    for _ in range(count):
        req = agent.env.generate_random_request()
        request_queue.append(req)
    
    return {
        "generated": count,
        "total_pending": len(request_queue),
    }


@app.post("/api/demo/reset")
async def reset_demo():
    """Reset the demo state"""
    global request_queue, processed_assignments
    request_queue = []
    processed_assignments = []
    
    for v in agent.env.vehicles:
        v.route = []
        v.current_passengers = 0
    
    return {"status": "reset_complete"}


if __name__ == "__main__":
    import uvicorn
    print("Starting LastMile.cy API server...")
    print("Docs available at: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
