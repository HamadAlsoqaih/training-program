// ============================================================================
// progress.js — dashboard: overall stats, phase timeline, heatmap, charts,
// fatigue check-in, notes timeline.
// ============================================================================
import { h, svgRing } from '../util.js';
import { PHASES, EX, getDay, dayExercises, getWeek } from '../program.js';
import * as store from '../state.js';
import { dayProgress, weekProgress, historyFor } from '../completion.js';
import { todayId, todayIndex, indexToId, idToIndex, dateForId, fmtDate } from '../schedule.js';
import { fmtMs } from '../timers.js';
import { lineChart, barChart } from '../charts.js';
import { historySheet } from './sheets.js';

export function renderProgress(rerender) {
  const s = store.get();
  const tIdx = todayIndex();
  const curWeek = Math.floor(tIdx / 7) + 1;

  // ---- aggregate stats ----------------------------------------------------
  let doneDays = 0, skippedDays = 0, realDone = 0, cardioDone = 0, cardioTotal = 0;
  let weeksDone = 0;
  const statuses = [];
  for (let i = 0; i <= 104; i++) {
    const id = indexToId(i);
    const p = dayProgress(id);
    const rec = store.day(id);
    statuses.push({ i, id, p, rec });
    if (p.status === 'done') { doneDays++; if (!rec?.auto) realDone++; }
    if (p.status === 'skipped') skippedDays++;
    // cardio: days 1–6 have cardio; count within elapsed schedule
    const d = (i % 7) + 1;
    if (d !== 7 && i <= tIdx) {
      cardioTotal++;
      if (rec?.auto) cardioDone++;
      else if (rec && cardioTicked(id, rec)) cardioDone++;
    }
  }
  for (let w = 1; w <= 15; w++) if (weekProgress(w).complete) weeksDone++;
  const overallPct = doneDays / 105;

  // streak: consecutive closed (done) days ending at the last closed day
  let streak = 0;
  for (let i = Math.min(tIdx, 104); i >= 0; i--) {
    const p = statuses[i].p;
    if (p.status === 'done') streak++;
    else if (p.status === 'skipped') continue;
    else if (i === tIdx) continue; // today still open doesn't break streak
    else break;
  }
  // adherence among elapsed days (excluding future)
  const elapsed = statuses.filter((x) => x.i <= tIdx);
  const closedElapsed = elapsed.filter((x) => x.p.status === 'done').length;
  const adherence = elapsed.length ? Math.round((closedElapsed / elapsed.length) * 100) : 0;

  const container = h('div', h('div', { class: 'h1', style: 'margin-bottom:10px' }, 'Progress'));

  // hero
  container.append(h('div', { class: 'hero' },
    h('div', { class: 'ring-mini', style: 'width:74px;height:74px' },
      h('span', { html: svgRing(overallPct, 74, 7, 'var(--good)') }),
      h('span', { class: 'v', style: 'font-size:15px' }, `${Math.round(overallPct * 100)}%`),
    ),
    h('div', { class: 'grow' },
      h('div', { class: 'bignum' }, `Week ${curWeek}`, h('span', { class: 'dim', style: 'font-size:17px;font-weight:600' }, ' / 15')),
      h('div', { class: 'small dim' }, `${doneDays} of 105 days complete`),
    ),
  ));

  // stat grid
  container.append(h('div', { class: 'statgrid' },
    h('div', { class: 'stat' }, h('div', { class: 'v' }, `${streak}`), h('div', { class: 'k' }, 'day streak')),
    h('div', { class: 'stat' }, h('div', { class: 'v' }, `${adherence}%`), h('div', { class: 'k' }, 'adherence')),
    h('div', { class: 'stat' }, h('div', { class: 'v' }, `${weeksDone}`), h('div', { class: 'k' }, 'weeks done')),
    h('div', { class: 'stat' }, h('div', { class: 'v' }, `${skippedDays}`), h('div', { class: 'k' }, 'skipped')),
    h('div', { class: 'stat' }, h('div', { class: 'v' }, `${Math.round((cardioDone / Math.max(1, cardioTotal)) * 100)}%`), h('div', { class: 'k' }, 'cardio')),
    h('div', { class: 'stat' }, h('div', { class: 'v' }, totalTime(statuses)), h('div', { class: 'k' }, 'gym time')),
  ));

  // phase timeline
  container.append(h('div', { class: 'card' },
    h('div', { class: 'h2', style: 'font-size:14px' }, 'Phase timeline'),
    h('div', { class: 'phasebar' }, ...PHASES.map((ph) => {
      const span = ph.weeks[1] - ph.weeks[0] + 1;
      let done = 0, tot = 0;
      for (let w = ph.weeks[0]; w <= ph.weeks[1]; w++) {
        const wp = weekProgress(w);
        done += wp.doneDays + wp.skipped; tot += 7;
      }
      return h('div', { style: `flex:${span}` },
        h('i', { style: `--p:${Math.round((done / tot) * 100)}%;background:${ph.color}` }));
    })),
    h('div', { class: 'row tiny faint', style: 'justify-content:space-between' },
      ...PHASES.map((ph) => h('span', {}, `P${ph.n}`))),
  ));

  // VO2 swap reminder (after week 6, once)
  if (curWeek >= 6 && !s.settings.vo2SwapAck) {
    container.append(h('div', { class: 'banner' },
      h('div', { style: 'font-weight:700;margin-bottom:4px' }, '🫁 Program note: VO2 max swap'),
      'You\'re past month 1–2 — the program says to swap one incline-walk session per week for VO2 max work. ',
      h('button', {
        class: 'btn sm', style: 'margin-top:8px',
        onclick: () => { store.update((st) => { st.settings.vo2SwapAck = true; }); rerender(); },
      }, 'Got it — doing this'),
    ));
  }

  // fatigue check-in
  container.append(fatigueCard(curWeek, rerender));

  // heatmap
  container.append(heatmapCard(statuses, tIdx));

  // session duration chart
  const durs = statuses
    .filter((x) => x.rec?.elapsedMs && !x.rec.auto)
    .map((x) => ({ x: x.i, y: Math.round(x.rec.elapsedMs / 60000), label: `${labelOf(x.id)}: ${fmtMs(x.rec.elapsedMs)}` }));
  container.append(h('div', { class: 'card' },
    h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:6px' }, 'Session duration (min)'),
    h('div', { class: 'chartwrap', html: durs.length >= 2 ? lineChart(durs, { unit: 'min' }) : '<div class="chart-empty">Complete workouts with the timer running to see your durations here.</div>' }),
  ));

  // lift progression
  container.append(liftCard());

  // weekly volume (sets completed per week)
  const weekly = [];
  for (let w = 1; w <= 15; w++) {
    let sets = 0;
    for (let d = 1; d <= 7; d++) {
      const rec = store.day(`w${w}d${d}`);
      if (!rec || rec.auto) continue;
      for (const exRec of Object.values(rec.ex || {})) {
        sets += (exRec.sets || []).filter((x) => x?.done).length;
      }
    }
    weekly.push({ label: `W${w}`, y: sets });
  }
  if (weekly.some((b) => b.y > 0)) {
    container.append(h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:6px' }, 'Sets completed per week'),
      h('div', { class: 'chartwrap', html: barChart(weekly, { unit: 'sets' }) }),
    ));
  }

  // notes timeline
  const notes = statuses.filter((x) => x.rec?.note).reverse().slice(0, 20);
  if (notes.length) {
    container.append(h('div', { class: 'section-title' }, 'Notes'));
    for (const x of notes) {
      container.append(h('a', { class: 'card', style: 'display:block;padding:10px 12px', href: `#/day/${x.id}` },
        h('div', { class: 'tiny faint', style: 'font-weight:700' }, `${labelOf(x.id)} · ${fmtDate(dateForId(x.id))}`),
        h('div', { class: 'small dim', style: 'margin-top:3px;white-space:pre-wrap' }, x.rec.note),
      ));
    }
  }

  return container;
}

