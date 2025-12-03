/**
 * Salish Sea Stations Map
 * Displays all buoy and tide stations on an interactive Leaflet map
 */

let stationsMap = null;
let markersLayer = null;
let buoyMarkers = {}; // Store buoy markers by ID for easy access
let latestBuoyData = null; // Cache for latest buoy data
let latestWindData = null; // Cache for latest wind station data
let stormSurgeData = null; // Cache for storm surge forecast data
let lightstationMarkers = {}; // Store lightstation markers by ID for easy access
let latestLightstationData = null; // Cache for latest lightstation observations

// Helper function to convert cardinal direction to degrees
function cardinalToDegrees(cardinal) {
  if (!cardinal) return null;
  const directions = {
    'N': 0, 'NORTH': 0,
    'NNE': 22.5, 'NORTH-NORTHEAST': 22.5,
    'NE': 45, 'NORTHEAST': 45,
    'ENE': 67.5, 'EAST-NORTHEAST': 67.5,
    'E': 90, 'EAST': 90,
    'ESE': 112.5, 'EAST-SOUTHEAST': 112.5,
    'SE': 135, 'SOUTHEAST': 135,
    'SSE': 157.5, 'SOUTH-SOUTHEAST': 157.5,
    'S': 180, 'SOUTH': 180,
    'SSW': 202.5, 'SOUTH-SOUTHWEST': 202.5,
    'SW': 225, 'SOUTHWEST': 225,
    'WSW': 247.5, 'WEST-SOUTHWEST': 247.5,
    'W': 270, 'WEST': 270,
    'WNW': 292.5, 'WEST-NORTHWEST': 292.5,
    'NW': 315, 'NORTHWEST': 315,
    'NNW': 337.5, 'NORTH-NORTHWEST': 337.5
  };
  return directions[cardinal.toUpperCase()] ?? null;
}

