"""
LastMile.cy - Cyprus Transit Simulation Environment
====================================================
This module simulates the demand-responsive transit system in Cyprus,
including realistic geographic locations, demand patterns, and road networks.

Key Features:
- Realistic Cyprus locations (Troodos villages, tourist spots, rural areas)
- Time-based demand patterns (peak hours, seasonal tourism)
- Integration with OpenStreetMap road network
- Gym-compatible interface for RL training
"""

import numpy as np
from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Optional
from enum import Enum
import math
import random
from datetime import datetime, timedelta
import json


# Cyprus geographic bounds
CYPRUS_BOUNDS = {
    "min_lat": 34.55,
    "max_lat": 35.70,
    "min_lon": 32.25,
    "max_lon": 34.60
}

# Key locations in Cyprus (lat, lon, name, type)
CYPRUS_LOCATIONS = {
    # Troodos Mountain Villages
    "platres": (34.8894, 32.8636, "Platres", "village"),
    "kakopetria": (34.9833, 32.9000, "Kakopetria", "village"),
    "pedoulas": (34.9667, 32.8333, "Pedoulas", "village"),
    "prodromos": (34.9500, 32.8333, "Prodromos", "village"),
    "agros": (34.9167, 33.0167, "Agros", "village"),
    "galata": (34.9833, 32.9000, "Galata", "village"),
    "olympus": (34.9417, 32.8667, "Mount Olympus", "landmark"),
    
    # Coastal Tourist Areas
    "ayia_napa": (34.9833, 34.0000, "Ayia Napa", "tourist"),
    "protaras": (35.0167, 34.0500, "Protaras", "tourist"),
    "coral_bay": (34.8500, 32.3667, "Coral Bay", "tourist"),
    "fig_tree_bay": (35.0139, 34.0556, "Fig Tree Bay", "beach"),
    "nissi_beach": (34.9917, 33.9750, "Nissi Beach", "beach"),
    
    # Archaeological Sites
    "kourion": (34.6667, 32.8833, "Kourion", "archaeological"),
    "paphos_mosaics": (34.7583, 32.4083, "Paphos Mosaics", "archaeological"),
    "tombs_of_kings": (34.7750, 32.4000, "Tombs of Kings", "archaeological"),
    "choirokoitia": (34.7972, 33.3417, "Choirokoitia", "archaeological"),
    
    # Major Cities (connection points)
    "nicosia": (35.1856, 33.3823, "Nicosia", "city"),
    "limassol": (34.6841, 33.0379, "Limassol", "city"),
    "larnaca": (34.9229, 33.6232, "Larnaca", "city"),
    "paphos": (34.7754, 32.4245, "Paphos", "city"),
    
    # Rural Villages
    "lefkara": (34.8667, 33.3000, "Lefkara", "village"),
    "omodos": (34.8500, 32.8000, "Omodos", "village"),
    "lofou": (34.8333, 32.8167, "Lofou", "village"),
    "fikardou": (34.9667, 33.1333, "Fikardou", "village"),
}