const labelOf = (id) => { const d = getDay(id); return `W${d.week} ${d.name.slice(0, 3)}`; };

function cardioTicked(id, rec) {
  const day = getDay(id);
  for (const e of dayExercises(day)) {
    if (e.item.ex !== 'incline_walk') continue;
    const ex = rec.ex?.[e.key];
    if (ex?.sets?.[0]?.done) return true;
  }
  return false;
}

function totalTime(statuses) {
  let ms = 0;
  for (const x of statuses) if (x.rec?.elapsedMs && !x.rec.auto) ms += x.rec.elapsedMs;
  const hours = ms / 3600000;
  return hours >= 10 ? `${Math.round(hours)}h` : `${Math.round(hours * 10) / 10}h`;
}

// ---- heatmap ----------------------------------------------------------------
function heatmapCard(statuses, tIdx) {
  const cells = [h('div')]; // corner
  for (const dn of ['W', 'T', 'F', 'S', 'S', 'M', 'T']) cells.push(h('div', { class: 'wk', style: 'justify-content:center' }, dn));
  for (let w = 1; w <= 15; w++) {
    cells.push(h('div', { class: 'wk' }, `${w}`));
    for (let d = 1; d <= 7; d++) {
      const i = (w - 1) * 7 + (d - 1);
      const x = statuses[i];
      const isRest = d === 7;
      let cls = 'hcell';
      let glyph = '';
      if (x.p.status === 'done') { cls += x.rec?.auto ? ' auto' : ' done'; }
      else if (x.p.status === 'skipped') { cls += ' skip'; glyph = '×'; }
      else if (x.p.pct > 0) { cls += ' part'; glyph = '◐'; }
      if (isRest && !x.p.status) cls += ' rest';
      if (i === tIdx) cls += ' today';
      cells.push(h('a', {
        class: cls, href: `#/day/${x.id}`,
        style: 'display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#0b0f16',
      }, glyph));
    }
  }
  return h('div', { class: 'card' },
    h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:8px' }, 'All 105 days'),
    h('div', { class: 'heatmap' }, cells),
    h('div', { class: 'row tiny faint', style: 'margin-top:8px;flex-wrap:wrap;gap:6px 12px' },
      legend('var(--good)', 'done'),
      legend('rgba(52,211,153,.35)', 'assumed'),
      legend('rgba(251,191,36,.5)', '◐ partial'),
      legend('var(--bad)', '× skipped'),
      legend('var(--card2)', 'open'),
    ),
  );
}
const legend = (color, label) => h('span', { class: 'row', style: 'gap:4px' },
  h('span', { style: `width:10px;height:10px;border-radius:3px;background:${color};border:1px solid var(--line)` }), label);

