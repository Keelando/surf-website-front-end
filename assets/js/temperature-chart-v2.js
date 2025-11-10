/* -----------------------------
   Temperature Chart Module
   Handles air and sea temperature visualization
   ----------------------------- */

/**
 * Render temperature chart for the selected buoy
 * @param {Object} tempChart - ECharts instance for temperature chart
 * @param {Object} buoy - Buoy data including name and timeseries
 */
function renderTemperatureChart(tempChart, buoy) {
  const ts = buoy.timeseries;
  const airTempData = ts.air_temp?.data || [];
  const seaTempData = ts.sea_temp?.data || [];

  tempChart.setOption({
    title: { text: `${buoy.name} - Temperature`, left: "center" },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      formatter: (params) => {
        if (!params || params.length === 0) return "";
        const time = formatTimeAxis(new Date(params[0].value[0]).toISOString());
        let res = `<b>${time}</b><br/>`;
        params.forEach((p) => {
          if (p.value[1] != null) {
            res += `${p.marker} ${p.seriesName}: ${p.value[1]} °C<br/>`;
          }
        });
        return res;
      },
    },
    legend: { data: ["Air Temperature", "Sea Temperature"], bottom: "8%" },
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
    yAxis: {
      type: "value",
      name: "Temperature (°C)",
      min: "dataMin",
      max: "dataMax",
      axisLabel: { formatter: "{value} °C" },
    },
    series: [
      {
        name: "Air Temperature",
        type: "line",
        data: sanitizeSeriesData(airTempData),
        smooth: true,
        connectNulls: false,
        itemStyle: { color: "#f4511e" },
      },
      {
        name: "Sea Temperature",
        type: "line",
        data: sanitizeSeriesData(seaTempData),
        smooth: true,
        connectNulls: false,
        itemStyle: { color: "#00acc1" },
      },
    ],
  });
}
