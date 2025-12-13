/* =====================================================
   Salish Sea Tide Conditions - Main Logic
   ===================================================== */

let tideCurrentData = null;
let tideTimeseriesData = null;
let tideHighLowData = null;
let combinedWaterLevelData = null;
let stationsMetadata = null;
let tideChart = null;
let currentDayOffset = 0; // 0 = today, 1 = tomorrow, 2 = day after
let currentStationKey = null;

// Station name formatting
const STATION_DISPLAY_NAMES = {
  'point_atkinson': 'Point Atkinson',
  'kitsilano': 'Kitsilano',
  'tsawwassen': 'Tsawwassen',
  'whiterock': 'White Rock',
  'crescent_pile': 'Crescent Beach',
  'crescent_beach_ocean': 'Crescent Beach Ocean (Geodetic)',
  'crescent_channel_ocean': 'Crescent Channel Ocean (Geodetic)',
  'nanaimo': 'Nanoose Bay (Nanaimo)',
  'new_westminster': 'New Westminster',
  'campbell_river': 'Campbell River',
  'tofino': 'Tofino',
  'ucluelet': 'Ucluelet',
  'port_renfrew': 'Port Renfrew',
  'victoria_harbor': 'Victoria Harbor'
};

/* =====================================================
   Data Loading
   ===================================================== */

async function loadTideData() {
  try {
    // Load all tide JSON files plus stations metadata and combined water level
    const [tideCurrentData_temp, tideTimeseriesData_temp, tideHighLowData_temp, combinedWaterLevelData_temp, stationsMetadata_temp] = await Promise.all([
      fetchWithTimeout(`/data/tide-latest.json?t=${Date.now()}`),
      fetchWithTimeout(`/data/tide-timeseries.json?t=${Date.now()}`),
      fetchWithTimeout(`/data/tide-hi-low.json?t=${Date.now()}`),
      fetchWithTimeout(`/data/combined-water-level.json?t=${Date.now()}`).catch(() => null),
      fetchWithTimeout(`/data/stations.json?t=${Date.now()}`).catch(() => null)
    ]);

    tideCurrentData = tideCurrentData_temp;
    tideTimeseriesData = tideTimeseriesData_temp;
    tideHighLowData = tideHighLowData_temp;

    if (combinedWaterLevelData_temp) {
      combinedWaterLevelData = combinedWaterLevelData_temp;
      logger.info('Tides', 'Loaded combined water level data');
    } else {
      logger.warn('Tides', 'Combined water level data not available');
    }

    if (stationsMetadata_temp) {
      stationsMetadata = stationsMetadata_temp.tides || {};
    }

    populateStationDropdown();
    updateTimestamp();

  } catch (error) {
    logger.error('Tides', 'Error loading tide data', error);
    showError();
  }
}

/* =====================================================
   UI Population
   ===================================================== */

function populateStationDropdown() {
  const select = document.getElementById('tide-station-select');
  const selectBottom = document.getElementById('tide-station-select-bottom');

  // Get unique stations from current data (observations only)
  const stations = Object.keys(tideCurrentData.stations || {});

  if (stations.length === 0) {
    select.innerHTML = '<option value="">No stations available</option>';
    if (selectBottom) selectBottom.innerHTML = '<option value="">No stations available</option>';
    return;
  }

  // Separate stations into regular and geodetic
  const regularStations = [];
  const geodeticStations = [];

  stations.forEach(stationKey => {
    const metadata = stationsMetadata?.tides?.[stationKey];
    const isGeodetic = metadata?.type === 'SURREY_FLOWWORKS';

    if (isGeodetic) {
      geodeticStations.push(stationKey);
    } else {
      regularStations.push(stationKey);
    }
  });

  // Sort each group alphabetically
  const sortByName = (a, b) => {
    const nameA = STATION_DISPLAY_NAMES[a] || a;
    const nameB = STATION_DISPLAY_NAMES[b] || b;
    return nameA.localeCompare(nameB);
  };
  regularStations.sort(sortByName);
  geodeticStations.sort(sortByName);

  // Build options HTML with optgroups
  let optionsHTML = '<option value="">-- Select a Station --</option>';

  // Regular chart datum stations
  if (regularStations.length > 0) {
    optionsHTML += '<optgroup label="Chart Datum Stations">';
    regularStations.forEach(stationKey => {
      const metadata = stationsMetadata?.tides?.[stationKey];
      const hasObservations = metadata?.series && metadata.series.includes('wlo');
      const indicator = hasObservations ? ' 📡' : '';
      const displayName = (STATION_DISPLAY_NAMES[stationKey] || stationKey) + indicator;
      optionsHTML += `<option value="${stationKey}">${displayName}</option>`;
    });
    optionsHTML += '</optgroup>';
  }

  // Geodetic stations
  if (geodeticStations.length > 0) {
    optionsHTML += '<optgroup label="Geodetic Stations (CGVD28)">';
    geodeticStations.forEach(stationKey => {
      const displayName = (STATION_DISPLAY_NAMES[stationKey] || stationKey) + ' 📊';
      optionsHTML += `<option value="${stationKey}" class="geodetic-station">${displayName}</option>`;
    });
    optionsHTML += '</optgroup>';
  }

  // Populate both dropdowns
  select.innerHTML = optionsHTML;
  if (selectBottom) selectBottom.innerHTML = optionsHTML;

  // Add change listener to top dropdown
  select.addEventListener('change', (e) => {
    if (e.target.value) {
      displayStation(e.target.value);
      // Sync bottom dropdown
      if (selectBottom) selectBottom.value = e.target.value;
    } else {
      hideStation();
      if (selectBottom) selectBottom.value = '';
    }
  });

  // Add change listener to bottom dropdown
  if (selectBottom) {
    selectBottom.addEventListener('change', (e) => {
      if (e.target.value) {
        displayStation(e.target.value);
        // Sync top dropdown
        select.value = e.target.value;
      } else {
        hideStation();
        select.value = '';
      }
    });
  }

  // Check for URL parameter first
  const urlParams = new URLSearchParams(window.location.search);
  const stationParam = urlParams.get('station');

  // If station parameter exists and is valid, use it; otherwise default to Point Atkinson
  if (stationParam && stations.includes(stationParam)) {
    select.value = stationParam;
    if (selectBottom) selectBottom.value = stationParam;
    displayStation(stationParam);
  } else if (stations.includes('point_atkinson')) {
    select.value = 'point_atkinson';
    if (selectBottom) selectBottom.value = 'point_atkinson';
    displayStation('point_atkinson');
  }
}

