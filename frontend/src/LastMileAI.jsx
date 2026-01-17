import React, { useState, useEffect, useRef } from 'react';

// All Cyprus locations - comprehensive list
const LOCATIONS = [
  // Major Cities
  { id: 'nicosia', name: 'Nicosia', lat: 35.1856, lng: 33.3823, type: 'city' },
  { id: 'limassol', name: 'Limassol', lat: 34.6786, lng: 33.0413, type: 'city' },
  { id: 'larnaca', name: 'Larnaca', lat: 34.9229, lng: 33.6233, type: 'city' },
  { id: 'paphos', name: 'Paphos', lat: 34.7754, lng: 32.4245, type: 'city' },
  { id: 'ayianapa', name: 'Ayia Napa', lat: 34.9879, lng: 33.9990, type: 'city' },
  { id: 'paralimni', name: 'Paralimni', lat: 35.0384, lng: 33.9823, type: 'city' },
  { id: 'protaras', name: 'Protaras', lat: 35.0125, lng: 34.0583, type: 'city' },
  
  // Troodos Mountain Villages
  { id: 'kakopetria', name: 'Kakopetria', lat: 34.9833, lng: 32.9000, type: 'village' },
  { id: 'platres', name: 'Platres', lat: 34.8897, lng: 32.8639, type: 'village' },
  { id: 'pedoulas', name: 'Pedoulas', lat: 34.9667, lng: 32.8333, type: 'village' },
  { id: 'omodos', name: 'Omodos', lat: 34.8472, lng: 32.8083, type: 'village' },
  { id: 'lefkara', name: 'Lefkara', lat: 34.8667, lng: 33.3000, type: 'village' },
  { id: 'agros', name: 'Agros', lat: 34.9167, lng: 33.0167, type: 'village' },
  { id: 'kalopanayiotis', name: 'Kalopanayiotis', lat: 34.9903, lng: 32.8297, type: 'village' },
  { id: 'fikardou', name: 'Fikardou', lat: 34.9667, lng: 33.1333, type: 'village' },
  { id: 'lofou', name: 'Lofou', lat: 34.8333, lng: 32.7833, type: 'village' },
  { id: 'tochni', name: 'Tochni', lat: 34.7667, lng: 33.3333, type: 'village' },
  { id: 'galata', name: 'Galata', lat: 34.9833, lng: 32.8917, type: 'village' },
  { id: 'moutoullas', name: 'Moutoullas', lat: 34.9833, lng: 32.8417, type: 'village' },
  { id: 'vouni', name: 'Vouni', lat: 34.8833, lng: 32.7667, type: 'village' },
  
  // Beaches
  { id: 'nissi', name: 'Nissi Beach', lat: 34.9875, lng: 34.0028, type: 'beach' },
  { id: 'coral', name: 'Coral Bay', lat: 34.8553, lng: 32.3569, type: 'beach' },
  { id: 'figtree', name: 'Fig Tree Bay', lat: 35.0125, lng: 34.0583, type: 'beach' },
  { id: 'mackenzie', name: 'Mackenzie Beach', lat: 34.8833, lng: 33.6167, type: 'beach' },
  { id: 'ladysmile', name: "Lady's Mile Beach", lat: 34.6333, lng: 33.0167, type: 'beach' },
  { id: 'konnos', name: 'Konnos Bay', lat: 34.9764, lng: 34.0764, type: 'beach' },
  { id: 'lara', name: 'Lara Beach', lat: 35.0597, lng: 32.3017, type: 'beach' },
  { id: 'governors', name: "Governor's Beach", lat: 34.7167, lng: 33.2667, type: 'beach' },
  
  // Archaeological & Cultural Sites
  { id: 'kourion', name: 'Kourion', lat: 34.6647, lng: 32.8872, type: 'archaeological' },
  { id: 'tombs', name: 'Tombs of Kings', lat: 34.7728, lng: 32.4072, type: 'archaeological' },
  { id: 'choirokoitia', name: 'Choirokoitia', lat: 34.7967, lng: 33.3417, type: 'archaeological' },
  { id: 'kolossi', name: 'Kolossi Castle', lat: 34.6653, lng: 32.9336, type: 'archaeological' },
  
  // Points of Interest
  { id: 'troodos', name: 'Troodos Square', lat: 34.9333, lng: 32.8667, type: 'poi' },
  { id: 'kykkos', name: 'Kykkos Monastery', lat: 34.9833, lng: 32.7417, type: 'poi' },
  { id: 'stavrovouni', name: 'Stavrovouni Monastery', lat: 34.8833, lng: 33.4333, type: 'poi' },
  { id: 'caledonia', name: 'Caledonia Waterfalls', lat: 34.8833, lng: 32.8833, type: 'poi' },
  { id: 'millomeris', name: 'Millomeris Waterfalls', lat: 34.8750, lng: 32.8583, type: 'poi' },
  
  // Transport Hubs
  { id: 'larnaca_airport', name: 'Larnaca Airport', lat: 34.8756, lng: 33.6247, type: 'transport' },
  { id: 'paphos_airport', name: 'Paphos Airport', lat: 34.7180, lng: 32.4857, type: 'transport' },
  { id: 'limassol_port', name: 'Limassol Port', lat: 34.6667, lng: 33.0333, type: 'transport' },
];

