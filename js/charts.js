// ============================================================================
// charts.js — tiny hand-rolled SVG charts (single-series line + bars).
// Anatomy per dataviz method: 2px lines, ≥8px tappable markers, recessive
// grid, selective direct labels, text in text tokens. Single series → no
// legend (the card title names it). Tap a point to read its value.
// ============================================================================
const NS = 'http://www.w3.org/2000/svg';
export const SERIES = '#60a5fa';   // single-series mark color (≥3:1 on card surface)

const fmtVal = (v, unit) => `${Math.round(v * 10) / 10}${unit ? ` ${unit}` : ''}`;

// points: [{x, y, label?}] sorted by x. Returns SVG markup string.
export function lineChart(points, { unit = '', height = 150, color = SERIES, yFmt } = {}) {
  if (!points.length) return '<div class="chart-empty">No data yet</div>';
  const W = 520, H = height, padL = 34, padR = 14, padT = 22, padB = 18;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  let ymin = Math.min(...ys), ymax = Math.max(...ys);
  if (ymin === ymax) { ymin -= 1; ymax += 1; }
  const yPad = (ymax - ymin) * 0.15;
  ymin -= yPad; ymax += yPad;
  const X = (x) => xmax === xmin ? (padL + (W - padL - padR) / 2) : padL + ((x - xmin) / (xmax - xmin)) * (W - padL - padR);
  const Y = (y) => padT + (1 - (y - ymin) / (ymax - ymin)) * (H - padT - padB);
  const fmt = yFmt || ((v) => fmtVal(v, ''));

  // recessive grid: 3 horizontal lines
  const gridVals = [0.25, 0.5, 0.75].map((t) => ymin + t * (ymax - ymin));
  const grid = gridVals.map((v) =>
    `<line x1="${padL}" x2="${W - padR}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/>
     <text x="${padL - 5}" y="${Y(v) + 3}" text-anchor="end" font-size="9" fill="var(--faint)">${fmt(v)}</text>`
  ).join('');

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');

  // markers: visible 4px dot + 22px invisible tap target
  const dots = points.map((p, i) => `
    <circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="4" fill="${color}" stroke="var(--card)" stroke-width="2"/>
    <circle class="chart-pt" data-v="${escapeAttr(p.label || fmtVal(p.y, unit))}" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="14" fill="transparent"/>`).join('');

  // selective direct labels: last point always; max point if distinct
  const last = points[points.length - 1];
  let maxP = points[0];
  for (const p of points) if (p.y > maxP.y) maxP = p;
  const labels = [
    `<text x="${X(last.x).toFixed(1)}" y="${(Y(last.y) - 9).toFixed(1)}" text-anchor="${X(last.x) > W - 60 ? 'end' : 'middle'}" font-size="10.5" font-weight="700" fill="var(--text)">${fmtVal(last.y, unit)}</text>`,
    maxP !== last && points.length > 2
      ? `<text x="${X(maxP.x).toFixed(1)}" y="${(Y(maxP.y) - 9).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="700" fill="var(--dim)">${fmtVal(maxP.y, unit)}</text>`
      : '',
  ].join('');

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img">
    ${grid}
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}${labels}
    <text class="chart-readout" x="${W - padR}" y="14" text-anchor="end" font-size="11" font-weight="700" fill="var(--accent)"></text>
  </svg>`;
}

// bars: [{label, y}] — thin rounded bars with 2px gaps, value on tap
export function barChart(bars, { unit = '', height = 150, color = SERIES, maxY } = {}) {
  if (!bars.length) return '<div class="chart-empty">No data yet</div>';
  const W = 520, H = height, padL = 8, padR = 8, padT = 20, padB = 22;
  const ymax = maxY ?? Math.max(...bars.map((b) => b.y), 1);
  const iw = (W - padL - padR) / bars.length;
  const bw = Math.min(26, Math.max(6, iw - 2)); // 2px surface gap between bars
  const rects = bars.map((b, i) => {
    const x = padL + i * iw + (iw - bw) / 2;
    const h = Math.max(2, (b.y / ymax) * (H - padT - padB));
    const y = H - padB - h;
    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="4" fill="${color}"/>
      <rect class="chart-pt" data-v="${escapeAttr(`${b.label}: ${fmtVal(b.y, unit)}`)}" x="${(padL + i * iw).toFixed(1)}" y="0" width="${iw.toFixed(1)}" height="${H}" fill="transparent"/>
      ${bars.length <= 16 ? `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 7}" text-anchor="middle" font-size="9" fill="var(--faint)">${b.label}</text>` : ''}`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img">
    <line x1="${padL}" x2="${W - padR}" y1="${H - padB}" y2="${H - padB}" stroke="var(--line)" stroke-width="1"/>
    ${rects}
    <text class="chart-readout" x="${W - padR}" y="13" text-anchor="end" font-size="11" font-weight="700" fill="var(--accent)"></text>
  </svg>`;
}

const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Tap-to-read tooltip: delegated once. Tapping a marker writes its value into
// the chart's readout corner.
document.addEventListener('click', (e) => {
  const pt = e.target.closest?.('.chart-pt');
  if (!pt) return;
  const svg = pt.closest('svg');
  const readout = svg?.querySelector('.chart-readout');
  if (readout) readout.textContent = pt.dataset.v;
});