/* =====================================================
   Station Display
   ===================================================== */

function displayStation(stationKey) {
  const section = document.getElementById('tide-current-section');
  const loading = document.getElementById('tide-loading');
  const error = document.getElementById('tide-error');

  // Hide loading/error
  loading.style.display = 'none';
  error.style.display = 'none';

  // Save current station and reset day offset
  currentStationKey = stationKey;
  currentDayOffset = 0;

  // Get station data
  const currentStation = tideCurrentData.stations[stationKey];
  const highlowStation = tideHighLowData.stations[stationKey];

  // Update station name in all locations
  const stationName = STATION_DISPLAY_NAMES[stationKey] || stationKey;
  document.getElementById('station-name').textContent = stationName;
  document.getElementById('highlow-station-name').textContent = stationName;
  document.getElementById('chart-station-name').textContent = stationName;

  // Display station metadata
  displayStationMetadata(stationKey);

  // Display current observation
  displayCurrentObservation(currentStation);

  // Display current prediction (also from currentStation which has prediction_now)
  displayCurrentPrediction(currentStation);

  // Display storm surge
  displayStormSurge(currentStation);

  // Display high/low table (for current day)
  displayHighLowTable(highlowStation, currentDayOffset);

  // Show the section first (so chart can measure properly)
  section.style.display = 'block';

  // Setup day navigation buttons
  setupDayNavigation();

  // Display tide chart after section is visible
  displayTideChart(stationKey, currentDayOffset);
}

function hideStation() {
  document.getElementById('tide-current-section').style.display = 'none';
  document.getElementById('tide-loading').style.display = 'block';
}

/* =====================================================
   Station Metadata Display
   ===================================================== */

function displayStationMetadata(stationKey) {
  const container = document.getElementById('station-metadata');

  if (!stationsMetadata || !stationsMetadata[stationKey]) {
    container.innerHTML = '';
    return;
  }

  const metadata = stationsMetadata[stationKey];

  // Check if station has observations by looking at series array
  const hasObservations = metadata.series && metadata.series.includes('wlo');
  const isPermanent = metadata.type === 'PERMANENT';

  // Determine badge based on observation capability
  const typeClass = hasObservations ? 'station-type-permanent' : 'station-type-temporary';
  const typeLabel = hasObservations ? '📡 Real-Time Observations' : '📊 Predictions Only';

  container.innerHTML = `
    <div class="metadata-item">
      <span class="station-type-badge ${typeClass}">${typeLabel}</span>
    </div>
    <div class="metadata-item">
      <strong>Code:</strong> <span>${metadata.code}</span>
    </div>
    <div class="metadata-item">
      <strong>📍 Coordinates:</strong> <span>${metadata.lat.toFixed(4)}°N, ${Math.abs(metadata.lon).toFixed(4)}°W</span>
    </div>
    <div class="metadata-item">
      <strong>Location:</strong> <span>${metadata.location}</span>
    </div>
  `;
}

/* =====================================================
   Current Observation Display
   ===================================================== */

