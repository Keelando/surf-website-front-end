/**
 * BC Lightstation Map
 * Displays all BC lighthouse stations on an interactive Leaflet map
 */

let lightstationMap = null;
let lightstationMarkersLayer = null;
let lightstationMapMarkers = {}; // Store lightstation markers by ID for easy access
let latestLightstationData = null; // Cache for latest lightstation observations

/**
 * Create custom lighthouse SVG icon
 * Classic lighthouse tower with red/white stripes and beacon light
 * @returns {string} SVG string
 */
function createLighthouseSVG() {
  return `
    <svg width="28" height="32" viewBox="0 0 28 32" xmlns="http://www.w3.org/2000/svg">
      <!-- Light beacon rays -->
      <g opacity="0.4">
        <path d="M14 3 L8 0 L10 4 Z" fill="#FFD700"/>
        <path d="M14 3 L20 0 L18 4 Z" fill="#FFD700"/>
        <path d="M14 3 L5 1 L8 5 Z" fill="#FFA500"/>
        <path d="M14 3 L23 1 L20 5 Z" fill="#FFA500"/>
      </g>

      <!-- Lighthouse beacon (top) -->
      <circle cx="14" cy="4" r="2.5" fill="#FFD700" stroke="#FFA500" stroke-width="1"/>

      <!-- Lighthouse tower (tapered) -->
      <!-- White stripe (top) -->
      <path d="M11 7 L10.5 13 L17.5 13 L17 7 Z" fill="#FFFFFF" stroke="#2c3e50" stroke-width="0.5"/>

      <!-- Red stripe -->
      <path d="M10.5 13 L10 19 L18 19 L17.5 13 Z" fill="#E53935" stroke="#2c3e50" stroke-width="0.5"/>

      <!-- White stripe -->
      <path d="M10 19 L9.5 25 L18.5 25 L18 19 Z" fill="#FFFFFF" stroke="#2c3e50" stroke-width="0.5"/>

      <!-- Base (red) -->
      <rect x="8" y="25" width="12" height="4" rx="1" fill="#C62828" stroke="#2c3e50" stroke-width="0.5"/>

      <!-- Foundation -->
      <rect x="6" y="29" width="16" height="2" rx="1" fill="#5D4037" stroke="#3e2723" stroke-width="0.5"/>

      <!-- Light beacon glow -->
      <circle cx="14" cy="4" r="2" fill="#FFEB3B" opacity="0.6"/>
      <circle cx="14" cy="4" r="1.5" fill="#FFF9C4"/>
    </svg>
  `;
}

// Initialize the lightstation map
function initLightstationMap() {
  // Create map centered on Salish Sea and Vancouver Island
  lightstationMap = L.map('lightstation-map', {
    center: [49.5, -125.0], // Center on Salish Sea/Vancouver Island region
    zoom: 7,
    scrollWheelZoom: true,
    zoomControl: true
  });

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(lightstationMap);

  // Create layer group for markers
  lightstationMarkersLayer = L.layerGroup().addTo(lightstationMap);

  // Load lightstation stations and add markers
  loadLightstationsAndMarkers();
}

// Load stations.json and add lightstation markers
async function loadLightstationsAndMarkers() {
  try {
    // Fetch latest lightstation observations
    try {
      const obsResponse = await fetch('/data/latest_lightstation.json');
      latestLightstationData = await obsResponse.json();
      console.log('Loaded latest lightstation observations');
    } catch (err) {
      console.warn('Could not fetch latest lightstation data:', err);
    }

    // Fetch stations metadata
    const response = await fetch('/data/stations.json');
    const stations = await response.json();

    // Add lighthouse station markers
    if (stations.lightstations) {
      const lightstationCount = Object.keys(stations.lightstations).length;
      console.log(`Loading ${lightstationCount} lighthouse stations to map...`);
      Object.values(stations.lightstations).forEach(lightstation => {
        addLightstationMapMarker(lightstation);
      });
    }
  } catch (error) {
    console.error('Error loading lightstation data:', error);
  }
}

