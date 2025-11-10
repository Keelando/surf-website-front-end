/* -----------------------------
   Wind Chart Module
   Handles wind speed and gust visualization with direction arrows
   ----------------------------- */

/**
 * Create wind direction arrow graphics for chart overlay
 * @param {Array} windDirectionData - Array of {time, value} wind direction points
 * @param {Array} windSpeedData - Array of {time, value} wind speed points for positioning
 * @param {Object} chart - ECharts instance
 * @returns {Array} Array of graphic elements (arrows)
 */
function createWindDirectionArrows(windDirectionData, windSpeedData, chart) {
  if (!windDirectionData || windDirectionData.length === 0) return [];

  const graphics = [];

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

    // Create arrow pointing where wind is blowing TO
    // ECharts rotation: 0° = right, 90° = down, 180° = left, 270° = up
    // For down arrow (↓), rotation = direction points where wind blows TO
    graphics.push({
      type: 'path',
      position: [timestamp, speed],
      shape: {
        // SVG path for down arrow (↓)
        pathData: 'M 0,-8 L 0,8 M -4,4 L 0,8 L 4,4',
      },
      style: {
        stroke: '#1e88e5',
        lineWidth: 2,
        fill: 'transparent'
      },
      rotation: (direction * Math.PI) / 180, // Convert to radians
      origin: [0, 0], // Rotate around arrow center
      z: 100 // Render on top
    });
  }

  return graphics;
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

  // Create direction arrows
  const directionArrows = createWindDirectionArrows(windDirectionData, windSpeedData, windChart);

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
    ],
    graphic: directionArrows.map(arrow => ({
      ...arrow,
      $action: 'replace' // Replace graphics on each update
    }))
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
