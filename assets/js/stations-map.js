/**
 * Salish Sea Stations Map
 * Displays all buoy and tide stations on an interactive Leaflet map
 */

let stationsMap = null;
let markersLayer = null;
let buoyMarkers = {}; // Store buoy markers by ID for easy access

// Initialize the map
function initStationsMap() {
  // Create map centered on Salish Sea
  stationsMap = L.map('stations-map', {
    center: [49.2, -123.3],
    zoom: 8,
    scrollWheelZoom: true,
    zoomControl: true
  });

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(stationsMap);

  // Create layer group for markers
  markersLayer = L.layerGroup().addTo(stationsMap);

  // Load stations and add markers
  loadStationsAndMarkers();
}

// Load stations.json from the envcan_wave directory
async function loadStationsAndMarkers() {
  try {
    // For now, we'll use the stations data directly
    // In production, you'd fetch from a generated JSON endpoint
    const stations = await fetchWithTimeout('/data/stations.json');

    // Add buoy markers
    if (stations.buoys) {
      Object.values(stations.buoys).forEach(buoy => {
        addBuoyMarker(buoy);
      });
    }

    // Add tide station markers
    if (stations.tides) {
      Object.entries(stations.tides).forEach(([stationKey, tide]) => {
        addTideMarker(tide, stationKey);
      });
    }
  } catch (error) {
    console.error('Error loading stations:', error);
    // Fallback to inline station data if fetch fails
    loadFallbackStations();
  }
}

// Add buoy marker to map
function addBuoyMarker(buoy) {
  // Determine marker icon and type label based on station type
  let markerEmoji = '🌊'; // Default: wave buoy (includes pile-mounted wave stations)
  let typeLabel = 'Wave Buoy';

  if (buoy.type === 'pile_mounted_wave_station') {
    // Keep wave icon since it measures waves
    markerEmoji = '🌊';
    typeLabel = 'Pile-Mounted Wave Station';
  } else if (buoy.type === 'wind_monitoring_station') {
    markerEmoji = '💨';
    typeLabel = 'Wind Monitoring Station';
  }

  const icon = L.divIcon({
    className: `station-marker buoy-marker ${buoy.type || 'wave_buoy'}`,
    html: `<div class="marker-icon">${markerEmoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });

  const marker = L.marker([buoy.lat, buoy.lon], { icon: icon });

  const popupContent = `
    <div class="station-popup">
      <h3>${buoy.name}</h3>
      <p><strong>ID:</strong> ${buoy.id}</p>
      <p><strong>Location:</strong> ${buoy.location}</p>
      <p><strong>Source:</strong> ${buoy.source}</p>
      <p><strong>Type:</strong> ${typeLabel}</p>
      <p><strong>Coordinates:</strong> ${buoy.lat.toFixed(3)}, ${buoy.lon.toFixed(3)}</p>
      <p><strong>Data Types:</strong></p>
      <ul class="data-types-list">
        ${buoy.data_types.slice(0, 5).map(dt => `<li>${dt.replace(/_/g, ' ')}</li>`).join('')}
        ${buoy.data_types.length > 5 ? `<li><em>+ ${buoy.data_types.length - 5} more...</em></li>` : ''}
      </ul>
      <a href="/#buoy-${buoy.id}" class="view-data-btn">View Data →</a>
    </div>
  `;

  marker.bindPopup(popupContent);
  marker.addTo(markersLayer);

  // Store marker reference for later access
  buoyMarkers[buoy.id] = marker;
}

// Add tide station marker to map
function addTideMarker(tide, stationKey) {
  const icon = L.divIcon({
    className: 'station-marker tide-marker',
    html: `<div class="marker-icon">📍</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });

  const marker = L.marker([tide.lat, tide.lon], { icon: icon });

  const hasObservations = tide.series && tide.series.includes('wlo');
  const stationType = hasObservations ? 'Permanent (with observations)' : 'Temporary (predictions only)';

  const popupContent = `
    <div class="station-popup">
      <h3>${tide.name}</h3>
      <p><strong>Code:</strong> ${tide.code}</p>
      <p><strong>Location:</strong> ${tide.location}</p>
      <p><strong>Source:</strong> ${tide.source}</p>
      <p><strong>Type:</strong> ${stationType}</p>
      <p><strong>Coordinates:</strong> ${tide.lat.toFixed(3)}, ${tide.lon.toFixed(3)}</p>
      ${tide.note ? `<p><em>${tide.note}</em></p>` : ''}
      <p><strong>Data Types:</strong></p>
      <ul class="data-types-list">
        ${tide.data_types.map(dt => `<li>${dt.replace(/_/g, ' ')}</li>`).join('')}
      </ul>
      <a href="/tides.html?station=${stationKey}" class="view-data-btn">View Data →</a>
    </div>
  `;

  marker.bindPopup(popupContent);
  marker.addTo(markersLayer);
}

