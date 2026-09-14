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
import { seedBefore } from '../completion.js';
import { PROGRAM_LIST, getProgram, daySlotsFor } from '../program.js';
import {
  idToIndex, toISO, DEFAULT_DAY_MAP, WEEKDAY_NAMES, dayMap, todayIndex, currentWeek,
  fmtDate, realToday,
} from '../schedule.js';
import { whereAmISheet } from './sheets.js';

export const ACCENTS = [
  ['#fbbf24', 'Amber'], ['#f97316', 'Orange'], ['#ef4444', 'Red'], ['#ec4899', 'Pink'],
  ['#a855f7', 'Purple'], ['#6366f1', 'Indigo'], ['#3b82f6', 'Blue'], ['#06b6d4', 'Cyan'],
  ['#10b981', 'Green'], ['#84cc16', 'Lime'], ['#e5e7eb', 'White'],
];

// --- weekday mapper (shared by start flow and settings) ---------------------
function dayMapEditor(pid, initial, onChange) {
  const map = { ...initial };
  const selects = {};
  const slots = daySlotsFor(pid);
  const warn = h('div', { class: 'banner behind', style: 'display:none;margin-top:8px' },
    'Each weekday can only be used once — fix the duplicates.');

  const validate = () => {
    const used = Object.values(map);
    const ok = new Set(used).size === 7;
    warn.style.display = ok ? 'none' : '';
    for (let d = 1; d <= 7; d++) {
      selects[d].style.borderColor = used.filter((w) => w === map[d]).length > 1 ? 'var(--bad)' : '';
    }
    onChange?.(map, ok);
    return ok;
  };

  const rows = [];
  for (let d = 1; d <= 7; d++) {
    const sel = h('select', { class: 'sel', style: 'width:132px;height:42px;font-size:14px' },
      ...WEEKDAY_NAMES.map((n, wd) => h('option', { value: wd, selected: map[d] === wd }, n)));
    sel.addEventListener('change', () => { map[d] = +sel.value; validate(); });
    selects[d] = sel;
    rows.push(h('div', { class: 'row', style: 'padding:5px 0' },
      h('div', { class: 'grow' },
        h('div', { class: 'small', style: 'font-weight:700' }, `Day ${d}`),
        h('div', { class: 'tiny faint' }, slots[d - 1])),
      sel));
  }
  const el = h('div', {}, ...rows, warn);
  setTimeout(validate, 0);
  return { el, getMap: () => ({ ...map }), isValid: () => new Set(Object.values(map)).size === 7 };
}

const progOfWeekdayIn = (map, wd) => {
  for (let d = 1; d <= 7; d++) if (map[d] === wd) return d;
  return 1;
};

