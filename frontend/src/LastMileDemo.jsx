import React, { useState, useEffect } from 'react';

// Cyprus locations data
const CITIES = [
  { id: 'nicosia', name: 'Nicosia', lat: 35.1856, lng: 33.3823 },
  { id: 'limassol', name: 'Limassol', lat: 34.6786, lng: 33.0413 },
  { id: 'larnaca', name: 'Larnaca', lat: 34.9229, lng: 33.6233 },
  { id: 'paphos', name: 'Paphos', lat: 34.7754, lng: 32.4245 },
];

const DESTINATIONS = [
  { id: 'kakopetria', name: 'Kakopetria', type: 'village', region: 'Troodos' },
  { id: 'platres', name: 'Platres', type: 'village', region: 'Troodos' },
  { id: 'lefkara', name: 'Lefkara', type: 'village', region: 'Larnaca' },
  { id: 'omodos', name: 'Omodos', type: 'village', region: 'Limassol' },
  { id: 'nissi', name: 'Nissi Beach', type: 'beach', region: 'Famagusta' },
  { id: 'coral', name: 'Coral Bay', type: 'beach', region: 'Paphos' },
  { id: 'kourion', name: 'Kourion', type: 'archaeological', region: 'Limassol' },
];

// Generate random ride request
const generateRequest = () => {
  const origin = CITIES[Math.floor(Math.random() * CITIES.length)];
  const dest = DESTINATIONS[Math.floor(Math.random() * DESTINATIONS.length)];
  return {
    id: Math.random().toString(36).substr(2, 6).toUpperCase(),
    origin: origin.name,
    destination: dest.name,
    destType: dest.type,
    passengers: Math.floor(Math.random() * 4) + 1,
    status: 'pending',
    eta: Math.floor(Math.random() * 15) + 5,
  };
};

// Simulate route optimization
const optimizeRoutes = (requests) => {
  const routes = [];
  const grouped = {};
  
  requests.forEach(req => {
    const key = req.destType;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(req);
  });
  
  Object.entries(grouped).forEach(([type, reqs], i) => {
    const totalPassengers = reqs.reduce((sum, r) => sum + r.passengers, 0);
    routes.push({
      id: `LM-${String(i + 1).padStart(3, '0')}`,
      stops: [...new Set(reqs.map(r => r.destination))],
      passengers: totalPassengers,
      distance: Math.floor(Math.random() * 40) + 20,
      co2Saved: (totalPassengers * 2.1).toFixed(1),
      efficiency: Math.min(100, Math.floor((totalPassengers / 8) * 100)),
    });
  });
  
  return routes;
};

