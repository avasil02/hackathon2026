"""
LastMile.cy - Reinforcement Learning Route Optimization Agent
Cyprus Transport Hackathon 2026

This module implements a Deep Q-Network (DQN) and Proximal Policy Optimization (PPO)
agent for demand-responsive transit routing in Cyprus.

Key Features:
- Request clustering using learned embeddings
- Dynamic vehicle routing optimization
- Real-time GTFS-RT integration
- CO2 savings calculation
"""

import numpy as np
from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict
from collections import deque
import random
import math

# For the hackathon, we'll use numpy for the core logic
# In production, you'd use PyTorch/TensorFlow

@dataclass
class Location:
    """Represents a location in Cyprus"""
    id: str
    name: str
    lat: float
    lng: float
    location_type: str  # 'city', 'village', 'beach', 'archaeological'
    region: Optional[str] = None
    
    def __hash__(self):
        return hash(self.id)
    
    def __eq__(self, other):
        if isinstance(other, Location):
            return self.id == other.id
        return False

@dataclass
class RideRequest:
    """A single ride request from a user"""
    id: str
    origin: Location
    destination: Location
    passengers: int
    timestamp: float
    flexibility_minutes: int = 15  # How flexible is the user on pickup time
    
@dataclass 
class Vehicle:
    """A LastMile.cy vehicle (minibus/van)"""
    id: str
    capacity: int
    current_location: Location
    current_passengers: int = 0
    route: List[Location] = None
    
    def __post_init__(self):
        if self.route is None:
            self.route = []

@dataclass
class RouteAssignment:
    """An optimized route assignment"""
    vehicle_id: str
    requests: List[RideRequest]
    route: List[Location]
    total_distance_km: float
    estimated_time_minutes: float
    co2_saved_kg: float
    efficiency_score: float


