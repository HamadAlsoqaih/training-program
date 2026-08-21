// ============================================================================
// settings.js — onboarding (first run) + settings screen.
// ============================================================================
import { h, toast } from '../util.js';
import * as store from '../state.js';
import { seedBefore } from '../completion.js';
import {
  idToIndex, toISO, DEFAULT_DAY_MAP, WEEKDAY_NAMES, dayMap,
} from '../schedule.js';

const DAY_SLOTS = [
  'Plyo + Leg Press & Hip Thrust',
  'Push Upper Body → Core',
  'Plyo + Nordics & Calf Raises',
  'Pull Upper Body → Core',
  'Rest + Cardio',
  'Strength Day',
  'Full Rest',
];

// ---------------------------------------------------------------------------
// Weekday mapper — assign each program day to a real weekday (permutation)
// ---------------------------------------------------------------------------
function dayMapEditor(initial, onChange) {
  const map = { ...initial };
  const selects = {};
  const warn = h('div', { class: 'banner behind', style: 'display:none;margin-top:8px' },
    'Each weekday can only be used once — fix the duplicates.');

  const validate = () => {
    const used = Object.values(map);
    const ok = new Set(used).size === 7;
    warn.style.display = ok ? 'none' : '';
    for (let d = 1; d <= 7; d++) {
      const dup = used.filter((w) => w === map[d]).length > 1;
      selects[d].style.borderColor = dup ? 'var(--bad)' : '';
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
        h('div', { class: 'tiny faint' }, DAY_SLOTS[d - 1])),
      sel,
    ));
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
// Onboarding
// ---------------------------------------------------------------------------
export function renderOnboarding(onDone) {
  let week = 1, dayN = 1;
  const today = new Date();

  const weekSel = h('select', { class: 'sel' },
    ...Array.from({ length: 15 }, (_, i) => h('option', { value: i + 1, selected: i + 1 === week }, `Week ${i + 1}`)));
  const daySel = h('select', { class: 'sel' });
  const dateIn = h('input', { class: 'txt', type: 'date', value: toISO(today) });
  const seedTgl = h('input', { type: 'checkbox' });
  const preview = h('div', { class: 'banner', style: 'margin-top:12px' });

  let mapper; // set below

  const rebuildDayOptions = () => {
    const m = mapper.getMap();
    const cur = +daySel.value || dayN;
    daySel.replaceChildren(...Array.from({ length: 7 }, (_, i) =>
      h('option', { value: i + 1, selected: i + 1 === cur }, `Day ${i + 1} — ${WEEKDAY_NAMES[m[i + 1]]}`)));
  };

  // keep date ↔ day consistent with the map (weekday-locked schedule)
  const syncDayFromDate = () => {
    const [y, mo, d] = (dateIn.value || toISO(today)).split('-').map(Number);
    const wd = new Date(y, mo - 1, d, 12).getDay();
    dayN = progOfWeekdayIn(mapper.getMap(), wd);
    daySel.value = dayN;
  };
  const syncDateFromDay = () => {
    const m = mapper.getMap();
    const target = m[+daySel.value];
    const [y, mo, d] = (dateIn.value || toISO(today)).split('-').map(Number);
    const cur = new Date(y, mo - 1, d, 12);
    let shift = (target - cur.getDay() + 7) % 7;
    if (shift > 3) shift -= 7; // nearest occurrence
    dateIn.value = toISO(new Date(cur.getTime() + shift * 86400000));
  };

  const updatePreview = () => {
    week = +weekSel.value; dayN = +daySel.value;
    const m = mapper.getMap();
    preview.innerHTML = `<b>${dateIn.value}</b> ↔ <b>Week ${week} · Day ${dayN} (${WEEKDAY_NAMES[m[dayN]]})</b> — ${DAY_SLOTS[dayN - 1]}.` +
      (seedTgl.checked && (week > 1 || dayN > 1) ? `<br>Everything before it will be marked <b>done (assumed)</b>.` : '');
  };

  mapper = dayMapEditor(DEFAULT_DAY_MAP, () => { rebuildDayOptions(); syncDayFromDate(); updatePreview(); });
  rebuildDayOptions();
  syncDayFromDate();

  weekSel.addEventListener('change', updatePreview);
  daySel.addEventListener('change', () => { syncDateFromDay(); updatePreview(); });
  dateIn.addEventListener('change', () => { syncDayFromDate(); updatePreview(); });
  seedTgl.addEventListener('change', updatePreview);
  updatePreview();

  return h('div', { class: 'onboard' }, h('div', { class: 'inner' },
    h('div', { class: 'center', style: 'margin-bottom:22px' },
      h('div', { style: 'font-size:56px' }, '🏐'),
      h('div', { class: 'h1', style: 'margin-top:8px' }, '15-Week Program'),
      h('div', { class: 'dim small', style: 'margin-top:6px' },
        'Plyo · strength · shoulder rehab · volleyball. All 105 days, tracked on your phone.'),
    ),
    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'margin-bottom:6px' }, '🗓 Your training weekdays'),
      h('div', { class: 'small dim', style: 'margin-bottom:8px' },
        '5 workout days + 2 rest days per week. Match each program day to your real weekday — the app always shows the workout that belongs to today.'),
      mapper.el,
    ),
    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'margin-bottom:10px' }, '📍 Where are you starting?'),
      h('div', { class: 'small dim', style: 'margin-bottom:10px' },
        'Fresh start = Week 1 · Day 1. Already mid-program? Pick your current day and turn on the switch to mark everything before it as done.'),
      h('div', { class: 'row', style: 'margin-bottom:8px' }, weekSel, daySel),
      dateIn,
      h('label', { class: 'row', style: 'margin-top:12px;gap:10px' },
        h('span', { class: 'switch' }, seedTgl, h('span', { class: 'knob' })),
        h('span', { class: 'small' }, 'Mark all previous days as already done'),
      ),
      preview,
    ),
    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'font-size:14px' }, '📲 Use it like an app'),
      h('div', { class: 'small dim', style: 'margin-top:4px' },
        'In Safari: tap Share → “Add to Home Screen”. Full-screen app, works offline, timers and sounds behave better.'),
    ),
    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'font-size:14px' }, '🌙 Late-night grace'),
      h('div', { class: 'small dim', style: 'margin-top:4px' },
        'The day doesn\'t flip at midnight — before 4 AM you still see the previous day\'s workout. Change the hour in Settings.'),
    ),
    h('button', {
      class: 'btn primary block', style: 'margin-top:8px;min-height:54px',
      onclick: () => {
        if (!mapper.isValid()) { toast('Fix the duplicate weekdays first'); return; }
        store.update((s) => {
          s.setup = {
            done: true, anchorDate: dateIn.value || toISO(today),
            anchorDay: `w${weekSel.value}d${daySel.value}`, rolloverHour: 4,
            dayMap: mapper.getMap(),
          };
        });
        if (seedTgl.checked) seedBefore(idToIndex(`w${weekSel.value}d${daySel.value}`));
        onDone();
      },
    }, 'Start training →'),
  ));
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export function renderSettings(rerender) {
  const s = store.get();

  const toggleRow = (label, sub, key) => {
    const input = h('input', {
      type: 'checkbox', checked: !!s.settings[key],
      onchange: () => store.update((st) => { st.settings[key] = input.checked; }),
    });
    return h('div', { class: 'setrow2' },
      h('div', { class: 'grow' },
        h('div', { class: 'small', style: 'font-weight:700' }, label),
        sub ? h('div', { class: 'tiny faint' }, sub) : null),
      h('label', { class: 'switch' }, input, h('span', { class: 'knob' })),
    );
  };

  // schedule editing
  const m0 = /w(\d+)d(\d)/.exec(s.setup.anchorDay);
  const mapper = dayMapEditor(dayMap(), () => rebuildDayOptions());
  const weekSel = h('select', { class: 'sel' },
    ...Array.from({ length: 15 }, (_, i) => h('option', { value: i + 1, selected: i + 1 === +m0[1] }, `Week ${i + 1}`)));
  const daySel = h('select', { class: 'sel' });
  const rebuildDayOptions = () => {
    const m = mapper.getMap();
    const cur = +daySel.value || +m0[2];
    daySel.replaceChildren(...Array.from({ length: 7 }, (_, i) =>
      h('option', { value: i + 1, selected: i + 1 === cur }, `Day ${i + 1} — ${WEEKDAY_NAMES[m[i + 1]]}`)));
  };
  rebuildDayOptions();
  const dateIn = h('input', { class: 'txt', type: 'date', value: s.setup.anchorDate || '' });
  const rollSel = h('select', { class: 'sel' },
    ...[0, 1, 2, 3, 4, 5, 6].map((hh) => h('option', { value: hh, selected: hh === s.setup.rolloverHour },
      hh === 0 ? 'Midnight (no grace)' : `${hh} AM`)));
  const saveSchedule = () => {
    if (!mapper.isValid()) { toast('Fix the duplicate weekdays first'); return; }
    store.update((st) => {
      st.setup.anchorDay = `w${weekSel.value}d${daySel.value}`;
      if (dateIn.value) st.setup.anchorDate = dateIn.value;
      st.setup.rolloverHour = +rollSel.value;
      st.setup.dayMap = mapper.getMap();
    });
    toast('Schedule updated');
    rerender();
  };

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
        const text = await f.text();
        const replace = confirm('OK = REPLACE everything with the backup.\nCancel = merge (keep local days, fill gaps from backup).');
        store.importJson(text, replace ? 'replace' : 'merge');
        toast('Backup imported'); rerender();
      } catch (e) { alert(`Import failed: ${e.message}`); }
    },
  });

  return h('div',
    h('div', { class: 'h1', style: 'margin-bottom:10px' }, 'Settings'),

    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:8px' }, '🗓 Training weekdays'),
      h('div', { class: 'tiny faint', style: 'margin-bottom:6px' },
        'Which workout falls on which real weekday. Each weekday used once.'),
      mapper.el,
    ),

    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:8px' }, '📅 Anchor'),
      h('div', { class: 'tiny faint', style: 'margin-bottom:8px' },
        'Which program day fell on which date — decides which week you\'re in.'),
      h('div', { class: 'row', style: 'margin-bottom:8px' }, weekSel, daySel),
      dateIn,
      h('div', { class: 'small dim', style: 'margin:12px 0 4px;font-weight:700' }, 'Day rolls over at'),
      h('div', { class: 'tiny faint', style: 'margin-bottom:6px' }, 'Before this hour you still see yesterday\'s workout (for 1 AM sessions).'),
      rollSel,
      h('button', { class: 'btn block', style: 'margin-top:10px', onclick: saveSchedule }, 'Save schedule'),
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
        'Program note: confirm with your PT which squat variation is cleared for your shoulder. Front Raise stays dropped pending PT confirmation.'),
      squatIn,
    ),

    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:8px' }, '⏱ Timer overrides'),
      h('div', { class: 'tiny faint', style: 'margin-bottom:8px' },
        'Edited hold/rest timers are remembered per exercise and reset automatically when the program itself progresses the duration.'),
      h('button', {
        class: 'btn sm block',
        onclick: () => {
          if (!confirm('Clear all saved timer/rest overrides and go back to the program\'s values?')) return;
          store.update((st) => { st.settings.durOv = {}; st.settings.restOv = {}; });
          toast('Overrides cleared'); rerender();
        },
      }, 'Reset all timer overrides'),
    ),

    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:8px' }, '💾 Data'),
      h('div', { class: 'tiny faint', style: 'margin-bottom:10px' },
        'Everything lives on this device. Export a backup regularly — clearing Safari data wipes it.'),
      h('div', { class: 'row' },
        h('button', {
          class: 'btn grow', onclick: () => {
            const blob = new Blob([store.exportJson()], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `15week-backup-${toISO(new Date())}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 5000);
          },
        }, '⬇ Export'),
        h('button', { class: 'btn grow', onclick: () => fileIn.click() }, '⬆ Import'),
        fileIn,
      ),
      h('button', {
        class: 'btn danger block', style: 'margin-top:10px',
        onclick: () => {
          if (!confirm('Delete ALL progress, logs and settings on this device?')) return;
          if (!confirm('Really sure? This cannot be undone (unless you exported a backup).')) return;
          store.resetAll();
          location.hash = '#/today';
          location.reload();
        },
      }, 'Reset everything'),
    ),

    h('div', { class: 'card tiny faint' },
      'Built for the 15-week volleyball strength & plyo program · works offline · v2',
    ),
  );
}
