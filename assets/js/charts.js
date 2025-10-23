/* -----------------------------
   Salish Sea Buoy Charts (v3)
   ----------------------------- */

let chartData = null;
let waveChart, windChart, tempChart, waveComparisonChart;

/* -----------------------------
   Utility functions
----------------------------- */

function sanitizeSeriesData(dataArray) {
  return dataArray.map(d => {
    const y = parseFloat(d.value);
    if (isNaN(y) || d.value == null || d.value === "MM") {
      return [new Date(d.time).getTime(), null];
    }
    return [new Date(d.time).getTime(), y];
  });
}

function formatCompactTimeLabel(isoString) {
  const d = new Date(isoString);
  const dayOfWeek = d.toLocaleString("en-US", {
    weekday: "short",
    timeZone: "America/Vancouver",
  });
  const hour = d.toLocaleString("en-US", {
    hour: "2-digit",
    hour12: false,
    timeZone: "America/Vancouver",
  });
  return `${dayOfWeek} ${hour}h`;
}

function formatTimeAxis(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Vancouver",
  });
}

/* -----------------------------
   Responsive Grid Configuration
----------------------------- */

function getResponsiveGridConfig(isComparisonChart = false) {
  const width = window.innerWidth;
  
  if (width < 600) {
    return {
      left: '8%',
      right: '8%',
      top: '15%',
      bottom: isComparisonChart ? '28%' : '22%',
      containLabel: true
    };
  } else if (width < 1000) {
    return {
      left: '10%',
      right: '10%',
      top: '12%',
      bottom: isComparisonChart ? '20%' : '16%',
      containLabel: true
    };
  } else {
    return {
      left: '8%',
      right: '8%',
      top: '10%',
      bottom: isComparisonChart ? '18%' : '14%',
      containLabel: true
    };
  }
}

/* -----------------------------
   Load + Init Charts
----------------------------- */

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
    generateWaveHeightTable();
  } catch (err) {
    console.error("Error loading chart data:", err);
    document.getElementById("timestamp").textContent = "⚠️ Error loading chart data";
  }
}

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

  updateWaveComparisonChart();
}

/* -----------------------------
   Active buoy indicator
----------------------------- */

function updateActiveBuoyIndicator(buoyId) {
  const indicator = document.getElementById("active-buoy-indicator");
  if (!indicator || !chartData || !chartData[buoyId]) return;
  indicator.textContent = `📊 Viewing: ${chartData[buoyId].name}`;
  indicator.classList.add("active");
}

/* -----------------------------
   Main chart update logic
----------------------------- */