// Fallback station data if fetch fails
function loadFallbackStations() {
  // Hardcoded fallback stations (will be replaced by fetch in production)
  const fallbackBuoys = [
    { id: "4600146", name: "Halibut Bank", location: "Off Vancouver", lat: 49.337, lon: -123.731, source: "Environment Canada", type: "wave_buoy", data_types: ["wave_height", "wind_speed", "air_temp"] },
    { id: "4600303", name: "Southern Georgia Strait", location: "Southern Strait", lat: 48.833, lon: -123.417, source: "Environment Canada", type: "wave_buoy", data_types: ["wave_height", "wind_speed", "air_temp"] },
    { id: "4600304", name: "English Bay", location: "Vancouver Harbor", lat: 49.291, lon: -123.181, source: "Environment Canada", type: "wave_buoy", data_types: ["wave_height", "wind_speed", "air_temp"] },
    { id: "4600131", name: "Sentry Shoal", location: "Northern Strait of Georgia", lat: 49.917, lon: -124.917, source: "Environment Canada", type: "wave_buoy", data_types: ["wave_height", "wind_speed", "air_temp"] },
    { id: "46087", name: "Neah Bay", location: "Cape Flattery, WA", lat: 48.495, lon: -124.728, source: "NOAA NDBC", type: "wave_buoy", data_types: ["wave_height", "wind_speed", "swell_height"] },
    { id: "46088", name: "New Dungeness", location: "Hein Bank", lat: 48.333, lon: -123.167, source: "NOAA NDBC", type: "wave_buoy", data_types: ["wave_height", "wind_speed", "swell_height"] },
    { id: "CRPILE", name: "Crescent Beach Ocean", location: "Crescent Beach, Surrey", lat: 49.0122, lon: -122.9411, source: "Surrey FlowWorks", type: "pile_mounted_wave_station", data_types: ["wave_height", "wind_speed", "air_temp", "sea_temp"] },
    { id: "CRCHAN", name: "Crescent Channel", location: "Boundary Bay Channel Marker", lat: 49.0536, lon: -122.8969, source: "Surrey FlowWorks", type: "pile_mounted_wave_station", data_types: ["wave_height", "wind_speed", "air_temp"] },
    { id: "COLEB", name: "Colebrook", location: "Colebrook Pump House", lat: 49.0858, lon: -122.845, source: "Surrey FlowWorks", type: "wind_monitoring_station", data_types: ["wind_speed", "air_temp"] }
  ];

  const fallbackTides = [
    { code: "07795", name: "Point Atkinson", location: "West Vancouver", lat: 49.3375, lon: -123.253583, source: "DFO IWLS", series: ["wlo", "wlp"], data_types: ["water_level_observed", "water_level_predicted"] },
    { code: "07707", name: "Kitsilano", location: "Vancouver", lat: 49.276583, lon: -123.13936, source: "DFO IWLS", series: ["wlo", "wlp"], data_types: ["water_level_observed", "water_level_predicted"] }
  ];

  fallbackBuoys.forEach(buoy => addBuoyMarker(buoy));
  fallbackTides.forEach(tide => addTideMarker(tide));
}

// Center map on specific buoy and open popup
function centerMapOnBuoy(buoyId) {
  if (!stationsMap || !buoyMarkers[buoyId]) {
    console.warn(`Map or marker not ready for buoy ${buoyId}`);
    return;
  }

  const marker = buoyMarkers[buoyId];
  const latlng = marker.getLatLng();

  // Center map on buoy with animation
  stationsMap.setView(latlng, 10, {
    animate: true,
    duration: 1.0
  });

  // Open popup after centering
  setTimeout(() => {
    marker.openPopup();
  }, 1100);
}

// Make function globally accessible
window.centerMapOnBuoy = centerMapOnBuoy;

// Initialize map when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStationsMap);
} else {
  initStationsMap();
}
