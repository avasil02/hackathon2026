import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, Users, Zap, Clock, Leaf, ChevronRight, Sparkles, Route, Car } from 'lucide-react';

// Cyprus locations data
const CYPRUS_LOCATIONS = {
  cities: [
    { id: 'nicosia', name: 'Nicosia', lat: 35.1856, lng: 33.3823, type: 'city' },
    { id: 'limassol', name: 'Limassol', lat: 34.6786, lng: 33.0413, type: 'city' },
    { id: 'larnaca', name: 'Larnaca', lat: 34.9229, lng: 33.6233, type: 'city' },
    { id: 'paphos', name: 'Paphos', lat: 34.7754, lng: 32.4245, type: 'city' },
  ],
  villages: [
    { id: 'kakopetria', name: 'Kakopetria', lat: 34.9833, lng: 32.9000, type: 'village', region: 'Troodos' },
    { id: 'platres', name: 'Platres', lat: 34.8897, lng: 32.8639, type: 'village', region: 'Troodos' },
    { id: 'lefkara', name: 'Lefkara', lat: 34.8667, lng: 33.3000, type: 'village', region: 'Larnaca' },
    { id: 'omodos', name: 'Omodos', lat: 34.8472, lng: 32.8083, type: 'village', region: 'Limassol' },
    { id: 'fikardou', name: 'Fikardou', lat: 34.9667, lng: 33.1333, type: 'village', region: 'Nicosia' },
    { id: 'peyia', name: 'Peyia', lat: 34.8833, lng: 32.3500, type: 'village', region: 'Paphos' },
  ],
  beaches: [
    { id: 'nissi', name: 'Nissi Beach', lat: 34.9875, lng: 34.0028, type: 'beach' },
    { id: 'coral', name: 'Coral Bay', lat: 34.8553, lng: 32.3569, type: 'beach' },
    { id: 'konnos', name: 'Konnos Bay', lat: 34.9764, lng: 34.0764, type: 'beach' },
  ],
  archaeological: [
    { id: 'kourion', name: 'Kourion', lat: 34.6647, lng: 32.8872, type: 'archaeological' },
    { id: 'tombs', name: 'Tombs of Kings', lat: 34.7728, lng: 32.4072, type: 'archaeological' },
  ]
};

// Simulated ride requests
const generateRideRequest = () => {
  const allLocations = [...CYPRUS_LOCATIONS.villages, ...CYPRUS_LOCATIONS.beaches, ...CYPRUS_LOCATIONS.archaeological];
  const destination = allLocations[Math.floor(Math.random() * allLocations.length)];
  const origin = CYPRUS_LOCATIONS.cities[Math.floor(Math.random() * CYPRUS_LOCATIONS.cities.length)];
  const passengers = Math.floor(Math.random() * 4) + 1;
  
  return {
    id: Math.random().toString(36).substr(2, 9),
    origin,
    destination,
    passengers,
    timestamp: new Date(),
    status: 'pending',
    eta: Math.floor(Math.random() * 20) + 5,
  };
};

// RL Agent Simulation (simplified for demo)
const simulateRLOptimization = (requests) => {
  // Simulate clustering and route optimization
  const clusters = [];
  const processed = new Set();
  
  requests.forEach(req => {
    if (processed.has(req.id)) return;
    
    const cluster = [req];
    processed.add(req.id);
    
    // Find nearby requests (same destination region)
    requests.forEach(other => {
      if (!processed.has(other.id) && 
          other.destination.region === req.destination.region &&
          cluster.length < 4) {
        cluster.push(other);
        processed.add(other.id);
      }
    });
    
    if (cluster.length > 0) {
      clusters.push({
        id: Math.random().toString(36).substr(2, 9),
        requests: cluster,
        totalPassengers: cluster.reduce((sum, r) => sum + r.passengers, 0),
        estimatedSavings: Math.floor(cluster.length * 15 + Math.random() * 10),
        co2Saved: (cluster.length * 2.5).toFixed(1),
        route: cluster.map(r => r.destination.name),
      });
    }
  });
  
  return clusters;
};