// Vehicle types based on passenger count
const VEHICLES = {
  small: { name: 'Mini Van', capacity: 4, icon: '🚐', co2: 0.15, color: '#10b981' },
  medium: { name: 'Minibus', capacity: 8, icon: '🚌', co2: 0.22, color: '#3b82f6' },
  large: { name: 'Bus', capacity: 20, icon: '🚎', co2: 0.30, color: '#8b5cf6' },
};

// Calculate straight-line distance (for clustering)
const getDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

// Fetch real road route from OSRM
const fetchRoute = async (stops) => {
  if (stops.length < 2) return null;
  
  // Build coordinates string: lng,lat;lng,lat;...
  const coords = stops.map(s => `${s.lng},${s.lat}`).join(';');
  
  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
    );
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes[0]) {
      return {
        geometry: data.routes[0].geometry.coordinates, // [[lng, lat], ...]
        distance: data.routes[0].distance / 1000, // km
        duration: data.routes[0].duration / 60, // minutes
      };
    }
  } catch (error) {
    console.error('OSRM routing error:', error);
  }
  
  return null;
};

// Select vehicle based on passenger count
const selectVehicle = (passengers) => {
  if (passengers <= 4) return VEHICLES.small;
  if (passengers <= 8) return VEHICLES.medium;
  return VEHICLES.large;
};

