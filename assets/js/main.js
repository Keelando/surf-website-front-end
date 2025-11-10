// Helper function to create rotated directional arrow
// SVG approach - bulletproof across ALL browsers/devices (fixes Firefox Android tablet bug)
function getDirectionalArrow(degrees, arrowType = 'wind') {
  if (degrees == null || degrees === '—') return '';

  // Meteorological convention: direction indicates WHERE wind/waves are COMING FROM
  const rotation = arrowType === 'wind' ? degrees : degrees + 90;

  // SVG arrows: wind points down, wave points right
  const svg = arrowType === 'wind'
    ? `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2v12m0 0l-3-3m3 3l3-3" stroke="#004b7c" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 8h12m0 0l-3-3m3 3l-3 3" stroke="#004b7c" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;

  return `<span style="display:inline-block;transform:rotate(${rotation}deg);margin-left:0.3rem;vertical-align:middle;">${svg}</span>`;
}

async function loadBuoyData() {
  const container = document.getElementById("buoy-container");
  const timestamp = document.getElementById("timestamp");

  // Grouped by geographic region
  const buoyGroups = [
    {
      region: "Strait of Georgia",
      stations: [
        "4600146", // Halibut Bank
        "4600304", // English Bay
        "4600303", // Southern Georgia Strait
        "4600131", // Sentry Shoal
      ]
    },
    {
      region: "Boundary Bay",
      stations: [
        "CRPILE",  // Crescent Beach Ocean
        "CRCHAN",  // Crescent Channel
      ]
    },
    {
      region: "Juan de Fuca Strait",
      stations: [
        "46087",   // Neah Bay
        "46088",   // New Dungeness
      ]
    }
  ];
  // COLEB excluded - wind-only station, available in charts only

  // Source links for each buoy
  const sourceLinks = {
    "4600146": "https://weather.gc.ca/marine/weatherConditions-currentConditions_e.html?mapID=02&siteID=14305&stationID=46146",
    "4600304": "https://weather.gc.ca/marine/weatherConditions-currentConditions_e.html?mapID=02&siteID=14305&stationID=46304",
    "4600303": "https://weather.gc.ca/marine/weatherConditions-currentConditions_e.html?mapID=02&siteID=14305&stationID=46303",
    "4600131": "https://weather.gc.ca/marine/weatherConditions-currentConditions_e.html?mapID=02&siteID=14305&stationID=46131",
    "46087": "https://www.ndbc.noaa.gov/station_page.php?station=46087",
    "46088": "https://www.ndbc.noaa.gov/station_page.php?station=46088",
    "CRPILE": "https://developers.flowworks.com/",
    "CRCHAN": "https://developers.flowworks.com/",
    "COLEB": "https://developers.flowworks.com/"
  };

  try {
    const response = await fetch(`/data/latest_buoy_v2.json?t=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    container.innerHTML = "";

    // Find most recent observation time
    let mostRecentTime = null;
    Object.values(data).forEach(buoy => {
      if (buoy.observation_time) {
        const time = new Date(buoy.observation_time);
        if (!mostRecentTime || time > mostRecentTime) {
          mostRecentTime = time;
        }
      }
    });

    // Add "Last Updated" header (24-hour, no PT label)
    if (mostRecentTime) {
      const updateHeader = document.createElement("div");
      updateHeader.className = "last-updated-header";
      updateHeader.textContent = `Last Updated: ${mostRecentTime.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "America/Vancouver"
      })}`;
      container.appendChild(updateHeader);
    }

    // Render buoys grouped by region
    buoyGroups.forEach(group => {
      // Create region group container
      const regionGroup = document.createElement("div");
      regionGroup.className = "region-group";

      // Add region header
      const regionHeader = document.createElement("div");
      regionHeader.className = "region-header";
      regionHeader.textContent = group.region;
      regionGroup.appendChild(regionHeader);

      // Create grid container for this region's cards
      const cardsGrid = document.createElement("div");
      cardsGrid.className = "buoy-cards-grid";

      // Render stations in this region
      group.stations.forEach(id => {
        const b = data[id];
        if (!b) return;

        const card = document.createElement("div");
        card.className = "buoy-card";
        card.id = `buoy-${id}`; // Add ID for anchor linking from map

        // Special styling for NOAA buoys
        if (id === "46087" || id === "46088") {
          card.style.borderLeft = "4px solid #003087";
        }

        // Special styling for Surrey FlowWorks stations
        if (id === "CRPILE" || id === "CRCHAN" || id === "COLEB") {
          card.style.borderLeft = "4px solid #006837";
        }

      // Format timestamp in Pacific Time (24-hour, no PT label)
      const updated = b.observation_time
        ? new Date(b.observation_time).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "America/Vancouver",
          })
        : "—";

      // Calculate data age for staleness warning
      const dataAge = b.observation_time 
        ? (Date.now() - new Date(b.observation_time).getTime()) / (1000 * 60) 
        : 999;
      const isStale = dataAge > 180; // 3 hours
      const ageWarning = isStale 
        ? ` <span style="color: #f57c00; font-weight: bold;">⚠️ (${Math.round(dataAge / 60)}h old)</span>` 
        : "";

      // Round wind speeds to integers
      const windSpeed = b.wind_speed != null ? Math.round(b.wind_speed) : "—";
      const windGust = b.wind_gust != null ? Math.round(b.wind_gust) : "—";

      // Build the card content based on buoy type
      let cardContent = `<h2>${b.name || id}`;
      
      // Add source badge
      if (id === "46087" || id === "46088") {
        cardContent += ` <span style="font-size: 0.7em; color: #003087; font-weight: normal;">🇺🇸 NOAA</span>`;
      } else {
        cardContent += ` <span style="font-size: 0.7em; color: #006400; font-weight: normal;">🇨🇦 Env Canada</span>`;
      }
      
      cardContent += `</h2>`;
      cardContent += `<p style="font-size: 0.9em; color: #666; margin-top: -0.5rem;">Last Update: ${updated}${ageWarning}</p>`;
      cardContent += `<div style="margin-top: 1rem;">`;

      // NOAA buoys get enhanced wave display with collapse
if (id === "46087" || id === "46088") {
  // Wind first
  cardContent += `<p class="buoy-metric"><b>💨 Wind:</b> ${windSpeed} kt G ${windGust} kt from ${b.wind_direction_cardinal ?? "—"} (${b.wind_direction ?? "—"}°) ${getDirectionalArrow(b.wind_direction, 'wind')}</p>`;
  
  // Special display for Dungeness (46088) - straddles open sea/inland transition
  if (id === "46088") {
    // Primary: Combined significant wave height
    cardContent += `
      <p class="buoy-metric" style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #eee;"><b>🌊 Significant Wave Height:</b> ${b.wave_height_sig ?? "—"} m</p>
      <p class="buoy-metric"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Average Period:</b> ${b.wave_period_avg ?? "—"} s</p>
      <p class="buoy-metric"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Peak Direction:</b> ${b.wave_direction_peak_cardinal ?? "—"} (${b.wave_direction_peak ?? "—"}°) ${getDirectionalArrow(b.wave_direction_peak, 'wave')}</p>
    `;

    // Collapsible detailed wave breakdown
    const detailsId = `details-${id}`;
    cardContent += `
      <button class="expand-btn" onclick="toggleDetails('${detailsId}')" style="
        margin-top: 0.75rem;
        padding: 0.5rem 1rem;
        background: #f0f4f8;
        border: 1px solid #d0d7de;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9em;
        color: #004b7c;
        font-weight: 600;
        width: 100%;
        text-align: center;
        transition: background 0.2s;
      " onmouseover="this.style.background='#e1e8ed'" onmouseout="this.style.background='#f0f4f8'">
        ▼ Show Wave Component Breakdown
      </button>
      
      <div id="${detailsId}" style="display: none; margin-top: 0.75rem;">
        <p class="buoy-metric" style="font-weight: 600; color: #004b7c; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.25rem;">
          💨 Wind Waves (Local Chop)
        </p>
        <p class="buoy-metric"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Height:</b> ${b.wind_wave_height ?? "—"} m</p>
        <p class="buoy-metric"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Period:</b> ${b.wind_wave_period ?? "—"} s</p>
        <p class="buoy-metric"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Direction:</b> ${b.wind_wave_direction_cardinal ?? "—"} (${b.wind_wave_direction ?? "—"}°) ${getDirectionalArrow(b.wind_wave_direction, 'wave')}</p>

        <p class="buoy-metric" style="margin-top: 0.75rem; font-weight: 600; color: #004b7c; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.25rem;">
          🌊 Ocean Swell (Long Period)
        </p>
        <p class="buoy-metric"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Height:</b> ${b.swell_height ?? "—"} m</p>
        <p class="buoy-metric"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Period:</b> ${b.swell_period ?? "—"} s</p>
        <p class="buoy-metric"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Direction:</b> ${b.swell_direction_cardinal ?? "—"} (${b.swell_direction ?? "—"}°) ${getDirectionalArrow(b.swell_direction, 'wave')}</p>
      </div>
    `;
  } else {
    // Standard NOAA display for 46087 (Neah Bay) - primary swell data
    cardContent += `
      <p class="buoy-metric" style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #eee;"><b>🌊 Swell Height:</b> ${b.swell_height ?? "—"} m</p>
      <p class="buoy-metric"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Swell Period:</b> ${b.swell_period ?? "—"} s</p>
      <p class="buoy-metric"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Direction:</b> ${b.swell_direction_cardinal ?? "—"} (${b.swell_direction ?? "—"}°) ${getDirectionalArrow(b.swell_direction, 'wave')}</p>
    `;

    // Collapsible detailed wave data
    const detailsId = `details-${id}`;
    cardContent += `
      <button class="expand-btn" onclick="toggleDetails('${detailsId}')" style="
        margin-top: 0.75rem;
        padding: 0.5rem 1rem;
        background: #f0f4f8;
        border: 1px solid #d0d7de;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9em;
        color: #004b7c;
        font-weight: 600;
        width: 100%;
        text-align: center;
        transition: background 0.2s;
      " onmouseover="this.style.background='#e1e8ed'" onmouseout="this.style.background='#f0f4f8'">
        ▼ Show Detailed Wave Data
      </button>
      
      <div id="${detailsId}" style="display: none; margin-top: 0.75rem;">
        <p class="buoy-metric" style="font-weight: 600; color: #004b7c; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.25rem;">
          💨 Wind Waves (Local Chop)
        </p>
        <p class="buoy-metric"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Height:</b> ${b.wind_wave_height ?? "—"} m</p>
        <p class="buoy-metric"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Period:</b> ${b.wind_wave_period ?? "—"} s</p>
        <p class="buoy-metric"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Direction:</b> ${b.wind_wave_direction_cardinal ?? "—"} (${b.wind_wave_direction ?? "—"}°) ${getDirectionalArrow(b.wind_wave_direction, 'wave')}</p>

        <p class="buoy-metric" style="margin-top: 0.75rem; font-weight: 600; color: #004b7c; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.25rem;">
          📊 Combined Wave Metrics
        </p>
        <p class="buoy-metric"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Sig. Wave Height:</b> ${b.wave_height_sig ?? "—"} m</p>
        <p class="buoy-metric"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Average Period:</b> ${b.wave_period_avg ?? "—"} s</p>
        <p class="buoy-metric"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Peak Direction:</b> ${b.wave_direction_peak_cardinal ?? "—"} (${b.wave_direction_peak ?? "—"}°) ${getDirectionalArrow(b.wave_direction_peak, 'wave')}</p>
      </div>
    `;
  }
  
  // Temps and pressure (same for all NOAA buoys)
  cardContent += `
    <p class="buoy-metric" style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #eee;"><b>🌡️ Sea Temperature:</b> ${b.sea_temp ?? "—"} °C | <b>Air:</b> ${b.air_temp ?? "—"} °C</p>
    <p class="buoy-metric"><b>⏱️ Pressure:</b> ${b.pressure ?? "—"} hPa</p>
  `;
      } else {
        // Standard Environment Canada wave display

        // Wind first
        cardContent += `<p class="buoy-metric"><b>💨 Wind:</b> ${windSpeed} kt G ${windGust} kt from ${b.wind_direction_cardinal ?? "—"} (${b.wind_direction ?? "—"}°) ${getDirectionalArrow(b.wind_direction, 'wind')}</p>`;

        // Surrey stations (CRPILE, CRCHAN) get special precision formatting
        const isSurrey = (id === "CRPILE" || id === "CRCHAN");

        // Wave height - 2 decimal places for Surrey, default for others
        const waveHeight = b.wave_height_sig != null
          ? (isSurrey ? b.wave_height_sig.toFixed(2) : b.wave_height_sig)
          : "—";

        // Wave period - 1 decimal place for Surrey
        let wavePeriod = "—";
        if (b.wave_period_avg != null) {
          const avgPeriod = isSurrey ? b.wave_period_avg.toFixed(1) : b.wave_period_avg;
          wavePeriod = avgPeriod + " s";
          if (b.wave_period_peak != null) {
            const peakPeriod = isSurrey ? b.wave_period_peak.toFixed(1) : b.wave_period_peak;
            wavePeriod += ` (${peakPeriod} s)`;
          }
        } else if (b.wave_period_peak != null) {
          const peakPeriod = isSurrey ? b.wave_period_peak.toFixed(1) : b.wave_period_peak;
          wavePeriod = `(${peakPeriod} s)`;
        }

        cardContent += `
          <p class="buoy-metric" style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #eee;"><b>🌊 Sig Wave Height:</b> ${waveHeight} m</p>
          <p class="buoy-metric"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Wave Period:</b> ${wavePeriod}</p>
          <p class="buoy-metric"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Direction (Peak):</b> ${b.wave_direction_peak_cardinal ?? "—"} (${b.wave_direction_peak ?? "—"}°) ${getDirectionalArrow(b.wave_direction_peak, 'wave')}</p>
        `;

        // Temps - 1 decimal place for Surrey
        const seaTemp = b.sea_temp != null
          ? (isSurrey ? b.sea_temp.toFixed(1) : b.sea_temp)
          : "—";
        const airTemp = b.air_temp != null
          ? (isSurrey ? b.air_temp.toFixed(1) : b.air_temp)
          : "—";

        // Temps and pressure
        cardContent += `
          <p class="buoy-metric" style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #eee;"><b>🌡️ Sea Temperature:</b> ${seaTemp} °C | <b>Air:</b> ${airTemp} °C</p>
          <p class="buoy-metric"><b>⏱️ Pressure:</b> ${b.pressure ?? "—"} hPa</p>
        `;
      }

      // Check if we have sufficient data for charts
      const hasChartData = b.wave_height_sig != null || b.wind_speed != null;
      const chartButtonDisabled = !hasChartData ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : '';

      // Add navigation links
      cardContent += `
        <div class="buoy-nav-links">
          <button class="buoy-nav-link" onclick="scrollToMap('${id}')">
            📍 View Location
          </button>
          <button class="buoy-nav-link" onclick="scrollToCharts('${id}')" ${chartButtonDisabled}>
            📊 View Charts
          </button>
        </div>
      `;

      // Add source link at the bottom of the card
      if (sourceLinks[id]) {
        cardContent += `
          <p style="margin-top: 0.75rem; margin-bottom: 0; padding-top: 0.5rem; border-top: 1px solid #e0e0e0; text-align: center;">
            <a href="${sourceLinks[id]}" target="_blank" rel="noopener noreferrer" style="
              font-size: 0.85em;
              color: #004b7c;
              text-decoration: none;
              font-weight: 500;
            " onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">
              🔗 View Source Data
            </a>
          </p>
        `;
      }

        cardContent += `</div>`;
        card.innerHTML = cardContent;
        cardsGrid.appendChild(card);
      }); // end stations forEach

      // Add grid to region group, then add region group to container
      regionGroup.appendChild(cardsGrid);
      container.appendChild(regionGroup);
    }); // end buoyGroups forEach

    const now = new Date();
    timestamp.textContent = `Page refreshed at ${now.toLocaleString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "America/Vancouver"
    })}`;
  } catch (err) {
    console.error("Error loading buoy data:", err);
    container.innerHTML =
      `<p class="error">⚠️ Error loading buoy data. Please try again later.</p>`;
  }
}