class RequestStatus(Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    PICKED_UP = "picked_up"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


@dataclass
class RideRequest:
    """A passenger ride request."""
    id: int
    pickup_lat: float
    pickup_lon: float
    dropoff_lat: float
    dropoff_lon: float
    request_time: float  # Simulation time in minutes
    passengers: int = 1
    status: RequestStatus = RequestStatus.PENDING
    assigned_vehicle: int = -1
    pickup_time: float = -1
    dropoff_time: float = -1
    
    def wait_time(self, current_time: float) -> float:
        """Calculate current wait time in minutes."""
        if self.status == RequestStatus.PENDING:
            return current_time - self.request_time
        elif self.pickup_time > 0:
            return self.pickup_time - self.request_time
        return 0
    
    def to_vector(self, current_time: float) -> np.ndarray:
        """Convert to feature vector for RL state."""
        return np.array([
            self.pickup_lat,
            self.pickup_lon,
            self.dropoff_lat,
            self.dropoff_lon,
            self.wait_time(current_time) / 60.0  # Normalize to hours
        ])


@dataclass
class Vehicle:
    """A microtransit vehicle."""
    id: int
    lat: float
    lon: float
    capacity: int = 8
    current_passengers: int = 0
    route: List[Tuple[float, float, int, str]] = field(default_factory=list)  # (lat, lon, request_id, action)
    speed_kmh: float = 40.0  # Average speed in km/h
    
    @property
    def available_capacity(self) -> int:
        return self.capacity - self.current_passengers
    
    def to_vector(self) -> np.ndarray:
        """Convert to feature vector for RL state."""
        return np.array([
            self.lat,
            self.lon,
            self.current_passengers / self.capacity,
            self.available_capacity / self.capacity
        ])


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points in kilometers.
    """
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_lat / 2) ** 2 + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def estimate_travel_time(lat1: float, lon1: float, lat2: float, lon2: float, 
                         speed_kmh: float = 40.0) -> float:
    """
    Estimate travel time in minutes between two points.
    Accounts for road winding factor (1.3x for mountain roads).
    """
    distance = haversine_distance(lat1, lon1, lat2, lon2)
    
    # Mountain road factor - more winding in Troodos region
    troodos_center = (34.95, 32.85)
    avg_lat = (lat1 + lat2) / 2
    avg_lon = (lon1 + lon2) / 2
    dist_to_troodos = haversine_distance(avg_lat, avg_lon, *troodos_center)
    
    winding_factor = 1.3 if dist_to_troodos < 30 else 1.1
    
    actual_distance = distance * winding_factor
    travel_time_hours = actual_distance / speed_kmh
    
    return travel_time_hours * 60  # Convert to minutes


class CyprusTransitEnv:
    """
    Gym-compatible simulation environment for Cyprus demand-responsive transit.
    
    State Space:
    - Vehicle states (position, capacity, passengers)
    - Pending request states (pickup/dropoff locations, wait times)
    - Time features (hour of day, day of week, season)
    
    Action Space:
    - Assign request to vehicle
    - Wait (do nothing)
    
    Reward Structure:
    - Negative reward for passenger wait time
    - Negative reward for vehicle travel distance
    - Positive reward for completed rides
    - Penalty for cancelled rides (excessive wait)
    """
    
    def __init__(
        self,
        num_vehicles: int = 3,
        max_requests: int = 10,
        vehicle_capacity: int = 8,
        max_wait_time: float = 30.0,  # Max wait before cancellation (minutes)
        simulation_hours: float = 8.0,  # Episode length
        demand_rate: float = 2.0,  # Avg requests per hour
        seed: int = None
    ):
        self.num_vehicles = num_vehicles
        self.max_requests = max_requests
        self.vehicle_capacity = vehicle_capacity
        self.max_wait_time = max_wait_time
        self.simulation_hours = simulation_hours
        self.demand_rate = demand_rate
        
        if seed is not None:
            np.random.seed(seed)
            random.seed(seed)
        
        # State dimensions
        self.vehicle_state_size = 4  # lat, lon, passengers, capacity
        self.request_state_size = 5  # pickup_lat, pickup_lon, dropoff_lat, dropoff_lon, wait_time
        self.time_state_size = 4  # hour_sin, hour_cos, day_of_week, season
        
        self.state_size = (
            num_vehicles * self.vehicle_state_size + 
            max_requests * self.request_state_size +
            self.time_state_size
        )
        
        # Action: assign any request to any vehicle, or wait
        self.action_size = num_vehicles * max_requests + 1
        
        self.reset()
        
    def reset(self) -> np.ndarray:
        """Reset the environment for a new episode."""
        # Initialize vehicles at strategic depot locations
        depot_locations = [
            CYPRUS_LOCATIONS["platres"][:2],  # Troodos hub
            CYPRUS_LOCATIONS["limassol"][:2],  # City connection
            CYPRUS_LOCATIONS["ayia_napa"][:2],  # Tourist area
        ]
        
        self.vehicles = []
        for i in range(self.num_vehicles):
            depot = depot_locations[i % len(depot_locations)]
            self.vehicles.append(Vehicle(
                id=i,
                lat=depot[0] + np.random.uniform(-0.01, 0.01),
                lon=depot[1] + np.random.uniform(-0.01, 0.01),
                capacity=self.vehicle_capacity
            ))
        
        self.requests: Dict[int, RideRequest] = {}
        self.completed_requests: List[RideRequest] = []
        self.cancelled_requests: List[RideRequest] = []
        
        self.current_time = 0.0  # Minutes from start
        self.next_request_id = 0
        self.episode_start_hour = np.random.randint(6, 18)  # Start between 6am-6pm
        
        # Schedule first request
        self._schedule_next_request()
        
        # Stats
        self.total_wait_time = 0.0
        self.total_distance = 0.0
        self.episode_reward = 0.0
        
        return self._get_state()
    
    def _get_current_hour(self) -> float:
        """Get current simulation hour (0-24)."""
        return (self.episode_start_hour + self.current_time / 60) % 24
    
    def _get_demand_multiplier(self) -> float:
        """Get demand multiplier based on time of day and season."""
        hour = self._get_current_hour()
        
        # Peak hours: morning (8-10), lunch (12-14), evening (17-20)
        if 8 <= hour < 10 or 12 <= hour < 14:
            time_mult = 1.5
        elif 17 <= hour < 20:
            time_mult = 2.0
        elif 6 <= hour < 8 or 20 <= hour < 22:
            time_mult = 1.0
        else:
            time_mult = 0.5
            
        # Summer season (June-Aug) has higher tourist demand
        # For simulation, randomly assign season
        season_mult = 1.5 if random.random() < 0.4 else 1.0
        
        return time_mult * season_mult
    
    def _generate_request(self) -> RideRequest:
        """Generate a realistic ride request based on Cyprus locations."""
        locations = list(CYPRUS_LOCATIONS.keys())
        
        # Weight certain location types higher
        weights = []
        for loc in locations:
            loc_type = CYPRUS_LOCATIONS[loc][3]
            if loc_type == "tourist":
                weights.append(3.0)
            elif loc_type == "beach":
                weights.append(2.5)
            elif loc_type == "village":
                weights.append(2.0)
            elif loc_type == "archaeological":
                weights.append(1.5)
            else:
                weights.append(1.0)
        
        weights = np.array(weights) / sum(weights)
        
        # Select pickup and dropoff (different locations)
        pickup_loc = np.random.choice(locations, p=weights)
        dropoff_loc = np.random.choice([l for l in locations if l != pickup_loc])
        
        pickup = CYPRUS_LOCATIONS[pickup_loc]
        dropoff = CYPRUS_LOCATIONS[dropoff_loc]
        
        # Add some randomness around the exact location
        request = RideRequest(
            id=self.next_request_id,
            pickup_lat=pickup[0] + np.random.uniform(-0.005, 0.005),
            pickup_lon=pickup[1] + np.random.uniform(-0.005, 0.005),
            dropoff_lat=dropoff[0] + np.random.uniform(-0.005, 0.005),
            dropoff_lon=dropoff[1] + np.random.uniform(-0.005, 0.005),
            request_time=self.current_time,
            passengers=np.random.choice([1, 2, 3, 4], p=[0.5, 0.3, 0.15, 0.05])
        )
        
        self.next_request_id += 1
        return request
    
    def _schedule_next_request(self):
        """Schedule the next request arrival time."""
        demand_mult = self._get_demand_multiplier()
        avg_interval = 60 / (self.demand_rate * demand_mult)  # Minutes between requests
        self.next_request_time = self.current_time + np.random.exponential(avg_interval)
    
    def _get_state(self) -> np.ndarray:
        """Construct the state vector."""
        state = []
        
        # Vehicle states
        for v in self.vehicles:
            state.extend(v.to_vector())
        
        # Request states (pad if fewer than max_requests)
        pending_requests = [r for r in self.requests.values() 
                          if r.status == RequestStatus.PENDING]
        
        for i in range(self.max_requests):
            if i < len(pending_requests):
                state.extend(pending_requests[i].to_vector(self.current_time))
            else:
                state.extend([0.0] * self.request_state_size)
        
        # Time features
        hour = self._get_current_hour()
        state.extend([
            np.sin(2 * np.pi * hour / 24),  # Hour (cyclical)
            np.cos(2 * np.pi * hour / 24),
            (self.current_time / 60) / self.simulation_hours,  # Episode progress
            self._get_demand_multiplier() / 2.0  # Normalized demand
        ])
        
        return np.array(state, dtype=np.float32)
    
    def step(self, action: int) -> Tuple[np.ndarray, float, bool, Dict]:
        """
        Execute one step in the environment.
        
        Args:
            action: Action index (vehicle_id * max_requests + request_id, or wait)
            
        Returns:
            state, reward, done, info
        """
        reward = 0.0
        info = {"events": []}
        
        # Decode action
        if action == self.action_size - 1:
            # Wait action - advance time
            time_step = 1.0  # 1 minute
        else:
            vehicle_id = action // self.max_requests
            request_idx = action % self.max_requests
            
            pending_requests = [r for r in self.requests.values() 
                              if r.status == RequestStatus.PENDING]
            
            if request_idx < len(pending_requests) and vehicle_id < len(self.vehicles):
                request = pending_requests[request_idx]
                vehicle = self.vehicles[vehicle_id]
                
                # Check if vehicle has capacity
                if vehicle.available_capacity >= request.passengers:
                    # Assign request
                    request.status = RequestStatus.ASSIGNED
                    request.assigned_vehicle = vehicle_id
                    
                    # Calculate pickup time
                    travel_time = estimate_travel_time(
                        vehicle.lat, vehicle.lon,
                        request.pickup_lat, request.pickup_lon,
                        vehicle.speed_kmh
                    )
                    
                    request.pickup_time = self.current_time + travel_time
                    
                    # Update vehicle position (simplified - move towards pickup)
                    vehicle.lat = request.pickup_lat
                    vehicle.lon = request.pickup_lon
                    vehicle.current_passengers += request.passengers
                    
                    # Add to route
                    vehicle.route.append((
                        request.pickup_lat, request.pickup_lon,
                        request.id, "pickup"
                    ))
                    vehicle.route.append((
                        request.dropoff_lat, request.dropoff_lon,
                        request.id, "dropoff"
                    ))
                    
                    # Reward for assignment (small positive)
                    reward += 1.0
                    
                    # Penalty for wait time so far
                    wait_time = request.wait_time(self.current_time)
                    reward -= wait_time / 10.0
                    self.total_wait_time += wait_time
                    
                    # Track distance
                    pickup_dist = haversine_distance(
                        vehicle.lat, vehicle.lon,
                        request.pickup_lat, request.pickup_lon
                    )
                    self.total_distance += pickup_dist
                    reward -= pickup_dist / 20.0  # Small penalty for distance
                    
                    info["events"].append(f"Request {request.id} assigned to Vehicle {vehicle_id}")
                    
                    time_step = travel_time
                else:
                    # Invalid action - vehicle at capacity
                    reward -= 0.5
                    time_step = 0.5
            else:
                # Invalid action
                reward -= 0.5
                time_step = 0.5
        
        # Advance simulation time
        self.current_time += time_step
        
        # Generate new requests
        while self.current_time >= self.next_request_time:
            if len([r for r in self.requests.values() 
                   if r.status == RequestStatus.PENDING]) < self.max_requests:
                new_request = self._generate_request()
                self.requests[new_request.id] = new_request
                info["events"].append(f"New request {new_request.id} arrived")
            self._schedule_next_request()
        
        # Check for completed trips
        for request in list(self.requests.values()):
            if request.status == RequestStatus.ASSIGNED:
                if request.assigned_vehicle >= 0:
                    vehicle = self.vehicles[request.assigned_vehicle]
                    
                    # Simplified: complete trip after dropoff travel time
                    dropoff_travel = estimate_travel_time(
                        request.pickup_lat, request.pickup_lon,
                        request.dropoff_lat, request.dropoff_lon,
                        vehicle.speed_kmh
                    )
                    
                    if self.current_time >= request.pickup_time + dropoff_travel:
                        request.status = RequestStatus.COMPLETED
                        request.dropoff_time = request.pickup_time + dropoff_travel
                        vehicle.current_passengers -= request.passengers
                        vehicle.lat = request.dropoff_lat
                        vehicle.lon = request.dropoff_lon
                        
                        self.completed_requests.append(request)
                        del self.requests[request.id]
                        
                        # Reward for completion
                        reward += 5.0
                        info["events"].append(f"Request {request.id} completed!")
        
        # Check for cancellations (excessive wait)
        for request in list(self.requests.values()):
            if request.status == RequestStatus.PENDING:
                if request.wait_time(self.current_time) > self.max_wait_time:
                    request.status = RequestStatus.CANCELLED
                    self.cancelled_requests.append(request)
                    del self.requests[request.id]
                    
                    # Big penalty for cancellation
                    reward -= 10.0
                    info["events"].append(f"Request {request.id} cancelled (timeout)")
        
        # Check episode end
        done = self.current_time >= self.simulation_hours * 60
        
        # Final rewards
        if done:
            # Bonus for completion rate
            total_requests = len(self.completed_requests) + len(self.cancelled_requests)
            if total_requests > 0:
                completion_rate = len(self.completed_requests) / total_requests
                reward += completion_rate * 20.0
        
        self.episode_reward += reward
        
        info.update({
            "current_time": self.current_time,
            "completed": len(self.completed_requests),
            "cancelled": len(self.cancelled_requests),
            "pending": len([r for r in self.requests.values() if r.status == RequestStatus.PENDING]),
            "total_wait_time": self.total_wait_time,
            "total_distance": self.total_distance,
            "episode_reward": self.episode_reward
        })
        
        return self._get_state(), reward, done, info
    
    def render(self) -> str:
        """Render current state as text."""
        output = []
        output.append(f"\n{'='*60}")
        output.append(f"Time: {self.current_time:.1f} min | Hour: {self._get_current_hour():.1f}")
        output.append(f"Completed: {len(self.completed_requests)} | Cancelled: {len(self.cancelled_requests)}")
        output.append(f"{'='*60}")
        
        output.append("\n🚐 Vehicles:")
        for v in self.vehicles:
            output.append(f"  Vehicle {v.id}: ({v.lat:.4f}, {v.lon:.4f}) - {v.current_passengers}/{v.capacity} passengers")
        
        pending = [r for r in self.requests.values() if r.status == RequestStatus.PENDING]
        output.append(f"\n📋 Pending Requests ({len(pending)}):")
        for r in pending[:5]:
            output.append(f"  Request {r.id}: Wait {r.wait_time(self.current_time):.1f} min, {r.passengers} passengers")
        
        return "\n".join(output)


def run_demo():
    """Run a quick demo of the environment."""
    env = CyprusTransitEnv(num_vehicles=3, max_requests=10, seed=42)
    state = env.reset()
    
    print("🚐 LastMile.cy - Cyprus Transit Simulation")
    print("=" * 60)
    
    total_reward = 0
    done = False
    step = 0
    
    while not done and step < 200:
        # Random policy for demo
        action = random.randint(0, env.action_size - 1)
        state, reward, done, info = env.step(action)
        total_reward += reward
        
        if step % 20 == 0:
            print(env.render())
        
        step += 1
    
    print("\n" + "=" * 60)
    print("📊 Episode Summary:")
    print(f"  Total Steps: {step}")
    print(f"  Total Reward: {total_reward:.2f}")
    print(f"  Completed Rides: {len(env.completed_requests)}")
    print(f"  Cancelled Rides: {len(env.cancelled_requests)}")
    print(f"  Avg Wait Time: {env.total_wait_time / max(1, len(env.completed_requests)):.1f} min")
    print(f"  Total Distance: {env.total_distance:.1f} km")


if __name__ == "__main__":
    run_demo()