// Animated background component
const AnimatedBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute top-0 left-0 w-full h-full">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full opacity-10"
          style={{
            width: `${Math.random() * 300 + 50}px`,
            height: `${Math.random() * 300 + 50}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: `radial-gradient(circle, ${
              ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b'][Math.floor(Math.random() * 4)]
            } 0%, transparent 70%)`,
            animation: `float ${Math.random() * 10 + 10}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}
    </div>
  </div>
);

// Main App Component
export default function LastMileDemo() {
  const [activeTab, setActiveTab] = useState('request');
  const [rideRequests, setRideRequests] = useState([]);
  const [optimizedRoutes, setOptimizedRoutes] = useState([]);
  const [stats, setStats] = useState({
    totalRequests: 0,
    activeVehicles: 3,
    co2Saved: 0,
    avgWaitTime: 12,
  });
  const [selectedOrigin, setSelectedOrigin] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Simulate incoming requests
  useEffect(() => {
    const interval = setInterval(() => {
      if (rideRequests.length < 8) {
        const newRequest = generateRideRequest();
        setRideRequests(prev => [...prev, newRequest]);
        setStats(prev => ({ ...prev, totalRequests: prev.totalRequests + 1 }));
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [rideRequests.length]);

  // Run optimization when we have enough requests
  useEffect(() => {
    if (rideRequests.filter(r => r.status === 'pending').length >= 3) {
      setIsOptimizing(true);
      setTimeout(() => {
        const optimized = simulateRLOptimization(rideRequests.filter(r => r.status === 'pending'));
        setOptimizedRoutes(optimized);
        setRideRequests(prev => prev.map(r => ({ ...r, status: 'assigned' })));
        setStats(prev => ({
          ...prev,
          co2Saved: prev.co2Saved + optimized.reduce((sum, c) => sum + parseFloat(c.co2Saved), 0),
        }));
        setIsOptimizing(false);
      }, 1500);
    }
  }, [rideRequests]);

  const handleRequestRide = () => {
    if (selectedOrigin && selectedDestination) {
      const newRequest = {
        id: Math.random().toString(36).substr(2, 9),
        origin: selectedOrigin,
        destination: selectedDestination,
        passengers: 1,
        timestamp: new Date(),
        status: 'pending',
        eta: Math.floor(Math.random() * 15) + 5,
      };
      setRideRequests(prev => [...prev, newRequest]);
      setStats(prev => ({ ...prev, totalRequests: prev.totalRequests + 1 }));
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      setSelectedOrigin(null);
      setSelectedDestination(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      <AnimatedBackground />
      
      {/* Keyframes for animations */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
        
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        .animate-slide-up {
          animation: slide-up 0.5s ease-out forwards;
        }
        
        .gradient-text {
          background: linear-gradient(135deg, #10b981, #06b6d4, #8b5cf6);
          background-size: 200% 200%;
          animation: gradient-shift 3s ease infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .glass-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .glow-emerald {
          box-shadow: 0 0 40px rgba(16, 185, 129, 0.3);
        }
        
        * {
          font-family: 'Space Grotesk', sans-serif;
        }
        
        .mono {
          font-family: 'JetBrains Mono', monospace;
        }
      `}</style>

      {/* Header */}
      <header className="relative z-10 px-6 py-4 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center glow-emerald">
              <Navigation className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold gradient-text">LastMile.cy</h1>
              <p className="text-xs text-slate-400 mono">AI-Powered Demand-Responsive Transit</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="glass-card rounded-xl px-4 py-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm text-emerald-400 mono">LIVE</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Cyprus Transport Hackathon</p>
              <p className="text-sm font-medium text-slate-300">January 2026</p>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="relative z-10 px-6 py-4 border-b border-white/5">
        <div className="max-w-7xl mx-auto grid grid-cols-4 gap-4">
          {[
            { icon: Users, label: 'Total Requests', value: stats.totalRequests, color: 'emerald' },
            { icon: Car, label: 'Active Vehicles', value: stats.activeVehicles, color: 'cyan' },
            { icon: Leaf, label: 'CO₂ Saved (kg)', value: stats.co2Saved.toFixed(1), color: 'green' },
            { icon: Clock, label: 'Avg Wait (min)', value: stats.avgWaitTime, color: 'amber' },
          ].map((stat, i) => (
            <div key={i} className="glass-card rounded-xl p-4 animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-${stat.color}-500/20 flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 text-${stat.color}-400`} />
                </div>
                <div>
                  <p className="text-2xl font-bold mono">{stat.value}</p>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="relative z-10 px-6 py-8">
        <div className="max-w-7xl mx-auto grid grid-cols-3 gap-6">
          
          {/* Left Panel - Request Ride */}
          <div className="glass-card rounded-2xl p-6 animate-slide-up">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-400" />
              Request a Ride
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block">Pickup Location</label>
                <div className="grid grid-cols-2 gap-2">
                  {CYPRUS_LOCATIONS.cities.map(city => (
                    <button
                      key={city.id}
                      onClick={() => setSelectedOrigin(city)}
                      className={`p-3 rounded-lg text-sm font-medium transition-all ${
                        selectedOrigin?.id === city.id
                          ? 'bg-emerald-500/30 border border-emerald-500 text-emerald-300'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300'
                      }`}
                    >
                      {city.name}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block">Destination</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {[...CYPRUS_LOCATIONS.villages, ...CYPRUS_LOCATIONS.beaches].map(loc => (
                    <button
                      key={loc.id}
                      onClick={() => setSelectedDestination(loc)}
                      className={`w-full p-3 rounded-lg text-left text-sm transition-all flex items-center justify-between ${
                        selectedDestination?.id === loc.id
                          ? 'bg-cyan-500/30 border border-cyan-500 text-cyan-300'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300'
                      }`}
                    >
                      <span>{loc.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        loc.type === 'village' ? 'bg-amber-500/20 text-amber-400' :
                        loc.type === 'beach' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-purple-500/20 text-purple-400'
                      }`}>
                        {loc.type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              
              <button
                onClick={handleRequestRide}
                disabled={!selectedOrigin || !selectedDestination}
                className={`w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  selectedOrigin && selectedDestination
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white glow-emerald'
                    : 'bg-white/10 text-slate-500 cursor-not-allowed'
                }`}
              >
                {showSuccess ? (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Ride Requested!
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Request Smart Ride
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Center Panel - Live Map Visualization */}
          <div className="glass-card rounded-2xl p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Route className="w-5 h-5 text-cyan-400" />
              Live Route Optimization
              {isOptimizing && (
                <span className="ml-auto text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full animate-pulse">
                  AI Optimizing...
                </span>
              )}
            </h2>
            
            {/* Simplified Cyprus Map Visualization */}
            <div className="relative h-64 bg-slate-900/50 rounded-xl overflow-hidden mb-4">
              <svg viewBox="0 0 400 200" className="w-full h-full">
                {/* Cyprus outline (simplified) */}
                <path
                  d="M50,100 Q100,50 200,60 Q300,70 350,100 Q320,150 200,140 Q100,130 50,100"
                  fill="none"
                  stroke="rgba(16, 185, 129, 0.3)"
                  strokeWidth="2"
                />
                
                {/* Cities */}
                {CYPRUS_LOCATIONS.cities.map((city, i) => (
                  <g key={city.id}>
                    <circle
                      cx={80 + i * 80}
                      cy={100}
                      r="8"
                      fill="#10b981"
                      className="animate-pulse"
                    />
                    <text
                      x={80 + i * 80}
                      y={125}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="10"
                    >
                      {city.name}
                    </text>
                  </g>
                ))}
                
                {/* Active routes */}
                {optimizedRoutes.slice(0, 3).map((route, i) => (
                  <path
                    key={route.id}
                    d={`M${80 + Math.random() * 80},100 Q${200},${60 + i * 20} ${280 + Math.random() * 40},${80 + i * 15}`}
                    fill="none"
                    stroke={['#06b6d4', '#8b5cf6', '#f59e0b'][i]}
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    className="animate-pulse"
                  />
                ))}
                
                {/* Vehicle icons */}
                {[1, 2, 3].map((_, i) => (
                  <g key={i} transform={`translate(${100 + i * 100}, ${90 + Math.sin(i) * 20})`}>
                    <rect x="-8" y="-5" width="16" height="10" rx="2" fill="#06b6d4" />
                    <circle cx="-5" cy="5" r="2" fill="#1e293b" />
                    <circle cx="5" cy="5" r="2" fill="#1e293b" />
                  </g>
                ))}
              </svg>
            </div>
            
            {/* Optimization Results */}
            <div className="space-y-2">
              {optimizedRoutes.slice(0, 3).map((route, i) => (
                <div 
                  key={route.id}
                  className="bg-white/5 rounded-lg p-3 flex items-center justify-between animate-slide-up"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      ['bg-cyan-500/20', 'bg-purple-500/20', 'bg-amber-500/20'][i]
                    }`}>
                      <Car className={`w-4 h-4 ${
                        ['text-cyan-400', 'text-purple-400', 'text-amber-400'][i]
                      }`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{route.route.slice(0, 2).join(' → ')}</p>
                      <p className="text-xs text-slate-500">{route.totalPassengers} passengers</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-emerald-400 mono">-{route.co2Saved}kg CO₂</p>
                    <p className="text-xs text-slate-500">{route.estimatedSavings}% more efficient</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel - Pending Requests Queue */}
          <div className="glass-card rounded-2xl p-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              Live Request Queue
              <span className="ml-auto text-xs bg-white/10 px-2 py-1 rounded-full mono">
                {rideRequests.length}
              </span>
            </h2>
            
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {rideRequests.slice(-6).reverse().map((request, i) => (
                <div 
                  key={request.id}
                  className={`p-4 rounded-xl border transition-all animate-slide-up ${
                    request.status === 'pending'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-emerald-500/10 border-emerald-500/30'
                  }`}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm">{request.origin.name}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <ChevronRight className="w-3 h-3" />
                        {request.destination.name}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full mono ${
                      request.status === 'pending'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {request.status === 'pending' ? 'MATCHING' : 'ASSIGNED'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {request.passengers}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      ~{request.eta} min
                    </span>
                    <span className="mono">{request.id}</span>
                  </div>
                </div>
              ))}
              
              {rideRequests.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Waiting for ride requests...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="max-w-7xl mx-auto mt-8">
          <div className="glass-card rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-6 gradient-text">How Our AI Works</h2>
            <div className="grid grid-cols-4 gap-6">
              {[
                {
                  step: '01',
                  title: 'Collect Requests',
                  desc: 'Users request rides to remote destinations in real-time',
                  icon: MapPin,
                },
                {
                  step: '02',
                  title: 'RL Clustering',
                  desc: 'Deep Q-Network clusters nearby requests by destination',
                  icon: Sparkles,
                },
                {
                  step: '03',
                  title: 'Route Optimization',
                  desc: 'PPO agent optimizes multi-stop routes dynamically',
                  icon: Route,
                },
                {
                  step: '04',
                  title: 'Smart Dispatch',
                  desc: 'Vehicles dispatched with maximum efficiency',
                  icon: Zap,
                },
              ].map((item, i) => (
                <div key={i} className="relative">
                  <div className="text-6xl font-bold text-white/5 absolute -top-4 -left-2">{item.step}</div>
                  <div className="relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center mb-3">
                      <item.icon className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h3 className="font-semibold mb-1">{item.title}</h3>
                    <p className="text-sm text-slate-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="max-w-7xl mx-auto mt-6">
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-slate-400 mb-1">TECH STACK</h3>
                <div className="flex items-center gap-3">
                  {['PyTorch', 'GTFS-RT', 'FastAPI', 'React', 'OpenStreetMap'].map(tech => (
                    <span key={tech} className="px-3 py-1 rounded-full bg-white/5 text-xs text-slate-300 mono">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Solving Cyprus's #1 transport problem</p>
                <p className="text-lg font-bold gradient-text">The Last Mile Gap</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Render the app
import { createRoot } from 'react-dom/client';

const root = createRoot(document.getElementById('root'));
root.render(<LastMileDemo />);
