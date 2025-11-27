/**
 * Salish Sea Stations Map
 * Displays all buoy and tide stations on an interactive Leaflet map
 */

let stationsMap = null;
let markersLayer = null;
let buoyMarkers = {}; // Store buoy markers by ID for easy access
let latestBuoyData = null; // Cache for latest buoy data
let stormSurgeData = null; // Cache for storm surge forecast data

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
    // Fetch latest buoy data
    try {
      latestBuoyData = await fetchWithTimeout('/data/latest_buoy_v2.json');
    } catch (err) {
      logger.warn('StationsMap', 'Could not fetch latest buoy data', err);
    }

    // Fetch storm surge forecast data
    try {
      stormSurgeData = await fetchWithTimeout('/data/storm_surge/combined_forecast.json');
    } catch (err) {
      logger.warn('StationsMap', 'Could not fetch storm surge data', err);
    }

    // Fetch stations metadata
    const stations = await fetchWithTimeout('/data/stations.json');

    // Add buoy markers
    if (stations.buoys) {
      Object.values(stations.buoys).forEach(buoy => {
        addBuoyMarker(buoy);
      });
    }

    // Add tide station markers
    if (stations.tides) {
      const tideCount = Object.keys(stations.tides).length;
      logger.debug('StationsMap', `Loading ${tideCount} tide stations to map...`);
      Object.entries(stations.tides).forEach(([stationKey, tide]) => {
        addTideMarker(tide, stationKey);
        logger.debug('StationsMap', `Added tide marker: ${stationKey} (${tide.name})`);
      });
    }

    // Add wind station markers (as buoys since they use same marker type)
    if (stations.wind) {
      const windCount = Object.keys(stations.wind).length;
      logger.debug('StationsMap', `Loading ${windCount} wind stations to map...`);
      Object.values(stations.wind).forEach(windStation => {
        // Wind stations use the same marker function as buoys
        addBuoyMarker({ ...windStation, type: 'weather_station' });
      });
    }
  } catch (error) {
    logger.error('StationsMap', 'Error loading stations', error);
    // Fallback to inline station data if fetch fails
    loadFallbackStations();
  }
}

/**
 * Create directional marker with triangular arrow (exact ECharts style match)
 * @param {number} direction - Direction in degrees (meteorological: coming FROM)
 * @param {number} height - Wave height in meters (optional)
 * @param {string} type - 'wave' or 'wind-on-wave'
 * @returns {string} HTML for marker
 */
function createDirectionalMarker(direction, height, type) {
  const isWave = type === 'wave';
  const arrowColor = isWave ? '#1e88e5' : '#718096'; // Match ECharts blue for waves, gray for wind

  // Meteorological convention: direction value = where wave is COMING FROM
  // Arrow shows propagation direction (where waves are TRAVELING TO)
  // Arrow SVG points DOWN at rotation=0 (South/180° compass)
  // Direction 0° (from North) → traveling South → arrow down → rotation 0
  // Direction 90° (from East) → traveling West → arrow left → rotation 90
  const rotation = direction;

  // Build height label if height is available
  const heightLabel = (height !== null && height !== undefined)
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
      ">${height.toFixed(1)}m</div>`
    : '';

  // Use exact ECharts arrow path from standard wave chart: 'M0,12 L-4,-8 L0,-6 L4,-8 Z'
  // This creates a filled triangular arrow with notch, pointing down by default
  // symbolSize 16 in ECharts - scale up for better visibility on map
  return `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
      ${heightLabel}
      <div style="transform: rotate(${rotation}deg); transform-origin: center center;">
        <svg width="22" height="26" viewBox="-5 -9 10 22" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5));">
          <path d="M0,12 L-4,-8 L0,-6 L4,-8 Z" fill="${arrowColor}" fill-opacity="0.98" stroke="${arrowColor}" stroke-width="1"/>
        </svg>
      </div>
    </div>
  `;
}

