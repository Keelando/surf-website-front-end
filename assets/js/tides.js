/* =====================================================
   Salish Sea Tide Conditions - Main Logic
   ===================================================== */

let tideCurrentData = null;
let tideTimeseriesData = null;
let tideHighLowData = null;
let tideChart = null;

// Station name formatting
const STATION_DISPLAY_NAMES = {
  'point_atkinson': 'Point Atkinson',
  'kitsilano': 'Kitsilano',
  'vancouver': 'Vancouver',
  'vancouver_harbour': 'Vancouver Harbour',
  'tsawwassen': 'Tsawwassen',
  'whiterock': 'White Rock',
  'crescent_pile': 'Crescent Beach',
  'nanaimo': 'Nanaimo',
  'new_westminster': 'New Westminster',
  'campbell_river': 'Campbell River'
};

/* =====================================================
   Data Loading
   ===================================================== */

async function loadTideData() {
  try {
    // Load all three tide JSON files
    const [currentRes, timeseriesRes, highlowRes] = await Promise.all([
      fetch(`/data/tide-latest.json?t=${Date.now()}`),
      fetch(`/data/tide-timeseries.json?t=${Date.now()}`),
      fetch(`/data/tide-hi-low.json?t=${Date.now()}`)
    ]);

    if (!currentRes.ok || !timeseriesRes.ok || !highlowRes.ok) {
      throw new Error('Failed to fetch tide data');
    }

    tideCurrentData = await currentRes.json();
    tideTimeseriesData = await timeseriesRes.json();
    tideHighLowData = await highlowRes.json();

    populateStationDropdown();
    updateTimestamp();

  } catch (error) {
    console.error('Error loading tide data:', error);
    showError();
  }
}

/* =====================================================
   UI Population
   ===================================================== */

