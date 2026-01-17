"""
LastMile.cy - Deep Q-Network Agent for Demand-Responsive Transit
================================================================
This module implements a DQN agent that learns to optimize vehicle routing
for demand-responsive microtransit in Cyprus's rural and tourist areas.

The agent learns to:
1. Cluster nearby ride requests efficiently
2. Optimize pickup/dropoff sequences
3. Balance wait times across passengers
4. Minimize total travel distance
"""

import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
import numpy as np
from collections import deque, namedtuple
import random
from typing import List, Tuple, Optional

# Experience tuple for replay buffer
Experience = namedtuple('Experience', 
    ['state', 'action', 'reward', 'next_state', 'done'])


class RouteOptimizerNetwork(nn.Module):
    """
    Neural network for Q-value estimation in route optimization.
    
    Architecture:
    - Input: State vector (vehicle positions, pending requests, time features)
    - Hidden: 3 fully connected layers with ReLU activation
    - Output: Q-values for each possible action
    """
    
    def __init__(self, state_size: int, action_size: int, hidden_size: int = 256):
        super(RouteOptimizerNetwork, self).__init__()
        
        self.fc1 = nn.Linear(state_size, hidden_size)
        self.bn1 = nn.BatchNorm1d(hidden_size)
        self.fc2 = nn.Linear(hidden_size, hidden_size)
        self.bn2 = nn.BatchNorm1d(hidden_size)
        self.fc3 = nn.Linear(hidden_size, hidden_size // 2)
        self.fc4 = nn.Linear(hidden_size // 2, action_size)
        
        self.dropout = nn.Dropout(0.2)
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = F.relu(self.bn1(self.fc1(x)))
        x = self.dropout(x)
        x = F.relu(self.bn2(self.fc2(x)))
        x = self.dropout(x)
        x = F.relu(self.fc3(x))
        return self.fc4(x)


class PrioritizedReplayBuffer:
    """
    Prioritized Experience Replay buffer for more efficient learning.
    Experiences with higher TD-error are sampled more frequently.
    """
    
    def __init__(self, capacity: int, alpha: float = 0.6):
        self.capacity = capacity
        self.alpha = alpha
        self.buffer = []
        self.priorities = np.zeros(capacity, dtype=np.float32)
        self.position = 0
        
    def push(self, experience: Experience, priority: float = 1.0):
        max_priority = self.priorities.max() if self.buffer else priority
        
        if len(self.buffer) < self.capacity:
            self.buffer.append(experience)
        else:
            self.buffer[self.position] = experience
            
        self.priorities[self.position] = max_priority ** self.alpha
        self.position = (self.position + 1) % self.capacity
        
    def sample(self, batch_size: int, beta: float = 0.4) -> Tuple:
        if len(self.buffer) == 0:
            return None
            
        priorities = self.priorities[:len(self.buffer)]
        probabilities = priorities / priorities.sum()
        
        indices = np.random.choice(len(self.buffer), batch_size, p=probabilities)
        experiences = [self.buffer[i] for i in indices]
        
        # Importance sampling weights
        weights = (len(self.buffer) * probabilities[indices]) ** (-beta)
        weights /= weights.max()
        
        return experiences, indices, torch.FloatTensor(weights)
    
    def update_priorities(self, indices: np.ndarray, priorities: np.ndarray):
        for idx, priority in zip(indices, priorities):
            self.priorities[idx] = (priority + 1e-5) ** self.alpha
            
    def __len__(self):
        return len(self.buffer)


class DQNAgent:
    """
    Deep Q-Network Agent for Demand-Responsive Transit Routing.
    
    This agent learns to make routing decisions that minimize:
    - Total passenger wait time
    - Vehicle travel distance
    - Service inequity between passengers
    
    Features:
    - Double DQN for stable learning
    - Prioritized Experience Replay
    - Soft target network updates
    """
    
    def __init__(
        self,
        state_size: int,
        action_size: int,
        learning_rate: float = 1e-4,
        gamma: float = 0.99,
        epsilon_start: float = 1.0,
        epsilon_end: float = 0.01,
        epsilon_decay: float = 0.995,
        buffer_size: int = 100000,
        batch_size: int = 64,
        tau: float = 0.005,
        device: str = None
    ):
        self.state_size = state_size
        self.action_size = action_size
        self.gamma = gamma
        self.epsilon = epsilon_start
        self.epsilon_end = epsilon_end
        self.epsilon_decay = epsilon_decay
        self.batch_size = batch_size
        self.tau = tau
        
        # Auto-detect device
        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)
            
        print(f"🚐 DQN Agent initialized on {self.device}")
        
        # Networks
        self.policy_net = RouteOptimizerNetwork(state_size, action_size).to(self.device)
        self.target_net = RouteOptimizerNetwork(state_size, action_size).to(self.device)
        self.target_net.load_state_dict(self.policy_net.state_dict())
        self.target_net.eval()
        
        # Optimizer
        self.optimizer = optim.Adam(self.policy_net.parameters(), lr=learning_rate)
        
        # Replay buffer
        self.memory = PrioritizedReplayBuffer(buffer_size)
        
        # Training stats
        self.training_step = 0
        self.episode_rewards = []
        
    def select_action(self, state: np.ndarray, training: bool = True) -> int:
        """
        Select action using epsilon-greedy policy.
        
        Args:
            state: Current environment state
            training: Whether to use exploration (epsilon-greedy)
            
        Returns:
            Selected action index
        """
        if training and random.random() < self.epsilon:
            return random.randrange(self.action_size)
        
        with torch.no_grad():
            state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.device)
            self.policy_net.eval()
            q_values = self.policy_net(state_tensor)
            self.policy_net.train()
            return q_values.argmax(dim=1).item()
    
    def store_experience(self, state, action, reward, next_state, done):
        """Store experience in replay buffer."""
        experience = Experience(state, action, reward, next_state, done)
        self.memory.push(experience)
        
    def train_step(self) -> Optional[float]:
        """
        Perform one training step using Double DQN.
        
        Returns:
            Loss value if training occurred, None otherwise
        """
        if len(self.memory) < self.batch_size:
            return None
            
        # Sample from prioritized replay buffer
        sample = self.memory.sample(self.batch_size)
        if sample is None:
            return None
            
        experiences, indices, weights = sample
        weights = weights.to(self.device)
        
        # Unpack experiences
        states = torch.FloatTensor(np.array([e.state for e in experiences])).to(self.device)
        actions = torch.LongTensor([e.action for e in experiences]).to(self.device)
        rewards = torch.FloatTensor([e.reward for e in experiences]).to(self.device)
        next_states = torch.FloatTensor(np.array([e.next_state for e in experiences])).to(self.device)
        dones = torch.BoolTensor([e.done for e in experiences]).to(self.device)
        
        # Current Q values
        current_q = self.policy_net(states).gather(1, actions.unsqueeze(1))
        
        # Double DQN: Use policy net to select action, target net to evaluate
        with torch.no_grad():
            next_actions = self.policy_net(next_states).argmax(dim=1, keepdim=True)
            next_q = self.target_net(next_states).gather(1, next_actions)
            target_q = rewards.unsqueeze(1) + (self.gamma * next_q * (~dones).unsqueeze(1))
        
        # Compute weighted loss
        td_errors = torch.abs(current_q - target_q).detach().cpu().numpy()
        loss = (weights * F.smooth_l1_loss(current_q, target_q, reduction='none').squeeze()).mean()
        
        # Update priorities
        self.memory.update_priorities(indices, td_errors.squeeze())
        
        # Optimize
        self.optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.policy_net.parameters(), 1.0)
        self.optimizer.step()
        
        # Soft update target network
        self._soft_update()
        
        # Decay epsilon
        self.epsilon = max(self.epsilon_end, self.epsilon * self.epsilon_decay)
        
        self.training_step += 1
        return loss.item()
    
    def _soft_update(self):
        """Soft update target network parameters."""
        for target_param, policy_param in zip(
            self.target_net.parameters(), 
            self.policy_net.parameters()
        ):
            target_param.data.copy_(
                self.tau * policy_param.data + (1 - self.tau) * target_param.data
            )
    
    def save(self, path: str):
        """Save model checkpoint."""
        torch.save({
            'policy_net': self.policy_net.state_dict(),
            'target_net': self.target_net.state_dict(),
            'optimizer': self.optimizer.state_dict(),
            'epsilon': self.epsilon,
            'training_step': self.training_step,
        }, path)
        print(f"✅ Model saved to {path}")
        
    def load(self, path: str):
        """Load model checkpoint."""
        checkpoint = torch.load(path, map_location=self.device)
        self.policy_net.load_state_dict(checkpoint['policy_net'])
        self.target_net.load_state_dict(checkpoint['target_net'])
        self.optimizer.load_state_dict(checkpoint['optimizer'])
        self.epsilon = checkpoint['epsilon']
        self.training_step = checkpoint['training_step']
        print(f"✅ Model loaded from {path}")