export default function LastMileAI() {
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [passengers, setPassengers] = useState(1);
  const [routes, setRoutes] = useState([]);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ total: 0, co2: 0 });
  const [mapReady, setMapReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markers = useRef({});
  const routeLayers = useRef([]);
  
  // Use refs to track current state for event handlers (fixes stale closure)
  const pickupRef = useRef(pickup);
  const destinationRef = useRef(destination);
  
  useEffect(() => {
    pickupRef.current = pickup;
  }, [pickup]);
  
  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  // Initialize map
  useEffect(() => {
    const loadMap = async () => {
      // Add Leaflet CSS
      if (!document.querySelector('link[href*="leaflet"]')) {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(css);
      }

      // Add Leaflet JS
      if (!window.L) {
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = resolve;
          document.body.appendChild(script);
        });
      }

      await new Promise(r => setTimeout(r, 100));

      if (mapRef.current && !mapInstance.current) {
        const L = window.L;
        
        const map = L.map(mapRef.current, { zoomControl: false })
          .setView([34.9, 33.1], 9);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 18,
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        mapInstance.current = map;

        // Add location markers
        LOCATIONS.forEach(loc => {
          const colors = {
            city: '#10b981',
            village: '#f59e0b', 
            beach: '#06b6d4',
            archaeological: '#a855f7',
            poi: '#ec4899',
            transport: '#ef4444'
          };

          const sizes = { city: 14, village: 10, beach: 10, archaeological: 10, poi: 9, transport: 11 };
          const color = colors[loc.type] || '#64748b';
          const size = sizes[loc.type] || 8;

          const icon = L.divIcon({
            className: 'loc-marker',
            html: `<div class="marker" style="
              width:${size}px;height:${size}px;
              background:${color};
              border:2px solid white;
              border-radius:50%;
              box-shadow:0 2px 6px rgba(0,0,0,0.4);
              cursor:pointer;
            "></div>`,
            iconSize: [size, size],
            iconAnchor: [size/2, size/2],
          });

          const marker = L.marker([loc.lat, loc.lng], { icon })
            .bindTooltip(loc.name, { direction: 'top', offset: [0, -8] })
            .addTo(map);

          // Use refs to avoid stale closure
          marker.on('click', () => {
            if (!pickupRef.current) {
              setPickup(loc);
            } else if (!destinationRef.current && loc.id !== pickupRef.current.id) {
              setDestination(loc);
            } else if (loc.id !== pickupRef.current.id) {
              setDestination(loc);
            }
          });
          
          markers.current[loc.id] = marker;
        });

        setMapReady(true);
      }
    };

    loadMap();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Update marker appearance based on selection
  useEffect(() => {
    if (!window.L) return;
    const L = window.L;

    LOCATIONS.forEach(loc => {
      const marker = markers.current[loc.id];
      if (!marker) return;

      const isPickup = pickup?.id === loc.id;
      const isDest = destination?.id === loc.id;
      
      const colors = {
        city: '#10b981', village: '#f59e0b', beach: '#06b6d4',
        archaeological: '#a855f7', poi: '#ec4899', transport: '#ef4444'
      };

      let color = colors[loc.type] || '#64748b';
      let size = loc.type === 'city' ? 14 : 10;

      if (isPickup) { color = '#22c55e'; size = 18; }
      if (isDest) { color = '#ef4444'; size = 18; }

      const icon = L.divIcon({
        className: 'loc-marker',
        html: `<div style="
          width:${size}px;height:${size}px;
          background:${color};
          border:${isPickup || isDest ? 3 : 2}px solid white;
          border-radius:50%;
          box-shadow:0 2px 8px rgba(0,0,0,0.5);
          cursor:pointer;
          ${isPickup || isDest ? 'animation: pulse 1.5s infinite;' : ''}
        "></div>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
      });

      marker.setIcon(icon);
    });
  }, [pickup, destination]);

  // Draw routes on map
  useEffect(() => {
    if (!mapInstance.current || !window.L) return;
    const L = window.L;

    // Clear old routes
    routeLayers.current.forEach(layer => layer.remove());
    routeLayers.current = [];

    // Draw each route
    routes.forEach(route => {
      if (!route.geometry || route.geometry.length < 2) return;

      // Convert [lng, lat] to [lat, lng] for Leaflet
      const latLngs = route.geometry.map(coord => [coord[1], coord[0]]);

      // Draw route line
      const routeLine = L.polyline(latLngs, {
        color: route.vehicle.color,
        weight: 5,
        opacity: 0.8,
      }).addTo(mapInstance.current);

      routeLayers.current.push(routeLine);

      // Add stop markers with numbers
      route.stops.forEach((stop, idx) => {
        const stopMarker = L.marker([stop.lat, stop.lng], {
          icon: L.divIcon({
            className: 'stop-marker',
            html: `<div style="
              width: 24px; height: 24px;
              background: ${route.vehicle.color};
              border: 2px solid white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 12px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            ">${idx + 1}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          })
        }).addTo(mapInstance.current);
        
        stopMarker.bindTooltip(`Stop ${idx + 1}: ${stop.name}`, { direction: 'top' });
        routeLayers.current.push(stopMarker);
      });

      // Animate vehicle along route
      let step = 0;
      const totalSteps = 200;
      
      const vehicleMarker = L.marker(latLngs[0], {
        icon: L.divIcon({
          className: 'vehicle-marker',
          html: `<div style="
            font-size: 28px;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
          ">${route.vehicle.icon}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })
      }).addTo(mapInstance.current);

      routeLayers.current.push(vehicleMarker);

      // Calculate total path length
      let totalLength = 0;
      const segmentLengths = [];
      for (let i = 1; i < latLngs.length; i++) {
        const len = mapInstance.current.distance(latLngs[i-1], latLngs[i]);
        segmentLengths.push(len);
        totalLength += len;
      }

      const animate = () => {
        if (step >= totalSteps) {
          step = 0; // Loop animation
        }
        
        const targetDist = (step / totalSteps) * totalLength;
        let accumulated = 0;
        
        for (let i = 0; i < segmentLengths.length; i++) {
          if (accumulated + segmentLengths[i] >= targetDist) {
            const ratio = (targetDist - accumulated) / segmentLengths[i];
            const lat = latLngs[i][0] + (latLngs[i+1][0] - latLngs[i][0]) * ratio;
            const lng = latLngs[i][1] + (latLngs[i+1][1] - latLngs[i][1]) * ratio;
            vehicleMarker.setLatLng([lat, lng]);
            break;
          }
          accumulated += segmentLengths[i];
        }
        
        step++;
        setTimeout(animate, 30);
      };
      
      animate();
    });
  }, [routes]);

  // Submit request
  const submitRequest = async () => {
    if (!pickup || !destination) return;

    setIsLoading(true);

    const newRequest = {
      id: Math.random().toString(36).substr(2, 8),
      pickup,
      destination,
      passengers,
      time: new Date().toLocaleTimeString(),
    };

    const newRequests = [...requests, newRequest];
    setRequests(newRequests);
    setStats(s => ({ ...s, total: s.total + 1 }));

    // Simple clustering - group by nearby destinations
    const used = new Set();
    const clusters = [];

    newRequests.forEach(req => {
      if (used.has(req.id)) return;

      const cluster = [req];
      used.add(req.id);

      newRequests.forEach(other => {
        if (used.has(other.id)) return;
        const dist = getDistance(req.destination.lat, req.destination.lng, other.destination.lat, other.destination.lng);
        if (dist < 20) {
          cluster.push(other);
          used.add(other.id);
        }
      });

      clusters.push(cluster);
    });

    // Build routes from clusters with real road data
    const newRoutes = await Promise.all(clusters.map(async (cluster) => {
      const totalPass = cluster.reduce((sum, r) => sum + r.passengers, 0);
      const vehicle = selectVehicle(totalPass);

      // Get unique stops
      const pickups = [...new Map(cluster.map(r => [r.pickup.id, r.pickup])).values()];
      const dests = [...new Map(cluster.map(r => [r.destination.id, r.destination])).values()];
      const stops = [...pickups, ...dests];

      // Fetch real road route
      const routeData = await fetchRoute(stops);

      // Calculate CO2 savings
      const dist = routeData ? routeData.distance : stops.reduce((sum, s, i) => {
        if (i === 0) return 0;
        return sum + getDistance(stops[i-1].lat, stops[i-1].lng, s.lat, s.lng);
      }, 0);

      const carCO2 = totalPass * dist * 0.21;
      const busCO2 = dist * vehicle.co2;
      const saved = Math.max(0, carCO2 - busCO2);

      return {
        id: Math.random().toString(36).substr(2, 6),
        stops,
        vehicle,
        passengers: totalPass,
        distance: routeData ? routeData.distance.toFixed(1) : dist.toFixed(1),
        time: routeData ? Math.round(routeData.duration) : Math.round(dist / 45 * 60),
        co2: saved.toFixed(1),
        geometry: routeData ? routeData.geometry : null,
        requests: cluster
      };
    }));

    setRoutes(newRoutes);
    setStats(s => ({ 
      ...s, 
      co2: s.co2 + newRoutes.reduce((sum, r) => sum + parseFloat(r.co2), 0) 
    }));

    // Clear selection for next request
    setPickup(null);
    setDestination(null);
    setPassengers(1);
    setIsLoading(false);
  };

  // Clear everything
  const clearAll = () => {
    setRoutes([]);
    setRequests([]);
    setPickup(null);
    setDestination(null);
    setStats({ total: 0, co2: 0 });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Sidebar */}
      <div style={{ 
        width: '320px', 
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        color: 'white',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', paddingBottom: '16px', borderBottom: '1px solid #334155' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>
            🚐 LastMile.cy
          </h1>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0' }}>
            AI-Powered Transit for Cyprus
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1, background: '#1e293b', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>{stats.total}</div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>REQUESTS</div>
          </div>
          <div style={{ flex: 1, background: '#1e293b', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#06b6d4' }}>{stats.co2.toFixed(1)}</div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>KG CO₂ SAVED</div>
          </div>
        </div>

        {/* Request Form */}
        <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: '#94a3b8' }}>
            NEW REQUEST
          </div>

          {/* Pickup */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>FROM</div>
            <div style={{ 
              padding: '10px', 
              background: pickup ? '#22c55e20' : '#1e293b',
              border: pickup ? '1px solid #22c55e' : '1px solid #334155',
              borderRadius: '6px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ color: '#22c55e' }}>📍</span>
              {pickup ? pickup.name : 'Click a point on map...'}
            </div>
          </div>

          {/* Destination */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>TO</div>
            <div style={{ 
              padding: '10px', 
              background: destination ? '#ef444420' : '#1e293b',
              border: destination ? '1px solid #ef4444' : '1px solid #334155',
              borderRadius: '6px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ color: '#ef4444' }}>🎯</span>
              {destination ? destination.name : 'Click a point on map...'}
            </div>
          </div>

          {/* Passengers */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>PASSENGERS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                onClick={() => setPassengers(Math.max(1, passengers - 1))}
                style={{ 
                  width: '32px', height: '32px', 
                  background: '#334155', border: 'none', borderRadius: '6px',
                  color: 'white', fontSize: '18px', cursor: 'pointer'
                }}
              >-</button>
              <span style={{ fontSize: '20px', fontWeight: 'bold', width: '30px', textAlign: 'center' }}>
                {passengers}
              </span>
              <button 
                onClick={() => setPassengers(Math.min(20, passengers + 1))}
                style={{ 
                  width: '32px', height: '32px', 
                  background: '#334155', border: 'none', borderRadius: '6px',
                  color: 'white', fontSize: '18px', cursor: 'pointer'
                }}
              >+</button>
              <span style={{ fontSize: '12px', color: '#64748b', marginLeft: 'auto' }}>
                {selectVehicle(passengers).icon} {selectVehicle(passengers).name}
              </span>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={submitRequest}
            disabled={!pickup || !destination || isLoading}
            style={{
              width: '100%',
              padding: '12px',
              background: pickup && destination && !isLoading ? 'linear-gradient(135deg, #10b981, #06b6d4)' : '#334155',
              border: 'none',
              borderRadius: '8px',
              color: pickup && destination ? 'white' : '#64748b',
              fontSize: '14px',
              fontWeight: '600',
              cursor: pickup && destination && !isLoading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {isLoading ? (
              <>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                Calculating Route...
              </>
            ) : (
              'Request Transit'
            )}
          </button>

          {/* Clear Selection */}
          <button
            onClick={() => { setPickup(null); setDestination(null); }}
            style={{
              width: '100%',
              padding: '8px',
              background: 'transparent',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#64748b',
              fontSize: '12px',
              cursor: 'pointer',
              marginTop: '8px'
            }}
          >
            Clear Selection
          </button>
        </div>

        {/* Legend */}
        <div style={{ 
          background: '#0f172a', 
          padding: '12px', 
          borderRadius: '8px',
          fontSize: '11px'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '8px', color: '#94a3b8' }}>MAP LEGEND</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {[
              { color: '#10b981', label: 'City' },
              { color: '#f59e0b', label: 'Village' },
              { color: '#06b6d4', label: 'Beach' },
              { color: '#a855f7', label: 'Archaeological' },
              { color: '#ec4899', label: 'POI' },
              { color: '#ef4444', label: 'Transport Hub' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ 
                  width: '8px', height: '8px', 
                  background: item.color, 
                  borderRadius: '50%' 
                }}></div>
                <span style={{ color: '#94a3b8' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Active Routes */}
        {routes.length > 0 && (
          <div style={{ 
            background: '#0f172a', 
            padding: '12px', 
            borderRadius: '8px' 
          }}>
            <div style={{ 
              fontSize: '13px', 
              fontWeight: '600', 
              marginBottom: '10px',
              color: '#94a3b8',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>ACTIVE ROUTES ({routes.length})</span>
              <button 
                onClick={clearAll}
                style={{
                  background: '#ef444430',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  color: '#ef4444',
                  fontSize: '10px',
                  cursor: 'pointer'
                }}
              >
                Clear All
              </button>
            </div>
            
            {routes.map(route => (
              <div key={route.id} style={{ 
                background: '#1e293b', 
                padding: '10px', 
                borderRadius: '6px',
                marginBottom: '8px',
                borderLeft: `3px solid ${route.vehicle.color}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '16px' }}>{route.vehicle.icon}</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{route.passengers} passengers</span>
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                  {route.stops.map((s, i) => (
                    <span key={s.id}>
                      <span style={{ 
                        display: 'inline-block',
                        width: '16px',
                        height: '16px',
                        background: route.vehicle.color,
                        borderRadius: '50%',
                        textAlign: 'center',
                        lineHeight: '16px',
                        fontSize: '10px',
                        color: 'white',
                        marginRight: '4px'
                      }}>{i + 1}</span>
                      {s.name}
                      {i < route.stops.length - 1 && ' → '}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '10px', color: '#64748b' }}>
                  <span>📏 {route.distance} km</span>
                  <span>⏱️ {route.time} min</span>
                  <span style={{ color: '#10b981' }}>🌱 -{route.co2} kg CO₂</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Powered by OSRM */}
        <div style={{ fontSize: '10px', color: '#475569', textAlign: 'center', marginTop: 'auto' }}>
          🛣️ Routes powered by OSRM (OpenStreetMap)
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        
        {/* Instruction overlay */}
        {!pickup && mapReady && (
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(30, 41, 59, 0.95)',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            color: 'white'
          }}>
            <span style={{ color: '#22c55e' }}>📍</span>
            Click to select <strong>pickup</strong> location
          </div>
        )}
        
        {pickup && !destination && (
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(30, 41, 59, 0.95)',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            color: 'white'
          }}>
            <span style={{ color: '#ef4444' }}>🎯</span>
            Now click to select <strong>destination</strong>
          </div>
        )}

        {isLoading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            padding: '20px 30px',
            borderRadius: '12px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 4px 30px rgba(0,0,0,0.5)',
            color: 'white'
          }}>
            <span style={{ fontSize: '24px', animation: 'spin 1s linear infinite', display: 'inline-block' }}>🚐</span>
            Calculating optimal route...
          </div>
        )}
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .leaflet-container {
          background: #0f172a;
        }
      `}</style>
    </div>
  );
}