function displayCurrentObservation(station) {
  const container = document.getElementById('current-observation');

  if (!station || !station.observation || station.observation.value === null) {
    // Check if this station has observations at all (in timeseries data)
    const stationKey = Object.keys(tideCurrentData.stations).find(key => tideCurrentData.stations[key] === station);
    const hasObservations = tideTimeseriesData?.stations?.[stationKey]?.has_observations || false;

    if (!hasObservations) {
      container.innerHTML = `
        <div style="padding: 1rem; background: #fff3e0; border-radius: 4px; border-left: 4px solid #ff9800;">
          <div style="font-weight: bold; color: #f57c00; margin-bottom: 0.5rem;">
            📊 Predictions Only
          </div>
          <div style="color: #666; font-size: 0.9rem;">
            This station provides astronomical tide predictions but does not have real-time water level sensors.
          </div>
        </div>
      `;
    } else {
      container.innerHTML = '<p style="color: #999;">No recent observation available</p>';
    }
    return;
  }

  const obs = station.observation;
  const observedLevel = obs.value.toFixed(2);
  const obsTime = new Date(obs.time);
  const timeStr = formatTime(obsTime);
  const ageStr = getAgeString(obsTime);
  const isStale = obs.stale || false;

  container.innerHTML = `
    <div style="font-size: 1.5rem; font-weight: bold; color: ${isStale ? '#e53935' : '#43a047'};">
      ${observedLevel} m
    </div>
    <div style="color: #666; margin-top: 0.25rem; font-size: 0.9rem;">
      at ${timeStr}
      <span style="color: ${isStale ? '#e53935' : '#999'};">(${ageStr})</span>
    </div>
    ${isStale ? '<div style="color: #e53935; margin-top: 0.25rem; font-size: 0.85rem;">⚠ Data may be stale</div>' : ''}
  `;
}

/* =====================================================
   Current Prediction Display
   ===================================================== */

function displayCurrentPrediction(station) {
  const container = document.getElementById('current-prediction');

  if (!station || !station.prediction_now || station.prediction_now.value === null) {
    container.innerHTML = '<p style="color: #999;">No prediction available</p>';
    return;
  }

  const pred = station.prediction_now;
  const tideLevel = pred.value.toFixed(2);
  const predTime = new Date(pred.time);
  const timeStr = formatTime(predTime);

  // Determine tide direction (rising, falling, slack)
  let tideDirection = '';
  let tideArrow = '';
  if (pred.trend) {
    if (pred.trend === 'rising') {
      tideDirection = 'Rising';
      tideArrow = '↗️';
    } else if (pred.trend === 'falling') {
      tideDirection = 'Falling';
      tideArrow = '↘️';
    } else if (pred.trend === 'slack') {
      tideDirection = 'Slack';
      tideArrow = '→';
    }
  }

  // Get next high/low event
  let nextEventHtml = '';
  if (tideHighLowData && tideHighLowData.stations && currentStationKey) {
    const stationEvents = tideHighLowData.stations[currentStationKey];
    if (stationEvents && stationEvents.events) {
      const now = Date.now();
      const futureEvents = stationEvents.events.filter(e => new Date(e.time).getTime() > now);
      if (futureEvents.length > 0) {
        const nextEvent = futureEvents[0];

        // Only display if we have valid event data
        if (nextEvent.time && nextEvent.type && nextEvent.value != null) {
          const eventTime = new Date(nextEvent.time);
          const eventTimeStr = eventTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'America/Vancouver'
          });
          const eventType = nextEvent.type === 'high' ? 'High' : 'Low';
          const eventHeight = nextEvent.value.toFixed(2);

          // Calculate time remaining
          const msUntil = eventTime.getTime() - Date.now();
          const minutesUntil = Math.floor(msUntil / 60000);
          const hoursUntil = Math.floor(minutesUntil / 60);
          const remainingMinutes = minutesUntil % 60;

          let timeUntilStr = '';
          if (hoursUntil > 0) {
            timeUntilStr = `in ${hoursUntil}h ${remainingMinutes}m`;
          } else if (minutesUntil > 0) {
            timeUntilStr = `in ${minutesUntil}m`;
          } else {
            timeUntilStr = 'now';
          }

          // Try to find storm surge forecast at this time for combined water level
          let combinedWaterLevel = null;
          if (combinedWaterLevelData && combinedWaterLevelData.stations && combinedWaterLevelData.stations[currentStationKey]) {
            const stationData = combinedWaterLevelData.stations[currentStationKey];
            if (stationData.forecast) {
              // Find forecast entry closest to the event time
              const eventTimeTs = eventTime.getTime();
              let closestForecast = null;
              let minDiff = Infinity;

              stationData.forecast.forEach(f => {
                const forecastTime = new Date(f.time).getTime();
                const diff = Math.abs(forecastTime - eventTimeTs);
                if (diff < minDiff && diff < 900000) { // Within 15 minutes
                  minDiff = diff;
                  closestForecast = f;
                }
              });

              if (closestForecast && closestForecast.total_water_level_m != null) {
                combinedWaterLevel = closestForecast.total_water_level_m.toFixed(2);
              }
            }
          }

          nextEventHtml = `
            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #eee; font-size: 0.85rem;">
              <div style="color: #666;">
                Next ${eventType} Tide: <strong style="color: #0077be;">${eventHeight} m</strong>
                ${combinedWaterLevel ? `<span style="color: #9c27b0; font-weight: 600;">(${combinedWaterLevel} m total)</span>` : ''}
                <span style="color: #43a047; font-weight: 600;">${timeUntilStr}</span>
                <span style="color: #999;">(${eventTimeStr})</span>
              </div>
            </div>
          `;
        }
      }
    }
  }

  container.innerHTML = `
    <div>
      <div style="font-size: 1.5rem; font-weight: bold; color: #0077be;">
        ${tideLevel} m ${tideArrow}
      </div>
      <div style="color: #666; margin-top: 0.25rem; font-size: 0.9rem;">
        at ${timeStr}${tideDirection ? ` <span style="color: #0077be;">(${tideDirection})</span>` : ''}
      </div>
    </div>
    ${nextEventHtml}
  `;
}

