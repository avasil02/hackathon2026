"""
LastMile.cy - Real GTFS-RT Integration for Cyprus
Cyprus Transport Hackathon 2026

This module connects to REAL Cyprus transport data sources:
1. Cyprus National Access Point (traffic4cyprus.org.cy) - GTFS-RT feeds
2. Cyprus By Bus (cyprusbybus.com) - Schedule data
3. OpenStreetMap - Road network for routing

IMPORTANT: You need to check the actual API endpoints and authentication
requirements at https://www.traffic4cyprus.org.cy/
"""

import asyncio
import httpx
from dataclasses import dataclass
from typing import List, Dict, Optional
from datetime import datetime
import struct

# Try to import protobuf for GTFS-RT parsing
try:
    from google.transit import gtfs_realtime_pb2
    HAS_PROTOBUF = True
except ImportError:
    HAS_PROTOBUF = False
    print("Warning: gtfs-realtime-bindings not installed. Run: pip install gtfs-realtime-bindings")


@dataclass
class VehiclePosition:
    """Real-time position of a bus"""
    vehicle_id: str
    route_id: str
    latitude: float
    longitude: float
    speed: Optional[float]
    timestamp: datetime
    occupancy_status: Optional[str] = None


@dataclass 
class TripUpdate:
    """Real-time arrival/departure updates"""
    trip_id: str
    route_id: str
    stop_id: str
    arrival_delay: int  # seconds
    departure_delay: int


class CyprusGTFSClient:
    """
    Client for fetching real Cyprus public transport data.
    
    Data sources:
    - GTFS-RT: https://www.traffic4cyprus.org.cy/dataset/publictransportrealtime_gtfs_rt
    - GTFS Static: Schedule data from bus operators
    """
    
    # Cyprus National Access Point - GTFS-RT endpoint
    # NOTE: You may need to register for API access!
    GTFS_RT_BASE = "https://www.traffic4cyprus.org.cy"
    
    # Alternative: Direct from bus operators (check their websites)
    # Nicosia/Larnaca: Cyprus Public Transport (CPT)
    # Limassol: EMEL
    # Paphos: OSYPA
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self._cache = {}
        self._cache_time = None
        
    async def close(self):
        await self.client.aclose()
    
    async def get_vehicle_positions(self) -> List[VehiclePosition]:
        """
        Fetch real-time bus positions from GTFS-RT feed.
        
        Returns list of VehiclePosition objects with current bus locations.
        """
        if not HAS_PROTOBUF:
            print("Protobuf not available, returning empty list")
            return []
        
        try:
            # The actual endpoint URL - you need to verify this!
            # Check https://www.traffic4cyprus.org.cy for the real URL
            url = f"{self.GTFS_RT_BASE}/gtfs-rt/vehiclepositions"
            
            response = await self.client.get(
                url,
                headers={
                    "Accept": "application/x-protobuf",
                    # Add API key if required:
                    # "Authorization": "Bearer YOUR_API_KEY"
                }
            )
            
            if response.status_code != 200:
                print(f"GTFS-RT request failed: {response.status_code}")
                return []
            
            # Parse protobuf response
            feed = gtfs_realtime_pb2.FeedMessage()
            feed.ParseFromString(response.content)
            
            positions = []
            for entity in feed.entity:
                if entity.HasField('vehicle'):
                    v = entity.vehicle
                    positions.append(VehiclePosition(
                        vehicle_id=v.vehicle.id,
                        route_id=v.trip.route_id if v.HasField('trip') else 'unknown',
                        latitude=v.position.latitude,
                        longitude=v.position.longitude,
                        speed=v.position.speed if v.position.HasField('speed') else None,
                        timestamp=datetime.fromtimestamp(v.timestamp),
                        occupancy_status=self._parse_occupancy(v.occupancy_status) if v.HasField('occupancy_status') else None
                    ))
            
            print(f"Fetched {len(positions)} real vehicle positions")
            return positions
            
        except Exception as e:
            print(f"Error fetching GTFS-RT: {e}")
            return []
    
    async def get_trip_updates(self) -> List[TripUpdate]:
        """
        Fetch real-time trip updates (delays, cancellations).
        """
        if not HAS_PROTOBUF:
            return []
            
        try:
            url = f"{self.GTFS_RT_BASE}/gtfs-rt/tripupdates"
            
            response = await self.client.get(
                url,
                headers={"Accept": "application/x-protobuf"}
            )
            
            if response.status_code != 200:
                return []
            
            feed = gtfs_realtime_pb2.FeedMessage()
            feed.ParseFromString(response.content)
            
            updates = []
            for entity in feed.entity:
                if entity.HasField('trip_update'):
                    tu = entity.trip_update
                    for stu in tu.stop_time_update:
                        updates.append(TripUpdate(
                            trip_id=tu.trip.trip_id,
                            route_id=tu.trip.route_id,
                            stop_id=stu.stop_id,
                            arrival_delay=stu.arrival.delay if stu.HasField('arrival') else 0,
                            departure_delay=stu.departure.delay if stu.HasField('departure') else 0,
                        ))
            
            return updates
            
        except Exception as e:
            print(f"Error fetching trip updates: {e}")
            return []
    
    async def get_service_alerts(self) -> List[Dict]:
        """
        Fetch service alerts (disruptions, changes).
        """
        if not HAS_PROTOBUF:
            return []
            
        try:
            url = f"{self.GTFS_RT_BASE}/gtfs-rt/alerts"
            
            response = await self.client.get(
                url,
                headers={"Accept": "application/x-protobuf"}
            )
            
            if response.status_code != 200:
                return []
            
            feed = gtfs_realtime_pb2.FeedMessage()
            feed.ParseFromString(response.content)
            
            alerts = []
            for entity in feed.entity:
                if entity.HasField('alert'):
                    a = entity.alert
                    alerts.append({
                        'id': entity.id,
                        'header': a.header_text.translation[0].text if a.header_text.translation else '',
                        'description': a.description_text.translation[0].text if a.description_text.translation else '',
                        'cause': str(a.cause),
                        'effect': str(a.effect),
                    })
            
            return alerts
            
        except Exception as e:
            print(f"Error fetching alerts: {e}")
            return []
    
    def _parse_occupancy(self, status) -> str:
        """Convert GTFS-RT occupancy enum to string"""
        mapping = {
            0: 'EMPTY',
            1: 'MANY_SEATS_AVAILABLE', 
            2: 'FEW_SEATS_AVAILABLE',
            3: 'STANDING_ROOM_ONLY',
            4: 'CRUSHED_STANDING_ROOM_ONLY',
            5: 'FULL',
            6: 'NOT_ACCEPTING_PASSENGERS',
        }
        return mapping.get(status, 'UNKNOWN')