// Toggle function for expandable details
function toggleDetails(detailsId) {
  const details = document.getElementById(detailsId);
  const button = event.target;

  if (details.style.display === "none") {
    details.style.display = "block";
    button.textContent = "▲ Hide Detailed Wave Data";
  } else {
    details.style.display = "none";
    button.textContent = "▼ Show Detailed Wave Data";
  }
}

// Scroll to charts section and select buoy
function scrollToCharts(buoyId) {
  const buoySelector = document.getElementById('buoy-selector');
  const chartsSection = document.getElementById('charts-section');

  // Prefer scrolling to the selector dropdown if it exists
  const scrollTarget = buoySelector || chartsSection;
  if (!scrollTarget) return;

  // Smooth scroll to buoy selector
  scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Wait for scroll to complete, then trigger chart selection
  setTimeout(() => {
    const chartSelect = document.getElementById('chart-buoy-select');
    if (chartSelect) {
      chartSelect.value = buoyId;
      chartSelect.dispatchEvent(new Event('change'));

      // Add highlight pulse effect to the selector
      if (buoySelector) {
        buoySelector.classList.add('highlight-pulse');
        setTimeout(() => buoySelector.classList.remove('highlight-pulse'), 2000);
      }
    }
  }, 800);
}

// Scroll to map section and center on buoy
function scrollToMap(buoyId) {
  const mapSection = document.getElementById('map-section');
  if (!mapSection) return;

  // Smooth scroll to map section
  mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Wait for scroll to complete, then center map on buoy
  setTimeout(() => {
    if (typeof window.centerMapOnBuoy === 'function') {
      window.centerMapOnBuoy(buoyId);

      // Add highlight pulse effect
      mapSection.classList.add('highlight-pulse');
      setTimeout(() => mapSection.classList.remove('highlight-pulse'), 2000);
    }
  }, 800);
}