/* =====================================================
   Storm Surge Display
   ===================================================== */

function displayStormSurge(station) {
  const container = document.getElementById('storm-surge');

  // Check if we have tide_offset (actual observed residual with matched timestamps)
  if (station && station.tide_offset && station.tide_offset.value !== null) {
    const offset = station.tide_offset.value;
    const offsetStr = offset >= 0 ? `+${offset.toFixed(2)}` : offset.toFixed(2);
    const color = Math.abs(offset) > 0.3 ? '#e53935' : (Math.abs(offset) > 0.15 ? '#ff9800' : '#43a047');

    // Format the calculation time
    const calcTime = new Date(station.tide_offset.observation_time);
    const calcTimeStr = formatTime(calcTime);

    // Check if we also have ECCC forecast surge for comparison
    const forecastSurge = station.observation?.surge || station.prediction_now?.surge;
    let forecastHtml = '';
    if (forecastSurge !== null && forecastSurge !== undefined) {
      const forecastStr = forecastSurge >= 0 ? `+${forecastSurge.toFixed(3)}` : forecastSurge.toFixed(3);
      forecastHtml = `
        <div style="color: #666; margin-top: 0.5rem; font-size: 0.85rem;">
          ECCC Forecast: <strong style="color: #ff9800;">${forecastStr} m</strong>
        </div>
      `;
    }

    container.innerHTML = `
      <div style="font-size: 1.5rem; font-weight: bold; color: ${color};">
        ${offsetStr} m
      </div>
      <div style="color: #666; margin-top: 0.25rem; font-size: 0.9rem;">
        Observed - Predicted
      </div>
      <div style="color: #999; margin-top: 0.25rem; font-size: 0.85rem;">
        Calculated at ${calcTimeStr}
      </div>
      ${forecastHtml}
      <div style="color: #999; margin-top: 0.25rem; font-size: 0.8rem;">
        ${station.tide_offset.description}
      </div>
    `;
    return;
  }

  // Fall back to storm surge forecast from combined water level data
  // (used for geodetic stations and others without tide_offset)
  let surge = null;
  let surgeTime = null;

  // First try to get current surge from combined water level data
  if (combinedWaterLevelData && combinedWaterLevelData.stations && combinedWaterLevelData.stations[currentStationKey]) {
    const stationData = combinedWaterLevelData.stations[currentStationKey];
    const forecast = stationData.forecast || [];

    // Find forecast closest to now
    const now = new Date();
    let closestForecast = null;
    let minDiff = Infinity;

    for (const point of forecast) {
      const pointTime = new Date(point.time);
      const diff = Math.abs(pointTime - now);
      if (diff < minDiff) {
        minDiff = diff;
        closestForecast = point;
      }
    }

    if (closestForecast && closestForecast.storm_surge_m !== null && closestForecast.storm_surge_m !== undefined) {
      surge = closestForecast.storm_surge_m;
      surgeTime = new Date(closestForecast.time);
    }
  }

  // Fall back to prediction_now.surge if available
  if (!surge && station && station.prediction_now && station.prediction_now.surge !== null && station.prediction_now.surge !== undefined) {
    surge = station.prediction_now.surge;
    surgeTime = new Date(station.prediction_now.time);
  }

  if (surge === null) {
    container.innerHTML = '<p style="color: #999;">No storm surge data available</p>';
    return;
  }

  const timeStr = formatTime(surgeTime);

  // Calculate today's peak from forecast data
  let peakHtml = '';
  if (combinedWaterLevelData && combinedWaterLevelData.stations && combinedWaterLevelData.stations[currentStationKey]) {
    const stationData = combinedWaterLevelData.stations[currentStationKey];
    const forecast = stationData.forecast || [];

    if (forecast.length > 0) {
      // Get today's date range in Pacific time
      const now = new Date();
      const pacificNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Vancouver' }));
      const todayStart = new Date(pacificNow);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(pacificNow);
      todayEnd.setHours(23, 59, 59, 999);

      // Filter forecast for today only and find peak
      let todayPeak = null;
      forecast.forEach(entry => {
        const entryTime = new Date(entry.time);
        const pacificEntryTime = new Date(entryTime.toLocaleString('en-US', { timeZone: 'America/Vancouver' }));

        // Check if this entry is today
        if (pacificEntryTime >= todayStart && pacificEntryTime <= todayEnd) {
          if (!todayPeak || entry.total_water_level_m > todayPeak.total_water_level_m) {
            todayPeak = entry;
          }
        }
      });

      if (todayPeak) {
        const peakTime = new Date(todayPeak.time);
        const peakTimeStr = peakTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Vancouver'
        });

        peakHtml = `
          <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #ddd;">
            <div style="font-size: 0.9rem; color: #666; margin-bottom: 0.75rem;">
              <strong>Today's Peak Tide Forecast</strong>
            </div>
            <div style="font-size: 0.95rem; line-height: 1.6;">
              Today's forecasted peak water level is
              <strong style="color: #9c27b0; font-size: 1.1rem;">${todayPeak.total_water_level_m.toFixed(2)} m</strong>
              with a storm surge of
              <strong style="color: #ff9800;">${todayPeak.storm_surge_m >= 0 ? '+' : ''}${todayPeak.storm_surge_m.toFixed(3)} m</strong>
              at <strong style="color: #0077be;">${peakTimeStr}</strong>.
            </div>
          </div>
        `;
      }
    }
  }

  container.innerHTML = `
    <div>
      <div style="font-size: 1.5rem; font-weight: bold; color: #ff9800;">
        ${surge >= 0 ? '+' : ''}${surge.toFixed(3)} m
      </div>
      <div style="color: #666; margin-top: 0.25rem; font-size: 0.9rem;">
        Current (at ${timeStr})
      </div>
    </div>
    ${peakHtml}
  `;
}

