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

  // Order of display (match JSON buoy IDs)
  const order = [
    "4600146", // Halibut Bank
    "4600304", // English Bay
    "CRPILE",  // Crescent Pile (Boundary Bay)
    "CRCHAN",  // Crescent Channel
    "4600303", // Southern Georgia Strait
    "4600131", // Sentry Shoal
    "46087",   // Neah Bay
    "46088",   // New Dungeness
    // COLEB excluded - wind-only station, available in charts only
  ];

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
      updateHeader.style.cssText = "text-align: center; font-size: 1.1em; margin-bottom: 1.5rem; color: #004b7c; font-weight: bold;";
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

    order.forEach(id => {
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
        
        // Wave data
        let wavePeriod = "—";
        if (b.wave_period_avg != null) {
          wavePeriod = b.wave_period_avg + " s";
          if (b.wave_period_peak != null) {
            wavePeriod += ` (${b.wave_period_peak} s)`;
          }
        } else if (b.wave_period_peak != null) {
          wavePeriod = `(${b.wave_period_peak} s)`;
        }

        cardContent += `
          <p class="buoy-metric" style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #eee;"><b>🌊 Sig Wave Height:</b> ${b.wave_height_sig ?? "—"} m</p>
          <p class="buoy-metric"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Wave Period:</b> ${wavePeriod}</p>
          <p class="buoy-metric"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Direction (Peak):</b> ${b.wave_direction_peak_cardinal ?? "—"} (${b.wave_direction_peak ?? "—"}°) ${getDirectionalArrow(b.wave_direction_peak, 'wave')}</p>
        `;
        
        // Temps and pressure
        cardContent += `
          <p class="buoy-metric" style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #eee;"><b>🌡️ Sea Temperature:</b> ${b.sea_temp ?? "—"} °C | <b>Air:</b> ${b.air_temp ?? "—"} °C</p>
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
      container.appendChild(card);
    });

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

loadBuoyData();
setInterval(loadBuoyData, 5 * 60 * 1000);