// Toggle region collapse/expand
function toggleRegion(regionName) {
  const regionGroup = document.getElementById(`region-${regionName.replace(/\s+/g, '-')}`);
  if (!regionGroup) return;

  const cardsGrid = regionGroup.querySelector('.buoy-cards-grid');
  const toggleBtn = regionGroup.querySelector('.region-toggle-btn');

  if (cardsGrid && toggleBtn) {
    const isHidden = cardsGrid.style.display === 'none';
    cardsGrid.style.display = isHidden ? 'grid' : 'none';
    toggleBtn.textContent = isHidden ? '▼' : '▶';

    // Save state to localStorage
    const regionKey = `region-${regionName}-collapsed`;
    localStorage.setItem(regionKey, isHidden ? 'false' : 'true');
  }
}

// Toggle card details (full metrics)
function toggleCardDetails(buoyId) {
  const detailsDiv = document.getElementById(`card-details-${buoyId}`);
  const button = document.querySelector(`#buoy-${buoyId} .toggle-details-btn`);

  if (detailsDiv && button) {
    const isHidden = detailsDiv.style.display === 'none';
    detailsDiv.style.display = isHidden ? 'block' : 'none';
    button.textContent = isHidden ? '▲ Hide Details' : '▼ Show Details';
  }
}

