// ============================================================================
// settings.js
//   renderStart(pid)   — the start / re-configure flow for ANY program:
//                        weekday mapping, starting week+day, optional back-fill.
//                        Also used as first-run onboarding.
//   renderSettings()   — active program, appearance (accent colour), schedule,
//                        workout behaviour, reminders, data.
// ============================================================================
import { h, toast } from '../util.js';
import * as store from '../state.js';
import { seedBefore, clearEmptyDeloadsFrom, restartProgram } from '../completion.js';
import { PROGRAM_LIST, getProgram, getWeek, daySlotsFor } from '../program.js';
import {
  idToIndex, toISO, DEFAULT_DAY_MAP, WEEKDAY_NAMES, dayMap, todayIndex, currentWeek,
  fmtDate, realToday, weekStartWd, deloadBlocks, saveWeekArrangement,
} from '../schedule.js';
import { whereAmISheet, openSheet, closeSheet } from './sheets.js';
import {
  PUSH_OK, pushState, pushOn, pushOff, sendTest, reminderSync, trainingWeekdays, onPushChange,
} from '../push.js';

export const ACCENTS = [
  ['#fbbf24', 'Amber'], ['#f97316', 'Orange'], ['#ef4444', 'Red'], ['#ec4899', 'Pink'],
  ['#a855f7', 'Purple'], ['#6366f1', 'Indigo'], ['#3b82f6', 'Blue'], ['#06b6d4', 'Cyan'],
  ['#10b981', 'Green'], ['#84cc16', 'Lime'], ['#e5e7eb', 'White'],
];

