/**
 * Winds Page Map
 * Displays wind stations and buoys with wind data on an interactive Leaflet map
 */

let windsMap = null;
let windMarkersLayer = null;
let windMarkers = {}; // Store markers by ID for easy access

// Helper: Fetch with timeout
async function fetchWithTimeout(url, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Helper: Convert degrees to cardinal direction
function degreesToCardinal(degrees) {
  if (degrees == null) return null;
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

// Helper: Get directional arrow (SVG, rotated to exact degrees)
function getDirectionalArrow(degrees) {
  if (degrees == null || degrees === '—') return '';

  // Meteorological convention: direction indicates WHERE wind is COMING FROM
  const rotation = degrees;

  // SVG wind arrow pointing down
  const svg = `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2v12m0 0l-3-3m3 3l3-3" stroke="#004b7c" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;

  return `<span style="display:inline-block;transform:rotate(${rotation}deg);margin-left:0.3rem;vertical-align:middle;">${svg}</span>`;
}

/**
 * Create directional marker with triangular arrow for map markers
 * @param {number} direction - Direction in degrees (meteorological: coming FROM)
 * @param {number} speed - Wind speed in knots
 * @returns {string} HTML for marker
 */
function createDirectionalMarker(direction, speed) {
  const arrowColor = '#dc2626'; // Red for wind

  // Meteorological convention: direction value = where wind is COMING FROM
  // Arrow shows direction wind is TRAVELING TO
  // Arrow SVG points DOWN at rotation=0 (South/180° compass)
  const rotation = direction;

  // Build speed label if available
  const speedLabel = (speed !== null && speed !== undefined)
    ? `<div style="
        background: ${arrowColor};
        color: white;
        padding: 2px 5px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: bold;
        white-space: nowrap;
        box-shadow: 0 1px 2px rgba(0,0,0,0.3);
        margin-bottom: 2px;
      ">${Math.round(speed)}kt</div>`
    : '';

  return `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
      ${speedLabel}
      <div style="transform: rotate(${rotation}deg); transform-origin: center center;">
        <svg width="26" height="30" viewBox="-6 -10 12 24" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5));">
          <path d="M0,12 L-5,-8 L0,-5 L5,-8 Z" fill="${arrowColor}" fill-opacity="0.98" stroke="${arrowColor}" stroke-width="1.5"/>
        </svg>
      </div>
    </div>
  `;
}

// Initialize the map
function initWindsMap() {
  // Create map centered on Salish Sea
  windsMap = L.map('winds-map', {
    center: [49.2, -123.3],
    zoom: 8,
    scrollWheelZoom: true,
    zoomControl: true
  });

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(windsMap);

  // Create layer group for markers
  windMarkersLayer = L.layerGroup().addTo(windsMap);

  // Load stations and add markers
  loadWindStationsAndMarkers();
}

// Load wind stations and buoys with wind data
async function loadWindStationsAndMarkers() {
  try {
    // Fetch stations metadata, wind station data, and buoy data
    const [stations, windData, buoyData] = await Promise.all([
      fetchWithTimeout('/data/stations.json'),
      fetchWithTimeout('/data/latest_wind.json'),
      fetchWithTimeout('/data/latest_buoy_v2.json')
    ]);

    // Add wind station markers
    if (stations.wind) {
      Object.values(stations.wind).forEach(windStation => {
        const currentData = windData[windStation.id];
        addWindStationMarker(windStation, currentData);
      });
    }

    // Add buoy markers (only those with wind data)
    if (stations.buoys) {
      Object.values(stations.buoys).forEach(buoy => {
        // Check if this buoy has wind data in buoyData
        const currentData = buoyData[buoy.id];
        if (currentData && (currentData.wind_speed != null || currentData.wind_direction != null)) {
          // Convert buoy data format to match wind data format
          const windFormatData = {
            wind_speed_kt: currentData.wind_speed,
            wind_gust_kt: currentData.wind_gust,
            wind_direction_deg: currentData.wind_direction,
            wind_direction_cardinal: currentData.wind_direction_cardinal,
            air_temp_c: currentData.air_temp,
            observation_time: currentData.observation_time,
            stale: currentData.stale
          };
          addBuoyWindMarker(buoy, windFormatData);
        }
      });
    }

  } catch (error) {
    console.error('Error loading wind stations for map:', error);
  }
}

// Add wind station marker to map
function addWindStationMarker(station, currentData) {
  // Create directional marker if we have wind direction data
  let iconHtml = `<div class="marker-icon">💨</div>`;
  let iconSize = [30, 30];
  let iconAnchor = [15, 15];

  if (currentData && !currentData.stale && currentData.wind_direction_deg !== null && currentData.wind_direction_deg !== undefined) {
    const windSpeed = currentData.wind_speed_kt;
    iconHtml = createDirectionalMarker(currentData.wind_direction_deg, windSpeed);
    iconSize = [26, windSpeed ? 48 : 30];
    iconAnchor = [13, windSpeed ? 38 : 15];
  }

  const icon = L.divIcon({
    className: 'station-marker wind-station-marker',
    html: iconHtml,
    iconSize: iconSize,
    iconAnchor: iconAnchor,
    popupAnchor: [0, -15]
  });

  const marker = L.marker([station.lat, station.lon], { icon: icon });

  // Build popup with current wind data
  let popupContent = `<div class="station-popup"><h3>${station.name}</h3>`;

  // Add current wind data if available
  if (currentData && !currentData.stale) {
    popupContent += `<div style="background: #f0f8ff; padding: 8px; margin: 8px 0; border-radius: 4px; border-left: 3px solid #fb8c00;">`;
    popupContent += `<div style="font-weight: 600; margin-bottom: 4px;">Current Wind:</div>`;

    // Wind speed and gust
    if (currentData.wind_speed_kt != null) {
      const windSpeed = Math.round(currentData.wind_speed_kt);
      const windGust = currentData.wind_gust_kt != null ? Math.round(currentData.wind_gust_kt) : null;
      popupContent += `<div><strong>Speed:</strong> ${windSpeed} kt`;
      if (windGust != null) {
        popupContent += ` (gust ${windGust} kt)`;
      }
      popupContent += `</div>`;
    }

    // Wind direction
    if (currentData.wind_direction_deg != null) {
      const arrow = getDirectionalArrow(currentData.wind_direction_deg);
      const cardinal = currentData.wind_direction_cardinal || degreesToCardinal(currentData.wind_direction_deg);
      popupContent += `<div><strong>Direction:</strong> ${cardinal} (${currentData.wind_direction_deg}°) ${arrow}</div>`;
    }

    // Temperature
    if (currentData.air_temp_c != null) {
      popupContent += `<div><strong>Temp:</strong> ${currentData.air_temp_c.toFixed(1)}°C</div>`;
    }

    // Timestamp
    if (currentData.observation_time) {
      const obsTime = new Date(currentData.observation_time);
      const timeStr = obsTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Vancouver'
      });
      popupContent += `<div style="font-size: 0.85em; color: #666; margin-top: 4px;">Updated: ${timeStr} PT</div>`;
    }

    popupContent += `</div>`;
  } else if (currentData && currentData.stale) {
    popupContent += `<div style="background: #fff5f5; padding: 8px; margin: 8px 0; border-radius: 4px; border-left: 3px solid #e53935;">`;
    popupContent += `<div style="color: #c62828; font-weight: 600;">Data stale (>2 hours old)</div>`;
    popupContent += `</div>`;
  }

  // Station details
  popupContent += `
    <div style="font-size: 0.9em; line-height: 1.4; margin-top: 8px;">
      <div><strong>ID:</strong> ${station.id}</div>
      <div><strong>Location:</strong> ${station.location}</div>
      <div><strong>Source:</strong> ${station.source}</div>
      <div><strong>Type:</strong> Weather Station</div>
    </div>
    <a href="#" onclick="selectStationAndShowChart('${station.id}'); return false;" class="view-data-btn" style="display: inline-block; margin-top: 8px; padding: 6px 12px; background: #0077be; color: white; text-decoration: none; border-radius: 4px; font-size: 0.9em;">View Wind Chart →</a>
  </div>`;

  marker.bindPopup(popupContent);
  marker.addTo(windMarkersLayer);

  // Store marker reference
  windMarkers[station.id] = marker;
}

