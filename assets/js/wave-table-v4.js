/* -----------------------------
   Wave Table Module
   Generates 24-hour wave height summary table
   ----------------------------- */

/**
 * Generate 24-hour wave height summary table
 * @param {Object} chartData - Full chart data object with all buoys
 */
function generateWaveHeightTable(chartData) {
  try {
    if (!chartData) return;

    const table = document.getElementById("wave-height-table");
    if (!table) return;

    const buoyOrder = ["4600146", "4600304", "CRPILE", "4600303", "4600131", "46087", "46088", "46267"];
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
        <th>Crescent Beach Ocean</th>
        <th>Southern Georgia Strait</th>
        <th>Sentry Shoal</th>
        <th>Neah Bay<br><span style="font-size: 0.8em; font-weight: normal; color: #666;">(Swell)</span></th>
        <th>New Dungeness</th>
        <th>Angeles Point</th>
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
        <td>${values["CRPILE"] != null ? values["CRPILE"].toFixed(2) + " m" : "—"}</td>
        <td>${values["4600303"] != null ? values["4600303"] + " m" : "—"}</td>
        <td>${values["4600131"] != null ? values["4600131"] + " m" : "—"}</td>
        <td>${values["46087"] != null ? values["46087"] + " m" : "—"}</td>
        <td>${values["46088"] != null ? values["46088"] + " m" : "—"}</td>
        <td>${values["46267"] != null ? values["46267"] + " m" : "—"}</td>
      </tr>
    `;
  });

  tableHTML += "</tbody>";
  table.innerHTML = tableHTML;
  } catch (error) {
    logger.error('WaveTable', 'Error generating wave height table', error);
    const table = document.getElementById("wave-height-table");
    if (table) {
      table.innerHTML = '<tbody><tr><td colspan="9" style="text-align: center; color: #e53935; padding: 2rem;">Error generating table</td></tr></tbody>';
    }
  }
}