// Toggle card history table
async function toggleCardHistory(buoyId) {
  const historyDiv = document.getElementById(`card-history-${buoyId}`);
  const button = document.querySelector(`#buoy-${buoyId} .toggle-history-btn`);

  if (!historyDiv || !button) return;

  const isHidden = historyDiv.style.display === 'none';

  if (isHidden) {
    // Load and display history
    button.textContent = 'Loading...';
    button.disabled = true;

    try {
      const response = await fetch(`/data/buoy_timeseries_24h.json?t=${Date.now()}`);
      if (!response.ok) throw new Error('Failed to fetch timeseries data');

      const timeseriesData = await response.json();
      const buoyData = timeseriesData[buoyId];

      if (buoyData && buoyData.timeseries) {
        historyDiv.innerHTML = renderHistoryTable(buoyId, buoyData.timeseries);
        historyDiv.style.display = 'block';
        button.textContent = '▲ Hide History';
        button.disabled = false;
      } else {
        historyDiv.innerHTML = '<p style="color: #999; text-align: center; padding: 1rem;">No historical data available</p>';
        historyDiv.style.display = 'block';
        button.textContent = '▲ Hide History';
        button.disabled = false;
      }
    } catch (error) {
      console.error('Error loading history:', error);
      historyDiv.innerHTML = '<p style="color: #e53935; text-align: center; padding: 1rem;">Error loading historical data</p>';
      historyDiv.style.display = 'block';
      button.textContent = '▲ Hide History';
      button.disabled = false;
    }
  } else {
    historyDiv.style.display = 'none';
    button.textContent = '▼ Show History (24h)';
  }
}