// ---- lift progression --------------------------------------------------------
const LIFTS = ['squat', 'leg_press', 'hip_thrust', 'nordics', 'leg_ext', 'ham_curl', 'calf_raise', 'lateral_raise', 'pec_deck', 'low_row', 'seated_row', 'triceps', 'biceps'];
let liftSel = 'squat';

function liftCard() {
  const withData = LIFTS.filter((id) => historyFor(id).some((e) => e.sets.some((s) => s.weight != null)));
  const options = withData.length ? withData : LIFTS;
  if (!options.includes(liftSel)) liftSel = options[0];
  const hist = historyFor(liftSel);
  const pts = hist.map((e) => {
    const ws = e.sets.filter((s) => s.weight != null).map((s) => +s.weight);
    return ws.length ? { x: e.index, y: Math.max(...ws), label: `${labelOf(e.dayId)}: ${Math.max(...ws)} kg` } : null;
  }).filter(Boolean);

  const sel = h('select', { class: 'sel', style: 'height:40px;font-size:14px' },
    ...options.map((id) => h('option', { value: id, selected: id === liftSel }, EX[id].name)));
  const chartBox = h('div', { class: 'chartwrap' });
  const draw = () => {
    const hist2 = historyFor(liftSel);
    const p2 = hist2.map((e) => {
      const ws = e.sets.filter((s) => s.weight != null).map((s) => +s.weight);
      return ws.length ? { x: e.index, y: Math.max(...ws), label: `${labelOf(e.dayId)}: ${Math.max(...ws)} kg` } : null;
    }).filter(Boolean);
    chartBox.innerHTML = p2.length >= 2 ? lineChart(p2, { unit: 'kg' })
      : '<div class="chart-empty">Log weights on this exercise across 2+ sessions to see the trend.</div>';
  };
  sel.addEventListener('change', () => { liftSel = sel.value; draw(); });
  draw();

  return h('div', { class: 'card' },
    h('div', { class: 'row', style: 'margin-bottom:8px' },
      h('div', { class: 'h2 grow', style: 'font-size:14px' }, 'Lift progression — top set (kg)'),
      h('button', { class: 'btn sm', onclick: () => historySheet(liftSel) }, 'log'),
    ),
    sel, h('div', { style: 'height:8px' }), chartBox,
  );
}

// ---- fatigue check-in --------------------------------------------------------
function fatigueCard(curWeek, rerender) {
  const s = store.get();
  const thisWeek = s.fatigue.find((f) => f.week === curWeek);
  const low = s.fatigue.slice(-2).filter((f) => f.rating <= 2).length >= 2 || (thisWeek && thisWeek.rating <= 2);

  const card = h('div', { class: 'card' },
    h('div', { class: 'h2', style: 'font-size:14px' }, `Weekly fatigue check — how did your jumps feel? (Week ${curWeek})`),
    h('div', { class: 'tiny faint', style: 'margin:2px 0 10px' }, '1 = dead legs · 5 = springy'),
  );
  const btns = h('div', { class: 'fatiguebtns' },
    ...[1, 2, 3, 4, 5].map((r) => h('button', {
      class: thisWeek?.rating === r ? 'on' : '',
      onclick: () => {
        store.update((st) => {
          st.fatigue = st.fatigue.filter((f) => f.week !== curWeek);
          st.fatigue.push({ week: curWeek, rating: r, at: Date.now() });
          st.fatigue.sort((a, b) => a.week - b.week);
        });
        rerender();
      },
    }, ['😵', '😮‍💨', '😐', '🙂', '⚡'][r - 1])));
  card.append(btns);
  if (low) {
    card.append(h('div', { class: 'banner deload', style: 'margin:10px 0 0' },
      'Jump performance is dropping → program rule: reduce cardio to 5 days/week or lower the incline temporarily.'));
  }
  if (thisWeek) card.append(h('div', { class: 'tiny faint', style: 'margin-top:8px' }, `Logged for week ${curWeek}. Tap to change.`));
  return card;
}