// ---------------------------------------------------------------------------
// Start / re-configure a program
// ---------------------------------------------------------------------------
export function renderStart(pid, onDone) {
  const program = getProgram(pid);
  const bucket = store.prog(pid);
  const first = !store.get().onboarded;
  const today = new Date();
  let week = bucket.started ? currentWeek(pid) : 1;

  const weekSel = h('select', { class: 'sel' },
    ...Array.from({ length: program.weeks }, (_, i) =>
      h('option', { value: i + 1, selected: i + 1 === week }, `Week ${i + 1}`)));
  const daySel = h('select', { class: 'sel' });
  const dateIn = h('input', { class: 'txt', type: 'date', value: bucket.setup.anchorDate || toISO(today) });
  const seedTgl = h('input', { type: 'checkbox' });
  const preview = h('div', { class: 'banner', style: 'margin-top:12px' });
  let mapper;
  let dateTouched = false;   // once you type a date, nothing may overwrite it

  const rebuildDays = () => {
    const m = mapper.getMap();
    const cur = +daySel.value || 1;
    daySel.replaceChildren(...Array.from({ length: 7 }, (_, i) =>
      h('option', { value: i + 1, selected: i + 1 === cur }, `Day ${i + 1} — ${WEEKDAY_NAMES[m[i + 1]]}`)));
  };
  const syncDayFromDate = () => {
    const [y, mo, d] = (dateIn.value || toISO(today)).split('-').map(Number);
    daySel.value = progOfWeekdayIn(mapper.getMap(), new Date(y, mo - 1, d, 12).getDay());
  };
  // If you picked the day, move the date FORWARD to the next matching weekday —
  // never backwards, and never past a date you typed yourself. (Snapping
  // backwards is what used to silently rewrite a chosen start date into the
  // past and made the app think the wrong day was "today".)
  const syncDateFromDay = () => {
    if (dateTouched) return;                       // your date wins, always
    const target = mapper.getMap()[+daySel.value];
    const [y, mo, d] = (dateIn.value || toISO(today)).split('-').map(Number);
    const cur = new Date(y, mo - 1, d, 12);
    const shift = (target - cur.getDay() + 7) % 7; // forward only
    dateIn.value = toISO(new Date(cur.getTime() + shift * 86400000));
  };

  const updatePreview = () => {
    week = +weekSel.value;
    const dayN = +daySel.value;
    const [y, mo, d] = (dateIn.value || toISO(today)).split('-').map(Number);
    const chosen = new Date(y, mo - 1, d, 12);
    const now = realToday(pid);
    const diff = Math.round((chosen - now) / 86400000);
    const wdOk = chosen.getDay() === mapper.getMap()[dayN];

    let when;
    if (diff > 0) when = `Starts <b>${fmtDate(chosen)}</b> — in ${diff} day${diff === 1 ? '' : 's'}.`;
    else if (diff === 0) when = `Starts <b>today</b> (${fmtDate(chosen)}).`;
    else when = `Anchored to <b>${fmtDate(chosen)}</b>, ${-diff} day${diff === -1 ? '' : 's'} ago — today lands later in the program.`;

    preview.innerHTML =
      `${when}<br>That date is <b>Week ${week} · Day ${dayN} (${WEEKDAY_NAMES[mapper.getMap()[dayN]]})</b> — ${daySlotsFor(pid)[dayN - 1]}.`
      + (wdOk ? '' : `<br><b>Heads up:</b> ${fmtDate(chosen)} is a ${WEEKDAY_NAMES[chosen.getDay()]}, but Day ${dayN} is your ${WEEKDAY_NAMES[mapper.getMap()[dayN]]}. Pick the matching day or change the date.`)
      + (seedTgl.checked && (week > 1 || dayN > 1) ? '<br>Everything before it will be marked <b>done (assumed)</b>.' : '');
  };

  mapper = dayMapEditor(pid, bucket.setup.dayMap || DEFAULT_DAY_MAP,
    () => { rebuildDays(); syncDayFromDate(); updatePreview(); });
  rebuildDays(); syncDayFromDate();
  weekSel.addEventListener('change', updatePreview);
  daySel.addEventListener('change', () => { syncDateFromDay(); updatePreview(); });
  dateIn.addEventListener('change', () => { dateTouched = true; syncDayFromDate(); updatePreview(); });
  seedTgl.addEventListener('change', updatePreview);
  updatePreview();

  return h('div', { class: 'onboard' }, h('div', { class: 'inner' },
    h('div', { class: 'center', style: 'margin-bottom:22px' },
      h('div', { style: 'font-size:56px' }, '🏐'),
      h('div', { class: 'h1', style: 'margin-top:8px' }, first ? "Hamad's Training" : program.name),
      h('div', { class: 'dim small', style: 'margin-top:6px' },
        first ? 'Your training programs, tracked on your phone.' : program.subtitle),
    ),
    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'margin-bottom:6px' }, '🗓 Your training weekdays'),
      h('div', { class: 'small dim', style: 'margin-bottom:8px' },
        'Match each program day to your real weekday — the app always shows the workout that belongs to today.'),
      mapper.el,
    ),
    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'margin-bottom:10px' }, '📍 Where are you starting?'),
      h('div', { class: 'small dim', style: 'margin-bottom:10px' },
        'Fresh start = Week 1 · Day 1. Already mid-program? Pick your current day and turn on the switch to mark everything before it as done.'),
      h('div', { class: 'row', style: 'margin-bottom:8px' }, weekSel, daySel),
      h('div', { class: 'tiny faint', style: 'margin-bottom:4px' },
        'The real date that day falls on (a future date is fine — the app will count down to it):'),
      dateIn,
      h('label', { class: 'row', style: 'margin-top:12px;gap:10px' },
        h('span', { class: 'switch' }, seedTgl, h('span', { class: 'knob' })),
        h('span', { class: 'small' }, 'Mark all previous days as already done')),
      preview,
    ),
    first ? h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'font-size:14px' }, '📲 Use it like an app'),
      h('div', { class: 'small dim', style: 'margin-top:4px' },
        'In Safari: tap Share → “Add to Home Screen”. Full-screen, works offline, timers and sounds behave better.')) : null,
    h('button', {
      class: 'btn primary block', style: 'margin-top:8px;min-height:54px',
      onclick: () => {
        if (!mapper.isValid()) { toast('Fix the duplicate weekdays first'); return; }
        const anchorDay = `w${weekSel.value}d${daySel.value}`;
        store.update((s) => {
          const b = s.programs[pid];
          b.started = true;
          b.startedAt = b.startedAt || Date.now();
          b.setup = { ...b.setup, anchorDate: dateIn.value || toISO(today), anchorDay, dayMap: mapper.getMap() };
          s.activeProgram = pid;
          s.onboarded = true;
          if (s.session && s.session.pid !== pid) s.session = null;
        });
        if (seedTgl.checked) seedBefore(pid, idToIndex(anchorDay));
        onDone();
      },
    }, bucket.started ? 'Save schedule →' : 'Start training →'),
    !first && bucket.started ? h('a', { class: 'btn block', style: 'margin-top:8px', href: `#/program/${pid}` }, 'Cancel') : null,
  ));
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

  const mapper = dayMapEditor(pid, dayMap(pid), () => {});
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
      try {
        const replace = confirm('OK = REPLACE everything with the backup.\nCancel = merge (keep local days, fill gaps from backup).');
        store.importJson(await f.text(), replace ? 'replace' : 'merge');
        toast('Backup imported'); rerender();
      } catch (e) { alert(`Import failed: ${e.message}`); }
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
      h('a', { class: 'btn sm block', href: '#/programs' }, 'Browse all programs'),
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
          store.update((st) => { st.programs[pid].setup.dayMap = mapper.getMap(); });
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

    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'font-size:14px' }, '🔔 Workout reminder'),
      toggleRow('Enable reminders', 'Best-effort on iOS — requires the app installed to your Home Screen (iOS 16.4+). A daily iPhone Clock alarm is the reliable backup.', 'remindersOn'),
      h('div', { class: 'row', style: 'margin-top:6px' },
        h('div', { class: 'small grow', style: 'font-weight:700' }, 'Reminder time'),
        h('input', {
          class: 'txt', type: 'time', style: 'width:130px', value: s.settings.reminderTime,
          onchange: (e) => store.update((st) => { st.settings.reminderTime = e.target.value; }),
        })),
      h('button', {
        class: 'btn sm block', style: 'margin-top:10px',
        onclick: async () => {
          if (!('Notification' in window)) return alert('Notifications are not supported here. Install the app to your Home Screen first (Share → Add to Home Screen).');
          const p = await Notification.requestPermission();
          toast(p === 'granted' ? 'Notifications allowed' : 'Notifications not allowed');
        },
      }, 'Allow notifications'),
    ),

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
