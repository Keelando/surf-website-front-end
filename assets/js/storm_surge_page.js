/* ======================================
   Storm Surge Page - Forecast & Hindcast
   ====================================== */

let forecastChart = null;
let hindcastChart = null;
let forecastData = null;
let hindcastData = null;
let observedSurgeData = null;

// Station display order
const STATION_ORDER = [
  "Point_Atkinson",
  "Crescent_Beach_Channel",
  "Campbell_River",
  "Neah_Bay",
  "New_Dungeness",
  "Tofino"
];

// Minimum date for hindcast data per station (YYYY-MM-DD format)
// Earlier data may be unreliable due to pipeline setup issues
const HINDCAST_MIN_DATE = {
  "Point_Atkinson": "2025-10-30",        // Reliable from start
  "Crescent_Beach_Channel": "2025-10-30", // Reliable from start
  "Campbell_River": "2025-11-06",         // Only reliable from Nov 6+
  "Neah_Bay": "2025-11-06",              // Only reliable from Nov 6+
  "New_Dungeness": "2025-11-06",         // Only reliable from Nov 6+
  "Tofino": "2025-11-06"                 // Only reliable from Nov 6+
};

/* ======================================
   Forecast Section
   ====================================== */

async function loadForecastData() {
  try {
    const response = await fetch(`/data/storm_surge/combined_forecast.json?t=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    forecastData = await response.json();

    initForecastSelector();
    const selectedStation = document.getElementById("forecast-station-select")?.value || "Point_Atkinson";
    updateForecastChart(selectedStation);

  } catch (err) {
    console.error("Error loading forecast data:", err);
    const container = document.getElementById("forecast-chart");
    if (container) {
      container.innerHTML = '<p style="text-align:center;color:#999;">⚠️ Forecast data unavailable</p>';
    }
  }
}

function initForecastSelector() {
  const selector = document.getElementById("forecast-station-select");
  if (!selector || selector.dataset.initialized) return;

  selector.innerHTML = "";

  STATION_ORDER.forEach(stationId => {
    const station = forecastData.stations?.[stationId];
    if (station) {
      const option = document.createElement("option");
      option.value = stationId;
      option.textContent = station.station_name;
      selector.appendChild(option);
    }
  });

  selector.addEventListener("change", (e) => {
    updateForecastChart(e.target.value);
    updateStationIndicator("forecast-station-indicator", e.target.value);
  });

  selector.dataset.initialized = "true";
  updateStationIndicator("forecast-station-indicator", selector.value);
}

function updateStationIndicator(elementId, stationId) {
  const indicator = document.getElementById(elementId);
  if (!indicator) return;

  let stationName = "";
  if (elementId.includes("forecast") && forecastData?.stations?.[stationId]) {
    stationName = forecastData.stations[stationId].station_name;
  } else if (elementId.includes("hindcast") && hindcastData?.stations?.[stationId]) {
    stationName = hindcastData.stations[stationId].station_name;
  }

  if (stationName) {
    indicator.textContent = `📍 Viewing: ${stationName}`;
  }
}

function updateForecastChart(stationId) {
  if (!forecastData?.stations?.[stationId]) {
    console.warn(`No forecast data found for station: ${stationId}`);
    return;
  }

  const station = forecastData.stations[stationId];

  if (!station.forecast || Object.keys(station.forecast).length === 0) {
    console.warn(`No forecast data for ${stationId}`);
    return;
  }

  // Prepare data
  const times = [];
  const values = [];

  Object.entries(station.forecast)
    .sort(([a], [b]) => new Date(a) - new Date(b))
    .forEach(([timeStr, value]) => {
      times.push(timeStr);
      values.push(value);
    });

  // Initialize chart if needed
  if (!forecastChart) {
    forecastChart = echarts.init(document.getElementById("forecast-chart"));
    window.addEventListener("resize", () => forecastChart.resize());
  }

  // Calculate y-axis range
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range = maxVal - minVal;
  const padding = Math.max(range * 0.2, 0.1); // At least 0.1m padding
  const yMin = Math.floor((minVal - padding) * 10) / 10;
  const yMax = Math.ceil((maxVal + padding) * 10) / 10;

  // Set chart options (notMerge: true to replace all data when switching stations)
  forecastChart.setOption({
    title: {
      text: `${station.station_name} - 10-Day Storm Surge Forecast`,
      left: "center",
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: "axis",
      formatter: (params) => {
        const idx = params[0].dataIndex;
        const time = new Date(times[idx]).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "America/Vancouver"
        });
        const value = params[0].value;
        const sign = value >= 0 ? "+" : "";
        return `<b>${time} PT</b><br/>Storm Surge: ${sign}${value.toFixed(3)} m`;
      }
    },
    grid: {
      left: window.innerWidth < 600 ? "10%" : "8%",
      right: window.innerWidth < 600 ? "8%" : "6%",
      bottom: "20%",
      top: "15%",
      containLabel: true
    },
    xAxis: {
      type: "category",
      data: times,
      axisLabel: {
        interval: (index) => index % 24 === 0,
        formatter: (value, index) => {
          const d = new Date(value);
          const day = d.toLocaleString("en-US", { day: "2-digit", timeZone: "America/Vancouver" });
          const month = d.toLocaleString("en-US", { month: "short", timeZone: "America/Vancouver" });
          return index === 0 ? `${month} ${day}` : day;
        },
        rotate: window.innerWidth < 600 ? 45 : 0,
        fontSize: 10,
        hideOverlap: true,
        margin: 10
      },
      axisTick: { show: true, alignWithLabel: true },
      splitLine: { show: true, lineStyle: { color: "#eee" } }
    },
    yAxis: {
      type: "value",
      name: "Surge (m)",
      min: yMin,
      max: yMax,
      axisLabel: {
        formatter: (value) => {
          const sign = value >= 0 ? "+" : "";
          return `${sign}${value.toFixed(1)}`;
        }
      },
      splitLine: { show: true, lineStyle: { color: "#eee" } }
    },
    series: [{
      name: "Storm Surge",
      type: "line",
      data: values,
      smooth: true,
      symbol: "none",
      itemStyle: { color: "#0077be" },
      lineStyle: { width: 2 },
      areaStyle: {
        color: {
          type: "linear",
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: "rgba(0, 119, 190, 0.3)" },
            { offset: 1, color: "rgba(0, 119, 190, 0.05)" }
          ]
        }
      },
      markLine: {
        silent: true,
        symbol: "none",
        lineStyle: { type: "dashed", color: "#999", width: 1 },
        label: {
          show: true,
          position: "end",
          formatter: "Sea Level"
        },
        data: [{ yAxis: 0 }]
      }
    }]
  }, true); // notMerge: true to prevent old data from persisting

  // Update metadata
  updateForecastMetadata(station, times, values);

  console.log(`✅ Loaded ${values.length} hours of forecast for ${station.station_name}`);
}

function updateForecastMetadata(station, times, values) {
  const metaEl = document.getElementById("forecast-metadata");
  if (!metaEl) return;

  const generatedTime = new Date(forecastData.generated_utc);
  const firstForecast = new Date(times[0]);
  const lastForecast = new Date(times[times.length - 1]);

  const maxSurge = Math.max(...values);
  const minSurge = Math.min(...values);
  const maxTime = times[values.indexOf(maxSurge)];
  const minTime = times[values.indexOf(minSurge)];

  const formatDate = (date) => date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Vancouver"
  });

  metaEl.innerHTML = `
    <strong>Station:</strong> ${station.station_name}<br/>
    <strong>Location:</strong> ${station.location.lat.toFixed(4)}°N, ${Math.abs(station.location.lon).toFixed(4)}°W<br/>
    <strong>Data Retrieved:</strong> ${formatDate(generatedTime)} PT<br/>
    <strong>Forecast Period:</strong> ${formatDate(firstForecast)} to ${formatDate(lastForecast)} PT<br/>
    <strong>Resolution:</strong> ${values.length} hours (1-hour intervals)<br/>
    <strong>Peak High:</strong> +${maxSurge.toFixed(3)} m at ${formatDate(new Date(maxTime))} PT<br/>
    <strong>Peak Low:</strong> ${minSurge.toFixed(3)} m at ${formatDate(new Date(minTime))} PT
  `;
}

/* ======================================
   Observed Surge Data
   ====================================== */

async function loadObservedSurgeData() {
  try {
    const response = await fetch(`/data/storm_surge/observed_surge.json?t=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    observedSurgeData = await response.json();
    console.log(`✅ Loaded observed surge data for ${Object.keys(observedSurgeData.stations || {}).length} stations`);
  } catch (err) {
    console.warn("Observed surge data not available:", err.message);
    observedSurgeData = null;
  }
}

/* ======================================
   Hindcast Section
   ====================================== */

async function loadHindcastData() {
  try {
    const response = await fetch(`/data/storm_surge/hindcast.json?t=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    hindcastData = await response.json();

    initHindcastSelector();
    const selectedStation = document.getElementById("hindcast-station-select")?.value || "Point_Atkinson";
    updateHindcastChart(selectedStation);

  } catch (err) {
    console.error("Error loading hindcast data:", err);
    const container = document.getElementById("hindcast-chart");
    if (container) {
      container.innerHTML = '<p style="text-align:center;color:#999;">⚠️ Hindcast data unavailable</p>';
    }
  }
}

function initHindcastSelector() {
  const selector = document.getElementById("hindcast-station-select");
  if (!selector || selector.dataset.initialized) return;

  selector.innerHTML = "";

  // Only show stations that have hindcast data
  STATION_ORDER.forEach(stationId => {
    const station = hindcastData.stations?.[stationId];
    if (station && station.hindcast && station.hindcast.length > 0) {
      const option = document.createElement("option");
      option.value = stationId;
      option.textContent = station.station_name;
      selector.appendChild(option);
    }
  });

  selector.addEventListener("change", (e) => {
    updateHindcastChart(e.target.value);
    updateStationIndicator("hindcast-station-indicator", e.target.value);
  });

  selector.dataset.initialized = "true";
  updateStationIndicator("hindcast-station-indicator", selector.value);
}

function updateHindcastChart(stationId) {
  if (!hindcastData?.stations?.[stationId]) {
    console.warn(`No hindcast data found for station: ${stationId}`);
    return;
  }

  const station = hindcastData.stations[stationId];

  if (!station.hindcast || station.hindcast.length === 0) {
    const container = document.getElementById("hindcast-chart");
    if (container) {
      container.innerHTML = '<p style="text-align:center;color:#999;">No hindcast data available for this station yet. Data accumulates over time.</p>';
    }
    return;
  }

  // Prepare data - group by forecast date
  // Filter out data before the minimum date for this station
  const minDate = HINDCAST_MIN_DATE[stationId] || "2025-11-06"; // Default to Nov 6
  const forecastDates = {};

  station.hindcast.forEach(point => {
    const date = point.forecast_date;

    // Skip data before the minimum date
    if (date < minDate) {
      return;
    }

    if (!forecastDates[date]) {
      forecastDates[date] = {
        times: [],
        values: []
      };
    }
    forecastDates[date].times.push(point.time);
    forecastDates[date].values.push(point.value);
  });

  // Sort dates
  const sortedDates = Object.keys(forecastDates).sort();

  // Check if we have any data after filtering
  if (sortedDates.length === 0) {
    const container = document.getElementById("hindcast-chart");
    if (container) {
      container.innerHTML = `<p style="text-align:center;color:#999;">No hindcast data available for this station from ${minDate} onwards. Data accumulates over time.</p>`;
    }
    return;
  }

  // Prepare series for each forecast date
  const series = sortedDates.map((date, index) => {
    const data = forecastDates[date];
    const color = getColorForIndex(index, sortedDates.length);

    return {
      name: `Forecast from ${new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC"
      })}`,
      type: "line",
      data: data.times.map((time, i) => [time, data.values[i]]),
      smooth: true,
      symbol: "circle",
      symbolSize: 4,
      itemStyle: { color: color },
      lineStyle: { width: 2 }
    };
  });

  // Add observed surge data if available for this station
  if (observedSurgeData?.stations?.[stationId]) {
    const obsStation = observedSurgeData.stations[stationId];
    const obsData = obsStation.data.map(d => [d.time, d.observed_surge_m]);

    series.push({
      name: "Observed Surge (Actual)",
      type: "line",
      data: obsData,
      smooth: false,
      symbol: "circle",
      symbolSize: 3,
      itemStyle: { color: "#000000" },
      lineStyle: { width: 3, type: "solid" },
      z: 10 // Render on top
    });

    console.log(`  ✅ Added ${obsData.length} observed surge points`);
  }

  // Get all unique times for x-axis (only from filtered data)
  const allTimes = [...new Set(
    station.hindcast
      .filter(p => p.forecast_date >= minDate)
      .map(p => p.time)
  )].sort();

  // Initialize chart if needed
  if (!hindcastChart) {
    hindcastChart = echarts.init(document.getElementById("hindcast-chart"));
    window.addEventListener("resize", () => hindcastChart.resize());
  }

  // Set chart options (notMerge: true to replace all data when switching stations)
  hindcastChart.setOption({
    title: {
      text: `${station.station_name} - Hindcast Comparison (48h Predictions)`,
      left: "center",
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: "axis",
      formatter: (params) => {
        if (!params || params.length === 0) return "";

        const time = new Date(params[0].data[0]).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "America/Vancouver"
        });

        let tooltip = `<b>${time} PT</b><br/>`;
        params.forEach(param => {
          const value = param.data[1];
          const sign = value >= 0 ? "+" : "";
          tooltip += `${param.marker} ${param.seriesName}: ${sign}${value.toFixed(3)} m<br/>`;
        });

        return tooltip;
      }
    },
    legend: {
      bottom: 0,
      left: "center",
      type: "scroll",
      pageButtonItemGap: 5,
      pageIconSize: 12
    },
    grid: {
      left: window.innerWidth < 600 ? "10%" : "8%",
      right: window.innerWidth < 600 ? "8%" : "6%",
      bottom: "18%",
      top: "15%",
      containLabel: true
    },
    xAxis: {
      type: "time",
      axisLabel: {
        formatter: (value) => {
          const d = new Date(value);
          return d.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "America/Vancouver"
          });
        },
        rotate: window.innerWidth < 600 ? 45 : 0,
        fontSize: 10
      },
      splitLine: { show: true, lineStyle: { color: "#eee" } }
    },
    yAxis: {
      type: "value",
      name: "Surge (m)",
      axisLabel: {
        formatter: (value) => {
          const sign = value >= 0 ? "+" : "";
          return `${sign}${value.toFixed(2)}`;
        }
      },
      splitLine: { show: true, lineStyle: { color: "#eee" } }
    },
    series: series.concat([{
      // Zero reference line
      name: "Sea Level",
      type: "line",
      data: allTimes.map(t => [t, 0]),
      lineStyle: { type: "dashed", color: "#999", width: 1 },
      symbol: "none",
      showSymbol: false,
      silent: true
    }])
  }, true); // notMerge: true to prevent old data from persisting

  // Update metadata
  updateHindcastMetadata(station);

  console.log(`✅ Loaded hindcast data for ${station.station_name} (${sortedDates.length} forecast dates)`);
}

function getColorForIndex(index, total) {
  const colors = [
    "#e53935", // red
    "#1e88e5", // blue
    "#43a047", // green
    "#fb8c00", // orange
    "#8e24aa", // purple
    "#00acc1", // cyan
    "#fdd835", // yellow
    "#6d4c41", // brown
    "#546e7a", // blue-grey
    "#f06292"  // pink
  ];
  return colors[index % colors.length];
}

function updateHindcastMetadata(station) {
  const metaEl = document.getElementById("hindcast-metadata");
  if (!metaEl) return;

  const generatedTime = new Date(hindcastData.generated_utc);
  const daysAvailable = hindcastData.actual_days_available || 0;

  const formatDate = (date) => date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Vancouver"
  });

  metaEl.innerHTML = `
    <strong>Station:</strong> ${station.station_name}<br/>
    <strong>Location:</strong> ${station.location.lat.toFixed(4)}°N, ${Math.abs(station.location.lon).toFixed(4)}°W<br/>
    <strong>Data Retrieved:</strong> ${formatDate(generatedTime)} PT<br/>
    <strong>Forecast Horizon:</strong> ${hindcastData.forecast_horizon_hours || 48} hours ahead<br/>
    <strong>Historical Days:</strong> ${daysAvailable} day${daysAvailable !== 1 ? 's' : ''} (max ${hindcastData.max_days_back || 10})<br/>
    <strong>Collection Time:</strong> 18Z model run (closest to noon Pacific)
  `;
}

/* ======================================
   Page Initialization
   ====================================== */

function initPage() {
  // Update timestamp in footer
  const timestampEl = document.getElementById("timestamp");
  if (timestampEl) {
    timestampEl.textContent = new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Vancouver"
    }) + " PT";
  }

  // Load all datasets (observed surge first, then charts)
  loadObservedSurgeData().then(() => {
    loadForecastData();
    loadHindcastData();
  });
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", initPage);

// Refresh data every 2 hours
setInterval(() => {
  loadObservedSurgeData().then(() => {
    loadForecastData();
    loadHindcastData();
  });
}, 2 * 60 * 60 * 1000);