// --- your week (shared by the start flow and settings) ---------------------
// Rows are YOUR days in order, starting on whatever weekday you choose. Each
// row picks which session happens that day, so you can arrange the program
// however you like; picking a session that's already used swaps the two, so
// the week can never end up with a session twice. Change the start day and the
// whole arrangement moves with it, keeping your order.
function dayMapEditor(pid, initialMap, initialWeekStart, onChange) {
  const slots = daySlotsFor(pid);
  const kinds = getWeek(pid, 1)?.days.map((d) => d.kind) || [];
  let weekStart = initialWeekStart ?? initialMap[1];
  // order[p] = the session slot (1..7) on position p
  const order = Array.from({ length: 7 }, (_, p) => {
    for (let d = 1; d <= 7; d++) if ((initialMap[d] - weekStart + 7) % 7 === p) return d;
    return p + 1;
  });
  // The program's own running order of sessions. Choosing Day 1 rotates this
  // cycle, so everything after it follows in the order the program intends.
  const base = getProgram(pid).defaultDayMap || DEFAULT_DAY_MAP;
  const cycle = [1, 2, 3, 4, 5, 6, 7].sort((a, b) =>
    ((base[a] - base[1] + 7) % 7) - ((base[b] - base[1] + 7) % 7));
  let editing = false;

  const startSel = h('select', { class: 'sel', style: 'width:132px;height:42px;font-size:14px' },
    ...WEEKDAY_NAMES.map((n, wd) => h('option', { value: wd, selected: weekStart === wd }, n)));
  const labels = [], selects = [], texts = [];
  const hint = h('div', { class: 'tiny', style: 'display:none;margin-top:8px;color:var(--warn)' });
  const editBtn = document.createTextNode('');

  const getMap = () => {
    const m = {};
    order.forEach((d, p) => { m[d] = (weekStart + p) % 7; });
    return m;
  };
  const refresh = () => {
    for (let p = 0; p < 7; p++) {
      labels[p].firstChild.textContent = `${WEEKDAY_NAMES[(weekStart + p) % 7]}`;
      selects[p].value = String(order[p]);
      if (texts[p]) texts[p].textContent = slots[order[p] - 1];
      if (p > 0) {
        selects[p].style.display = editing ? '' : 'none';
        texts[p].style.display = editing ? 'none' : '';
      }
    }
    editBtn.textContent = editing ? '✓ Done editing' : '✎ Edit days one by one';
    startSel.value = String(weekStart);
    // two of the same hard session back to back (wrapping into next week)
    const hard = new Set(['upper', 'strength', 'plyo']);
    const clash = [];
    for (let p = 0; p < 7; p++) {
      const a = kinds[order[p] - 1], b = kinds[order[(p + 1) % 7] - 1];
      if (a && a === b && hard.has(a)) {
        clash.push(`${WEEKDAY_NAMES[(weekStart + p) % 7]} → ${WEEKDAY_NAMES[(weekStart + p + 1) % 7]}`);
      }
    }
    hint.style.display = clash.length ? '' : 'none';
    hint.textContent = clash.length
      ? `Heads up: same kind of session on back-to-back days (${clash.join(', ')}). The program spaces these apart on purpose.`
      : '';
    onChange?.(getMap(), true);
  };
  const rotateTo = (wd) => { weekStart = wd; refresh(); };
  startSel.addEventListener('change', () => rotateTo(+startSel.value));

  const head = h('div', { class: 'row', style: 'padding:2px 0 10px;border-bottom:1px solid var(--line);margin-bottom:6px' },
    h('div', { class: 'grow' },
      h('div', { class: 'small', style: 'font-weight:800' }, 'Week starts on'),
      h('div', { class: 'tiny faint' }, 'your first day — the week ends the day before')),
    h('button', { class: 'btn sm', style: 'margin-right:8px', onclick: () => rotateTo(new Date().getDay()) }, 'Today'),
    startSel);

  const rows = [];
  for (let p = 0; p < 7; p++) {
    const lab = h('div', { class: 'grow' },
      h('div', { class: 'small', style: 'font-weight:700' }, ''),
      h('div', { class: 'tiny faint' }, `Day ${p + 1}`));
    const sel = h('select', { class: 'sel', style: 'max-width:190px;height:42px;font-size:13px' },
      ...slots.map((label, i) => h('option', { value: i + 1 }, label)));
    const txt = h('div', { class: 'small', style: 'max-width:190px;text-align:right;font-weight:600' });
    sel.addEventListener('change', () => {
      const d = +sel.value;
      if (p === 0 && !editing) {
        // Day 1 chosen: the rest of the week follows in the program's order
        const at = cycle.indexOf(d);
        for (let k = 0; k < 7; k++) order[k] = cycle[(at + k) % 7];
      } else {
        const q = order.indexOf(d);
        order[q] = order[p];     // swap, so every session is used exactly once
        order[p] = d;
      }
      refresh();
    });
    labels.push(lab); selects.push(sel); texts.push(txt);
    rows.push(h('div', { class: 'row', style: 'padding:5px 0;gap:8px' }, lab, sel, p > 0 ? txt : null));
  }
  const el = h('div', {}, head, ...rows,
    h('button', { class: 'btn sm block', style: 'margin-top:8px', onclick: () => { editing = !editing; refresh(); } }, editBtn),
    hint);
  setTimeout(refresh, 0);
  return {
    el, getMap, rotateTo,
    getWeekStart: () => weekStart,
    slotAt: (p) => order[p],          // which session is on position p
    isValid: () => new Set(order).size === 7,
  };
}

const progOfWeekdayIn = (map, wd) => {
  for (let d = 1; d <= 7; d++) if (map[d] === wd) return d;
  return 1;
};