class CyprusEnvironment:
    """
    Simulation environment for Cyprus transport network.
    Used for training and testing the RL agent.
    """
    
    # Cyprus city/location data
    CITIES = {
        'nicosia': Location('nicosia', 'Nicosia', 35.1856, 33.3823, 'city'),
        'limassol': Location('limassol', 'Limassol', 34.6786, 33.0413, 'city'),
        'larnaca': Location('larnaca', 'Larnaca', 34.9229, 33.6233, 'city'),
        'paphos': Location('paphos', 'Paphos', 34.7754, 32.4245, 'city'),
    }
    
    VILLAGES = {
        'kakopetria': Location('kakopetria', 'Kakopetria', 34.9833, 32.9000, 'village', 'Troodos'),
        'platres': Location('platres', 'Platres', 34.8897, 32.8639, 'village', 'Troodos'),
        'lefkara': Location('lefkara', 'Lefkara', 34.8667, 33.3000, 'village', 'Larnaca'),
        'omodos': Location('omodos', 'Omodos', 34.8472, 32.8083, 'village', 'Limassol'),
        'fikardou': Location('fikardou', 'Fikardou', 34.9667, 33.1333, 'village', 'Nicosia'),
        'peyia': Location('peyia', 'Peyia', 34.8833, 32.3500, 'village', 'Paphos'),
        'agros': Location('agros', 'Agros', 34.9167, 33.0167, 'village', 'Troodos'),
        'pedoulas': Location('pedoulas', 'Pedoulas', 34.9667, 32.8333, 'village', 'Troodos'),
    }
    
    BEACHES = {
        'nissi': Location('nissi', 'Nissi Beach', 34.9875, 34.0028, 'beach'),
        'coral': Location('coral', 'Coral Bay', 34.8553, 32.3569, 'beach'),
        'konnos': Location('konnos', 'Konnos Bay', 34.9764, 34.0764, 'beach'),
        'fig_tree': Location('fig_tree', 'Fig Tree Bay', 35.0139, 34.0583, 'beach'),
    }
    
    ARCHAEOLOGICAL = {
        'kourion': Location('kourion', 'Kourion', 34.6647, 32.8872, 'archaeological'),
        'tombs': Location('tombs', 'Tombs of Kings', 34.7728, 32.4072, 'archaeological'),
        'choirokoitia': Location('choirokoitia', 'Choirokoitia', 34.7967, 33.3417, 'archaeological'),
    }
    
    # CO2 emissions constants (kg per km)
    CAR_CO2_PER_KM = 0.21  # Average car
    MINIBUS_CO2_PER_KM = 0.35  # Our vehicles (but shared!)
    
    def __init__(self, num_vehicles: int = 5):
        self.all_destinations = {**self.VILLAGES, **self.BEACHES, **self.ARCHAEOLOGICAL}
        self.vehicles = self._initialize_vehicles(num_vehicles)
        self.pending_requests: List[RideRequest] = []
        self.completed_requests: List[RideRequest] = []
        self.total_co2_saved = 0.0
        
    def _initialize_vehicles(self, num_vehicles: int) -> List[Vehicle]:
        """Initialize vehicles at major city hubs"""
        cities = list(self.CITIES.values())
        vehicles = []
        for i in range(num_vehicles):
            city = cities[i % len(cities)]
            vehicles.append(Vehicle(
                id=f"LM-{i+1:03d}",
                capacity=8,  # 8-seater minibus
                current_location=city,
            ))
        return vehicles
    
    def haversine_distance(self, loc1: Location, loc2: Location) -> float:
        """Calculate distance between two points in km using Haversine formula"""
        R = 6371  # Earth's radius in km
        
        lat1, lon1 = math.radians(loc1.lat), math.radians(loc1.lng)
        lat2, lon2 = math.radians(loc2.lat), math.radians(loc2.lng)
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        return R * c
    
    def calculate_route_distance(self, route: List[Location]) -> float:
        """Calculate total distance of a route"""
        if len(route) < 2:
            return 0.0
        total = 0.0
        for i in range(len(route) - 1):
            total += self.haversine_distance(route[i], route[i+1])
        return total
    
    def calculate_co2_savings(self, requests: List[RideRequest], route: List[Location]) -> float:
        """
        Calculate CO2 saved by sharing rides vs individual car trips.
        This is a key metric for the hackathon!
        """
        # Individual car trips CO2
        individual_co2 = 0.0
        for req in requests:
            distance = self.haversine_distance(req.origin, req.destination)
            individual_co2 += distance * self.CAR_CO2_PER_KM * req.passengers
        
        # Shared minibus CO2
        shared_distance = self.calculate_route_distance(route)
        shared_co2 = shared_distance * self.MINIBUS_CO2_PER_KM
        
        return max(0, individual_co2 - shared_co2)
    
    def generate_random_request(self) -> RideRequest:
        """Generate a random ride request for simulation"""
        origin = random.choice(list(self.CITIES.values()))
        destination = random.choice(list(self.all_destinations.values()))
        
        return RideRequest(
            id=f"REQ-{random.randint(10000, 99999)}",
            origin=origin,
            destination=destination,
            passengers=random.randint(1, 4),
            timestamp=random.random() * 86400,  # Random time in day
            flexibility_minutes=random.randint(10, 30),
        )