// Add buoy marker to map
function addBuoyMarker(buoy) {
  // Determine marker icon and type label based on station type
  let markerEmoji = '🌊'; // Default: wave buoy (includes pile-mounted wave stations)
  let typeLabel = 'Wave Buoy';
  let isWaveStation = true;

  if (buoy.type === 'pile_mounted_wave_station') {
    // Keep wave icon since it measures waves
    markerEmoji = '🌊';
    typeLabel = 'Pile-Mounted Wave Station';
    isWaveStation = true;
  } else if (buoy.type === 'wind_monitoring_station') {
    markerEmoji = '💨';
    typeLabel = 'Wind Monitoring Station';
    isWaveStation = false;
  } else if (buoy.type === 'weather_station') {
    markerEmoji = '💨';
    typeLabel = 'Weather Station';
    isWaveStation = false;
  } else if (buoy.type === 'c_man_station') {
    markerEmoji = '💨';
    typeLabel = 'C-MAN Station';
    isWaveStation = false;
  } else if (buoy.type === 'land_station') {
    markerEmoji = '💨';
    typeLabel = 'Land Station';
    isWaveStation = false;
  }

  // Check if we have live data with direction for this buoy
  let iconHtml = `<div class="marker-icon">${markerEmoji}</div>`;
  let iconSize = [30, 30];
  let iconAnchor = [15, 15];

  try {
    if (latestBuoyData && latestBuoyData[buoy.id]) {
      const data = latestBuoyData[buoy.id];
      // Try multiple possible field names for wave direction
      const waveDirection = data.wave_direction_avg || data.wave_direction_peak || data.wave_direction;
      const waveHeight = data.wave_height_sig;
      const windDirection = data.wind_direction;

      // Debug log for first few buoys to check data
      if (buoy.id === '4600146' || buoy.id === '46087') {
        console.log(`${buoy.id} directions:`, {
          waveDir: waveDirection,
          windDir: windDirection,
          height: waveHeight,
          isWaveStation,
          availableFields: Object.keys(data).filter(k => k.includes('direction'))
        });
      }

      // For wave stations with wave direction data
      if (isWaveStation && waveDirection !== null && waveDirection !== undefined) {
        // Create directional arrow marker with wave height (BLUE)
        iconHtml = createDirectionalMarker(waveDirection, waveHeight, 'wave');
        // Arrow size: 22x26px (scaled up), label adds ~18px height
        iconSize = [22, waveHeight ? 44 : 26];
        // Anchor at center of rotation
        iconAnchor = [11, waveHeight ? 34 : 13];
      }
      // For wave stations without wave direction but with wind direction and wave height
      else if (isWaveStation && waveHeight !== null && waveHeight !== undefined && windDirection !== null && windDirection !== undefined) {
        // Show wind direction with wave height (GRAY)
        iconHtml = createDirectionalMarker(windDirection, waveHeight, 'wind-on-wave');
        iconSize = [22, 44];
        iconAnchor = [11, 34];
      }
      // For non-wave stations with wind direction
      else if (!isWaveStation && windDirection !== null && windDirection !== undefined) {
        // Keep emoji for now, but could show wind direction later
        iconHtml = `<div class="marker-icon">${markerEmoji}</div>`;
      }
    }
  } catch (error) {
    console.error('Error creating directional marker for', buoy.id, error);
    // Fall back to emoji on error
    iconHtml = `<div class="marker-icon">${markerEmoji}</div>`;
    iconSize = [30, 30];
    iconAnchor = [15, 15];
  }

  const icon = L.divIcon({
    className: `station-marker buoy-marker ${buoy.type || 'wave_buoy'}`,
    html: iconHtml,
    iconSize: iconSize,
    iconAnchor: iconAnchor,
    popupAnchor: [0, -15]
  });

  const marker = L.marker([buoy.lat, buoy.lon], { icon: icon });

  // Build popup with latest data at top
  let popupContent = `<div class="station-popup"><h3>${buoy.name}</h3>`;

  // Add latest wave data if available (priority data at top)
  if (latestBuoyData && latestBuoyData[buoy.id]) {
    const data = latestBuoyData[buoy.id];
    const obsTime = data.observation_time ? new Date(data.observation_time) : null;

    popupContent += `<div style="background: #f0f8ff; padding: 8px; margin: 8px 0; border-radius: 4px; border-left: 3px solid #0077be;">`;
    popupContent += `<div style="font-weight: 600; margin-bottom: 4px;">Latest Data:</div>`;

    // Show wave data
    if (data.wave_height_sig !== null && data.wave_height_sig !== undefined) {
      const period = data.wave_period_avg || data.wave_period_peak || '—';
      popupContent += `<div><strong>Wave:</strong> ${data.wave_height_sig.toFixed(1)}m @ ${typeof period === 'number' ? period.toFixed(1) + 's' : period}</div>`;
    }

    // Show timestamp
    if (obsTime) {
      const timeStr = obsTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Vancouver'
      });
      popupContent += `<div style="font-size: 0.85em; color: #666; margin-top: 4px;">Updated: ${timeStr} PT</div>`;
    }

    popupContent += `</div>`;
  }

  // Station details (condensed)
  popupContent += `
    <div style="font-size: 0.9em; line-height: 1.4;">
      <div><strong>ID:</strong> ${buoy.id}</div>
      <div><strong>Location:</strong> ${buoy.location}</div>
      <div><strong>Source:</strong> ${buoy.source}</div>
      <div><strong>Type:</strong> ${typeLabel}</div>
    </div>`;

  // Determine link based on station type
  const isWindStation = buoy.type === 'weather_station' || buoy.type === 'wind_monitoring_station' || buoy.type === 'c_man_station' || buoy.type === 'land_station';
  const linkHref = isWindStation ? `/winds.html#wind-${buoy.id}` : `/#buoy-${buoy.id}`;
  const linkText = isWindStation ? 'View on Winds Page →' : 'View Data →';

  popupContent += `
    <a href="${linkHref}" class="view-data-btn" style="display: inline-block; margin-top: 8px; padding: 6px 12px; background: #0077be; color: white; text-decoration: none; border-radius: 4px; font-size: 0.9em;">${linkText}</a>
  </div>`;

  marker.bindPopup(popupContent);
  marker.addTo(markersLayer);

  // Store marker reference for later access
  buoyMarkers[buoy.id] = marker;
}