// ---------------------------------------------------------------------------
// Start / re-configure a program
// ---------------------------------------------------------------------------
export function renderStart(pid, onDone, { restart = false } = {}) {
  const program = getProgram(pid);
  const bucket = store.prog(pid);
  const first = !store.get().onboarded;
  // Re-configuring a program you're already in opens on "partway through",
  // with your current week; a new start or a restart opens on Week 1 · Day 1.
  const reconfig = bucket.started && !restart;
  const DAY = 86400000;
  const today = realToday(pid);
  const isoOf = (v) => { const [y, mo, d] = v.split('-').map(Number); return new Date(y, mo - 1, d, 12); };

  let mapper;
  let dateTouched = false;     // in "partway" mode, a typed date is never overwritten
  let rotating = false;        // we are moving the week start ourselves
  let easy = false;

  // --- the simple path: one date, and Day 1 is that date -------------------
  const dateIn = h('input', { class: 'txt', type: 'date',
    value: reconfig && bucket.setup.anchorDate ? bucket.setup.anchorDate : toISO(today) });
  const quick = (label, days) => h('button', { class: 'btn sm grow', onclick: () => {
    dateIn.value = toISO(new Date(today.getTime() + days * DAY));
    dateTouched = true; onDate();
  } }, label);
  const weekList = h('div', { class: 'weeklist' });
  const easyTgl = h('input', { type: 'checkbox', onchange: () => { easy = easyTgl.checked; updatePreview(); } });
  const easyRow = h('label', { class: 'row', style: 'margin-top:12px;gap:10px;align-items:flex-start' },
    h('span', { class: 'switch' }, easyTgl, h('span', { class: 'knob' })),
    h('span', { class: 'small' }, 'It’s been a long time since I trained',
      h('span', { class: 'tiny faint', style: 'display:block' },
        'Easier first 2 weeks: 2 sets wherever the program says 3 or more, and no “add weight” until week 3.')));

  // --- "partway through": week + day + mark-before-as-done ----------------
  const mid = h('details', { class: 'card', open: reconfig || null });
  const weekSel = h('select', { class: 'sel' },
    ...Array.from({ length: program.weeks }, (_, i) =>
      h('option', { value: i + 1, selected: i + 1 === (reconfig ? currentWeek(pid) : 1) }, `Week ${i + 1}`)));
  const daySel = h('select', { class: 'sel' });
  const seedTgl = h('input', { type: 'checkbox', onchange: () => updatePreview() });
  const preview = h('div', { class: 'banner', style: 'margin-top:12px' });

  const wdOfPos = (n) => (mapper.getWeekStart() + n - 1) % 7;
  const rebuildDays = () => {
    const cur = +daySel.value || 1;
    daySel.replaceChildren(...Array.from({ length: 7 }, (_, i) =>
      h('option', { value: i + 1, selected: i + 1 === cur }, `Day ${i + 1} — ${WEEKDAY_NAMES[wdOfPos(i + 1)]}`)));
  };
  const syncDayFromDate = () => {
    daySel.value = String(((isoOf(dateIn.value || toISO(today)).getDay() - mapper.getWeekStart() + 7) % 7) + 1);
  };
  const syncDateFromDay = () => {
    if (dateTouched) return;
    const shift = (wdOfPos(+daySel.value) - today.getDay() + 7) % 7;
    dateIn.value = toISO(new Date(today.getTime() + shift * DAY));
  };

  const updatePreview = () => {
    const partway = mid.open;
    const chosen = isoOf(dateIn.value || toISO(today));
    const diff = Math.round((chosen - today) / DAY);
    const week = partway ? +weekSel.value : 1;
    const dayN = partway ? +daySel.value : 1;
    const slots = daySlotsFor(pid);
    const ws = mapper.getWeekStart();
    weekList.replaceChildren(...Array.from({ length: 7 }, (_, p) => h('div', { class: 'row tiny', style: 'padding:3px 0' },
      h('b', { style: 'width:42px' }, WEEKDAY_NAMES[(ws + p) % 7].slice(0, 3)),
      h('span', { class: 'grow dim' }, slots[mapper.slotAt(p) - 1]))));
    const when = diff > 0 ? `<b>${fmtDate(chosen)}</b> — in ${diff} day${diff === 1 ? '' : 's'}`
      : diff === 0 ? `<b>today</b> (${fmtDate(chosen)})`
        : `<b>${fmtDate(chosen)}</b>, ${-diff} day${diff === -1 ? '' : 's'} ago`;
    const wdOk = chosen.getDay() === wdOfPos(dayN);
    preview.innerHTML = (partway
      ? `${when} is <b>Week ${week} · Day ${dayN} (${WEEKDAY_NAMES[wdOfPos(dayN)]})</b> — ${slots[mapper.slotAt(dayN - 1) - 1]}.`
        + (wdOk ? '' : `<br><b>Heads up:</b> that date is a ${WEEKDAY_NAMES[chosen.getDay()]}, but Day ${dayN} is your ${WEEKDAY_NAMES[wdOfPos(dayN)]}. Pick the matching day or change the date.`)
        + (seedTgl.checked && (week > 1 || dayN > 1) ? '<br>Everything before it will be marked <b>done (assumed)</b>.' : '')
      : `Week 1 starts ${when}. Your week runs <b>${WEEKDAY_NAMES[ws]} → ${WEEKDAY_NAMES[(ws + 6) % 7]}</b>.`
        + (easy ? '<br>🌱 Weeks 1–2 are easy weeks.' : ''))
      + (restart ? `<br>Your ${Object.keys(bucket.days).length ? 'logged workouts move to “earlier run”: they stay in each exercise’s history, and the weeks start fresh' : 'weeks start fresh'}.` : '')
      + (!restart && deloadBlocks(pid).some((b) => b.at >= (week - 1) * 7)
        ? '<br>A deload week you added earlier is in front of this start — it will be removed when you save (anything you logged in it is kept).' : '');
    easyRow.style.display = partway ? 'none' : '';
  };

  // Simple path: the date you pick is Day 1, so the week starts on its weekday.
  const onDate = () => {
    if (mid.open) { dateTouched = true; syncDayFromDate(); updatePreview(); return; }
    rotating = true; mapper.rotateTo(isoOf(dateIn.value || toISO(today)).getDay()); rotating = false;
    updatePreview();
  };

  let lastWs = null;
  mapper = dayMapEditor(pid, bucket.setup.dayMap || program.defaultDayMap || DEFAULT_DAY_MAP,
    bucket.setup.weekStart,
    () => {
      if (!mapper) return;
      const ws = mapper.getWeekStart();
      if (ws !== lastWs && lastWs !== null && !rotating) {
        // You changed "Week starts on" yourself: Day 1 moves to the nearest such day.
        if (mid.open) { daySel.value = '1'; dateTouched = false; rebuildDays(); syncDateFromDay(); }
        else dateIn.value = toISO(new Date(today.getTime() + ((ws - today.getDay() + 7) % 7) * DAY));
      } else if (mid.open) { rebuildDays(); syncDayFromDate(); }
      lastWs = ws;
      updatePreview();
    });
  // A new start or restart: Day 1 is the chosen date, so turn the week (in
  // your order) to begin on that weekday.
  if (!reconfig) { rotating = true; mapper.rotateTo(isoOf(dateIn.value).getDay()); rotating = false; }
  lastWs = mapper.getWeekStart();
  rebuildDays(); syncDayFromDate();
  dateIn.addEventListener('change', onDate);
  weekSel.addEventListener('change', updatePreview);
  daySel.addEventListener('change', () => { syncDateFromDay(); updatePreview(); });
  mid.addEventListener('toggle', () => {
    if (mid.open) { rebuildDays(); syncDayFromDate(); }
    else { weekSel.value = '1'; onDate(); }
    updatePreview();
  });
  mid.append(
    h('summary', { class: 'h2', style: 'font-size:15px;cursor:pointer' }, '📍 Already partway through this program?'),
    h('div', { class: 'small dim', style: 'margin:8px 0 10px' },
      'Pick the week and day the date above falls on. Turn on the switch to mark everything before it as done.'),
    h('div', { class: 'row', style: 'margin-bottom:8px' }, weekSel, daySel),
    h('label', { class: 'row', style: 'margin-top:6px;gap:10px' },
      h('span', { class: 'switch' }, seedTgl, h('span', { class: 'knob' })),
      h('span', { class: 'small' }, 'Mark all previous days as already done')),
  );
  const custom = h('details', { class: 'card' },
    h('summary', { class: 'h2', style: 'font-size:15px;cursor:pointer' }, '✎ Change which day gets which session'),
    h('div', { class: 'small dim', style: 'margin:8px 0' },
      'Any order you like. Picking a session that’s already placed swaps the two.'),
    mapper.el);
  setTimeout(updatePreview, 0);

  return h('div', { class: 'onboard' }, h('div', { class: 'inner' },
    h('div', { class: 'center', style: 'margin-bottom:22px' },
      h('div', { style: 'font-size:56px' }, restart ? '↺' : '🏐'),
      h('div', { class: 'h1', style: 'margin-top:8px' }, first ? "Hamad's Training" : restart ? `Restart ${program.name}` : program.name),
      h('div', { class: 'dim small', style: 'margin-top:6px' },
        first ? 'Your training programs, tracked on your phone.' : restart ? 'Start over from Week 1.' : program.subtitle),
    ),
    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'margin-bottom:8px' }, '📅 When do you start?'),
      h('div', { class: 'row', style: 'gap:8px;margin-bottom:8px' }, quick('Today', 0), quick('Tomorrow', 1)),
      dateIn,
      h('div', { class: 'small', style: 'font-weight:700;margin:14px 0 4px' }, 'Your week'),
      weekList,
      easyRow,
      preview,
    ),
    custom,
    restart ? null : mid,
    first ? h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'font-size:14px' }, '📲 Use it like an app'),
      h('div', { class: 'small dim', style: 'margin-top:4px' },
        'In Safari: tap Share → “Add to Home Screen”. Full-screen, works offline, timers and sounds behave better.')) : null,
    h('button', {
      class: 'btn primary block', style: 'margin-top:8px;min-height:54px',
      onclick: () => {
        if (!mapper.isValid()) { toast('Fix the duplicate weekdays first'); return; }
        const partway = mid.open && !restart;
        const week = partway ? +weekSel.value : 1;
        const dayN = partway ? +daySel.value : 1;
        const anchorDay = `w${week}d${mapper.slotAt(dayN - 1)}`;
        if (restart) restartProgram(pid);
        // A deload inserted earlier would push a fresh start back a week: drop
        // any at/after this start that hold no logged work.
        else clearEmptyDeloadsFrom(pid, (week - 1) * 7);
        store.update((s) => {
          const b = s.programs[pid];
          b.started = true;
          b.startedAt = restart ? Date.now() : (b.startedAt || Date.now());
          b.setup = { ...b.setup, anchorDate: dateIn.value || toISO(today), anchorDay,
            dayMap: mapper.getMap(), weekStart: mapper.getWeekStart() };
          if (!partway && easy) b.setup.easyStart = true; else delete b.setup.easyStart;
          // a fresh schedule: no per-week arrangements left over from before
          delete b.setup.mapHistory; delete b.setup.weekMaps; delete b.setup.weekSwaps;
          s.activeProgram = pid;
          s.onboarded = true;
          if (s.session && s.session.pid !== pid) s.session = null;
        });
        if (partway && seedTgl.checked) seedBefore(pid, idToIndex(anchorDay, pid));
        toast(restart ? `${program.name} restarted` : 'Saved');
        onDone();
      },
    }, restart ? '↺ Restart from Week 1' : bucket.started ? 'Save schedule →' : 'Start training →'),
    !first && bucket.started ? h('a', { class: 'btn block', style: 'margin-top:8px', href: `#/program/${pid}` }, 'Cancel') : null,
  ));
}