// Add lightstation marker to map
function addLightstationMapMarker(lightstation) {
  const icon = L.divIcon({
    className: 'station-marker lightstation-marker',
    html: createLighthouseSVG(),
    iconSize: [28, 32],
    iconAnchor: [14, 32],
    popupAnchor: [0, -32]
  });

  const marker = L.marker([lightstation.lat, lightstation.lon], { icon: icon });

  // Build popup
  let popupContent = `<div class="station-popup"><h3>${lightstation.name}</h3>`;

  // Add latest observations if available
  // Convert station ID (e.g., "ADDENBROKE_ISLAND") to match JSON format (e.g., "ADDENBROKE ISLAND")
  const lookupName = lightstation.id.replace(/_/g, ' ');
  if (latestLightstationData && latestLightstationData[lookupName]) {
    const obs = latestLightstationData[lookupName];

    popupContent += `<div style="background: #f0f8ff; padding: 8px; margin: 8px 0; border-radius: 4px; border-left: 3px solid #0077be;">`;
    popupContent += `<div style="font-weight: 600; margin-bottom: 4px;">Latest Conditions:</div>`;

    // Wind
    if (!obs.wind_calm) {
      const windText = `${obs.wind_direction || 'N/A'} ${obs.wind_speed_kt || 'N/A'} kt${obs.wind_gusting ? ' (gusting)' : ''}${obs.wind_estimated ? ' (est)' : ''}`;
      popupContent += `<div><strong>💨 Wind:</strong> ${windText}</div>`;
    } else {
      popupContent += `<div><strong>💨 Wind:</strong> CALM</div>`;
    }

    // Sea state
    if (obs.sea_height_ft !== null || obs.sea_condition) {
      const seaText = obs.sea_height_ft !== null
        ? `${obs.sea_height_ft} ft ${obs.sea_condition || ''}`
        : obs.sea_condition || 'N/A';
      popupContent += `<div><strong>🌊 Sea:</strong> ${seaText}</div>`;
    }

    // Swell
    if (obs.swell_intensity || obs.swell_direction) {
      const swellText = `${obs.swell_intensity || ''} ${obs.swell_direction || ''} swell`.trim();
      popupContent += `<div><strong>〰️ Swell:</strong> ${swellText || 'N/A'}</div>`;
    }

    // Report time
    if (obs.report_time_str) {
      popupContent += `<div style="font-size: 0.85em; color: #666; margin-top: 4px;">Report: ${obs.report_time_str}</div>`;
    }

    // Staleness warning
    if (obs.stale) {
      popupContent += `<div style="color: #c53030; font-size: 0.85em; margin-top: 4px;">⚠️ Data >6 hours old</div>`;
    }

    popupContent += `</div>`;
  }

  // Station details
  popupContent += `
    <div style="font-size: 0.9em; line-height: 1.4;">
      <div><strong>ID:</strong> ${lightstation.id}</div>
      <div><strong>Location:</strong> ${lightstation.location}</div>
      <div><strong>Region:</strong> ${lightstation.region}</div>
      <div><strong>Source:</strong> ${lightstation.source}</div>
      <div><strong>Type:</strong> Lightstation</div>
      ${lightstation.established ? `<div><strong>Established:</strong> ${lightstation.established}</div>` : ''}
      ${lightstation.notes ? `<div style="font-style: italic; margin-top: 4px; color: #666;">${lightstation.notes}</div>` : ''}
    </div>
    <a href="#lightstation-data-table-section" class="view-data-btn" onclick="viewLightstationData('${lightstation.id}')" style="display: inline-block; margin-top: 8px; padding: 6px 12px; background: #0077be; color: white; text-decoration: none; border-radius: 4px; font-size: 0.9em;">View Data →</a>
  </div>`;

  marker.bindPopup(popupContent);
  marker.addTo(lightstationMarkersLayer);

  // Store marker reference for later access
  lightstationMapMarkers[lightstation.id] = marker;
}

// Center map on specific lightstation and open popup
function centerMapOnLightstation(lightstationId, retryCount = 0) {
  if (!lightstationMap || !lightstationMapMarkers[lightstationId]) {
    // Retry up to 5 times with 500ms delay
    if (retryCount < 5) {
      console.log(`Waiting for lightstation marker ${lightstationId}... (attempt ${retryCount + 1}/5)`);
      setTimeout(() => centerMapOnLightstation(lightstationId, retryCount + 1), 500);
      return;
    }
    console.warn(`Map or marker not ready for lightstation ${lightstationId}`);
    return;
  }

  const marker = lightstationMapMarkers[lightstationId];
  const latlng = marker.getLatLng();

  // Center map on lightstation with animation
  lightstationMap.setView(latlng, 10, {
    animate: true,
    duration: 1.0
  });

  // Open popup after centering
  setTimeout(() => {
    marker.openPopup();
  }, 1100);
}

// Make functions globally accessible
window.centerMapOnLightstation = centerMapOnLightstation;

// Function to view lightstation data (called from map popups)
function viewLightstationData(lightstationId) {
  // Find the lightstation name from the ID
  const select = document.getElementById('lightstation-station-select');
  if (!select) return;

  // Map ID to station name (IDs are uppercase with underscores)
  const stationName = lightstationId.split('_').map(word =>
    word.charAt(0) + word.slice(1).toLowerCase()
  ).join(' ');

  // Select the station in dropdown
  for (let i = 0; i < select.options.length; i++) {
    if (select.options[i].text === stationName) {
      select.value = select.options[i].value;
      break;
    }
  }

  // Trigger chart render if the function exists
  if (typeof window.renderLightstationCharts === 'function') {
    window.renderLightstationCharts(stationName);
  }

  // Scroll to chart section
  const chartSection = document.getElementById('lightstation-data-table-section');
  if (chartSection) {
    chartSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Make function globally accessible
window.viewLightstationData = viewLightstationData;

// Initialize map when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initLightstationMap();
  });
} else {
  initLightstationMap();
}