// Helper function for directional arrows
function getDirectionalArrow(degrees, arrowType = 'wind') {
  if (degrees == null || degrees === '—') return '';

  // Meteorological convention: direction indicates WHERE wind/waves are COMING FROM
  const rotation = arrowType === 'wind' ? degrees : degrees + 90;

  // SVG arrows: wind points down, wave points right
  const svg = arrowType === 'wind'
    ? `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2v12m0 0l-3-3m3 3l3-3" stroke="#004b7c" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 8h12m0 0l-3-3m3 3l-3 3" stroke="#004b7c" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;

  return `<span style="display:inline-block;transform:rotate(${rotation}deg);margin-left:0.3rem;vertical-align:middle;">${svg}</span>`;
}

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

    // Fetch latest wind station data
    try {
      latestWindData = await fetchWithTimeout('/data/latest_wind.json');
      logger.debug('StationsMap', 'Loaded latest wind station data');
    } catch (err) {
      logger.warn('StationsMap', 'Could not fetch latest wind data', err);
    }

    // Fetch storm surge forecast data
    try {
      stormSurgeData = await fetchWithTimeout('/data/storm_surge/combined_forecast.json');
    } catch (err) {
      logger.warn('StationsMap', 'Could not fetch storm surge data', err);
    }

    // Fetch latest lightstation observations
    try {
      latestLightstationData = await fetchWithTimeout('/data/latest_lightstation.json');
      logger.debug('StationsMap', 'Loaded latest lightstation observations');
    } catch (err) {
      logger.warn('StationsMap', 'Could not fetch latest lightstation data', err);
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

    // Add lighthouse station markers
    if (stations.lightstations) {
      const lightstationCount = Object.keys(stations.lightstations).length;
      logger.debug('StationsMap', `Loading ${lightstationCount} lighthouse stations to map...`);
      Object.values(stations.lightstations).forEach(lightstation => {
        addLightstationMarker(lightstation);
      });
    }
  } catch (error) {
    logger.error('StationsMap', 'Error loading stations', error);
    // Fallback to inline station data if fetch fails
    loadFallbackStations();
  }
}

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

/**
 * Create simple tide station SVG icon
 * Purple circle - distinguishes from blue wave markers
 * @returns {string} SVG string
 */
function createTideGaugeSVG() {
  return `
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="#9333ea" stroke="#6b21a8" stroke-width="2"/>
    </svg>
  `;
}

/**
 * Create directional marker with triangular arrow (exact ECharts style match)
 * @param {number} direction - Direction in degrees (meteorological: coming FROM)
 * @param {number} height - Wave height in meters (optional)
 * @param {string} type - 'wave', 'wind-on-wave', or 'wind'
 * @returns {string} HTML for marker
 */
function createDirectionalMarker(direction, height, type) {
  const isWave = type === 'wave';
  const isWind = type === 'wind';
  const arrowColor = isWave ? '#1e88e5' : (isWind ? '#dc2626' : '#718096'); // Blue for waves, red for wind, gray for wind-on-wave

  // Meteorological convention: direction value = where wave/wind is COMING FROM
  // Arrow shows propagation direction (where waves/wind are TRAVELING TO)
  // Arrow SVG points DOWN at rotation=0 (South/180° compass)
  // Direction 0° (from North) → traveling South → arrow down → rotation 0
  // Direction 90° (from East) → traveling West → arrow left → rotation 90
  const rotation = direction;

  // Build label if height/speed is available
  // For waves: show height in meters
  // For wind: show speed in knots
  let valueLabel = '';
  if (height !== null && height !== undefined) {
    if (isWind) {
      // Wind speed in knots (rounded to nearest integer)
      valueLabel = `<div style="
        background: ${arrowColor};
        color: white;
        padding: 2px 5px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: bold;
        white-space: nowrap;
        box-shadow: 0 1px 2px rgba(0,0,0,0.3);
        margin-bottom: 2px;
      ">${Math.round(height)}kt</div>`;
    } else {
      // Wave height in meters
      valueLabel = `<div style="
        background: ${arrowColor};
        color: white;
        padding: 2px 5px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: bold;
        white-space: nowrap;
        box-shadow: 0 1px 2px rgba(0,0,0,0.3);
        margin-bottom: 2px;
      ">${height.toFixed(1)}m</div>`;
    }
  }

  // Use ECharts-style arrow path, fattened for better map visibility
  // Original: 'M0,12 L-4,-8 L0,-6 L4,-8 Z' (width 8)
  // Fattened: 'M0,12 L-5,-8 L0,-5 L5,-8 Z' (width 10)
  // This creates a filled triangular arrow with notch, pointing down by default
  // Scaled up from ECharts symbolSize 16 for better visibility on map
  return `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
      ${valueLabel}
      <div style="transform: rotate(${rotation}deg); transform-origin: center center;">
        <svg width="26" height="30" viewBox="-6 -10 12 24" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5));">
          <path d="M0,12 L-5,-8 L0,-5 L5,-8 Z" fill="${arrowColor}" fill-opacity="0.98" stroke="${arrowColor}" stroke-width="1.5"/>
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
    // TODO: REFACTOR - Data source unification needed
    // ISSUE: Wind stations are split across two data sources:
    //   - EC wind stations: latest_wind.json (CWVF, CWGT, etc.)
    //   - NOAA land/C-MAN: latest_buoy_v2.json (CPMW1, SISW1, COLEB)
    // This creates confusion because:
    //   1. Station type (wind_monitoring_station, land_station, c_man_station) doesn't indicate data source
    //   2. Must check both JSON files for wind station data
    //   3. Field names differ between sources (wind_direction vs wind_direction_deg)
    // SOLUTION: Unify all wind stations into a single latest_wind.json OR clearly separate
    //           station collections (buoys vs wind_stations) in stations.json
    let data = null;
    if (isWaveStation) {
      data = latestBuoyData ? latestBuoyData[buoy.id] : null;
    } else {
      // For wind stations, check both sources (prefer wind data, fall back to buoy data)
      data = (latestWindData && latestWindData[buoy.id]) || (latestBuoyData && latestBuoyData[buoy.id]);
    }

    if (data) {
      // Try multiple possible field names for wave direction
      const waveDirection = data.wave_direction_avg || data.wave_direction_peak || data.wave_direction;
      const waveHeight = data.wave_height_sig;
      // Wind data format differs: wind stations use wind_direction_deg
      const windDirection = data.wind_direction_deg !== undefined ? data.wind_direction_deg : data.wind_direction;

      // For wave stations with wave direction data
      if (isWaveStation && waveDirection !== null && waveDirection !== undefined) {
        // Create directional arrow marker with wave height (BLUE)
        iconHtml = createDirectionalMarker(waveDirection, waveHeight, 'wave');
        // Arrow size: 26x30px (fattened), label adds ~18px height
        iconSize = [26, waveHeight ? 48 : 30];
        // Anchor at center of rotation
        iconAnchor = [13, waveHeight ? 38 : 15];
      }
      // For wave stations without wave direction but with wind direction and wave height
      else if (isWaveStation && waveHeight !== null && waveHeight !== undefined && windDirection !== null && windDirection !== undefined) {
        // Show wind direction with wave height (GRAY)
        iconHtml = createDirectionalMarker(windDirection, waveHeight, 'wind-on-wave');
        iconSize = [26, 48];
        iconAnchor = [13, 38];
      }
      // For non-wave stations with wind direction
      else if (!isWaveStation && windDirection !== null && windDirection !== undefined) {
        // Show red wind direction marker
        // Wind stations use wind_speed_kt, buoys use wind_speed
        const windSpeed = data.wind_speed_kt !== undefined ? data.wind_speed_kt : data.wind_speed;
        iconHtml = createDirectionalMarker(windDirection, windSpeed, 'wind');
        iconSize = [26, windSpeed ? 48 : 30];
        iconAnchor = [13, windSpeed ? 38 : 15];
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

  // Add latest data if available (priority data at top)
  // TODO: REFACTOR - See data source unification note above (line 316)
  let popupData = null;
  if (isWaveStation) {
    popupData = latestBuoyData ? latestBuoyData[buoy.id] : null;
  } else {
    // For wind stations, check both sources
    popupData = (latestWindData && latestWindData[buoy.id]) || (latestBuoyData && latestBuoyData[buoy.id]);
  }

  if (popupData) {
    const data = popupData;
    const obsTime = data.observation_time ? new Date(data.observation_time) : null;

    popupContent += `<div style="background: #f0f8ff; padding: 8px; margin: 8px 0; border-radius: 4px; border-left: 3px solid #0077be;">`;
    popupContent += `<div style="font-weight: 600; margin-bottom: 4px;">Latest Conditions:</div>`;

    // Show wind data (handle both buoy and wind station formats)
    const windSpeed = data.wind_speed_kt !== undefined ? data.wind_speed_kt : data.wind_speed;
    if (windSpeed !== null && windSpeed !== undefined) {
      const windSpeedRounded = Math.round(windSpeed);
      const windGust = data.wind_gust_kt !== undefined ? data.wind_gust_kt : data.wind_gust;
      const windGustRounded = windGust !== null && windGust !== undefined ? Math.round(windGust) : null;
      const windCardinal = data.wind_direction_cardinal || '—';
      const windDir = data.wind_direction_deg !== undefined ? data.wind_direction_deg : data.wind_direction;
      const windDegrees = windDir !== null && windDir !== undefined ? ` (${Math.round(windDir)}°)` : '';
      const windArrow = getDirectionalArrow(windDir, 'wind');
      const gustPart = windGustRounded !== null ? ` G ${windGustRounded}` : '';

      popupContent += `<div><strong>💨 Wind:</strong> ${windCardinal} ${windSpeedRounded}${gustPart} kt${windDegrees} ${windArrow}</div>`;
    }

    // Show wave data with direction
    if (data.wave_height_sig !== null && data.wave_height_sig !== undefined) {
      const waveHeight = data.wave_height_sig.toFixed(1);
      const period = data.wave_period_avg || data.wave_period_peak || null;
      const periodStr = period !== null ? ` @ ${typeof period === 'number' ? period.toFixed(1) + 's' : period}` : '';

      // Check if this is a NOAA buoy with spectral wave data
      const hasSpectralData = (buoy.id === '46087' || buoy.id === '46088' || buoy.id === '46267') &&
                               (data.swell_height !== null || data.wind_wave_height !== null);

      if (hasSpectralData) {
        // Show detailed wave breakdown for NOAA buoys
        popupContent += `<div style="margin: 4px 0;"><strong>🌊 Waves (Spectral):</strong></div>`;
        popupContent += `<div style="margin-left: 8px; font-size: 0.9em;">`;

        // Significant wave (combined)
        popupContent += `<div style="margin: 2px 0;"><em>Combined:</em> ${waveHeight}m${periodStr}</div>`;

        // Wind waves (local chop)
        if (data.wind_wave_height !== null && data.wind_wave_height !== undefined) {
          const windWaveHeight = data.wind_wave_height.toFixed(1);
          const windWavePeriod = data.wind_wave_period !== null ? ` @ ${data.wind_wave_period.toFixed(1)}s` : '';
          const windWaveCardinal = data.wind_wave_direction_cardinal || '';
          const windWaveDeg = data.wind_wave_direction !== null ? ` (${Math.round(data.wind_wave_direction)}°)` : '';
          const windWaveArrow = data.wind_wave_direction !== null ? getDirectionalArrow(data.wind_wave_direction, 'wave') : '';
          const windWaveDir = windWaveCardinal ? `${windWaveCardinal} ` : '';

          popupContent += `<div style="margin: 2px 0;"><em>Wind Wave:</em> ${windWaveDir}${windWaveHeight}m${windWavePeriod}${windWaveDeg} ${windWaveArrow}</div>`;
        }

        // Ocean swell
        if (data.swell_height !== null && data.swell_height !== undefined) {
          const swellHeight = data.swell_height.toFixed(1);
          const swellPeriod = data.swell_period !== null ? ` @ ${data.swell_period.toFixed(1)}s` : '';
          const swellCardinal = data.swell_direction_cardinal || '';
          const swellDeg = data.swell_direction !== null ? ` (${Math.round(data.swell_direction)}°)` : '';
          const swellArrow = data.swell_direction !== null ? getDirectionalArrow(data.swell_direction, 'wave') : '';
          const swellDir = swellCardinal ? `${swellCardinal} ` : '';

          popupContent += `<div style="margin: 2px 0;"><em>Swell:</em> ${swellDir}${swellHeight}m${swellPeriod}${swellDeg} ${swellArrow}</div>`;
        }

        popupContent += `</div>`;
      } else {
        // Standard wave display for non-spectral buoys
        // Match map marker logic: use wave_direction_avg first, then peak, then swell (same as map markers)
        const waveDir = data.wave_direction_avg || data.wave_direction_peak || data.swell_direction || null;

        if (waveDir !== null) {
          // Try to get cardinal direction matching the numeric direction we're using
          let waveCardinal = '';
          if (data.wave_direction_avg && data.wave_direction_avg === waveDir) {
            waveCardinal = data.wave_direction_avg_cardinal || '';
          } else if (data.wave_direction_peak && data.wave_direction_peak === waveDir) {
            waveCardinal = data.wave_direction_peak_cardinal || '';
          } else if (data.swell_direction && data.swell_direction === waveDir) {
            waveCardinal = data.swell_direction_cardinal || '';
          }

          const waveDegrees = ` (${Math.round(waveDir)}°)`;
          const waveArrow = getDirectionalArrow(waveDir, 'wave');
          const dirDisplay = waveCardinal ? `${waveCardinal} ` : '';

          popupContent += `<div><strong>🌊 Wave:</strong> ${dirDisplay}${waveHeight}m${periodStr}${waveDegrees} ${waveArrow}</div>`;
        } else {
          // No direction data available
          popupContent += `<div><strong>🌊 Wave:</strong> ${waveHeight}m${periodStr}</div>`;
        }
      }
    }

    // Show temperatures
    if (data.sea_temp !== null && data.sea_temp !== undefined || data.air_temp !== null && data.air_temp !== undefined) {
      const seaTemp = data.sea_temp !== null && data.sea_temp !== undefined ? data.sea_temp.toFixed(1) : '—';
      const airTemp = data.air_temp !== null && data.air_temp !== undefined ? data.air_temp.toFixed(1) : '—';
      popupContent += `<div><strong>🌡️ Temp:</strong> Sea ${seaTemp}°C | Air ${airTemp}°C</div>`;
    }

    // Show timestamp
    if (obsTime) {
      const timeStr = obsTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Vancouver',
        timeZoneName: 'short'
      });
      popupContent += `<div style="font-size: 0.85em; color: #666; margin-top: 4px;">Updated: ${timeStr}</div>`;
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
    html: createTideGaugeSVG(),
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
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
      timeZone: 'America/Vancouver',
      timeZoneName: 'short'
    });

    popupContent += `<div style="background: #fff3e0; padding: 8px; margin: 8px 0; border-radius: 4px; border-left: 3px solid #ff9800;">`;
    popupContent += `<div style="font-weight: 600; margin-bottom: 4px;">Storm Surge Forecast:</div>`;
    popupContent += `<div><strong>${surgeSign}${surgeForecast.value.toFixed(2)}m</strong></div>`;
    popupContent += `<div style="font-size: 0.85em; color: #666; margin-top: 4px;">Next: ${timeStr}</div>`;
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

// Add lightstation marker to map
function addLightstationMarker(lightstation) {
  // Always use lighthouse icon for lightstations
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
    <a href="/lightstations.html#lightstation-${lightstation.id}" class="view-data-btn" style="display: inline-block; margin-top: 8px; padding: 6px 12px; background: #0077be; color: white; text-decoration: none; border-radius: 4px; font-size: 0.9em;">View Data →</a>
  </div>`;

  marker.bindPopup(popupContent);
  marker.addTo(markersLayer);

  // Store marker reference for later access
  lightstationMarkers[lightstation.id] = marker;
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
