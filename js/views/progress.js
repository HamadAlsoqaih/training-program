// ============================================================================
// progress.js — dashboard for the ACTIVE program: headline stats, this-week
// vs last-week, phase timeline, full heatmap, charts, fatigue check-in, notes.
// ============================================================================
import { h, svgRing } from '../util.js';
import {
  EX, getDay, getProgram, totalDays, totalWeeks, dayExercises,
} from '../program.js';
import * as store from '../state.js';
import { dayProgress, weekProgress, historyFor, plannedDay } from '../completion.js';
import { todayIndex, indexToId, dateForId, fmtDate, weekdayName, currentWeek } from '../schedule.js';
import { fmtMs } from '../timers.js';
import { lineChart, barChart } from '../charts.js';
import { jumpVolumeByWeek, spikeCheck, freestyleBlocks, FREESTYLE } from '../analytics.js';
import { historySheet } from './sheets.js';

export function renderProgress(rerender) {
  const pid = store.activePid();
  const program = getProgram(pid);
  const s = store.get();
  const nDays = totalDays(pid);
  const tIdx = todayIndex();
  const curWeek = currentWeek(pid);

  // ---- one pass over the program's days ----------------------------------
  let doneDays = 0, skippedDays = 0, cardioDone = 0, cardioTotal = 0, weeksDone = 0;
  const statuses = [];
  for (let i = 0; i < nDays; i++) {
    const id = indexToId(i);
    const p = dayProgress(pid, id);
    const rec = store.day(id, pid);
    statuses.push({ i, id, p, rec });
    if (p.status === 'done') doneDays++;
    if (p.status === 'skipped') skippedDays++;
    const d = (i % 7) + 1;
    if (d !== 7 && i <= tIdx) {
      cardioTotal++;
      if (rec?.auto || (rec && cardioTicked(pid, id, rec))) cardioDone++;
    }
  }
  for (let w = 1; w <= totalWeeks(pid); w++) if (weekProgress(pid, w).complete) weeksDone++;
  const overallPct = doneDays / nDays;

  let streak = 0;
  for (let i = Math.min(tIdx, nDays - 1); i >= 0; i--) {
    const p = statuses[i].p;
    if (p.status === 'done') streak++;
    else if (p.status === 'skipped') continue;
    else if (i === tIdx) continue;
    else break;
  }
  const elapsed = statuses.filter((x) => x.i <= tIdx);
  const closedElapsed = elapsed.filter((x) => x.p.status === 'done').length;
  const adherence = elapsed.length ? Math.round((closedElapsed / elapsed.length) * 100) : 0;

  const container = h('div',
    h('div', { class: 'row', style: 'margin-bottom:10px' },
      h('div', { class: 'h1 grow' }, 'Progress'),
      h('a', { class: 'chip', href: `#/program/${pid}` }, program.name),
    ));

  container.append(h('div', { class: 'hero' },
    h('div', { class: 'ring-mini', style: 'width:74px;height:74px' },
      h('span', { html: svgRing(overallPct, 74, 7, 'var(--good)') }),
      h('span', { class: 'v', style: 'font-size:15px' }, `${Math.round(overallPct * 100)}%`)),
    h('div', { class: 'grow' },
      h('div', { class: 'bignum' }, `Week ${curWeek}`,
        h('span', { class: 'dim', style: 'font-size:17px;font-weight:600' }, ` / ${program.weeks}`)),
      h('div', { class: 'small dim' }, `${doneDays} of ${nDays} days complete`),
    ),
  ));

  container.append(h('div', { class: 'statgrid' },
    h('div', { class: 'stat' }, h('div', { class: 'v' }, `${streak}`), h('div', { class: 'k' }, 'day streak')),
    h('div', { class: 'stat' }, h('div', { class: 'v' }, `${adherence}%`), h('div', { class: 'k' }, 'adherence')),
    h('div', { class: 'stat' }, h('div', { class: 'v' }, `${weeksDone}`), h('div', { class: 'k' }, 'weeks done')),
    h('div', { class: 'stat' }, h('div', { class: 'v' }, `${skippedDays}`), h('div', { class: 'k' }, 'skipped')),
    h('div', { class: 'stat' }, h('div', { class: 'v' }, `${Math.round((cardioDone / Math.max(1, cardioTotal)) * 100)}%`), h('div', { class: 'k' }, 'cardio')),
    h('div', { class: 'stat' }, h('div', { class: 'v' }, totalTime(statuses)), h('div', { class: 'k' }, 'gym time')),
  ));

  container.append(weeklyCompareCard(pid, curWeek));
  const jumpCard = jumpVolumeCard();
  if (jumpCard) container.append(jumpCard);

  // phase timeline
  container.append(h('div', { class: 'card' },
    h('div', { class: 'h2', style: 'font-size:14px' }, 'Phase timeline'),
    h('div', { class: 'phasebar' }, ...program.phases.map((ph) => {
      const span = ph.weeks[1] - ph.weeks[0] + 1;
      let done = 0, tot = 0;
      for (let w = ph.weeks[0]; w <= ph.weeks[1]; w++) {
        const wp = weekProgress(pid, w);
        done += wp.doneDays + wp.skipped; tot += 7;
      }
      return h('div', { style: `flex:${span}` },
        h('i', { style: `--p:${Math.round((done / tot) * 100)}%;background:${ph.color}` }));
    })),
    h('div', { class: 'row tiny faint', style: 'justify-content:space-between' },
      ...program.phases.map((ph) => h('span', {}, `P${ph.n}`))),
  ));

  if (curWeek >= 6 && !s.settings.vo2SwapAck) {
    container.append(h('div', { class: 'banner' },
      h('div', { style: 'font-weight:700;margin-bottom:4px' }, '🫁 Program note: VO2 max swap'),
      'You’re past month 1–2 — the program says to swap one incline-walk session per week for VO2 max work. ',
      h('button', {
        class: 'btn sm', style: 'margin-top:8px',
        onclick: () => { store.update((st) => { st.settings.vo2SwapAck = true; }); rerender(); },
      }, 'Got it — doing this'),
    ));
  }

  container.append(fatigueCard(pid, curWeek, rerender));
  container.append(heatmapCard(pid, statuses, tIdx, totalWeeks(pid)));

  const durs = statuses
    .filter((x) => x.rec?.elapsedMs && !x.rec.auto)
    .map((x) => ({ x: x.i, y: Math.round(x.rec.elapsedMs / 60000), label: `${labelOf(pid, x.id)}: ${fmtMs(x.rec.elapsedMs)}` }));
  container.append(h('div', { class: 'card' },
    h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:6px' }, 'Session duration (min)'),
    h('div', { class: 'chartwrap', html: durs.length >= 2 ? lineChart(durs, { unit: 'min' })
      : '<div class="chart-empty">Complete workouts with the timer running to see your durations here.</div>' }),
  ));

  container.append(liftCard(pid));

  const weekly = [];
  for (let w = 1; w <= totalWeeks(pid); w++) {
    let sets = 0;
    for (let d = 1; d <= 7; d++) {
      const rec = store.day(`w${w}d${d}`, pid);
      if (!rec || rec.auto) continue;
      for (const exRec of Object.values(rec.ex || {})) sets += (exRec.sets || []).filter((x) => x?.done).length;
    }
    weekly.push({ label: `W${w}`, y: sets });
  }
  if (weekly.some((b) => b.y > 0)) {
    container.append(h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:6px' }, 'Sets completed per week'),
      h('div', { class: 'chartwrap', html: barChart(weekly, { unit: 'sets' }) }),
    ));
  }

  const notes = statuses.filter((x) => x.rec?.note).reverse().slice(0, 20);
  if (notes.length) {
    container.append(h('div', { class: 'section-title' }, 'Notes'));
    for (const x of notes) {
      container.append(h('a', { class: 'card', style: 'display:block;padding:10px 12px', href: `#/day/${pid}/${x.id}` },
        h('div', { class: 'tiny faint', style: 'font-weight:700' }, `${labelOf(pid, x.id)} · ${fmtDate(dateForId(x.id, pid))}`),
        h('div', { class: 'small dim', style: 'margin-top:3px;white-space:pre-wrap' }, x.rec.note),
      ));
    }
  }
  return container;
}