// Render history table
function renderHistoryTable(buoyId, timeseries) {
  // Get the most recent 12 hourly observations
  const windSpeed = timeseries.wind_speed?.data || [];
  const windDir = timeseries.wind_direction?.data || [];
  const windGust = timeseries.wind_gust?.data || [];
  const waveHeight = timeseries.wave_height_sig?.data || [];
  const wavePeriod = timeseries.wave_period_avg?.data || [];
  const airTemp = timeseries.air_temp?.data || [];
  const seaTemp = timeseries.sea_temp?.data || [];

  // Find common timestamps
  const times = windSpeed.map(d => d.time).slice(-12);

  let tableHTML = `
    <div style="overflow-x: auto; margin-top: 1rem;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="padding: 0.5rem; border: 1px solid #ddd; text-align: left;">Time</th>
            <th style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">Wind</th>
            <th style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">Gust</th>
            <th style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">Wave Ht</th>
            <th style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">Period</th>
            <th style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">Air °C</th>
            <th style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">Sea °C</th>
          </tr>
        </thead>
        <tbody>
  `;

  times.forEach(time => {
    const windSpeedVal = windSpeed.find(d => d.time === time)?.value;
    const windGustVal = windGust.find(d => d.time === time)?.value;
    const waveHeightVal = waveHeight.find(d => d.time === time)?.value;
    const wavePeriodVal = wavePeriod.find(d => d.time === time)?.value;
    const airTempVal = airTemp.find(d => d.time === time)?.value;
    const seaTempVal = seaTemp.find(d => d.time === time)?.value;

    const timeStr = new Date(time).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Vancouver'
    });

    tableHTML += `
      <tr>
        <td style="padding: 0.5rem; border: 1px solid #ddd;">${timeStr}</td>
        <td style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">${windSpeedVal != null ? Math.round(windSpeedVal) + ' kt' : '—'}</td>
        <td style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">${windGustVal != null ? Math.round(windGustVal) + ' kt' : '—'}</td>
        <td style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">${waveHeightVal != null ? waveHeightVal.toFixed(2) + ' m' : '—'}</td>
        <td style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">${wavePeriodVal != null ? wavePeriodVal.toFixed(1) + ' s' : '—'}</td>
        <td style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">${airTempVal != null ? airTempVal.toFixed(1) : '—'}</td>
        <td style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">${seaTempVal != null ? seaTempVal.toFixed(1) : '—'}</td>
      </tr>
    `;
  });

  tableHTML += `
        </tbody>
      </table>
    </div>
  `;

  return tableHTML;
}

loadBuoyData();
setInterval(loadBuoyData, 5 * 60 * 1000);