// Store tide markers by key for later access
let tideMarkers = {};

// Mapping from tide station keys to storm surge station names
const TIDE_TO_SURGE_MAP = {
  'point_atkinson': 'Point_Atkinson',
  'campbell_river': 'Campbell_River',
  'crescent_pile': 'Crescent_Beach_Channel',
  'tofino': 'Tofino'
};

// Mapping from surge station names to map markers (reverse lookup)
const SURGE_TO_MARKER_MAP = {
  'Point_Atkinson': { type: 'tide', id: 'point_atkinson' },
  'Campbell_River': { type: 'tide', id: 'campbell_river' },
  'Crescent_Beach_Channel': { type: 'tide', id: 'crescent_pile' },
  'Neah_Bay': { type: 'buoy', id: '46087' },
  'New_Dungeness': { type: 'buoy', id: '46088' },
  'Tofino': { type: 'tide', id: 'tofino' }
};

// Get current storm surge forecast for a tide station
function getCurrentSurgeForecast(stationKey) {
  if (!stormSurgeData) return null;

  const surgeStationName = TIDE_TO_SURGE_MAP[stationKey];
  if (!surgeStationName) return null;

  const station = stormSurgeData.stations?.[surgeStationName];
  if (!station || !station.forecast) return null;

  // Find the nearest forecast time (current or next)
  const now = new Date();
  const forecastTimes = Object.keys(station.forecast)
    .map(t => new Date(t))
    .filter(t => t >= now)
    .sort((a, b) => a - b);

  if (forecastTimes.length === 0) return null;

  const nextTime = forecastTimes[0];
  const nextTimeStr = nextTime.toISOString();
  const value = station.forecast[nextTimeStr];

  // Return null if value is invalid
  if (value === null || value === undefined) return null;

  return {
    value: value,
    time: nextTime,
    stationName: station.station_name
  };
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

  // Build popup with storm surge at top if available
  let popupContent = `<div class="station-popup"><h3>${tide.name}</h3>`;

  // Add storm surge forecast if available (priority data at top)
  const surgeForecast = getCurrentSurgeForecast(stationKey);
  if (surgeForecast && surgeForecast.value !== null && surgeForecast.value !== undefined) {
    const surgeSign = surgeForecast.value >= 0 ? '+' : '';
    const timeStr = surgeForecast.time.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Vancouver'
    });

    popupContent += `<div style="background: #fff3e0; padding: 8px; margin: 8px 0; border-radius: 4px; border-left: 3px solid #ff9800;">`;
    popupContent += `<div style="font-weight: 600; margin-bottom: 4px;">Storm Surge Forecast:</div>`;
    popupContent += `<div><strong>${surgeSign}${surgeForecast.value.toFixed(2)}m</strong></div>`;
    popupContent += `<div style="font-size: 0.85em; color: #666; margin-top: 4px;">Next: ${timeStr} PT</div>`;
    popupContent += `</div>`;
  }

  // Station details (condensed)
  popupContent += `
    <div style="font-size: 0.9em; line-height: 1.4;">
      <div><strong>Code:</strong> ${tide.code}</div>
      <div><strong>Location:</strong> ${tide.location}</div>
      <div><strong>Source:</strong> ${tide.source}</div>
      <div><strong>Type:</strong> ${stationType}</div>
      ${tide.note ? `<div style="font-style: italic; margin-top: 4px; color: #666;">${tide.note}</div>` : ''}
    </div>
    <a href="/tides.html?station=${stationKey}" class="view-data-btn" style="display: inline-block; margin-top: 8px; padding: 6px 12px; background: #0077be; color: white; text-decoration: none; border-radius: 4px; font-size: 0.9em;">View Data →</a>
  </div>`;

  marker.bindPopup(popupContent);
  marker.addTo(markersLayer);

  // Store marker reference for later access
  tideMarkers[stationKey] = marker;
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

  const fallbackTides = {
    'point_atkinson': { code: "07795", name: "Point Atkinson", location: "West Vancouver", lat: 49.3375, lon: -123.253583, source: "DFO IWLS", series: ["wlo", "wlp"], data_types: ["water_level_observed", "water_level_predicted"] },
    'kitsilano': { code: "07707", name: "Kitsilano", location: "Vancouver", lat: 49.276583, lon: -123.13936, source: "DFO IWLS", series: ["wlo", "wlp"], data_types: ["water_level_observed", "water_level_predicted"] }
  };

  fallbackBuoys.forEach(buoy => addBuoyMarker(buoy));
  Object.entries(fallbackTides).forEach(([key, tide]) => addTideMarker(tide, key));
}

