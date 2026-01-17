# 🚐 LastMile.cy

## AI-Powered Demand-Responsive Transit for Cyprus

[![Cyprus Transport Hackathon 2026](https://img.shields.io/badge/Cyprus-Transport%20Hackathon%202026-blue)](https://gov.cy)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-green)](https://python.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Solving Cyprus's #1 Transport Problem: The Last Mile Gap**

Cyprus has the highest car ownership rate in the EU, with only 3% of trips made by public transport. Remote villages in Troodos, pristine beaches, and archaeological sites remain inaccessible without a private car. **LastMile.cy** uses Reinforcement Learning to create an on-demand, shared transit service that bridges this gap.

---

## 🎯 The Problem

| Statistic | Impact |
|-----------|--------|
| **742 cars per 1,000 people** | Highest in EU |
| **3% public transport usage** | In Nicosia urban area |
| **0% railway** | No functioning rail since 1951 |
| **Troodos villages** | 1-2 buses per day |
| **Tourist mobility** | 90% rent cars |

**The Result:** CO2 emissions, traffic congestion, and inaccessible rural heritage.

---

## 💡 Our Solution

**LastMile.cy** is an AI-powered demand-responsive transit system that:

1. **Collects ride requests** from users wanting to visit remote destinations
2. **Clusters requests** by destination region and time using learned embeddings
3. **Optimizes routes** with Deep Q-Network (DQN) and PPO algorithms
4. **Dispatches shared minibuses** that serve multiple passengers efficiently

### Key Innovation: Reinforcement Learning for Dynamic Routing

Unlike static scheduling, our RL agent learns optimal routing policies by:
- Maximizing passenger throughput
- Minimizing total distance traveled
- Adapting to real-time demand patterns
- Integrating with existing GTFS-RT bus data

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Request UI  │  │  Live Map   │  │   Stats     │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI BACKEND                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  /request   │  │  /routes    │  │  /gtfs-rt   │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RL OPTIMIZATION ENGINE                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Clusterer  │─▶│  DQN Agent  │─▶│  Dispatcher │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│              CYPRUS DATA INTEGRATION                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  GTFS-RT    │  │ OpenStreet  │  │   Weather   │             │
│  │  (Realtime) │  │    Map      │  │     API     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🤖 The RL Agent

### State Space
- Current vehicle position (lat, lng)
- Pending destinations list
- Time constraints
- Vehicle capacity utilization

### Action Space
- Select next destination to visit from pending list

### Reward Function
```python
reward = (
    -distance_penalty          # Shorter routes = better
    + clustering_bonus         # Visit nearby destinations together
    + efficiency_bonus         # Higher vehicle utilization
    + co2_savings_bonus        # Environmental impact
)
```

### Training
- **Algorithm:** Deep Q-Network with experience replay
- **Episodes:** 1000+ simulated days
- **Convergence:** ~500 episodes to stable policy

---

## 📊 Expected Impact

| Metric | Current | With LastMile.cy |
|--------|---------|------------------|
| Rural accessibility | 1-2 buses/day | On-demand |
| Tourist car rentals | 90% | Target: 50% |
| CO2 per passenger-km | 0.21 kg (car) | 0.04 kg (shared) |
| Average wait time | N/A | 15-20 minutes |

---

## 🚀 Quick Start

### Prerequisites
```bash
Python 3.10+
Node.js 18+ (for frontend)
```

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python api.py
# API running at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
# App running at http://localhost:3000
```

### Run RL Training
```bash
cd backend
python rl_agent.py
```

---

## 📁 Project Structure

```
lastmile-cy/
├── frontend/
│   └── LastMileDemo.jsx      # React demo application
├── backend/
│   ├── rl_agent.py           # RL optimization engine
│   ├── api.py                # FastAPI backend
│   └── requirements.txt      # Python dependencies
├── simulation/
│   └── cyprus_env.py         # Training environment
├── docs/
│   ├── PRESENTATION.md       # Hackathon pitch
│   └── TECHNICAL.md          # Technical deep-dive
└── README.md
```

---

## 🔗 Data Sources

- **Cyprus GTFS-RT:** [traffic4cyprus.org.cy](https://www.traffic4cyprus.org.cy/dataset/publictransportrealtime_gtfs_rt)
- **OpenStreetMap:** Road network for Cyprus
- **Cyprus Open Data Portal:** Transportation statistics

---

## 🏆 Hackathon Submission

**Team:** [Your Team Name]

**Challenge:** Cyprus Transport Hackathon 2026

**Category:** Sustainable Mobility / Last-Mile Solutions

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- Ministry of Transport, Communications and Works of Cyprus
- Cyprus National Access Point for GTFS-RT data
- The open-source community

---

<p align="center">
  <strong>Built with 💚 for Cyprus</strong>
  <br>
  <em>Connecting every village, beach, and heritage site</em>
</p>