/* =====================================================
   High/Low Table Display
   ===================================================== */

function displayHighLowTable(station, dayOffset = 0) {
  const tbody = document.querySelector('#highlow-table tbody');

  if (!station || !station.events || station.events.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="color: #999; text-align: center;">No high/low data available</td></tr>';
    return;
  }

  // Calculate target day in Pacific timezone
  const pacific = 'America/Vancouver';
  const now = new Date();
  const targetDay = new Date(now);
  targetDay.setDate(now.getDate() + dayOffset);

  // Get target day string in Pacific timezone (YYYY-MM-DD)
  const targetDateStr = new Date(targetDay.toLocaleString('en-US', { timeZone: pacific }))
    .toISOString()
    .split('T')[0];

  // Filter events for the target day
  const eventsForDay = station.events.filter(event => {
    // event.date is in format "YYYY-MM-DD" (Pacific time)
    return event.date === targetDateStr;
  });

  if (eventsForDay.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="color: #999; text-align: center;">No high/low data available for this day</td></tr>';
    return;
  }

  // Sort events by time
  const events = [...eventsForDay].sort((a, b) => new Date(a.time) - new Date(b.time));

  // Build table rows
  tbody.innerHTML = events.map(event => {
    const timeStr = event.time_display; // Use pre-formatted time from JSON
    const height = event.value.toFixed(2);
    const type = event.type.charAt(0).toUpperCase() + event.type.slice(1);
    const typeColor = event.type === 'high' ? '#0077be' : '#e53935';

    return `
      <tr>
        <td style="font-weight: bold;">${timeStr}</td>
        <td>${height} m</td>
        <td style="color: ${typeColor}; font-weight: bold;">${type}</td>
      </tr>
    `;
  }).join('');
}

/* =====================================================
   Day Navigation
   ===================================================== */

function setupDayNavigation() {
  const prevBtn = document.getElementById('prev-day-btn');
  const nextBtn = document.getElementById('next-day-btn');

  // Remove existing listeners by cloning
  const newPrevBtn = prevBtn.cloneNode(true);
  const newNextBtn = nextBtn.cloneNode(true);
  prevBtn.replaceWith(newPrevBtn);
  nextBtn.replaceWith(newNextBtn);

  // Add new listeners
  newPrevBtn.addEventListener('click', () => {
    if (currentDayOffset > 0) {
      currentDayOffset--;
      updateChartForDay();
    }
  });

  newNextBtn.addEventListener('click', () => {
    if (currentDayOffset < 2) {
      currentDayOffset++;
      updateChartForDay();
    }
  });

  updateDayLabel();
  updateNavigationButtons();
}