// ---------------------------------------------------------------------------
// Notifications card
// ---------------------------------------------------------------------------
let pushUnsub = null;
function notificationsCard(rerender) {
  const s = store.get().settings;
  const N = pushState();
  // redraw this screen when the subscription check finishes
  pushUnsub?.(); pushUnsub = onPushChange(() => { if (location.hash.startsWith('#/settings')) rerender({ keepScroll: true }); });
  const card = h('div', { class: 'card' }, h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:6px' }, '🔔 Notifications'));
  const line = (t) => h('div', { class: 'tiny faint', style: 'margin-bottom:8px' }, t);
  const run = (fn, ok) => async () => {
    try { await fn(); if (ok) toast(ok); } catch (e) { toast(e.message, 4200); }
    rerender({ keepScroll: true });
  };
  if (!PUSH_OK) {
    card.append(line('Open the app from its Home Screen icon (iPhone: Share → Add to Home Screen, iOS 16.4 or newer) to turn notifications on.'));
    return card;
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    card.append(line('Blocked. Turn them on in iPhone Settings › Notifications › Training, then come back.'));
    return card;
  }
  if (N.sub === undefined || !N.ready) { card.append(line('Checking…')); return card; }
  if (!N.sub) {
    card.append(line(N.key
      ? 'Get a notification when a rest timer ends while the phone is locked, and a daily reminder on training days.'
      : 'The notification server isn’t set up on this site yet (it runs on the Vercel version of the app).'));
    if (N.key) card.append(h('button', { class: 'btn primary block', onclick: run(pushOn, 'Notifications on 🔔') }, 'Turn on notifications'));
    return card;
  }
  const tgl = (label, sub, key, def, after) => {
    const input = h('input', {
      type: 'checkbox', checked: s[key] ?? def,
      onchange: () => { store.update((st) => { st.settings[key] = input.checked; }); after?.(); },
    });
    return h('div', { class: 'setrow2' },
      h('div', { class: 'grow' }, h('div', { class: 'small', style: 'font-weight:700' }, label), sub ? h('div', { class: 'tiny faint' }, sub) : null),
      h('label', { class: 'switch' }, input, h('span', { class: 'knob' })));
  };
  const days = trainingWeekdays().map((d) => WEEKDAY_NAMES[d].slice(0, 3)).join(', ');
  card.append(...[
    tgl('When a timer ends', 'Rest and hold timers, even with the phone locked or another app open', 'notifyTimer', true),
    tgl('Daily workout reminder', days ? `On your training days: ${days}` : 'No training days left in this program', 'remindersOn', false,
      run(() => reminderSync(true))),
    s.remindersOn ? h('div', { class: 'row', style: 'margin-top:6px' },
      h('div', { class: 'small grow', style: 'font-weight:700' }, 'Reminder time'),
      h('input', {
        class: 'txt', type: 'time', style: 'width:130px', value: s.reminderTime || '17:00',
        onchange: (e) => { store.update((st) => { st.settings.reminderTime = e.target.value; }); run(() => reminderSync(true), 'Reminder time saved')(); },
      })) : null,
    h('div', { class: 'row', style: 'gap:8px;margin-top:12px' },
      h('button', { class: 'btn sm grow', onclick: run(sendTest, 'Sent — lock the phone, it arrives in ~5 seconds') }, 'Send a test'),
      h('button', { class: 'btn sm grow', onclick: run(pushOff, 'Notifications off') }, 'Turn off')),
  ].filter(Boolean));
  return card;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export function renderSettings(rerender) {
  const s = store.get();
  const pid = store.activePid();
  const program = getProgram(pid);

  const toggleRow = (label, sub, key) => {
    const input = h('input', {
      type: 'checkbox', checked: !!s.settings[key],
      onchange: () => store.update((st) => { st.settings[key] = input.checked; }),
    });
    return h('div', { class: 'setrow2' },
      h('div', { class: 'grow' },
        h('div', { class: 'small', style: 'font-weight:700' }, label),
        sub ? h('div', { class: 'tiny faint' }, sub) : null),
      h('label', { class: 'switch' }, input, h('span', { class: 'knob' })));
  };

  const mapper = dayMapEditor(pid, dayMap(pid), weekStartWd(pid), () => {});
  const rollSel = h('select', {
    class: 'sel',
    onchange: () => { store.update((st) => { st.programs[pid].setup.rolloverHour = +rollSel.value; }); toast('Rollover updated'); },
  }, ...[0, 1, 2, 3, 4, 5, 6].map((hh) => h('option', {
    value: hh, selected: hh === store.setupOf(pid).rolloverHour,
  }, hh === 0 ? 'Midnight (no grace)' : `${hh} AM`)));

  const squatIn = h('input', {
    class: 'txt', placeholder: 'e.g. belt squat (PT-cleared)', value: s.settings.squatVariation || '',
    onchange: () => store.update((st) => { st.settings.squatVariation = squatIn.value; }),
  });

  const fileIn = h('input', {
    type: 'file', accept: 'application/json,.json', style: 'display:none',
    onchange: async () => {
      const f = fileIn.files[0];
      if (!f) return;
      fileIn.value = '';
      let text, info;
      try { text = await f.text(); info = store.previewBackup(text); }
      catch { toast('That file isn’t a training backup'); return; }
      const run = (mode) => {
        try { store.importJson(text, mode); }
        catch (e) { closeSheet(); toast(`Import failed: ${e.message}`); return; }
        closeSheet(); toast(mode === 'replace' ? 'Backup loaded' : 'Backup merged'); rerender();
      };
      const when = info.exportedAt ? new Date(info.exportedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
      openSheet(
        h('div', { class: 'h2', style: 'margin-bottom:6px' }, 'Import this backup?'),
        h('div', { class: 'small dim', style: 'margin-bottom:12px' },
          `${when ? `Saved ${when}. ` : ''}It has ${info.days} logged day${info.days === 1 ? '' : 's'}`
          + ` — ${info.added} not on this phone, ${info.newer} newer than this phone’s copy.`),
        h('div', { class: 'small', style: 'margin-bottom:6px' },
          h('b', {}, 'Merge'), ' adds the days you don’t have. When both have the same day, the one changed most recently wins.'),
        h('div', { class: 'small', style: 'margin-bottom:14px' },
          h('b', {}, 'Replace'), ' swaps everything on this phone for the backup.'),
        h('div', { class: 'row', style: 'gap:8px' },
          h('button', { class: 'btn grow', onclick: closeSheet }, 'Cancel'),
          h('button', { class: 'btn grow', onclick: () => run('replace') }, 'Replace'),
          h('button', { class: 'btn primary grow', onclick: () => run('merge') }, 'Merge')),
      );
    },
  });

  // --- appearance ---
  const setAccent = (hex) => { store.update((st) => { st.settings.accent = hex; }); rerender({ keepScroll: true }); };
  const swatches = h('div', { class: 'swatches' },
    ...ACCENTS.map(([hex, name]) => h('button', {
      class: `swatch${s.settings.accent?.toLowerCase() === hex.toLowerCase() ? ' on' : ''}`,
      style: `background:${hex}`, 'aria-label': name, title: name,
      onclick: () => setAccent(hex),
    })));
  const colorIn = h('input', {
    type: 'color', class: 'colorin', value: s.settings.accent || '#fbbf24',
    oninput: () => setAccent(colorIn.value),
  });

  return h('div',
    h('div', { class: 'h1', style: 'margin-bottom:10px' }, 'Settings'),

    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:6px' }, '🏋️ Active program'),
      h('div', { class: 'tiny faint', style: 'margin-bottom:8px' },
        'The Today tab follows this program. Switching keeps every program’s progress.'),
      ...PROGRAM_LIST.map((p) => h('button', {
        class: `btn block${p.id === pid ? ' primary' : ''}`, style: 'margin-bottom:8px;justify-content:space-between',
        onclick: () => {
          if (p.id === pid) { location.hash = `#/program/${p.id}`; return; }
          if (!store.prog(p.id).started) { location.hash = `#/start/${p.id}`; return; }
          store.setActiveProgram(p.id); toast(`${p.name} is now active`); rerender();
        },
      }, p.name, h('span', { class: 'tiny' }, p.id === pid ? 'active' : store.prog(p.id).started ? 'switch' : 'start'))),
      h('div', { class: 'row', style: 'gap:8px' },
        h('a', { class: 'btn sm grow', href: '#/programs' }, 'Browse all programs'),
        h('a', { class: 'btn sm grow', href: `#/start/${pid}/restart` }, `↺ Restart ${program.name.replace(/ Program$/, '')}`)),
    ),

    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:6px' }, '🎨 Appearance'),
      h('div', { class: 'tiny faint', style: 'margin-bottom:10px' },
        'Accent colour for buttons, the tab bar, toggles and highlights.'),
      swatches,
      h('div', { class: 'row', style: 'margin-top:12px;gap:10px' },
        h('div', { class: 'grow small', style: 'font-weight:700' }, 'Custom colour'),
        colorIn,
        h('button', { class: 'btn sm', onclick: () => setAccent('#fbbf24') }, 'Reset')),
    ),

    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:6px' }, '📍 Where are you now?'),
      h('div', { class: 'tiny faint', style: 'margin-bottom:8px' },
        `${program.name} — if the app shows the wrong week, fix it in two taps. The weekday always comes from real time.`),
      h('button', { class: 'btn primary block', onclick: () => whereAmISheet(pid, rerender) },
        `Today = Week ${currentWeek(pid)} — change`),
    ),

    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:8px' }, '🗓 Training weekdays'),
      h('div', { class: 'tiny faint', style: 'margin-bottom:6px' },
        `Which ${program.name} day falls on which real weekday. For a one-week change use “⇄” inside that week instead.`),
      mapper.el,
      h('button', {
        class: 'btn block', style: 'margin-top:10px',
        onclick: () => {
          if (!mapper.isValid()) { toast('Fix the duplicate weekdays first'); return; }
          if (mapper.getWeekStart() === weekStartWd(pid) && store.prog(pid).setup.anchorDate) {
            // Same week start: change the usual week from this week on, so the
            // weeks you already trained keep their days.
            saveWeekArrangement(pid, currentWeek(pid), mapper.getMap(), 'every');
            toast(`Weekdays updated from Week ${currentWeek(pid)} on`); rerender(); return;
          }
          // A new week start moves the whole calendar, so it starts over clean.
          store.update((st) => {
            const su = st.programs[pid].setup;
            su.dayMap = mapper.getMap();
            su.weekStart = mapper.getWeekStart();
            delete su.mapHistory; delete su.weekMaps; delete su.weekSwaps;
          });
          toast('Weekdays updated'); rerender();
        },
      }, 'Save weekdays'),
      h('div', { class: 'small dim', style: 'margin:12px 0 4px;font-weight:700' }, 'Day rolls over at'),
      h('div', { class: 'tiny faint', style: 'margin-bottom:6px' },
        'Before this hour you still see yesterday’s workout (for 1 AM sessions).'),
      rollSel,
    ),

    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'font-size:14px' }, '⚙️ Workout behavior'),
      toggleRow('Auto rest timer', 'Ticking a set starts its rest countdown automatically', 'autoRest'),
      toggleRow('Sound', 'Chime when timers finish (iOS has no vibration in Safari)', 'sound'),
      toggleRow('Keep screen awake', 'Screen stays on during an active workout (iOS 16.4+)', 'wakeLock'),
    ),

    notificationsCard(rerender),

    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:6px' }, '🦵 Squat variation (PT clearance)'),
      h('div', { class: 'tiny faint', style: 'margin-bottom:8px' },
        'Confirm with your PT which squat variation is cleared for your shoulder.'),
      squatIn,
    ),

    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:8px' }, '⏱ Timer overrides'),
      h('div', { class: 'tiny faint', style: 'margin-bottom:8px' },
        'Edited hold/rest timers are remembered per exercise and reset automatically when the program itself progresses the duration.'),
      h('button', {
        class: 'btn sm block',
        onclick: () => {
          if (!confirm('Clear all saved timer/rest overrides and go back to the program’s values?')) return;
          store.update((st) => { st.settings.durOv = {}; st.settings.restOv = {}; });
          toast('Overrides cleared'); rerender();
        },
      }, 'Reset all timer overrides'),
    ),

    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:8px' }, '💾 Data'),
      h('div', { class: 'tiny faint', style: 'margin-bottom:10px' },
        'Everything lives on this device, for every program. Export a backup regularly — clearing Safari data wipes it.'),
      h('div', { class: 'row' },
        h('button', {
          class: 'btn grow', onclick: () => {
            const blob = new Blob([store.exportJson()], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `training-backup-${toISO(new Date())}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 5000);
          },
        }, '⬇ Export'),
        h('button', { class: 'btn grow', onclick: () => fileIn.click() }, '⬆ Import'),
        fileIn),
      h('button', {
        class: 'btn danger block', style: 'margin-top:10px',
        onclick: () => {
          if (!confirm('Delete ALL progress, logs and settings for every program on this device?')) return;
          if (!confirm('Really sure? This cannot be undone (unless you exported a backup).')) return;
          store.resetAll(); location.hash = '#/today'; location.reload();
        },
      }, 'Reset everything'),
    ),

    h('div', { class: 'card tiny faint' }, "Hamad's Training · works offline · v5"),
  );
}