const labelOf = (pid, id) => {
  const d = getDay(pid, id);
  return `W${d.week} ${weekdayName(d.d, d.week, pid).slice(0, 3)}`;
};

function cardioTicked(pid, id, rec) {
  const planned = plannedDay(pid, id);
  if (!planned) return false;
  for (const e of planned.entries) {
    if (e.item.ex !== 'incline_walk') continue;
    if (rec.ex?.[e.key]?.sets?.[0]?.done) return true;
  }
  return false;
}

function totalTime(statuses) {
  let ms = 0;
  for (const x of statuses) if (x.rec?.elapsedMs && !x.rec.auto) ms += x.rec.elapsedMs;
  const hours = ms / 3600000;
  return hours >= 10 ? `${Math.round(hours)}h` : `${Math.round(hours * 10) / 10}h`;
}

// --- this week vs last -------------------------------------------------------
function weekMetrics(pid, week) {
  let vol = 0, sets = 0, timeMs = 0, cardio = 0, any = false;
  if (week < 1 || week > totalWeeks(pid)) return { vol, sets, timeMs, cardio, any };
  for (let d = 1; d <= 7; d++) {
    const id = `w${week}d${d}`;
    const rec = store.day(id, pid);
    if (!rec || rec.auto) continue;
    const planned = plannedDay(pid, id);
    if (!planned) continue;
    for (const e of planned.entries) {
      const ex = rec.ex?.[e.key];
      if (!ex?.sets) continue;
      for (const x of ex.sets) {
        if (!x?.done) continue;
        sets++; any = true;
        if (x.weight != null) vol += +x.weight * (x.reps ?? e.sch.reps ?? 0);
        if (e.item.ex === 'incline_walk') cardio++;
      }
    }
    if (rec.elapsedMs) { timeMs += rec.elapsedMs; any = true; }
  }
  return { vol, sets, timeMs, cardio, any };
}

