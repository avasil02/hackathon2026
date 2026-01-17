# 🔌 API Integration Guide for LastMile.cy

## Current Status: What's Real vs Simulated

| Component | Status | Data Source |
|-----------|--------|-------------|
| Cyprus locations | ✅ Real | Hardcoded real lat/lng coordinates |
| Ride requests | 🎭 Simulated | Randomly generated for demo |
| Route optimization | ✅ Real algorithm | RL agent works, but on simulated requests |
| CO2 calculations | ✅ Real formula | Based on EU emission factors |
| GTFS-RT bus positions | 🎭 Simulated | Tries real API, falls back to fake |
| Bus schedules | ❌ Not integrated | Need to download GTFS files |

---

## Available Cyprus Data Sources

### 1. Cyprus National Access Point (GTFS-RT)
**URL:** https://www.traffic4cyprus.org.cy

**What it provides:**
- Real-time bus positions (lat/lng)
- Trip updates (delays)
- Service alerts

**How to access:**
```python
# Install protobuf parser
pip install gtfs-realtime-bindings

# Fetch real-time positions
import httpx
from google.transit import gtfs_realtime_pb2

response = httpx.get("https://traffic4cyprus.org.cy/gtfs-rt/vehiclepositions")
feed = gtfs_realtime_pb2.FeedMessage()
feed.ParseFromString(response.content)

for entity in feed.entity:
    if entity.HasField('vehicle'):
        v = entity.vehicle
        print(f"Bus {v.vehicle.id}: {v.position.latitude}, {v.position.longitude}")
```

⚠️ **Note:** You may need to register for API access. Check the website.

---

### 2. GTFS Static (Bus Schedules)
**Sources:**
- Cyprus Public Transport (Nicosia/Larnaca)
- EMEL (Limassol)
- OSYPA (Paphos)

**What it provides:**
- All bus stops with coordinates
- All routes
- Timetables
- Service calendars

**Files in a GTFS zip:**
```
stops.txt      → Bus stop locations
routes.txt     → Route definitions
stop_times.txt → Arrival/departure times
trips.txt      → Individual trips
calendar.txt   → Days of service
```

**How to use:**
```python
import csv

# Load all bus stops
with open('gtfs/stops.txt') as f:
    reader = csv.DictReader(f)
    for row in reader:
        print(f"{row['stop_name']}: {row['stop_lat']}, {row['stop_lon']}")
```

---

### 3. OpenRouteService (Route Optimization)
**URL:** https://openrouteservice.org
**Free tier:** 2000 requests/day

**What it provides:**
- Driving directions
- **Vehicle Routing Problem (VRP) solver** ← KEY for LastMile.cy!
- Isochrones (travel time areas)

**How to use for route optimization:**
```python
import httpx

API_KEY = "your_key_here"

# Define vehicles (our minibuses)
vehicles = [
    {"id": 1, "start": [33.3823, 35.1856], "capacity": [8]},  # Nicosia
    {"id": 2, "start": [33.0413, 34.6786], "capacity": [8]},  # Limassol
]

# Define jobs (pickup requests)
jobs = [
    {"id": 1, "location": [32.9000, 34.9833], "amount": [3]},  # 3 people to Kakopetria
    {"id": 2, "location": [32.8639, 34.8897], "amount": [2]},  # 2 people to Platres
]

response = httpx.post(
    "https://api.openrouteservice.org/optimization",
    json={"vehicles": vehicles, "jobs": jobs},
    headers={"Authorization": API_KEY}
)

result = response.json()
# Returns optimized routes for each vehicle!
```

---

### 4. OpenStreetMap (Road Network)
**Free and open!**

**What it provides:**
- Complete road network of Cyprus
- Points of interest
- Building footprints

**How to use:**
```python
# With OSMnx library
import osmnx as ox

# Download Cyprus road network
G = ox.graph_from_place("Cyprus", network_type="drive")

# Find shortest path
route = ox.shortest_path(G, origin_node, dest_node)
```

---

## How to Make LastMile.cy Use Real Data

### Step 1: Get API Access
```bash
# 1. Register at traffic4cyprus.org.cy
# 2. Get OpenRouteService API key (free)
# 3. Download GTFS static files from bus operators
```

### Step 2: Install Dependencies
```bash
pip install gtfs-realtime-bindings httpx osmnx
```

### Step 3: Modify the Code

Replace the simulated data in `rl_agent.py`:

```python
# BEFORE (simulated):
def generate_random_request():
    origin = random.choice(CITIES)
    destination = random.choice(VILLAGES)
    ...

# AFTER (real):
async def get_real_requests_from_app():
    # Requests come from mobile app users
    # Stored in database
    return await db.get_pending_requests()

async def get_real_bus_positions():
    # Fetch from GTFS-RT
    gtfs_client = CyprusGTFSClient()
    return await gtfs_client.get_vehicle_positions()
```

### Step 4: Integrate with Existing Buses

The smart approach: **Complement existing buses, don't replace them!**

```python
async def find_last_mile_gaps():
    # 1. Get existing bus routes from GTFS
    bus_routes = load_gtfs_routes()
    
    # 2. Find areas with poor coverage
    for village in TROODOS_VILLAGES:
        nearest_stop = find_nearest_bus_stop(village)
        if nearest_stop.distance_km > 5:
            # This village needs LastMile.cy service!
            yield village
```

---

## Architecture for Production

```
┌─────────────────────────────────────────────────────────────┐
│                     MOBILE APP                               │
│                  (React Native)                              │
└─────────────────────┬───────────────────────────────────────┘
                      │ User requests
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   FASTAPI BACKEND                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  /request   │  │  /optimize  │  │  /track     │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
└─────────┼────────────────┼────────────────┼─────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                   DATA LAYER                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  PostgreSQL │  │   Redis     │  │  TimescaleDB│         │
│  │  (requests) │  │  (cache)    │  │ (positions) │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                 EXTERNAL APIS                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ GTFS-RT     │  │ OpenRoute   │  │ OpenStreet  │         │
│  │ (Cyprus)    │  │ Service     │  │ Map         │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## For the Hackathon: What to Tell Judges

**"Our demo uses simulated requests, but the AI is real. Here's our integration plan:"**

1. ✅ GTFS-RT endpoint exists at traffic4cyprus.org.cy
2. ✅ We've written the integration code (show `gtfs_integration.py`)
3. ✅ OpenRouteService provides free VRP optimization
4. ✅ The RL agent is trained and working
5. 🔜 Next step: Register for API access and connect

**This is a valid hackathon approach** - you can't always get API access in 24 hours!

---

## Quick Test: Check if Cyprus GTFS-RT is Accessible

```bash
curl -I https://www.traffic4cyprus.org.cy/api/gtfs-rt/vehiclepositions
```

If you get `200 OK` → API is public!
If you get `401/403` → Need to register for access