function populateStationDropdown() {
  const select = document.getElementById('tide-station-select');
  
  // Get unique stations from current data (observations only)
  const stations = Object.keys(tideCurrentData.stations || {});
  
  if (stations.length === 0) {
    select.innerHTML = '<option value="">No stations available</option>';
    return;
  }

  // Sort stations alphabetically by display name
  stations.sort((a, b) => {
    const nameA = STATION_DISPLAY_NAMES[a] || a;
    const nameB = STATION_DISPLAY_NAMES[b] || b;
    return nameA.localeCompare(nameB);
  });

  // Populate dropdown
  select.innerHTML = '<option value="">-- Select a Station --</option>';
  stations.forEach(stationKey => {
    const option = document.createElement('option');
    option.value = stationKey;
    option.textContent = STATION_DISPLAY_NAMES[stationKey] || stationKey;
    select.appendChild(option);
  });

  // Add change listener
  select.addEventListener('change', (e) => {
    if (e.target.value) {
      displayStation(e.target.value);
    } else {
      hideStation();
    }
  });

  // Set Point Atkinson as default and load its data
  if (stations.includes('point_atkinson')) {
    select.value = 'point_atkinson';
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

  // Get station data
  const currentStation = tideCurrentData.stations[stationKey];
  const highlowStation = tideHighLowData.stations[stationKey];

  // Update station name
  const stationName = STATION_DISPLAY_NAMES[stationKey] || stationKey;
  document.getElementById('station-name').textContent = stationName;

  // Display current observation
  displayCurrentObservation(currentStation);

  // Display current prediction (also from currentStation which has prediction_now)
  displayCurrentPrediction(currentStation);

  // Display high/low table
  displayHighLowTable(highlowStation);

  // Show the section first (so chart can measure properly)
  section.style.display = 'block';

  // Display tide chart after section is visible
  displayTideChart(stationKey);
}

function hideStation() {
  document.getElementById('tide-current-section').style.display = 'none';
  document.getElementById('tide-loading').style.display = 'block';
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
  const waterLevel = obs.value.toFixed(2);
  const obsTime = new Date(obs.time);
  const timeStr = formatTime(obsTime);
  const ageStr = getAgeString(obsTime);
  const isStale = obs.stale || false;

  container.innerHTML = `
    <div style="font-size: 2rem; font-weight: bold; color: ${isStale ? '#e53935' : '#0077be'};">
      ${waterLevel} m
    </div>
    <div style="color: #666; margin-top: 0.5rem;">
      at ${timeStr}
      <span style="color: ${isStale ? '#e53935' : '#999'};">(${ageStr})</span>
    </div>
    ${isStale ? '<div style="color: #e53935; margin-top: 0.5rem; font-size: 0.9rem;">⚠ Data may be stale</div>' : ''}
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
  const waterLevel = pred.value.toFixed(2);
  const predTime = new Date(pred.time);
  const timeStr = formatTime(predTime);

  container.innerHTML = `
    <div style="font-size: 2rem; font-weight: bold; color: #43a047;">
      ${waterLevel} m
    </div>
    <div style="color: #666; margin-top: 0.5rem;">
      at ${timeStr}
    </div>
  `;
}

/* =====================================================
   High/Low Table Display
   ===================================================== */

function displayHighLowTable(station) {
  const tbody = document.querySelector('#highlow-table tbody');

  if (!station || !station.events || station.events.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="color: #999; text-align: center;">No high/low data available</td></tr>';
    return;
  }

  // Sort events by time
  const events = [...station.events].sort((a, b) => new Date(a.time) - new Date(b.time));

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
   Tide Chart Display
   ===================================================== */

function displayTideChart(stationKey) {
  const chartContainer = document.getElementById('tide-chart');

  if (!chartContainer) return;

  // Get timeseries data for this station
  const stationData = tideTimeseriesData?.stations?.[stationKey];

  if (!stationData || !stationData.predictions || stationData.predictions.length === 0) {
    chartContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No prediction data available</p>';
    return;
  }

  // Initialize chart if needed
  if (!tideChart) {
    tideChart = echarts.init(chartContainer);
  }

  // Extract predictions data
  const predictions = stationData.predictions;
  const times = predictions.map(p => new Date(p.time));
  const values = predictions.map(p => p.value);

  // Get observations if available
  const observations = stationData.observations || [];
  const obsTimes = observations.map(o => new Date(o.time));
  const obsValues = observations.map(o => o.value);

  // Chart options
  const option = {
    tooltip: {
      trigger: 'axis',
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
          result += `${param.marker} ${param.seriesName}: ${param.value[1].toFixed(2)} m<br/>`;
        });
        return result;
      }
    },
    grid: {
      left: window.innerWidth < 600 ? '12%' : '10%',
      right: window.innerWidth < 600 ? '12%' : '10%',
      top: '10%',
      bottom: '20%',
      containLabel: true
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        formatter: function(value) {
          const date = new Date(value);
          return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            hour12: true,
            timeZone: 'America/Vancouver'
          });
        },
        hideOverlap: true,
        fontSize: window.innerWidth < 600 ? 9 : 10
      },
      splitLine: { show: true, lineStyle: { color: "#eee" } }
    },
    yAxis: {
      type: 'value',
      name: 'Height (m)',
      nameLocation: 'middle',
      nameGap: 45
    },
    series: [
      {
        name: 'Prediction',
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

  // Add observations if available
  if (observations.length > 0) {
    option.series.push({
      name: 'Observation',
      type: 'scatter',
      data: obsTimes.map((t, i) => [t, obsValues[i]]),
      itemStyle: {
        color: '#43a047'
      },
      symbolSize: 6
    });
  }

  // Render chart (notMerge=true to completely replace previous data)
  tideChart.setOption(option, true);

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

/* =====================================================
   Initialization
   ===================================================== */

// Load data on page load
loadTideData();

// Auto-refresh every 5 minutes
setInterval(loadTideData, 5 * 60 * 1000);

// Handle window resize for chart
window.addEventListener('resize', () => {
  if (tideChart) {
    tideChart.resize();
  }
});