function updateChartForDay() {
  if (currentStationKey) {
    displayTideChart(currentStationKey, currentDayOffset);
    updateDayLabel();
    updateNavigationButtons();

    // Also update the high/low table for the selected day
    const highlowStation = tideHighLowData?.stations?.[currentStationKey];
    if (highlowStation) {
      displayHighLowTable(highlowStation, currentDayOffset);
    }
  }
}

function updateDayLabel() {
  const label = document.getElementById('chart-date-label');
  const pacific = 'America/Vancouver';
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + currentDayOffset);

  const dateStr = targetDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: pacific
  });

  if (currentDayOffset === 0) {
    label.textContent = `Today (${dateStr})`;
  } else if (currentDayOffset === 1) {
    label.textContent = `Tomorrow (${dateStr})`;
  } else {
    label.textContent = dateStr;
  }
}

function updateNavigationButtons() {
  const prevBtn = document.getElementById('prev-day-btn');
  const nextBtn = document.getElementById('next-day-btn');

  prevBtn.disabled = currentDayOffset === 0;
  nextBtn.disabled = currentDayOffset === 2;

  prevBtn.style.opacity = currentDayOffset === 0 ? '0.3' : '1';
  nextBtn.style.opacity = currentDayOffset === 2 ? '0.3' : '1';
  prevBtn.style.cursor = currentDayOffset === 0 ? 'not-allowed' : 'pointer';
  nextBtn.style.cursor = currentDayOffset === 2 ? 'not-allowed' : 'pointer';
}

/* =====================================================
   Tide Chart Display
   ===================================================== */

