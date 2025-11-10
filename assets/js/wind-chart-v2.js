/* -----------------------------
   Wind Chart Module
   Handles wind speed and gust visualization with direction arrows
   ----------------------------- */

/**
 * Create wind direction arrow data for scatter series
 * @param {Array} windDirectionData - Array of {time, value} wind direction points
 * @param {Array} windSpeedData - Array of {time, value} wind speed points for positioning
 * @returns {Array} Array of data points with individual itemStyle and symbolRotate
 */
function createWindDirectionArrowData(windDirectionData, windSpeedData) {
  if (!windDirectionData || windDirectionData.length === 0) return [];

  const arrowData = [];

  // Sample every 3 hours to avoid overcrowding (assuming hourly data)
  const sampleInterval = 3;

  for (let i = 0; i < windDirectionData.length; i += sampleInterval) {
    const dirPoint = windDirectionData[i];
    if (!dirPoint || dirPoint.value == null) continue;

    // Find corresponding wind speed for this time to position arrow vertically
    const speedPoint = windSpeedData.find(s => s.time === dirPoint.time);
    if (!speedPoint || speedPoint.value == null) continue;

    const timestamp = new Date(dirPoint.time).getTime();
    const direction = dirPoint.value; // Meteorological direction (coming FROM)
    const speed = speedPoint.value;

    // Each data point with its own rotation
    arrowData.push({
      value: [timestamp, speed],
      symbolRotate: direction, // Set rotation per data point
      itemStyle: {
        color: '#1e88e5',
        opacity: 0.8
      }
    });
  }

  return arrowData;
}

/**
 * Render wind chart for the selected buoy
 * @param {Object} windChart - ECharts instance for wind chart
 * @param {Object} buoy - Buoy data including name and timeseries
 */
function renderWindChart(windChart, buoy) {
  const ts = buoy.timeseries;
  const windSpeedData = ts.wind_speed?.data || [];
  const windGustData = ts.wind_gust?.data || [];
  const windDirectionData = ts.wind_direction?.data || [];

  // Create direction arrow data
  const arrowData = createWindDirectionArrowData(windDirectionData, windSpeedData);

  windChart.setOption({
    title: { text: `${buoy.name} - Wind Conditions`, left: "center" },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      formatter: (params) => {
        if (!params || params.length === 0) return "";
        const time = formatTimeAxis(new Date(params[0].value[0]).toISOString());
        let res = `<b>${time}</b><br/>`;
        params.forEach((p) => {
          if (p.seriesName === "Wind Direction") return; // Skip arrow series in tooltip
          if (p.value[1] != null) {
            res += `${p.marker} ${p.seriesName}: ${p.value[1]} kt<br/>`;
          }
        });

        // Add wind direction to tooltip if available
        const timestamp = new Date(params[0].value[0]).getTime();
        const dirPoint = windDirectionData.find(d => Math.abs(new Date(d.time).getTime() - timestamp) < 1800000); // Within 30 min
        if (dirPoint && dirPoint.value != null) {
          const dir = Math.round(dirPoint.value);
          const compass = degreesToCompass(dir);
          res += `🧭 Direction: ${dir}° (${compass})<br/>`;
        }

        return res;
      },
    },
    legend: { data: ["Wind Speed", "Wind Gust"], bottom: "8%" },
    grid: getResponsiveGridConfig(false),
    xAxis: {
      type: "time",
      axisLabel: {
        fontSize: window.innerWidth < 600 ? 9 : 10,
        rotate: window.innerWidth < 600 ? 30 : 0,
        formatter: (value) => formatCompactTimeLabel(new Date(value).toISOString()),
        hideOverlap: true,
        margin: 10
      },
      axisTick: { show: true },
      splitLine: { show: true, lineStyle: { color: "#eee" } },
    },
    yAxis: { type: "value", name: "Speed (kt)" },
    series: [
      {
        name: "Wind Speed",
        type: "line",
        data: sanitizeSeriesData(windSpeedData),
        smooth: true,
        connectNulls: false,
        itemStyle: { color: "#fb8c00" },
        areaStyle: { opacity: 0.1 },
      },
      {
        name: "Wind Gust",
        type: "line",
        data: sanitizeSeriesData(windGustData),
        smooth: true,
        connectNulls: false,
        lineStyle: { type: "dashed" },
        itemStyle: { color: "#e53935" },
      },
      {
        name: "Wind Direction",
        type: "scatter",
        data: arrowData,
        symbol: 'arrow', // Use built-in arrow symbol
        symbolSize: 15,
        silent: true, // Don't trigger mouse events
        z: 10 // Render on top of lines
      }
    ]
  });
}

/**
 * Convert degrees to compass direction
 * @param {number} degrees - Wind direction in degrees
 * @returns {string} Compass direction (N, NE, E, etc.)
 */
function degreesToCompass(degrees) {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}
