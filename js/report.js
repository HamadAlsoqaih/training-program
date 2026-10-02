// ============================================================================
// report.js — "what did this program actually do for me".
//
// Builds one JSON object holding BOTH a computed summary — the numbers the
// Progress page shows — and the raw day records, so the file is readable by
// anything later and can still be imported back into the app.
// ============================================================================
import { getProgram, getDay, totalDays, totalWeeks, EX } from './program.js';
import * as store from './state.js';
import { historyIndex, dayProgress, weekProgress, bestWeight } from './completion.js';
import { indexToId, dateForIndex, dateForId, toISO, deloadBlocks } from './schedule.js';
import { jumpVolumeByWeek, jumpContactsForDay, isJump } from './analytics.js';

const round = (n, p = 1) => Math.round(n * 10 ** p) / 10 ** p;
const isoOrNull = (d) => (d ? toISO(d) : null);

// Every required day closed, every week over the line.
export function programComplete(pid) {
  for (let w = 1; w <= totalWeeks(pid); w++) if (!weekProgress(pid, w).closed) return false;
  return true;
}

export function buildProgramReport(pid) {
  const program = getProgram(pid);
  const bucket = store.prog(pid);
  const n = totalDays(pid);
  const days = bucket.days || {};

  // --- day-by-day pass -------------------------------------------------------
  let daysDone = 0, daysSkipped = 0, gymMs = 0, cardio = 0, cardioTotal = 0;
  let streak = 0, longestStreak = 0;
  const notes = [];
  const weekly = [];
  for (let w = 1; w <= totalWeeks(pid); w++) {
    weekly.push({ week: w, setsDone: 0, volumeKg: 0, gymTimeMin: 0, cardioSessions: 0, jumpContacts: 0 });
  }

  for (let i = 0; i < n; i++) {
    const id = indexToId(i, pid);
    const rec = days[id];
    const p = dayProgress(pid, id);
    const w = Math.floor(i / 7);
    if (p.status === 'done') { daysDone++; streak++; longestStreak = Math.max(longestStreak, streak); }
    else if (p.status === 'skipped') { daysSkipped++; streak = 0; }
    else streak = 0;
    if (getDay(pid, id)?.kind !== 'off') cardioTotal++;
    if (rec?.cardioDone) { cardio++; weekly[w].cardioSessions++; }
    if (rec?.elapsedMs && !rec.auto) { gymMs += rec.elapsedMs; weekly[w].gymTimeMin += Math.round(rec.elapsedMs / 60000); }
    if (rec?.note) notes.push({ dayId: id, date: isoOrNull(dateForIndex(i, pid)), note: rec.note });
    const jc = jumpContactsForDay(pid, id);
    if (jc) weekly[w].jumpContacts += Math.round(jc);
  }

  // --- per-exercise pass, straight off the memoised history index -----------
  let setsDone = 0, volumeKg = 0, jumpContacts = 0;
  const exercises = [];
  const prs = [];
  for (const [exId, all] of historyIndex()) {
    const list = all.filter((r) => r.pid === pid);
    if (!list.length) continue;
    let sets = 0, vol = 0, first = null, lastW = null;
    for (const r of list) {
      for (const st of r.sets) {
        if (!st.done) continue;
        sets++;
        if (st.weight != null && st.reps != null) vol += +st.weight * +st.reps;
        if (st.weight != null) { if (first === null) first = +st.weight; lastW = +st.weight; }
      }
    }
    const best = bestWeight(list);
    const bestRec = best == null ? null
      : list.find((r) => !r.deload && r.sets.some((st) => +st.weight === best));
    if (best != null) {
      prs.push({ exercise: exId, name: EX[exId]?.name || exId, weightKg: best,
        date: bestRec ? isoOrNull(dateForId(bestRec.dayId, pid)) : null });
    }
    setsDone += sets;
    volumeKg += vol;
    exercises.push({
      id: exId, name: EX[exId]?.name || exId,
      sessions: list.length, setsDone: sets,
      volumeKg: round(vol), bestWeightKg: best,
      firstWeightKg: first, lastWeightKg: lastW,
      gainKg: first != null && lastW != null ? round(lastW - first) : null,
      jump: isJump(exId) || undefined,
    });
  }
  exercises.sort((a, b) => b.volumeKg - a.volumeKg);
  prs.sort((a, b) => b.weightKg - a.weightKg);

  // weekly sets + volume, from the same index
  for (const [, all] of historyIndex()) {
    for (const r of all) {
      if (r.pid !== pid || r.index == null) continue;
      const w = Math.floor(r.index / 7);
      if (!weekly[w]) continue;
      for (const st of r.sets) {
        if (!st.done) continue;
        weekly[w].setsDone++;
        if (st.weight != null && st.reps != null) weekly[w].volumeKg += +st.weight * +st.reps;
      }
    }
  }
  for (const wk of weekly) wk.volumeKg = round(wk.volumeKg);

  const jumps = jumpVolumeByWeek({ weeks: 52 });
  jumpContacts = Math.round(jumps.reduce((a, b) => a + b.contacts, 0));

  const elapsedDays = daysDone + daysSkipped;
  return {
    app: "Hamad's Training",
    generatedAt: new Date().toISOString(),
    program: { id: pid, name: program.name, weeks: program.weeks, subtitle: program.subtitle },
    schedule: {
      startedAt: bucket.startedAt ? new Date(bucket.startedAt).toISOString() : null,
      startDate: isoOrNull(dateForIndex(0, pid)),
      endDate: isoOrNull(dateForIndex(n - 1, pid)),
      dayMap: bucket.setup.dayMap || program.defaultDayMap || null,
      weekStartsOn: bucket.setup.weekStart ?? null,
      deloadWeeksInserted: deloadBlocks(pid).map((b) => ({ beforeWeek: b.week, deloadDays: 8 - b.d0 })),
    },
    summary: {
      complete: programComplete(pid),
      daysDone, daysSkipped, daysTotal: n,
      adherencePct: elapsedDays ? round((daysDone / elapsedDays) * 100) : 0,
      weeksComplete: weekly.filter((_, i) => weekProgress(pid, i + 1).complete).length,
      longestStreakDays: longestStreak,
      setsDone,
      volumeKg: round(volumeKg),
      gymTimeHours: round(gymMs / 3600000),
      cardioSessions: cardio,
      cardioPct: cardioTotal ? round((cardio / cardioTotal) * 100) : 0,
      jumpContacts,
      personalBests: prs.length,
    },
    weekly,
    exercises,
    personalBests: prs,
    fatigueCheckIns: (bucket.fatigue || []).map((f) => ({ week: f.week, rating: f.rating,
      at: f.at ? new Date(f.at).toISOString() : null })),
    notes,
    raw: { version: store.get().version, days },
  };
}

// Hand the file to the browser. Same path the Settings backup uses.
export function downloadReport(pid) {
  const data = buildProgramReport(pid);
  const name = `${data.program.name.replace(/[^\w+-]+/g, '-').toLowerCase()}-${toISO(new Date())}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return data;
}