// Add buoy marker with wind data to map
function addBuoyWindMarker(buoy, currentData) {
  // Create directional marker if we have wind direction data
  let iconHtml = `<div class="marker-icon">🌊</div>`;
  let iconSize = [30, 30];
  let iconAnchor = [15, 15];

  if (currentData && !currentData.stale && currentData.wind_direction_deg !== null && currentData.wind_direction_deg !== undefined) {
    const windSpeed = currentData.wind_speed_kt;
    iconHtml = createDirectionalMarker(currentData.wind_direction_deg, windSpeed);
    iconSize = [26, windSpeed ? 48 : 30];
    iconAnchor = [13, windSpeed ? 38 : 15];
  }

  const icon = L.divIcon({
    className: 'station-marker buoy-wind-marker',
    html: iconHtml,
    iconSize: iconSize,
    iconAnchor: iconAnchor,
    popupAnchor: [0, -15]
  });

  const marker = L.marker([buoy.lat, buoy.lon], { icon: icon });

  // Build popup with current wind data
  let popupContent = `<div class="station-popup"><h3>${buoy.name}</h3>`;

  // Add current wind data if available
  if (currentData && !currentData.stale) {
    popupContent += `<div style="background: #f0f8ff; padding: 8px; margin: 8px 0; border-radius: 4px; border-left: 3px solid #0077be;">`;
    popupContent += `<div style="font-weight: 600; margin-bottom: 4px;">Current Wind:</div>`;

    // Wind speed and gust
    if (currentData.wind_speed_kt != null) {
      const windSpeed = Math.round(currentData.wind_speed_kt);
      const windGust = currentData.wind_gust_kt != null ? Math.round(currentData.wind_gust_kt) : null;
      popupContent += `<div><strong>Speed:</strong> ${windSpeed} kt`;
      if (windGust != null) {
        popupContent += ` (gust ${windGust} kt)`;
      }
      popupContent += `</div>`;
    }

    // Wind direction
    if (currentData.wind_direction_deg != null) {
      const arrow = getDirectionalArrow(currentData.wind_direction_deg);
      const cardinal = currentData.wind_direction_cardinal || degreesToCardinal(currentData.wind_direction_deg);
      popupContent += `<div><strong>Direction:</strong> ${cardinal} (${currentData.wind_direction_deg}°) ${arrow}</div>`;
    }

    // Temperature
    if (currentData.air_temp_c != null) {
      popupContent += `<div><strong>Air Temp:</strong> ${currentData.air_temp_c.toFixed(1)}°C</div>`;
    }

    // Timestamp
    if (currentData.observation_time) {
      const obsTime = new Date(currentData.observation_time);
      const timeStr = obsTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Vancouver'
      });
      popupContent += `<div style="font-size: 0.85em; color: #666; margin-top: 4px;">Updated: ${timeStr} PT</div>`;
    }

    popupContent += `</div>`;
  } else if (currentData && currentData.stale) {
    popupContent += `<div style="background: #fff5f5; padding: 8px; margin: 8px 0; border-radius: 4px; border-left: 3px solid #e53935;">`;
    popupContent += `<div style="color: #c62828; font-weight: 600;">Data stale (>2 hours old)</div>`;
    popupContent += `</div>`;
  }

  // Station details
  const typeLabel = buoy.type === 'pile_mounted_wave_station' ? 'Pile-Mounted Wave Station' :
                    buoy.type === 'wind_monitoring_station' ? 'Wind Monitoring Station' :
                    'Wave Buoy';

  popupContent += `
    <div style="font-size: 0.9em; line-height: 1.4; margin-top: 8px;">
      <div><strong>ID:</strong> ${buoy.id}</div>
      <div><strong>Location:</strong> ${buoy.location}</div>
      <div><strong>Source:</strong> ${buoy.source}</div>
      <div><strong>Type:</strong> ${typeLabel}</div>
    </div>
    <a href="#" onclick="selectStationAndShowChart('${buoy.id}'); return false;" class="view-data-btn" style="display: inline-block; margin-top: 8px; padding: 6px 12px; background: #0077be; color: white; text-decoration: none; border-radius: 4px; font-size: 0.9em;">View Wind Chart →</a>
  </div>`;

  marker.bindPopup(popupContent);
  marker.addTo(windMarkersLayer);

  // Store marker reference
  windMarkers[buoy.id] = marker;
}

// Initialize map when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initWindsMap();
  });
} else {
  initWindsMap();
}