export default function LastMileDemo() {
  const [requests, setRequests] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [stats, setStats] = useState({ requests: 0, co2: 0, vehicles: 3 });
  const [selectedOrigin, setSelectedOrigin] = useState('');
  const [selectedDest, setSelectedDest] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Auto-generate requests
  useEffect(() => {
    const interval = setInterval(() => {
      if (requests.length < 8) {
        const newReq = generateRequest();
        setRequests(prev => [...prev, newReq]);
        setStats(prev => ({ ...prev, requests: prev.requests + 1 }));
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [requests.length]);

  // Auto-optimize when enough requests
  useEffect(() => {
    if (requests.filter(r => r.status === 'pending').length >= 4) {
      setIsOptimizing(true);
      setTimeout(() => {
        const optimized = optimizeRoutes(requests);
        setRoutes(optimized);
        setRequests(prev => prev.map(r => ({ ...r, status: 'assigned' })));
        const totalCo2 = optimized.reduce((sum, r) => sum + parseFloat(r.co2Saved), 0);
        setStats(prev => ({ ...prev, co2: prev.co2 + totalCo2 }));
        setIsOptimizing(false);
      }, 1500);
    }
  }, [requests]);

  const handleRequest = () => {
    if (selectedOrigin && selectedDest) {
      const newReq = {
        id: Math.random().toString(36).substr(2, 6).toUpperCase(),
        origin: selectedOrigin,
        destination: selectedDest,
        destType: DESTINATIONS.find(d => d.name === selectedDest)?.type || 'village',
        passengers: 1,
        status: 'pending',
        eta: Math.floor(Math.random() * 10) + 5,
      };
      setRequests(prev => [...prev, newReq]);
      setStats(prev => ({ ...prev, requests: prev.requests + 1 }));
      setSelectedOrigin('');
      setSelectedDest('');
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: 'white', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '48px', 
              height: '48px', 
              borderRadius: '12px', 
              background: 'linear-gradient(135deg, #10b981, #06b6d4)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              🚐
            </div>
            <div>
              <h1 style={{ 
                fontSize: '24px', 
                fontWeight: 'bold', 
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                margin: 0
              }}>
                LastMile.cy
              </h1>
              <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>AI-Powered Demand-Responsive Transit</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#1e293b', padding: '8px 16px', borderRadius: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', animation: 'pulse 2s infinite' }}></div>
            <span style={{ color: '#10b981', fontSize: '14px', fontFamily: 'monospace' }}>LIVE</span>
          </div>
        </div>

        {/* Stats Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {[
            { icon: '👥', label: 'Total Requests', value: stats.requests, color: '#10b981' },
            { icon: '🚐', label: 'Active Vehicles', value: stats.vehicles, color: '#06b6d4' },
            { icon: '🌱', label: 'CO₂ Saved (kg)', value: stats.co2.toFixed(1), color: '#22c55e' },
            { icon: '⏱️', label: 'Avg Wait (min)', value: '12', color: '#f59e0b' },
          ].map((stat, i) => (
            <div key={i} style={{ 
              backgroundColor: 'rgba(30, 41, 59, 0.5)', 
              borderRadius: '12px', 
              padding: '16px', 
              border: '1px solid #334155' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '8px', 
                  backgroundColor: `${stat.color}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px'
                }}>
                  {stat.icon}
                </div>
                <div>
                  <p style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace', margin: 0 }}>{stat.value}</p>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          {/* Request Panel */}
          <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', padding: '24px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📍 Request a Ride
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Pickup City</label>
                <select 
                  value={selectedOrigin}
                  onChange={(e) => setSelectedOrigin(e.target.value)}
                  style={{ 
                    width: '100%', 
                    backgroundColor: '#334155', 
                    border: '1px solid #475569', 
                    borderRadius: '8px', 
                    padding: '12px', 
                    color: 'white',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select city...</option>
                  {CITIES.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Destination</label>
                <select
                  value={selectedDest}
                  onChange={(e) => setSelectedDest(e.target.value)}
                  style={{ 
                    width: '100%', 
                    backgroundColor: '#334155', 
                    border: '1px solid #475569', 
                    borderRadius: '8px', 
                    padding: '12px', 
                    color: 'white',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select destination...</option>
                  {DESTINATIONS.map(d => (
                    <option key={d.id} value={d.name}>{d.name} ({d.type})</option>
                  ))}
                </select>
              </div>
              
              <button
                onClick={handleRequest}
                disabled={!selectedOrigin || !selectedDest}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '12px', 
                  fontWeight: '600',
                  border: 'none',
                  cursor: selectedOrigin && selectedDest ? 'pointer' : 'not-allowed',
                  background: selectedOrigin && selectedDest 
                    ? 'linear-gradient(135deg, #10b981, #06b6d4)' 
                    : '#334155',
                  color: selectedOrigin && selectedDest ? 'white' : '#64748b',
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
              >
                🚐 Request Smart Ride
              </button>
            </div>
          </div>

          {/* Optimized Routes */}
          <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', padding: '24px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🛣️ Optimized Routes
              {isOptimizing && (
                <span style={{ 
                  marginLeft: 'auto', 
                  fontSize: '12px', 
                  backgroundColor: 'rgba(245, 158, 11, 0.2)', 
                  color: '#f59e0b', 
                  padding: '4px 8px', 
                  borderRadius: '9999px'
                }}>
                  AI Optimizing...
                </span>
              )}
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {routes.length === 0 ? (
                <p style={{ color: '#64748b', textAlign: 'center', padding: '32px 0' }}>Waiting for requests to optimize...</p>
              ) : (
                routes.map((route) => (
                  <div key={route.id} style={{ backgroundColor: 'rgba(51, 65, 85, 0.5)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontFamily: 'monospace', color: '#06b6d4' }}>{route.id}</span>
                        <p style={{ fontSize: '14px', color: '#94a3b8', margin: '4px 0 0 0' }}>{route.stops.join(' → ')}</p>
                      </div>
                      <span style={{ color: '#10b981', fontFamily: 'monospace', fontSize: '14px' }}>-{route.co2Saved}kg 🌱</span>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#64748b' }}>
                      <span>👥 {route.passengers}</span>
                      <span>📍 {route.distance}km</span>
                      <span>⚡ {route.efficiency}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Request Queue */}
          <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', padding: '24px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📋 Live Request Queue
              <span style={{ 
                marginLeft: 'auto', 
                fontSize: '12px', 
                backgroundColor: '#334155', 
                padding: '4px 8px', 
                borderRadius: '9999px',
                fontFamily: 'monospace'
              }}>
                {requests.length}
              </span>
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
              {requests.slice(-6).reverse().map((req) => (
                <div 
                  key={req.id}
                  style={{ 
                    padding: '12px', 
                    borderRadius: '8px', 
                    border: '1px solid',
                    backgroundColor: req.status === 'pending' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    borderColor: req.status === 'pending' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '500', fontSize: '14px' }}>{req.origin} → {req.destination}</span>
                    <span style={{ 
                      fontSize: '12px', 
                      padding: '2px 8px', 
                      borderRadius: '9999px',
                      fontFamily: 'monospace',
                      backgroundColor: req.status === 'pending' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                      color: req.status === 'pending' ? '#f59e0b' : '#10b981'
                    }}>
                      {req.status === 'pending' ? 'MATCHING' : 'ASSIGNED'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#64748b' }}>
                    <span>👥 {req.passengers}</span>
                    <span>⏱️ ~{req.eta}min</span>
                    <span style={{ fontFamily: 'monospace' }}>{req.id}</span>
                  </div>
                </div>
              ))}
              
              {requests.length === 0 && (
                <p style={{ textAlign: 'center', color: '#64748b', padding: '32px 0' }}>Waiting for ride requests...</p>
              )}
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div style={{ marginTop: '32px', backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', padding: '24px', border: '1px solid #334155' }}>
          <h2 style={{ 
            fontSize: '20px', 
            fontWeight: 'bold', 
            marginBottom: '16px',
            background: 'linear-gradient(135deg, #10b981, #06b6d4)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            How Our AI Works
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
            {[
              { step: '01', title: 'Collect Requests', desc: 'Users request rides to remote destinations' },
              { step: '02', title: 'RL Clustering', desc: 'Deep Q-Network clusters by destination region' },
              { step: '03', title: 'Route Optimization', desc: 'PPO agent optimizes multi-stop routes' },
              { step: '04', title: 'Smart Dispatch', desc: 'Vehicles dispatched with max efficiency' },
            ].map((item, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <span style={{ fontSize: '48px', fontWeight: 'bold', color: '#1e293b', position: 'absolute', top: '-8px', left: '-4px' }}>{item.step}</span>
                <div style={{ position: 'relative', zIndex: 10, paddingTop: '16px' }}>
                  <h3 style={{ fontWeight: '600', color: '#10b981', margin: '0 0 4px 0' }}>{item.title}</h3>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '24px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
          <p>Cyprus Transport Hackathon 2026 • Built with 💚 for Cyprus</p>
        </div>
      </div>
      
      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
