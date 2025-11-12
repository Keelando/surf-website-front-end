/* -----------------------------
   Wave Chart Module
   Handles wave height and period visualization
   ----------------------------- */

/**
 * Render wave chart for the selected buoy
 * Special handling for New Dungeness (46088) with dual charts
 * @param {Object} waveChart - ECharts instance for main wave chart
 * @param {Object} buoy - Buoy data including name and timeseries
 * @param {string} buoyId - Buoy identifier
 */
function renderWaveChart(waveChart, buoy, buoyId) {
  const ts = buoy.timeseries;

  if (buoyId === "46088") {
    // NEW DUNGENESS - Special handling with two separate charts
    renderNewDungenessCharts(waveChart, buoy, ts);
  } else {
    // ALL OTHER BUOYS - Standard single wave chart
    renderStandardWaveChart(waveChart, buoy, buoyId, ts);
  }
}

/**
 * Render New Dungeness dual-chart display (wave heights + periods)
 */
function renderNewDungenessCharts(waveChart, buoy, ts) {
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
    title: {
      text: `${buoy.name} - Wave Height Components`,
      left: "center",
      textStyle: { fontSize: window.innerWidth < 600 ? 12 : 14 }
    },
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
  }, true);

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
      title: {
        text: `${buoy.name} - Wave Period Components`,
        left: "center",
        textStyle: { fontSize: window.innerWidth < 600 ? 12 : 14 }
      },
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
}

/**
 * Render standard wave chart (all buoys except New Dungeness)
 */
function renderStandardWaveChart(waveChart, buoy, buoyId, ts) {
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
    title: {
      text: chartTitle,
      left: "center",
      textStyle: { fontSize: window.innerWidth < 600 ? 12 : 14 }
    },
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
      { type: "value", name: "Height (m)", position: "left", min: 0, max: (value) => Math.max(1, Math.ceil(value.max * 1.1)), scale: true },
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