function displayTideChart(stationKey, dayOffset = 0) {
  const chartContainer = document.getElementById('tide-chart');

  if (!chartContainer) return;

  // Initialize chart if needed
  if (!tideChart) {
    tideChart = echarts.init(chartContainer);
  }

  // Calculate target day range (Pacific timezone)
  const pacific = 'America/Vancouver';
  const now = new Date();

  // Calculate the target date (add dayOffset to current date)
  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + dayOffset);

  // Format the target date in Pacific timezone to get year/month/day
  const pacificYear = parseInt(targetDate.toLocaleString('en-US', { timeZone: pacific, year: 'numeric' }));
  const pacificMonth = parseInt(targetDate.toLocaleString('en-US', { timeZone: pacific, month: 'numeric' }));
  const pacificDay = parseInt(targetDate.toLocaleString('en-US', { timeZone: pacific, day: 'numeric' }));

  // Create a date string for this Pacific day
  const targetDateStr = `${pacificYear}-${String(pacificMonth).padStart(2, '0')}-${String(pacificDay).padStart(2, '0')}`;

  // Helper function to get a Date object for midnight Pacific time on a given date
  function getPacificMidnight(year, month, day) {
    // Try PST (UTC-8, which is UTC+8 hours for midnight)
    let testDate = new Date(Date.UTC(year, month - 1, day, 8, 0, 0, 0));
    let testHour = parseInt(testDate.toLocaleString('en-US', {
      timeZone: pacific,
      hour: 'numeric',
      hour12: false
    }));

    // If it's midnight, we found it
    if (testHour === 0) return testDate;

    // Otherwise try PDT (UTC-7, which is UTC+7 hours for midnight)
    testDate = new Date(Date.UTC(year, month - 1, day, 7, 0, 0, 0));
    return testDate;
  }

  // Get midnight Pacific for the start and end of the target day
  const dayStart = getPacificMidnight(pacificYear, pacificMonth, pacificDay);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000); // Add 24 hours

  // Helper function to filter data by day
  function filterByDay(dataArray, timeKey) {
    return dataArray.filter(item => {
      const itemDate = new Date(item[timeKey]);
      return itemDate >= dayStart && itemDate < dayEnd;
    });
  }

  // Get astronomical tide predictions and observations
  let predictions = [];
  let observations = [];

  // Always try to use tide-timeseries.json first (now contains 3 days of data)
  const stationData = tideTimeseriesData?.stations?.[stationKey];

  if (!stationData) {
    if (tideChart) {
      tideChart.dispose();
      tideChart = null;
    }
    chartContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No tide data available for this station</p>';
    return;
  }

  // Filter predictions for the target day
  predictions = filterByDay(stationData.predictions || [], 'time');

  // Only include observations for today (dayOffset === 0)
  if (dayOffset === 0) {
    observations = filterByDay(stationData.observations || [], 'time');
  }

  if (predictions.length === 0) {
    if (tideChart) {
      tideChart.dispose();
      tideChart = null;
    }
    chartContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No prediction data available for this day</p>';
    return;
  }

  const times = predictions.map(p => new Date(p.time));
  const values = predictions.map(p => p.value);
  const obsTimes = observations.map(o => new Date(o.time));
  const obsValues = observations.map(o => o.value);

  // Get residuals from timeseries data (pre-calculated for geodetic stations)
  let residuals = [];
  if (stationData.residuals && stationData.residuals.length > 0 && dayOffset === 0) {
    // Filter residuals for the target day
    residuals = filterByDay(stationData.residuals, 'time').map(r => [
      new Date(r.time),
      r.value
    ]);
  }

  // Get combined water level data if available (for all days including today)
  // Skip total water level for geodetic stations (CGVD28 datum makes it not useful)
  let combinedData = [];
  let surgeData = [];
  let hasCombinedData = false;

  // Detect geodetic stations by station_id prefix (Surrey stations start with "surrey_")
  const isGeodetic = stationData.station_id?.startsWith('surrey_');

  if (combinedWaterLevelData && combinedWaterLevelData.stations && combinedWaterLevelData.stations[stationKey]) {
    const stationCombined = combinedWaterLevelData.stations[stationKey];
    const forecast = stationCombined.forecast || [];

    // Filter by day
    const filteredCombined = forecast.filter(item => {
      const itemDate = new Date(item.time);
      return itemDate >= dayStart && itemDate <= dayEnd;
    });

    // Only show total water level for DFO stations (Chart Datum)
    // Geodetic stations (CGVD28) - total water level is not meaningful due to datum mismatch
    if (!isGeodetic) {
      combinedData = filteredCombined.map(item => [
        new Date(item.time),
        item.total_water_level_m
      ]);
    }

    // Show storm surge for all stations
    surgeData = filteredCombined.map(item => [
      new Date(item.time),
      item.storm_surge_m
    ]);

    hasCombinedData = combinedData.length > 0 || surgeData.length > 0;
  }

  // Chart options
  const option = {
    tooltip: {
      trigger: 'axis',
      confine: true,  // Keep tooltip within chart bounds
      position: function (point, params, dom, rect, size) {
        // point: [x, y] position of mouse
        // size: { contentSize: [width, height], viewSize: [width, height] }
        const chartWidth = size.viewSize[0];
        const chartHeight = size.viewSize[1];
        const tooltipWidth = size.contentSize[0];
        const tooltipHeight = size.contentSize[1];

        // Default position is to the right of the point
        let x = point[0] + 10;
        let y = point[1] - tooltipHeight / 2;

        // If tooltip would go off the right edge, position it to the left
        if (x + tooltipWidth > chartWidth) {
          x = point[0] - tooltipWidth - 10;
        }

        // If tooltip would go off the bottom, position it above
        if (y + tooltipHeight > chartHeight) {
          y = chartHeight - tooltipHeight - 10;
        }

        // If tooltip would go off the top, position it below
        if (y < 0) {
          y = 10;
        }

        // If tooltip would go off the left edge (shouldn't happen but just in case)
        if (x < 0) {
          x = 10;
        }

        return [x, y];
      },
      formatter: function(params) {
        const date = new Date(params[0].value[0]);
        const timeStr = date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'America/Vancouver'
        });
        let result = `${timeStr}<br/>`;
        params.forEach(param => {
          const value = param.value[1];
          if (value !== null && value !== undefined) {
            result += `${param.marker} ${param.seriesName}: ${value.toFixed(3)} m<br/>`;
          }
        });
        return result;
      }
    },
    legend: {
      data: (() => {
        let legendItems = ['Astronomical Tide', 'Observation'];
        if (residuals.length > 0) {
          legendItems.push('Residual (Obs - Pred)');
        }
        if (hasCombinedData) {
          legendItems.push('Storm Surge (Forecast)', 'Total Water Level (Forecast)');
        }
        return legendItems;
      })(),
      bottom: getResponsiveLegendBottom(),
      textStyle: { fontSize: 10 }
    },
    grid: {
      left: window.innerWidth < 600 ? '8%' : '8%',
      right: window.innerWidth < 600 ? '4%' : '6%',
      top: '10%',
      bottom: '22%',
      containLabel: true
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        formatter: function(value, index) {
          const date = new Date(value);
          const hour = date.toLocaleString('en-US', {
            hour: '2-digit',
            hour12: false,
            timeZone: 'America/Vancouver'
          });

          // Show full date at midnight (00h) or first label
          if (hour === '00' || index === 0) {
            const monthDay = date.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              timeZone: 'America/Vancouver'
            });
            return `${monthDay} ${hour}h`;
          }

          // Otherwise just show hour
          return `${hour}h`;
        },
        hideOverlap: true,
        interval: window.innerWidth < 600 ? 'auto' : 'auto',
        fontSize: window.innerWidth < 600 ? 9 : 10,
        rotate: window.innerWidth < 600 ? 25 : 0
      },
      splitLine: { show: true, lineStyle: { color: "#eee" } }
    },
    yAxis: {
      type: 'value',
      name: window.innerWidth < 600 ? 'height (meters)' : 'Height (m)',
      nameLocation: 'middle',
      nameGap: window.innerWidth < 600 ? 25 : 45,
      nameTextStyle: {
        fontSize: window.innerWidth < 600 ? 9 : 12
      }
    },
    series: [
      {
        name: 'Astronomical Tide',
        type: 'line',
        data: times.map((t, i) => [t, values[i]]),
        smooth: true,
        lineStyle: {
          color: '#0077be',
          width: 2
        },
        itemStyle: {
          color: '#0077be'
        },
        showSymbol: false
      }
    ]
  };

  // Add observations if available (only show for today)
  if (observations.length > 0 && dayOffset === 0) {
    option.series.push({
      name: 'Observation',
      type: 'scatter',
      data: obsTimes.map((t, i) => [t, obsValues[i]]),
      itemStyle: {
        color: '#43a047'
      },
      symbolSize: 6,
      z: 10
    });
  }

  // Add residuals series for geodetic stations
  if (residuals.length > 0 && dayOffset === 0) {
    option.series.push({
      name: 'Residual (Obs - Pred)',
      type: 'line',
      data: residuals,
      smooth: false,
      lineStyle: {
        color: '#e53935',
        width: 2,
        type: 'dashed'
      },
      itemStyle: {
        color: '#e53935'
      },
      showSymbol: true,
      symbolSize: 4,
      z: 8
    });

    // Add a zero reference line for residuals
    option.series.push({
      name: 'Zero Reference',
      type: 'line',
      data: [[times[0], 0], [times[times.length - 1], 0]],
      lineStyle: {
        color: '#999',
        width: 1,
        type: 'dotted'
      },
      showSymbol: false,
      silent: true,
      z: 1
    });
  }

  // Add storm surge and combined water level series
  if (hasCombinedData) {
    // Storm surge series (small but useful to see the component)
    option.series.push({
      name: 'Storm Surge (Forecast)',
      type: 'line',
      data: surgeData,
      smooth: true,
      lineStyle: {
        color: '#ff9800',
        width: 2
      },
      itemStyle: {
        color: '#ff9800'
      },
      showSymbol: false
    });

    // Total water level series (tide + surge)
    option.series.push({
      name: 'Total Water Level (Forecast)',
      type: 'line',
      data: combinedData,
      smooth: true,
      lineStyle: {
        color: '#9c27b0',
        width: 3
      },
      itemStyle: {
        color: '#9c27b0'
      },
      showSymbol: false,
      z: 5
    });
  }

  // Clear existing chart data and render fresh (fixes day navigation issues)
  tideChart.clear();
  tideChart.setOption(option);

  // Force resize to ensure proper dimensions
  setTimeout(() => {
    if (tideChart) {
      tideChart.resize();
    }
  }, 100);
}