function weeklyCompareCard(pid, curWeek) {
  const now = weekMetrics(pid, curWeek);
  const prev = weekMetrics(pid, curWeek - 1);
  const fmtVol = (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}t` : `${Math.round(v)} kg`);
  const fmtT = (ms) => (ms ? fmtMs(ms) : '0:00');
  const delta = (a, b, fmt = (x) => Math.round(x)) => {
    if (!prev.any) return null;
    const d = a - b;
    if (d === 0) return h('span', { class: 'chip' }, '=');
    return h('span', {
      class: `chip ${d > 0 ? 'good' : ''}`,
      style: d < 0 ? 'color:var(--warn);border-color:rgba(251,146,60,.35)' : '',
    }, `${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}`);
  };
  const row = (label, cur, last, dEl) => h('div', { class: 'row', style: 'padding:6px 0;border-bottom:1px solid var(--line)' },
    h('div', { class: 'small grow', style: 'font-weight:700' }, label),
    h('div', { class: 'small', style: 'font-weight:800' }, cur),
    prev.any ? h('div', { class: 'tiny faint', style: 'width:64px;text-align:right' }, `was ${last}`) : null,
    dEl || h('span', { style: 'width:0' }),
  );
  return h('div', { class: 'card' },
    h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:4px' }, `This week vs last — Week ${curWeek}`),
    !prev.any ? h('div', { class: 'tiny faint', style: 'margin-bottom:4px' },
      curWeek <= 1 ? 'First week — nothing to compare yet.' : 'No logged training last week to compare against.') : null,
    row('Volume (kg×reps)', fmtVol(now.vol), fmtVol(prev.vol), delta(now.vol, prev.vol, (x) => fmtVol(x))),
    row('Sets done', String(now.sets), String(prev.sets), delta(now.sets, prev.sets)),
    row('Gym time', fmtT(now.timeMs), fmtT(prev.timeMs), delta(now.timeMs, prev.timeMs, (x) => fmtMs(x))),
    row('Cardio sessions', String(now.cardio), String(prev.cardio), delta(now.cardio, prev.cardio)),
  );
}

// --- jump volume ---------------------------------------------------------------
// Ground contacts by CALENDAR week, so plyo from either program lands in the
// same bar. The point is the shape of the line, not the exact number.
function jumpVolumeCard() {
  const buckets = jumpVolumeByWeek({ weeks: 12 });
  if (!buckets.some((b) => b.contacts > 0)) return null;
  const spike = spikeCheck(buckets);
  const fs = freestyleBlocks({ weeks: 12 });
  const wkLabel = (ms) => {
    const d = new Date(ms);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };
  const bars = buckets.map((b) => ({ label: wkLabel(b.weekStart), y: b.contacts }));
  const pct = spike.pct == null ? null : Math.round(spike.pct * 100);
  const trend = spike.prev <= 0
    ? (spike.cur > 0 ? 'first week back on jumps' : 'nothing logged yet')
    : pct === 0 ? 'level with last week'
    : `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs last week`;

  return h('div', { class: 'card' },
    h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:2px' }, 'Jump volume (ground contacts)'),
    h('div', { class: 'tiny faint', style: 'margin-bottom:6px' }, 'Both programs · by calendar week'),
    h('div', { class: 'row', style: 'align-items:baseline;gap:8px;margin-bottom:4px' },
      h('div', { style: 'font-size:22px;font-weight:800;font-variant-numeric:tabular-nums' }, String(Math.round(spike.cur))),
      h('div', { class: 'small dim grow' }, 'this week'),
      h('div', {
        class: 'tiny',
        style: `font-weight:700;color:${spike.level === 'ok' ? 'var(--faint)' : 'var(--warn)'}`,
      }, trend)),
    h('div', { class: 'chartwrap', html: barChart(bars, { unit: 'contacts' }) }),
    spike.level === 'spike' ? h('div', {
      class: 'banner', style: 'margin-top:10px;border-color:rgba(251,146,60,.4)',
    },
      h('div', { style: 'font-weight:700;margin-bottom:4px' }, '⚠️ Jump volume spike'),
      `You are ${pct}% above last week (${Math.round(spike.prev)} → ${Math.round(spike.cur)} contacts). `
      + 'That is the kind of jump that shows up later as knee or achilles pain. Hold this week where it is '
      + 'rather than adding more, and follow the program’s own fatigue rule: drop cardio to 5 days or lower '
      + 'the incline, and back off plyo volume if your jumps feel flat.',
    ) : null,
    spike.level === 'watch' && spike.prev > 0 ? h('div', { class: 'tiny faint', style: 'margin-top:8px' },
      `Climbing — ${pct}% up on last week. Fine for now; worth watching if it keeps rising.`) : null,
    spike.level === 'watch' && spike.prev <= 0 ? h('div', { class: 'tiny faint', style: 'margin-top:8px' },
      'Straight back into jumping after a week off — ease in rather than starting where you left off.') : null,
    fs.total ? h('div', { class: 'tiny faint', style: 'margin-top:8px' },
      `Freestyle blocks tapped out: ${fs.inRange}/${fs.total} inside the ${FREESTYLE.warn}–${FREESTYLE.cap} cap`
      + (fs.over ? ` · ${fs.over} over` : '') + (fs.under ? ` · ${fs.under} short` : '')) : null,
  );
}

// --- heatmap ------------------------------------------------------------------
function heatmapCard(pid, statuses, tIdx, weeks) {
  const cells = [h('div')];
  for (let d = 1; d <= 7; d++) cells.push(h('div', { class: 'wk', style: 'justify-content:center' }, weekdayName(d, null, pid)[0]));
  for (let w = 1; w <= weeks; w++) {
    cells.push(h('div', { class: 'wk' }, `${w}`));
    for (let d = 1; d <= 7; d++) {
      const i = (w - 1) * 7 + (d - 1);
      const x = statuses[i];
      let cls = 'hcell', glyph = '';
      if (x.p.status === 'done') cls += x.rec?.auto ? ' auto' : ' done';
      else if (x.p.status === 'skipped') { cls += ' skip'; glyph = '×'; }
      else if (x.p.pct > 0) { cls += ' part'; glyph = '◐'; }
      if (d === 7 && !x.p.status) cls += ' rest';
      if (i === tIdx) cls += ' today';
      cells.push(h('a', {
        class: cls, href: `#/day/${pid}/${x.id}`,
        style: 'display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#0b0f16',
      }, glyph));
    }
  }
  return h('div', { class: 'card' },
    h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:8px' }, `All ${weeks * 7} days`),
    h('div', { class: 'heatmap' }, cells),
    h('div', { class: 'row tiny faint', style: 'margin-top:8px;flex-wrap:wrap;gap:6px 12px' },
      legend('var(--good)', 'done'), legend('rgba(52,211,153,.35)', 'assumed'),
      legend('rgba(251,191,36,.5)', '◐ partial'), legend('var(--bad)', '× skipped'),
      legend('var(--card2)', 'open')),
  );
}
const legend = (color, label) => h('span', { class: 'row', style: 'gap:4px' },
  h('span', { style: `width:10px;height:10px;border-radius:3px;background:${color};border:1px solid var(--line)` }), label);