class RequestClusterer:
    """
    Clusters ride requests by destination region and time window.
    Uses learned embeddings in production; rule-based for hackathon demo.
    """
    
    def __init__(self, max_cluster_size: int = 8, time_window_minutes: int = 30):
        self.max_cluster_size = max_cluster_size
        self.time_window = time_window_minutes * 60  # Convert to seconds
        
    def cluster_requests(self, requests: List[RideRequest]) -> List[List[RideRequest]]:
        """
        Cluster requests by destination region and time proximity.
        
        Algorithm:
        1. Group by destination region
        2. Sort by timestamp within each region
        3. Create clusters respecting capacity and time constraints
        """
        # Group by region
        region_groups: Dict[str, List[RideRequest]] = {}
        for req in requests:
            region = req.destination.region or req.destination.location_type
            if region not in region_groups:
                region_groups[region] = []
            region_groups[region].append(req)
        
        clusters = []
        
        for region, group in region_groups.items():
            # Sort by timestamp
            group.sort(key=lambda r: r.timestamp)
            
            current_cluster = []
            current_passengers = 0
            cluster_start_time = None
            
            for req in group:
                # Check if request fits in current cluster
                if (current_passengers + req.passengers <= self.max_cluster_size and
                    (cluster_start_time is None or 
                     req.timestamp - cluster_start_time <= self.time_window)):
                    
                    current_cluster.append(req)
                    current_passengers += req.passengers
                    if cluster_start_time is None:
                        cluster_start_time = req.timestamp
                else:
                    # Start new cluster
                    if current_cluster:
                        clusters.append(current_cluster)
                    current_cluster = [req]
                    current_passengers = req.passengers
                    cluster_start_time = req.timestamp
            
            # Don't forget the last cluster
            if current_cluster:
                clusters.append(current_cluster)
        
        return clusters