function updateCharts(buoyId) {
  if (!chartData || !chartData[buoyId]) {
    console.warn(`No data for buoy ${buoyId}`);
    return;
  }

  const buoy = chartData[buoyId];
  const ts = buoy.timeseries;
  
  // Check if this is a NOAA buoy with swell data
  const isNoaaBuoy = buoyId === "46087" || buoyId === "46088";



/* ---------- WAVE CHART ---------- */
  if (buoyId === "46088") {
    // NEW DUNGENESS - Special handling with two separate charts
    
    // Chart 1: Wave Heights (All three components with fallbacks)
    const sigWaveHeight = ts.wave_height_sig?.data || [];
    const windWaveHeight = ts.wind_wave_height?.data || [];
    const swellHeight = ts.swell_height?.data || [];
    
    // Debug: Check what data we actually have
    console.log("New Dungeness wave data available:", {
      sig: sigWaveHeight.length,
      wind: windWaveHeight.length, 
      swell: swellHeight.length
    });
    
    waveChart.setOption({
      title: { text: `${buoy.name} - Wave Height Components`, left: "center" },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        formatter: (params) => {
          if (!params || params.length === 0) return "";
          const time = formatTimeAxis(new Date(params[0].value[0]).toISOString());
          let res = `<b>${time}</b><br/>`;
          params.forEach((p) => {
            if (p.value[1] != null) {
              res += `${p.marker} ${p.seriesName}: ${p.value[1]} m<br/>`;
            }
          });
          return res;
        },
      },
      legend: { 
        data: ["Wind Waves", "Ocean Swell", "Total (Significant)"], 
        bottom: "2%" 
      },
      grid: {
        left: window.innerWidth < 600 ? '12%' : '10%',
        right: window.innerWidth < 600 ? '12%' : '10%',
        top: '15%',
        bottom: '22%',
        containLabel: true
      },
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
        name: "Height (m)", 
        min: 0, 
        max: (value) => Math.max(0.5, Math.ceil(value.max * 1.1)), 
        scale: true
      },
      series: [
        {
          name: "Wind Waves",
          type: "line",
          data: sanitizeSeriesData(windWaveHeight),
          smooth: true,
          connectNulls: false,
          itemStyle: { color: "#1e88e5" },
          showSymbol: false
        },
        {
          name: "Ocean Swell",
          type: "line",
          data: sanitizeSeriesData(swellHeight),
          smooth: true,
          connectNulls: false,
          itemStyle: { color: "#fb8c00" },
          showSymbol: false
        },
        {
          name: "Total (Significant)",
          type: "line",
          data: sanitizeSeriesData(sigWaveHeight),
          smooth: true,
          connectNulls: false,
          lineStyle: { 
            type: "dashed",
            width: 2,
            color: "#999999"
          },
          itemStyle: { color: "#999999" },
          showSymbol: false,
          z: 1
        }
      ]
    },true);
    
    // Chart 2: Wave Periods (All three components with fallbacks)
    const avgPeriod = ts.wave_period_avg?.data || [];
    const windWavePeriod = ts.wind_wave_period?.data || [];
    const swellPeriod = ts.swell_period?.data || [];
    
    // Debug: Check what period data we have
    console.log("New Dungeness period data available:", {
      avg: avgPeriod.length,
      wind: windWavePeriod.length,
      swell: swellPeriod.length
    });

    const periodChartContainer = document.getElementById("wave-period-chart");
    if (periodChartContainer) {
      periodChartContainer.style.display = "block";
      
      if (!window.wavePeriodChart) {
        window.wavePeriodChart = echarts.init(periodChartContainer);
        window.addEventListener("resize", () => window.wavePeriodChart.resize());
      }
      
      window.wavePeriodChart.setOption({
        title: { text: `${buoy.name} - Wave Period Components`, left: "center" },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "cross" },
          formatter: (params) => {
            if (!params || params.length === 0) return "";
            const time = formatTimeAxis(new Date(params[0].value[0]).toISOString());
            let res = `<b>${time}</b><br/>`;
            params.forEach((p) => {
              if (p.value[1] != null) {
                res += `${p.marker} ${p.seriesName}: ${p.value[1]} s<br/>`;
              }
            });
            return res;
          },
        },
        legend: { 
          data: ["Wind Wave Period", "Swell Period", "Average Period"], 
          bottom: "2%" 
        },
        grid: {
          left: window.innerWidth < 600 ? '12%' : '10%',
          right: window.innerWidth < 600 ? '12%' : '10%',
          top: '15%',
          bottom: '22%',
          containLabel: true
        },
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
          name: "Period (s)",
          min: 0
        },
        series: [
          {
            name: "Wind Wave Period",
            type: "line",
            data: sanitizeSeriesData(windWavePeriod),
            smooth: true,
            connectNulls: false,
            itemStyle: { color: "#1e88e5" },
            showSymbol: false
          },
          {
            name: "Swell Period",
            type: "line",
            data: sanitizeSeriesData(swellPeriod),
            smooth: true,
            connectNulls: false,
            itemStyle: { color: "#fb8c00" },
            showSymbol: false
          },
          {
            name: "Average Period",
            type: "line",
            data: sanitizeSeriesData(avgPeriod),
            smooth: true,
            connectNulls: false,
            lineStyle: { 
              type: "dashed",
              width: 2,
              color: "#999999"
            },
            itemStyle: { color: "#999999" },
            showSymbol: false,
            z: 1
          }
        ]
      });
      
      setTimeout(() => {
        if (window.wavePeriodChart) {
          window.wavePeriodChart.resize();
        }
      }, 100);
    }
    
  } else {
    // ALL OTHER BUOYS - Standard single wave chart
    
    // Hide the period chart if it exists
    const periodChartContainer = document.getElementById("wave-period-chart");
    if (periodChartContainer) {
      periodChartContainer.style.display = "none";
    }
    
    let waveHeightData, wavePeriodData, chartTitle, heightLabel, periodLabel;
    
    if (buoyId === "46087") {
      // Neah Bay - use swell data (open ocean)
      waveHeightData = ts.swell_height?.data || [];
      wavePeriodData = ts.swell_period?.data || [];
      chartTitle = `${buoy.name} - Swell Conditions`;
      heightLabel = "Swell Height";
      periodLabel = "Swell Period";
    } else {
      // Canadian buoys - use significant wave height
      waveHeightData = ts.wave_height_sig?.data || [];
      wavePeriodData = ts.wave_period_peak?.data || [];
      chartTitle = `${buoy.name} - Wave Conditions`;
      heightLabel = "Significant Wave Height";
      periodLabel = "Peak Period";
    }

    waveChart.setOption({
      title: { text: chartTitle, left: "center" },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        formatter: (params) => {
          if (!params || params.length === 0) return "";
          const time = formatTimeAxis(new Date(params[0].value[0]).toISOString());
          let res = `<b>${time}</b><br/>`;
          params.forEach((p) => {
            if (p.value[1] != null) {
              res += `${p.marker} ${p.seriesName}: ${p.value[1]} ${
                p.seriesName.includes("Height") ? "m" : "s"
              }<br/>`;
            }
          });
          return res;
        },
      },
      legend: { 
        data: [heightLabel, periodLabel], 
        bottom: "2%" 
      },
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
      yAxis: [
        { type: "value", name: "Height (m)", position: "left", min: 0, max: (value) => Math.max(1, Math.ceil(value.max * 1.1)), scale: true},
        { type: "value", name: "Period (s)", position: "right" },
      ],
      series: [
        {
          name: heightLabel,
          type: "line",
          data: sanitizeSeriesData(waveHeightData),
          smooth: true,
          connectNulls: false,
          yAxisIndex: 0,
          itemStyle: { color: "#1e88e5" },
          areaStyle: { opacity: 0.1 },
        },
        {
          name: periodLabel,
          type: "line",
          data: sanitizeSeriesData(wavePeriodData),
          smooth: true,
          connectNulls: false,
          yAxisIndex: 1,
          itemStyle: { color: "#43a047" },
        },
      ]
    });
  }

  /* ---------- WIND CHART ---------- */
  const windSpeedData = ts.wind_speed?.data || [];
  const windGustData = ts.wind_gust?.data || [];

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
  });

  /* ---------- TEMPERATURE CHART ---------- */
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

  updateWaveComparisonChart();
}

