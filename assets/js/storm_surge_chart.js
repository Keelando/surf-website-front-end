/* -----------------------------
   Storm Surge Chart - Point Atkinson
   ----------------------------- */

let surgeChart = null;

async function loadStormSurgeChart() {
  try {
    const response = await fetch(`/data/storm_surge/combined_forecast.json?t=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    const station = data.stations?.Point_Atkinson;
    if (!station || !station.forecast) {
      console.warn("No Point Atkinson data found");
      return;
    }

    // Prepare data
    const times = [];
    const values = [];
    
    Object.entries(station.forecast).forEach(([timeStr, value]) => {
      times.push(timeStr);
      values.push(value);
    });

    // Initialize chart
    if (!surgeChart) {
      surgeChart = echarts.init(document.getElementById("surge-chart"));
      window.addEventListener("resize", () => surgeChart.resize());
    }

    // Set chart options
    surgeChart.setOption({
      title: {
        text: `${station.station_name} - 10 day`,
        left: "center",
        textStyle: { fontSize: 16 }
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
          return `<b>${time}</b><br/>Storm Surge: ${sign}${value.toFixed(2)} m`;
        }
      },
      grid: {
        left: window.innerWidth < 600 ? "5%" : "10%",
        right: window.innerWidth < 600 ? "5%" : "10%",
        bottom: "22%",
        top: "12%",
        containLabel: true
      },
      xAxis: {
        type: "category",
        data: times,  // use raw timestamps here
        axisLabel: {
          interval: (index) => index % 24 === 0,  // show every 24th tick
          formatter: (value, index) => {
            const d = new Date(value);
            const day = d.toLocaleString("en-US", { day: "2-digit", timeZone: "America/Vancouver" });
            const month = d.toLocaleString("en-US", { month: "short", timeZone: "America/Vancouver" });
            return index === 0 ? `${month} ${day}` : day;  // "Oct 16", then "17", "18", etc.
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
    });

    // Update metadata display
    const metaEl = document.getElementById("surge-metadata");
    if (metaEl) {
      const generatedTime = new Date(data.generated_utc);
      const firstForecast = new Date(times[0]);
      const lastForecast = new Date(times[times.length - 1]);
      
      const formatDate = (date) => date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "America/Vancouver"
      });
      
      metaEl.innerHTML = `
        <strong>Model:</strong> GDSPS (Global Deterministic Storm Surge Prediction System)<br/>
        <strong>Data Retrieved:</strong> ${formatDate(generatedTime)} PT<br/>
        <strong>Forecast Period:</strong> ${formatDate(firstForecast)} to ${formatDate(lastForecast)} PT<br/>
        <strong>Resolution:</strong> ${values.length} hours (1-hour intervals)
      `;
    }

    console.log(`✅ Loaded ${values.length} hours of storm surge forecast`);

  } catch (err) {
    console.error("Error loading storm surge data:", err);
    const container = document.getElementById("surge-chart");
    if (container) {
      container.innerHTML = '<p style="text-align:center;color:#999;">⚠️ Storm surge data unavailable</p>';
    }
  }
}

// Load on page load
loadStormSurgeChart();

// Refresh every 2 hours
setInterval(loadStormSurgeChart, 2 * 60 * 60 * 1000);