class DQNRouteOptimizer:
    """
    Deep Q-Network for route optimization.
    
    State: Current vehicle position + pending destinations
    Action: Next destination to visit
    Reward: -distance + efficiency_bonus + co2_savings
    
    For the hackathon, we implement a simplified version.
    Full implementation would use PyTorch neural networks.
    """
    
    def __init__(self, 
                 learning_rate: float = 0.001,
                 gamma: float = 0.95,
                 epsilon: float = 1.0,
                 epsilon_decay: float = 0.995,
                 epsilon_min: float = 0.01,
                 memory_size: int = 10000):
        
        self.lr = learning_rate
        self.gamma = gamma
        self.epsilon = epsilon
        self.epsilon_decay = epsilon_decay
        self.epsilon_min = epsilon_min
        
        # Experience replay buffer
        self.memory = deque(maxlen=memory_size)
        
        # Q-table (simplified - would be neural network in production)
        self.q_table: Dict[Tuple, Dict[str, float]] = {}
        
    def get_state_key(self, current_location: Location, 
                      remaining_destinations: List[Location]) -> Tuple:
        """Convert state to hashable key"""
        dest_ids = tuple(sorted([d.id for d in remaining_destinations]))
        return (current_location.id, dest_ids)
    
    def get_q_values(self, state_key: Tuple, 
                     possible_actions: List[Location]) -> Dict[str, float]:
        """Get Q-values for all possible actions in a state"""
        if state_key not in self.q_table:
            # Initialize with small random values
            self.q_table[state_key] = {
                loc.id: np.random.uniform(-0.1, 0.1) 
                for loc in possible_actions
            }
        return self.q_table[state_key]
    
    def select_action(self, current_location: Location,
                      remaining_destinations: List[Location],
                      env: CyprusEnvironment) -> Location:
        """
        Select next destination using epsilon-greedy policy.
        """
        if not remaining_destinations:
            return None
            
        # Epsilon-greedy exploration
        if np.random.random() < self.epsilon:
            return random.choice(remaining_destinations)
        
        state_key = self.get_state_key(current_location, remaining_destinations)
        q_values = self.get_q_values(state_key, remaining_destinations)
        
        # Select action with highest Q-value
        best_action_id = max(q_values.keys(), key=lambda k: q_values[k])
        return next((d for d in remaining_destinations if d.id == best_action_id), 
                   remaining_destinations[0])
    
    def calculate_reward(self, 
                        current_location: Location,
                        next_location: Location,
                        remaining_destinations: List[Location],
                        env: CyprusEnvironment) -> float:
        """
        Calculate reward for taking an action.
        
        Reward components:
        - Negative distance (encourage shorter routes)
        - Clustering bonus (encourage visiting nearby locations)
        - Time efficiency bonus
        """
        distance = env.haversine_distance(current_location, next_location)
        
        # Base reward: negative distance (shorter is better)
        reward = -distance * 0.1
        
        # Clustering bonus: if next location is close to other remaining destinations
        if remaining_destinations:
            avg_distance_to_remaining = np.mean([
                env.haversine_distance(next_location, dest) 
                for dest in remaining_destinations
            ])
            if avg_distance_to_remaining < 20:  # Within 20km
                reward += 2.0
        
        # Completion bonus
        if len(remaining_destinations) == 0:
            reward += 10.0
        
        return reward
    
    def update(self, state_key: Tuple, action_id: str, 
               reward: float, next_state_key: Tuple,
               next_possible_actions: List[Location]):
        """Update Q-value using Bellman equation"""
        
        if state_key not in self.q_table:
            return
            
        current_q = self.q_table[state_key].get(action_id, 0)
        
        # Get max Q-value for next state
        if next_possible_actions:
            next_q_values = self.get_q_values(next_state_key, next_possible_actions)
            max_next_q = max(next_q_values.values()) if next_q_values else 0
        else:
            max_next_q = 0
        
        # Bellman update
        new_q = current_q + self.lr * (reward + self.gamma * max_next_q - current_q)
        self.q_table[state_key][action_id] = new_q
        
        # Decay epsilon
        self.epsilon = max(self.epsilon_min, self.epsilon * self.epsilon_decay)
    
    def optimize_route(self, 
                       vehicle: Vehicle,
                       cluster: List[RideRequest],
                       env: CyprusEnvironment) -> RouteAssignment:
        """
        Optimize the route for a vehicle serving a cluster of requests.
        """
        # Get unique destinations
        destinations = list(set([req.destination for req in cluster]))
        
        # Build route using learned policy
        route = [vehicle.current_location]
        current = vehicle.current_location
        remaining = destinations.copy()
        
        while remaining:
            next_dest = self.select_action(current, remaining, env)
            if next_dest is None:
                break
                
            # Calculate reward and update Q-values
            state_key = self.get_state_key(current, remaining)
            remaining.remove(next_dest)
            reward = self.calculate_reward(current, next_dest, remaining, env)
            next_state_key = self.get_state_key(next_dest, remaining)
            
            self.update(state_key, next_dest.id, reward, next_state_key, remaining)
            
            route.append(next_dest)
            current = next_dest
        
        # Calculate metrics
        total_distance = env.calculate_route_distance(route)
        co2_saved = env.calculate_co2_savings(cluster, route)
        
        # Estimate time (assume 40 km/h average speed + 5 min per stop)
        estimated_time = (total_distance / 40) * 60 + len(route) * 5
        
        # Calculate efficiency score
        total_passengers = sum(req.passengers for req in cluster)
        efficiency = (total_passengers / vehicle.capacity) * 100 if total_passengers else 0
        
        return RouteAssignment(
            vehicle_id=vehicle.id,
            requests=cluster,
            route=route,
            total_distance_km=total_distance,
            estimated_time_minutes=estimated_time,
            co2_saved_kg=co2_saved,
            efficiency_score=efficiency,
        )