/* -----------------------------
   WAVE COMPARISON CHART
----------------------------- */

function updateWaveComparisonChart() {
  if (!chartData) {
    console.warn("No chart data available");
    return;
  }

  const buoyOrder = ["4600146", "4600304", "4600303", "4600131"];
  const buoyColors = {
    "4600146": "#1e88e5",
    "4600304": "#43a047",
    "4600303": "#fb8c00",
    "4600131": "#e53935",
  };

  const series = buoyOrder
    .map((buoyId) => {
      const buoy = chartData[buoyId];
      if (!buoy?.timeseries?.wave_height_sig) return null;

      const data = buoy.timeseries.wave_height_sig.data || [];

      return {
        name: buoy.name,
        type: "line",
        data: sanitizeSeriesData(data),
        smooth: true,
        connectNulls: false,
        itemStyle: { color: buoyColors[buoyId] },
        emphasis: { focus: "series" },
        markLine: {
          symbol: "none",
          data: [
            { 
              yAxis: 0.7,
              lineStyle: { type: "dashed", color: "orange", width: 1 },
              label: { formatter: "0.7m" }
            },
            { 
              yAxis: 1.2,
              lineStyle: { type: "dashed", color: "red", width: 1 },
              label: { formatter: "1.2m" }
            }
          ]
        }
      };
    })
    .filter(Boolean);

  waveComparisonChart.setOption({
    title: { text: "Sig Wave Height (All)", left: "center" },

    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      formatter: (params) => {
        if (!params?.length) return "";
        const time = formatTimeAxis(new Date(params[0].value[0]).toISOString());
        let res = `<b>${time}</b><br/>`;
        for (const p of params) {
          if (p.value[1] != null) {
            res += `${p.marker} ${p.seriesName}: ${p.value[1]} m<br/>`;
          }
        }
        return res;
      },
    },

    legend: {
      data: buoyOrder.map((id) => chartData[id]?.name).filter(Boolean),
      bottom: "12%",
    },

    grid: getResponsiveGridConfig(true),

    xAxis: {
      type: "time",
      axisLabel: {
        fontSize: window.innerWidth < 600 ? 9 : 10,
        rotate: window.innerWidth < 600 ? 30 : 0,
        formatter: (value) => formatCompactTimeLabel(new Date(value).toISOString()),
        hideOverlap: true,
        margin: 10,
      },
      axisTick: { show: true },
      splitLine: { show: true, lineStyle: { color: "#eee" } },
    },

    yAxis: {
      type: "value",
      name: "Wave Height (m)",
      min: 0,
      max: (value) => {
        const rawMax = value.max || 1;
        const padded = Math.ceil(rawMax * 1.01 * 10) / 10;
        return Math.max(1, padded);
      },
      scale: false,
      boundaryGap: [0, 0],
      splitLine: { show: true, lineStyle: { color: "#eee" } },
    },

    series: series,
  });
}