// --- lift progression ----------------------------------------------------------
const LIFTS = ['squat', 'leg_press', 'hip_thrust', 'nordics', 'leg_ext', 'ham_curl', 'calf_raise',
  'lateral_raise', 'chest_press', 'pec_deck', 'low_row', 'seated_row', 'triceps', 'biceps'];
let liftSel = 'leg_press';

function liftCard(pid) {
  const withData = LIFTS.filter((id) => historyFor(id).some((e) => e.sets.some((x) => x.weight != null)));
  const options = withData.length ? withData : LIFTS;
  if (!options.includes(liftSel)) liftSel = options[0];

  const sel = h('select', { class: 'sel', style: 'height:40px;font-size:14px' },
    ...options.map((id) => h('option', { value: id, selected: id === liftSel }, EX[id].name)));
  const chartBox = h('div', { class: 'chartwrap' });
  const draw = () => {
    const pts = historyFor(liftSel).map((e) => {
      const ws = e.sets.filter((x) => x.weight != null).map((x) => +x.weight);
      return ws.length ? { x: e.t, y: Math.max(...ws), label: `${labelOf(e.pid, e.dayId)}: ${Math.max(...ws)} kg` } : null;
    }).filter(Boolean);
    chartBox.innerHTML = pts.length >= 2 ? lineChart(pts, { unit: 'kg' })
      : '<div class="chart-empty">Log weights on this exercise across 2+ sessions to see the trend.</div>';
  };
  sel.addEventListener('change', () => { liftSel = sel.value; draw(); });
  draw();

  return h('div', { class: 'card' },
    h('div', { class: 'row', style: 'margin-bottom:8px' },
      h('div', { class: 'h2 grow', style: 'font-size:14px' }, 'Lift progression — top set (kg)'),
      h('button', { class: 'btn sm', onclick: () => historySheet(liftSel) }, 'log')),
    sel, h('div', { style: 'height:8px' }), chartBox,
  );
}