// Center map on specific buoy and open popup
function centerMapOnBuoy(buoyId, retryCount = 0) {
  if (!stationsMap || !buoyMarkers[buoyId]) {
    // Retry up to 5 times with 500ms delay
    if (retryCount < 5) {
      logger.debug('StationsMap', `Waiting for buoy marker ${buoyId}... (attempt ${retryCount + 1}/5)`);
      setTimeout(() => centerMapOnBuoy(buoyId, retryCount + 1), 500);
      return;
    }
    logger.warn('StationsMap', `Map or marker not ready for buoy ${buoyId}`);
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

// Center map on specific tide station and open popup
function centerMapOnTide(stationKey, retryCount = 0) {
  if (!stationsMap || !tideMarkers[stationKey]) {
    // Retry up to 5 times with 500ms delay
    if (retryCount < 5) {
      logger.debug('StationsMap', `Waiting for tide marker ${stationKey}... (attempt ${retryCount + 1}/5)`);
      setTimeout(() => centerMapOnTide(stationKey, retryCount + 1), 500);
      return;
    }
    logger.warn('StationsMap', `Map or marker not ready for tide station ${stationKey}`);
    return;
  }

  const marker = tideMarkers[stationKey];
  const latlng = marker.getLatLng();

  // Center map on tide station with animation
  stationsMap.setView(latlng, 10, {
    animate: true,
    duration: 1.0
  });

  // Open popup after centering
  setTimeout(() => {
    marker.openPopup();
  }, 1100);
}

// Make functions globally accessible
window.centerMapOnBuoy = centerMapOnBuoy;
window.centerMapOnTide = centerMapOnTide;

// Show selected buoy on map from dropdown
function showSelectedBuoyOnMap(event) {
  event.preventDefault();

  const select = document.getElementById('chart-buoy-select');
  if (!select) return;

  const buoyId = select.value;
  if (!buoyId) return;

  // Center map on selected buoy
  centerMapOnBuoy(buoyId);

  // Scroll to map section smoothly
  const mapSection = document.getElementById('stations-map');
  if (mapSection) {
    mapSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// Make function globally accessible
window.showSelectedBuoyOnMap = showSelectedBuoyOnMap;

// Show selected surge station on map from any dropdown
function showSurgeStationOnMap(surgeStationName, scrollToMap = true) {
  const marker = SURGE_TO_MARKER_MAP[surgeStationName];
  if (!marker) {
    logger.warn('StationsMap', `No map marker found for surge station: ${surgeStationName}`);
    return;
  }

  // Center map on the appropriate marker
  if (marker.type === 'buoy') {
    centerMapOnBuoy(marker.id);
  } else if (marker.type === 'tide') {
    centerMapOnTide(marker.id);
  }

  // Scroll to map section if requested
  if (scrollToMap) {
    const mapSection = document.getElementById('stations-map');
    if (mapSection) {
      mapSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

// Show selected surge station on map from index.html surge selector
function showSelectedSurgeOnMap(event) {
  if (event) event.preventDefault();

  const select = document.getElementById('surge-station-select');
  if (!select || !select.value) return;

  showSurgeStationOnMap(select.value, true);
}

// Show selected surge station on map from storm_surge.html forecast selector
function showSelectedForecastSurgeOnMap() {
  const select = document.getElementById('forecast-station-select');
  if (!select || !select.value) return;

  // Navigate to index.html with surge station in hash
  window.location.href = `/#surge-${select.value}`;
}

// Show selected surge station on map from storm_surge.html hindcast selector
function showSelectedHindcastSurgeOnMap() {
  const select = document.getElementById('hindcast-station-select');
  if (!select || !select.value) return;

  // Navigate to index.html with surge station in hash
  window.location.href = `/#surge-${select.value}`;
}

// Make functions globally accessible
window.showSelectedSurgeOnMap = showSelectedSurgeOnMap;
window.showSelectedForecastSurgeOnMap = showSelectedForecastSurgeOnMap;
window.showSelectedHindcastSurgeOnMap = showSelectedHindcastSurgeOnMap;

// Check URL hash for station to show on map
function checkHashForStation() {
  const hash = window.location.hash;

  if (hash.startsWith('#tide-')) {
    const stationKey = hash.substring(6); // Remove '#tide-'
    // Short delay to ensure map starts initializing, then retry logic kicks in
    setTimeout(() => {
      centerMapOnTide(stationKey);

      // Scroll to map section
      const mapSection = document.getElementById('stations-map');
      if (mapSection) {
        mapSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 500);
  } else if (hash.startsWith('#buoy-')) {
    const buoyId = hash.substring(6); // Remove '#buoy-'
    setTimeout(() => {
      centerMapOnBuoy(buoyId);

      // Scroll to map section
      const mapSection = document.getElementById('stations-map');
      if (mapSection) {
        mapSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 500);
  } else if (hash.startsWith('#surge-')) {
    const surgeStation = hash.substring(7); // Remove '#surge-'
    setTimeout(() => {
      showSurgeStationOnMap(surgeStation, true);
    }, 500);
  }
}

// Initialize map when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initStationsMap();
    checkHashForStation();
  });
} else {
  initStationsMap();
  checkHashForStation();
}