/* -----------------------------
   Table builder
----------------------------- */

function generateWaveHeightTable() {
  if (!chartData) return;

  const table = document.getElementById("wave-height-table");
  if (!table) return;

  const buoyOrder = ["4600146", "4600304", "4600303", "4600131", "46087", "46088"];
  const hourMap = new Map();

  buoyOrder.forEach((buoyId) => {
    const buoy = chartData[buoyId];
    if (!buoy || !buoy.timeseries) return;

    // Use swell_height ONLY for Neah Bay (46087), sig wave height for all others
    const waveData = (buoyId === "46087")
      ? buoy.timeseries.swell_height?.data 
      : buoy.timeseries.wave_height_sig?.data;
    
    if (!waveData) return;

    waveData.forEach((point) => {
      const date = new Date(point.time);
      const hourKey = new Date(date);
      hourKey.setMinutes(0, 0, 0);
      const hourStr = hourKey.toISOString();

      if (!hourMap.has(hourStr)) {
        hourMap.set(hourStr, {});
      }
      hourMap.get(hourStr)[buoyId] = point.value;
    });
  });

  const sortedHours = Array.from(hourMap.keys()).sort().reverse();

  let tableHTML = `
    <thead>
      <tr>
        <th>Time</th>
        <th>Halibut Bank</th>
        <th>English Bay</th>
        <th>Southern Georgia Strait</th>
        <th>Sentry Shoal</th>
        <th>Neah Bay<br><span style="font-size: 0.8em; font-weight: normal; color: #666;">(Swell)</span></th>
        <th>New Dungeness</th>
      </tr>
    </thead>
    <tbody>
  `;

  sortedHours.forEach((hourStr) => {
    const date = new Date(hourStr);

    const timeLabel =
      date.toLocaleString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "America/Vancouver",
      }) +
      " " +
      date.toLocaleString("en-US", {
        weekday: "short",
        timeZone: "America/Vancouver",
      });

    const values = hourMap.get(hourStr);

    tableHTML += `
      <tr>
        <td><strong>${timeLabel}</strong></td>
        <td>${values["4600146"] != null ? values["4600146"] + " m" : "—"}</td>
        <td>${values["4600304"] != null ? values["4600304"] + " m" : "—"}</td>
        <td>${values["4600303"] != null ? values["4600303"] + " m" : "—"}</td>
        <td>${values["4600131"] != null ? values["4600131"] + " m" : "—"}</td>
        <td>${values["46087"] != null ? values["46087"] + " m" : "—"}</td>
        <td>${values["46088"] != null ? values["46088"] + " m" : "—"}</td>
      </tr>
    `;
  });

  tableHTML += "</tbody>";
  table.innerHTML = tableHTML;
}

/* -----------------------------
   Auto-refresh
----------------------------- */

loadChartsData();
setInterval(loadChartsData, 15 * 60 * 1000);