/* =====================================================
   Utility Functions
   ===================================================== */

function formatTime(date) {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Vancouver'
  });
}

function getAgeString(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

function updateTimestamp() {
  const timestampEl = document.getElementById('timestamp');
  if (!timestampEl) return;

  const now = new Date();
  timestampEl.textContent = `Last updated: ${now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Vancouver'
  })}`;
}

function showError() {
  document.getElementById('tide-loading').style.display = 'none';
  document.getElementById('tide-current-section').style.display = 'none';
  document.getElementById('tide-error').style.display = 'block';
}

// Show selected tide station on map (navigates to index.html)
function showSelectedTideOnMap() {
  const select = document.getElementById('tide-station-select');
  if (!select || !select.value) return;

  const stationKey = select.value;

  // Map geodetic tide stations to their wave station IDs
  const geodeticToWaveMap = {
    'crescent_beach_ocean': 'CRPILE',
    'crescent_channel_ocean': 'CRCHAN'
  };

  // If it's a geodetic station, show the wave station marker instead
  if (geodeticToWaveMap[stationKey]) {
    window.location.href = `/#${geodeticToWaveMap[stationKey]}`;
  } else {
    // Regular tide station
    window.location.href = `/#tide-${stationKey}`;
  }
}

// Make function globally accessible
window.showSelectedTideOnMap = showSelectedTideOnMap;

/* =====================================================
   Initialization
   ===================================================== */

// Load data on page load - wait for HTMX to load footer with timestamp
document.addEventListener('htmx:load', function() {
  loadTideData();
}, { once: true });

// Auto-refresh every 5 minutes
setInterval(loadTideData, 5 * 60 * 1000);

// Handle window resize for chart
window.addEventListener('resize', () => {
  if (tideChart) {
    tideChart.resize();
  }
});