import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
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

const ALL_DESTINATIONS = [
  ...CYPRUS_LOCATIONS.villages,
  ...CYPRUS_LOCATIONS.beaches,
  ...CYPRUS_LOCATIONS.archaeological,
];

const VEHICLE_COLORS = ['#22c55e', '#38bdf8', '#f97316', '#a855f7', '#facc15', '#ef4444'];

const getVehicleColor = (vehicleId) => {
  if (!vehicleId) return VEHICLE_COLORS[0];
  const hash = vehicleId.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return VEHICLE_COLORS[hash % VEHICLE_COLORS.length];
};

const toRadians = (deg) => (deg * Math.PI) / 180;
const toDegrees = (rad) => (rad * 180) / Math.PI;

const computeBearing = (from, to) => {
  const [lat1, lng1] = from;
  const [lat2, lng2] = to;
  const dLng = toRadians(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRadians(lat2));
  const x = Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
    Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(dLng);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
};

const makeArrowIcon = (color, rotation) => L.divIcon({
  className: 'route-arrow',
  html: `<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:12px solid ${color};transform:rotate(${rotation}deg);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// Simulated ride requests
const generateRideRequest = () => {
  const destination = ALL_DESTINATIONS[Math.floor(Math.random() * ALL_DESTINATIONS.length)];
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
  let vehicleIndex = 1;
  
  requests.forEach(req => {
    if (processed.has(req.id)) return;
    
    const cluster = [req];
    processed.add(req.id);
    
    // Find nearby requests (same destination region/type)
    const reqRegion = req.destination.region || req.destination.type;
    requests.forEach(other => {
      if (!processed.has(other.id) && 
          (other.destination.region || other.destination.type) === reqRegion &&
          cluster.length < 4) {
        cluster.push(other);
        processed.add(other.id);
      }
    });
    
    if (cluster.length > 0) {
      const destinationCounts = new Map();
      const originCounts = new Map();
      cluster.forEach(r => {
        destinationCounts.set(r.destination.id, (destinationCounts.get(r.destination.id) || 0) + 1);
        originCounts.set(r.origin.id, (originCounts.get(r.origin.id) || 0) + 1);
      });
      const primaryDestinationId = [...destinationCounts.entries()]
        .sort((a, b) => b[1] - a[1])[0][0];
      const primaryOriginId = [...originCounts.entries()]
        .sort((a, b) => b[1] - a[1])[0][0];
      const primaryOrigin = cluster.find(r => r.origin.id === primaryOriginId)?.origin || cluster[0].origin;
      const uniqueDestinations = [
        ...new Map(cluster.map(r => [r.destination.id, r.destination])).values(),
      ];
      const destinationIds = uniqueDestinations.map(dest => dest.id);

      clusters.push({
        id: Math.random().toString(36).substr(2, 9),
        vehicleId: `LM-${String(vehicleIndex).padStart(3, '0')}`,
        requests: cluster,
        totalPassengers: cluster.reduce((sum, r) => sum + r.passengers, 0),
        estimatedSavings: Math.floor(cluster.length * 15 + Math.random() * 10),
        co2Saved: (cluster.length * 2.5).toFixed(1),
        primaryDestinationId,
        destinationIds,
        routeStops: [primaryOrigin, ...uniqueDestinations],
        route: uniqueDestinations.map(r => r.name),
      });
      vehicleIndex += 1;
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
  const [focusedDestinationId, setFocusedDestinationId] = useState(ALL_DESTINATIONS[0]?.id || null);
  const [apiRoutes, setApiRoutes] = useState([]);
  const [apiError, setApiError] = useState(null);

  const focusedDestination = useMemo(
    () => ALL_DESTINATIONS.find(dest => dest.id === focusedDestinationId) || null,
    [focusedDestinationId]
  );

  const apiRouteViews = useMemo(() => (
    apiRoutes.map(route => {
      const routeStops = route.route || [];
      const destinationIds = routeStops.map(stop => stop.id);
      return {
        id: route.vehicle_id,
        vehicleId: route.vehicle_id,
        routeStops,
        destinationIds,
        totalPassengers: route.total_passengers ?? 0,
        estimatedSavings: Math.max(10, Math.round((route.efficiency_score || 50) / 2)),
        co2Saved: (route.co2_saved_kg ?? 0).toFixed(1),
      };
    })
  ), [apiRoutes]);

  const activeRoutesForUI = apiRouteViews.length > 0 ? apiRouteViews : optimizedRoutes;

  const routesForDestination = useMemo(() => {
    if (!focusedDestinationId) return [];
    return activeRoutesForUI.filter(route => route.destinationIds?.includes(focusedDestinationId));
  }, [activeRoutesForUI, focusedDestinationId]);

  const transportOptions = useMemo(() => {
    if (!focusedDestinationId) return [];
    return routesForDestination.map((route, index) => {
      const capacity = route.totalPassengers <= 4 ? 4 : route.totalPassengers <= 8 ? 8 : 12;
      const label = capacity === 4 ? 'E-Shuttle' : capacity === 8 ? 'Minibus' : 'Coach';
      const availability = route.totalPassengers < capacity
        ? `${capacity - route.totalPassengers} seats left`
        : 'Full';
      return {
        id: route.vehicleId,
        label,
        capacity,
        occupancy: route.totalPassengers,
        availability,
        eta: Math.max(6, 18 - index * 3),
      };
    });
  }, [routesForDestination, focusedDestinationId]);

  const apiMapRoutes = useMemo(() => (
    apiRoutes.map(route => ({
      ...route,
      points: (route.route || []).map(stop => [stop.lat, stop.lng]),
    }))
  ), [apiRoutes]);

  useEffect(() => {
    let isMounted = true;

    const fetchRoutes = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/routes/active');
        if (!response.ok) {
          throw new Error(`API ${response.status}`);
        }
        const data = await response.json();
        if (isMounted) {
          setApiRoutes(Array.isArray(data) ? data : []);
          setApiError(null);
        }
      } catch (err) {
        if (isMounted) {
          setApiError('API unavailable');
          setApiRoutes([]);
        }
      }
    };

    fetchRoutes();
    const interval = setInterval(fetchRoutes, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

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
                  {ALL_DESTINATIONS.map(loc => (
                    <button
                      key={loc.id}
                      onClick={() => {
                        setSelectedDestination(loc);
                        setFocusedDestinationId(loc.id);
                      }}
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
            <div className="relative h-64 bg-slate-900/50 rounded-xl overflow-hidden mb-4" style={{ height: '16rem' }}>
              <MapContainer
                center={[35.035, 33.2]}
                zoom={8}
                minZoom={7}
                maxZoom={12}
                scrollWheelZoom={false}
                className="h-full w-full"
                style={{ height: '100%', width: '100%' }}
                maxBounds={[[34.45, 32.0], [35.6, 34.6]]}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {apiMapRoutes.map(route => {
                  if (!route.points || route.points.length < 2) return null;
                  const color = getVehicleColor(route.vehicle_id);
                  return (
                    <Polyline
                      key={route.vehicle_id}
                      positions={route.points}
                      pathOptions={{ color, weight: 4, opacity: 0.75 }}
                    />
                  );
                })}

                {apiMapRoutes.map(route => {
                  if (!route.points || route.points.length < 2) return null;
                  const midIndex = Math.max(1, Math.floor(route.points.length / 2));
                  const from = route.points[midIndex - 1];
                  const to = route.points[midIndex];
                  const rotation = computeBearing(from, to);
                  const color = getVehicleColor(route.vehicle_id);
                  return (
                    <Marker
                      key={`${route.vehicle_id}-arrow`}
                      position={to}
                      icon={makeArrowIcon(color, rotation)}
                    />
                  );
                })}

                {apiMapRoutes.map(route => {
                  if (!route.points || route.points.length === 0) return null;
                  const [lat, lng] = route.points[0];
                  const color = getVehicleColor(route.vehicle_id);
                  return (
                    <CircleMarker
                      key={`${route.vehicle_id}-marker`}
                      center={[lat, lng]}
                      radius={7}
                      pathOptions={{ color, fillColor: color, fillOpacity: 0.9 }}
                    >
                      <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                        {route.vehicle_id}
                      </Tooltip>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
              {apiError && (
                <div className="absolute bottom-2 right-2 bg-slate-950/70 text-xs text-slate-300 px-2 py-1 rounded-lg">
                  {apiError}
                </div>
              )}
            </div>

            {/* Destination focus + transport options */}
            <div className="mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Destination Focus</p>
                <select
                  value={focusedDestinationId || ''}
                  onChange={(event) => setFocusedDestinationId(event.target.value)}
                  className="bg-white/5 border border-white/10 text-slate-200 text-xs rounded-lg px-3 py-2"
                >
                  {ALL_DESTINATIONS.map(dest => (
                    <option key={dest.id} value={dest.id}>{dest.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <p className="text-xs text-slate-500 mb-2">Optimal Route</p>
                  <div className="space-y-2">
                    {routesForDestination.length > 0 ? (
                      routesForDestination.map(route => (
                        <div key={route.id} className="text-xs text-slate-200">
                          <span className="mono text-emerald-400">{route.vehicleId}</span>
                          <span className="text-slate-400"> · </span>
                          {route.routeStops.map(stop => stop.name).join(' → ')}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">Waiting for requests to this destination.</p>
                    )}
                  </div>
                </div>

                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <p className="text-xs text-slate-500 mb-2">Available Transport</p>
                  <div className="space-y-2">
                    {transportOptions.length > 0 ? (
                      transportOptions.map(option => (
                        <div key={option.id} className="flex items-center justify-between text-xs text-slate-200">
                          <div>
                            <span className="font-semibold">{option.label}</span>
                            <span className="text-slate-400"> · </span>
                            <span className="mono">{option.id}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-emerald-400">{option.availability}</p>
                            <p className="text-slate-500">ETA {option.eta} min</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">No vehicles assigned yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Optimization Results */}
            <div className="space-y-2">
              {(routesForDestination.length > 0 ? routesForDestination : activeRoutesForUI.slice(0, 3)).map((route, i) => (
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