class CyprusBusScheduleClient:
    """
    Client for fetching static schedule data from Cyprus bus operators.
    
    GTFS Static files contain:
    - routes.txt: All bus routes
    - stops.txt: All bus stops with coordinates
    - stop_times.txt: Arrival/departure times
    - trips.txt: Individual trips
    - calendar.txt: Service days
    """
    
    # You can download GTFS Static files from:
    # - Cyprus Public Transport
    # - EMEL Limassol
    # - Check traffic4cyprus.org.cy for links
    
    GTFS_STATIC_URLS = {
        'nicosia': 'https://example.com/cpt_gtfs.zip',  # Replace with real URL
        'limassol': 'https://example.com/emel_gtfs.zip',
        'paphos': 'https://example.com/osypa_gtfs.zip',
    }
    
    def __init__(self, gtfs_path: str = None):
        """
        Initialize with path to extracted GTFS folder.
        
        Args:
            gtfs_path: Path to folder containing GTFS .txt files
        """
        self.gtfs_path = gtfs_path
        self.stops = {}
        self.routes = {}
        
    def load_stops(self) -> Dict[str, Dict]:
        """Load stops.txt - all bus stops with coordinates"""
        import csv
        
        if not self.gtfs_path:
            return {}
            
        stops = {}
        try:
            with open(f"{self.gtfs_path}/stops.txt", 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    stops[row['stop_id']] = {
                        'name': row['stop_name'],
                        'lat': float(row['stop_lat']),
                        'lng': float(row['stop_lon']),
                    }
        except FileNotFoundError:
            print("stops.txt not found")
        
        self.stops = stops
        return stops
    
    def load_routes(self) -> Dict[str, Dict]:
        """Load routes.txt - all bus routes"""
        import csv
        
        if not self.gtfs_path:
            return {}
            
        routes = {}
        try:
            with open(f"{self.gtfs_path}/routes.txt", 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    routes[row['route_id']] = {
                        'short_name': row.get('route_short_name', ''),
                        'long_name': row.get('route_long_name', ''),
                        'type': row.get('route_type', '3'),  # 3 = bus
                    }
        except FileNotFoundError:
            print("routes.txt not found")
        
        self.routes = routes
        return routes
    
    def find_nearest_stops(self, lat: float, lng: float, limit: int = 5) -> List[Dict]:
        """Find nearest bus stops to a given location"""
        import math
        
        if not self.stops:
            self.load_stops()
        
        def haversine(lat1, lon1, lat2, lon2):
            R = 6371  # Earth's radius in km
            dlat = math.radians(lat2 - lat1)
            dlon = math.radians(lon2 - lon1)
            a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
            return 2 * R * math.asin(math.sqrt(a))
        
        stops_with_distance = []
        for stop_id, stop in self.stops.items():
            dist = haversine(lat, lng, stop['lat'], stop['lng'])
            stops_with_distance.append({
                'stop_id': stop_id,
                'name': stop['name'],
                'lat': stop['lat'],
                'lng': stop['lng'],
                'distance_km': round(dist, 2)
            })
        
        stops_with_distance.sort(key=lambda x: x['distance_km'])
        return stops_with_distance[:limit]


class OpenRouteServiceClient:
    """
    Client for route optimization using OpenRouteService API.
    
    Free tier: 2000 requests/day
    Sign up at: https://openrouteservice.org/
    """
    
    BASE_URL = "https://api.openrouteservice.org"
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def get_route(self, 
                       coordinates: List[List[float]],
                       profile: str = 'driving-car') -> Dict:
        """
        Get optimized route between multiple points.
        
        Args:
            coordinates: List of [lng, lat] pairs
            profile: 'driving-car', 'cycling-regular', etc.
        
        Returns:
            Route with distance, duration, geometry
        """
        try:
            response = await self.client.post(
                f"{self.BASE_URL}/v2/directions/{profile}",
                json={"coordinates": coordinates},
                headers={
                    "Authorization": self.api_key,
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"ORS error: {response.status_code}")
                return {}
                
        except Exception as e:
            print(f"Route request failed: {e}")
            return {}
    
    async def optimize_route(self,
                            vehicles: List[Dict],
                            jobs: List[Dict]) -> Dict:
        """
        Solve vehicle routing problem (VRP).
        
        This is the key API for LastMile.cy - it optimizes
        which vehicle serves which requests in what order.
        
        Args:
            vehicles: List of vehicle definitions with start locations
            jobs: List of pickup/delivery jobs
            
        Returns:
            Optimized routes for each vehicle
        """
        try:
            response = await self.client.post(
                f"{self.BASE_URL}/optimization",
                json={
                    "vehicles": vehicles,
                    "jobs": jobs,
                },
                headers={
                    "Authorization": self.api_key,
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Optimization error: {response.status_code}")
                return {}
                
        except Exception as e:
            print(f"Optimization request failed: {e}")
            return {}
    
    async def close(self):
        await self.client.aclose()


# =============================================================================
# INTEGRATION EXAMPLE
# =============================================================================

async def demo_real_integration():
    """
    Demo showing how to integrate real APIs with LastMile.cy
    """
    print("=" * 60)
    print("LastMile.cy - Real API Integration Demo")
    print("=" * 60)
    
    # 1. Fetch real-time bus positions from Cyprus
    print("\n1. Fetching real-time bus positions...")
    gtfs_client = CyprusGTFSClient()
    
    positions = await gtfs_client.get_vehicle_positions()
    if positions:
        print(f"   Found {len(positions)} buses!")
        for pos in positions[:3]:
            print(f"   - Bus {pos.vehicle_id} on route {pos.route_id}")
            print(f"     Location: {pos.latitude}, {pos.longitude}")
    else:
        print("   No real data available (API may require authentication)")
        print("   Using simulated data for demo...")
    
    # 2. Load static schedule data
    print("\n2. Loading bus stop data...")
    # In production, download and extract GTFS files first
    schedule_client = CyprusBusScheduleClient(gtfs_path=None)
    
    # 3. Find nearest stops to a location (e.g., user's pickup point)
    print("\n3. Finding nearest bus stops to Nicosia center...")
    # Nicosia coordinates
    nicosia_lat, nicosia_lng = 35.1856, 33.3823
    
    # This would work if we had GTFS data loaded:
    # nearest = schedule_client.find_nearest_stops(nicosia_lat, nicosia_lng)
    # for stop in nearest:
    #     print(f"   - {stop['name']} ({stop['distance_km']}km away)")
    
    # 4. Optimize routes using OpenRouteService
    print("\n4. Route optimization with OpenRouteService...")
    print("   (Requires API key from https://openrouteservice.org)")
    
    # Example of how to use it:
    # ors_client = OpenRouteServiceClient(api_key="YOUR_API_KEY")
    # 
    # vehicles = [
    #     {"id": 1, "start": [33.3823, 35.1856], "capacity": [8]},  # Nicosia
    #     {"id": 2, "start": [33.0413, 34.6786], "capacity": [8]},  # Limassol
    # ]
    # 
    # jobs = [
    #     {"id": 1, "location": [32.9000, 34.9833], "amount": [3]},  # Kakopetria
    #     {"id": 2, "location": [32.8639, 34.8897], "amount": [2]},  # Platres
    # ]
    # 
    # result = await ors_client.optimize_route(vehicles, jobs)
    
    await gtfs_client.close()
    
    print("\n" + "=" * 60)
    print("To use real data:")
    print("1. Register at traffic4cyprus.org.cy for GTFS-RT access")
    print("2. Download GTFS static files from bus operators")
    print("3. Get OpenRouteService API key (free tier available)")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(demo_real_integration())