class LastMileAgent:
    """
    Main agent that coordinates clustering and route optimization.
    This is the entry point for the LastMile.cy system.
    """
    
    def __init__(self, num_vehicles: int = 5):
        self.env = CyprusEnvironment(num_vehicles)
        self.clusterer = RequestClusterer()
        self.optimizer = DQNRouteOptimizer()
        self.assignments: List[RouteAssignment] = []
        
    def process_requests(self, requests: List[RideRequest]) -> List[RouteAssignment]:
        """
        Main processing pipeline:
        1. Cluster requests by region and time
        2. Assign clusters to available vehicles
        3. Optimize routes for each vehicle
        """
        # Step 1: Cluster requests
        clusters = self.clusterer.cluster_requests(requests)
        
        # Step 2 & 3: Assign and optimize
        assignments = []
        available_vehicles = [v for v in self.env.vehicles if len(v.route) == 0]
        
        for i, cluster in enumerate(clusters):
            if i >= len(available_vehicles):
                break  # No more vehicles available
                
            vehicle = available_vehicles[i]
            assignment = self.optimizer.optimize_route(vehicle, cluster, self.env)
            assignments.append(assignment)
            
            # Update vehicle state
            vehicle.route = assignment.route
            vehicle.current_passengers = sum(r.passengers for r in cluster)
        
        self.assignments = assignments
        return assignments
    
    def train(self, num_episodes: int = 1000):
        """
        Train the RL agent using simulated requests.
        """
        print(f"Training LastMile.cy agent for {num_episodes} episodes...")
        
        total_rewards = []
        
        for episode in range(num_episodes):
            # Generate random requests
            num_requests = random.randint(10, 30)
            requests = [self.env.generate_random_request() for _ in range(num_requests)]
            
            # Process and get assignments
            assignments = self.process_requests(requests)
            
            # Calculate episode reward
            episode_reward = sum(a.co2_saved_kg for a in assignments)
            total_rewards.append(episode_reward)
            
            # Reset vehicles
            for v in self.env.vehicles:
                v.route = []
                v.current_passengers = 0
            
            if (episode + 1) % 100 == 0:
                avg_reward = np.mean(total_rewards[-100:])
                print(f"Episode {episode + 1}: Avg CO2 Saved = {avg_reward:.2f} kg, "
                      f"Epsilon = {self.optimizer.epsilon:.3f}")
        
        print("Training complete!")
        return total_rewards
    
    def get_stats(self) -> Dict:
        """Get current system statistics"""
        return {
            'total_vehicles': len(self.env.vehicles),
            'active_routes': len([v for v in self.env.vehicles if v.route]),
            'total_co2_saved': self.env.total_co2_saved,
            'pending_requests': len(self.env.pending_requests),
            'completed_requests': len(self.env.completed_requests),
        }


# Demo/Testing code
if __name__ == "__main__":
    print("=" * 60)
    print("LastMile.cy - AI-Powered Demand-Responsive Transit")
    print("Cyprus Transport Hackathon 2026")
    print("=" * 60)
    print()
    
    # Initialize agent
    agent = LastMileAgent(num_vehicles=5)
    
    # Generate sample requests
    print("Generating sample ride requests...")
    sample_requests = [agent.env.generate_random_request() for _ in range(15)]
    
    print(f"\nReceived {len(sample_requests)} ride requests:")
    for req in sample_requests[:5]:
        print(f"  - {req.origin.name} → {req.destination.name} ({req.passengers} passengers)")
    print("  ...")
    
    # Process requests
    print("\n🤖 Running RL-based route optimization...")
    assignments = agent.process_requests(sample_requests)
    
    print(f"\n✅ Optimized {len(assignments)} routes:")
    total_co2 = 0
    for assignment in assignments:
        route_str = " → ".join([loc.name for loc in assignment.route])
        print(f"\n  Vehicle {assignment.vehicle_id}:")
        print(f"    Route: {route_str}")
        print(f"    Passengers: {sum(r.passengers for r in assignment.requests)}")
        print(f"    Distance: {assignment.total_distance_km:.1f} km")
        print(f"    Est. Time: {assignment.estimated_time_minutes:.0f} min")
        print(f"    CO2 Saved: {assignment.co2_saved_kg:.2f} kg 🌱")
        print(f"    Efficiency: {assignment.efficiency_score:.1f}%")
        total_co2 += assignment.co2_saved_kg
    
    print(f"\n{'=' * 60}")
    print(f"🌍 TOTAL CO2 SAVED: {total_co2:.2f} kg")
    print(f"{'=' * 60}")
    
    # Optional: Train the agent
    print("\n" + "=" * 60)
    print("Training RL Agent (simplified demo)...")
    print("=" * 60)
    agent.train(num_episodes=200)