class MultiVehicleDQNAgent(DQNAgent):
    """
    Extended DQN Agent for coordinating multiple vehicles.
    
    This agent handles:
    - Fleet-level optimization
    - Vehicle assignment decisions
    - Load balancing across vehicles
    """
    
    def __init__(self, num_vehicles: int, max_requests: int, **kwargs):
        self.num_vehicles = num_vehicles
        self.max_requests = max_requests
        
        # State: vehicle positions + capacities + request info
        # Each vehicle: (lat, lon, current_passengers, remaining_capacity)
        # Each request: (pickup_lat, pickup_lon, dropoff_lat, dropoff_lon, wait_time)
        state_size = num_vehicles * 4 + max_requests * 5
        
        # Actions: assign request to vehicle, or wait
        action_size = num_vehicles * max_requests + 1  # +1 for "wait" action
        
        super().__init__(state_size=state_size, action_size=action_size, **kwargs)
        
        print(f"🚐 Multi-Vehicle Agent: {num_vehicles} vehicles, {max_requests} max requests")
        
    def decode_action(self, action: int) -> Tuple[int, int]:
        """
        Decode action index to (vehicle_id, request_id) tuple.
        
        Returns:
            (-1, -1) for wait action
            (vehicle_id, request_id) for assignment action
        """
        if action == self.action_size - 1:
            return (-1, -1)  # Wait action
            
        vehicle_id = action // self.max_requests
        request_id = action % self.max_requests
        return (vehicle_id, request_id)


if __name__ == "__main__":
    # Quick test
    print("Testing DQN Agent...")
    
    agent = MultiVehicleDQNAgent(
        num_vehicles=3,
        max_requests=10,
        learning_rate=1e-4
    )
    
    # Simulate some experiences
    for _ in range(100):
        state = np.random.randn(agent.state_size)
        action = agent.select_action(state)
        reward = np.random.randn()
        next_state = np.random.randn(agent.state_size)
        done = random.random() < 0.1
        
        agent.store_experience(state, action, reward, next_state, done)
        loss = agent.train_step()
        
        if loss is not None:
            print(f"Training step {agent.training_step}, Loss: {loss:.4f}, Epsilon: {agent.epsilon:.3f}")
    
    print("✅ DQN Agent test complete!")