// --- fatigue check-in ----------------------------------------------------------
function fatigueCard(pid, curWeek, rerender) {
  const log = store.prog(pid).fatigue;
  const thisWeek = log.find((f) => f.week === curWeek);
  const low = log.slice(-2).filter((f) => f.rating <= 2).length >= 2 || (thisWeek && thisWeek.rating <= 2);

  const card = h('div', { class: 'card' },
    h('div', { class: 'h2', style: 'font-size:14px' }, `Weekly fatigue check — how did your jumps feel? (Week ${curWeek})`),
    h('div', { class: 'tiny faint', style: 'margin:2px 0 10px' }, '1 = dead legs · 5 = springy'),
    h('div', { class: 'fatiguebtns' }, ...[1, 2, 3, 4, 5].map((r) => h('button', {
      class: thisWeek?.rating === r ? 'on' : '',
      onclick: () => {
        store.update((st) => {
          const b = st.programs[pid];
          b.fatigue = b.fatigue.filter((f) => f.week !== curWeek);
          b.fatigue.push({ week: curWeek, rating: r, at: Date.now() });
          b.fatigue.sort((a, b2) => a.week - b2.week);
        });
        rerender();
      },
    }, ['😵', '😮‍💨', '😐', '🙂', '⚡'][r - 1]))),
  );
  if (low) {
    card.append(h('div', { class: 'banner deload', style: 'margin:10px 0 0' },
      'Jump performance is dropping → program rule: reduce cardio to 5 days/week or lower the incline temporarily.'));
  }
  if (thisWeek) card.append(h('div', { class: 'tiny faint', style: 'margin-top:8px' }, `Logged for week ${curWeek}. Tap to change.`));
  return card;
}
