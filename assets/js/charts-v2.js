/* -----------------------------
   Charts Orchestrator
   Main coordination for all chart modules
   ----------------------------- */

let chartData = null;
let waveChart, windChart, tempChart, waveComparisonChart;

/**
 * Load chart data from JSON file and initialize
 */
async function loadChartsData() {
  try {
    const response = await fetch(`/data/buoy_timeseries_24h.json?t=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    chartData = await response.json();

    if (chartData._meta?.generated_utc) {
      const dataTime = new Date(chartData._meta.generated_utc);
      const timestampEl = document.getElementById("timestamp");
      timestampEl.textContent = `Chart data updated: ${dataTime.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "America/Vancouver",
      })}`;
    }

    initCharts();
    const selectedBuoy = document.getElementById("chart-buoy-select").value;
    updateCharts(selectedBuoy);
    generateWaveHeightTable(chartData);
  } catch (err) {
    console.error("Error loading chart data:", err);
    document.getElementById("timestamp").textContent = "⚠️ Error loading chart data";
  }
}

/**
 * Initialize all chart instances and event listeners
 */
function initCharts() {
  waveChart = echarts.init(document.getElementById("wave-chart"));
  windChart = echarts.init(document.getElementById("wind-chart"));
  tempChart = echarts.init(document.getElementById("temp-chart"));
  waveComparisonChart = echarts.init(document.getElementById("wave-comparison-chart"));

  document
    .getElementById("chart-buoy-select")
    .addEventListener("change", (e) => {
      updateCharts(e.target.value);
      updateActiveBuoyIndicator(e.target.value);
    });

  const selectedBuoy = document.getElementById("chart-buoy-select").value;
  updateActiveBuoyIndicator(selectedBuoy);

  window.addEventListener("resize", () => {
    [waveChart, windChart, tempChart].forEach(chart => chart.resize());
    waveComparisonChart.resize();
  });

  renderComparisonChart(waveComparisonChart, chartData);
}

/**
 * Update active buoy indicator text
 */
function updateActiveBuoyIndicator(buoyId) {
  const indicator = document.getElementById("active-buoy-indicator");
  if (!indicator || !chartData || !chartData[buoyId]) return;
  indicator.textContent = `📊 Viewing: ${chartData[buoyId].name}`;
  indicator.classList.add("active");
}

/**
 * Update all charts for the selected buoy
 */
function updateCharts(buoyId) {
  if (!chartData || !chartData[buoyId]) {
    console.warn(`No data for buoy ${buoyId}`);
    return;
  }

  const buoy = chartData[buoyId];

  // Render each chart using the dedicated modules
  renderWaveChart(waveChart, buoy, buoyId);
  renderWindChart(windChart, buoy);
  renderTemperatureChart(tempChart, buoy);
  renderComparisonChart(waveComparisonChart, chartData);
}

// Load on page load
loadChartsData();

// Auto-refresh every 15 minutes
setInterval(loadChartsData, 15 * 60 * 1000);
