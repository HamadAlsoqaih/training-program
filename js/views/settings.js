// ============================================================================
// settings.js — onboarding (first run) + settings screen.
// ============================================================================
import { h, toast } from '../util.js';
import { getWeek, DAY_NAMES, getDay } from '../program.js';
import * as store from '../state.js';
import { seedBefore } from '../completion.js';
import { idToIndex, indexToId, toISO, todayId, clampIndex, todayIndexRaw } from '../schedule.js';

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------
export function renderOnboarding(onDone) {
  // default anchor: Monday nearest to today (program Day 6 = Monday), Week 3
  const now = new Date();
  const dow = now.getDay(); // 0 Sun..6 Sat
  const toMon = ((1 - dow) + 7) % 7; // days until next Monday
  const nearestMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (toMon <= 3 ? toMon : toMon - 7), 12);

  let week = 3, dayN = 6, dateISO = toISO(nearestMon), seed = true;

  const weekSel = h('select', { class: 'sel' },
    ...Array.from({ length: 15 }, (_, i) => h('option', { value: i + 1, selected: i + 1 === week }, `Week ${i + 1}`)));
  const daySel = h('select', { class: 'sel' },
    ...DAY_NAMES.map((n, i) => h('option', { value: i + 1, selected: i + 1 === dayN }, `Day ${i + 1} — ${n}`)));
  const dateIn = h('input', { class: 'txt', type: 'date', value: dateISO });
  const seedTgl = h('input', { type: 'checkbox', checked: true });
  const preview = h('div', { class: 'banner', style: 'margin-top:12px' });

  const updatePreview = () => {
    week = +weekSel.value; dayN = +daySel.value; dateISO = dateIn.value || dateISO; seed = seedTgl.checked;
    const d = getDay(`w${week}d${dayN}`);
    preview.innerHTML = `<b>${dateISO}</b> ↔ <b>Week ${week} · ${d.name}</b> (${d.title}).` +
      (seed ? `<br>Everything before it will be marked <b>done (assumed)</b>.` : '');
  };
  [weekSel, daySel, dateIn, seedTgl].forEach((el) => el.addEventListener('change', updatePreview));
  updatePreview();

  return h('div', { class: 'onboard' }, h('div', { class: 'inner' },
    h('div', { class: 'center', style: 'margin-bottom:22px' },
      h('div', { style: 'font-size:56px' }, '🏐'),
      h('div', { class: 'h1', style: 'margin-top:8px' }, '15-Week Program'),
      h('div', { class: 'dim small', style: 'margin-top:6px' },
        'Plyo · strength · shoulder rehab · volleyball. All 105 days, tracked on your phone.'),
    ),
    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'margin-bottom:10px' }, 'Where are you in the program?'),
      h('div', { class: 'small dim', style: 'margin-bottom:10px' },
        'Pick your current (or next) training day and the real date it lands on. The app maps every other day to the calendar from there.'),
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
        'In Safari: tap Share → “Add to Home Screen”. You get a full-screen app that works offline, and timers/sounds behave better.'),
    ),
    h('div', { class: 'card' },
      h('div', { class: 'h2', style: 'font-size:14px' }, '🌙 Late-night grace'),
      h('div', { class: 'small dim', style: 'margin-top:4px' },
        'The day doesn\'t flip at midnight — before 4 AM you still see the previous day\'s workout. Change the hour in Settings.'),
    ),
    h('button', {
      class: 'btn primary block', style: 'margin-top:8px;min-height:54px',
      onclick: () => {
        store.update((s) => {
          s.setup = { done: true, anchorDate: dateIn.value || dateISO, anchorDay: `w${week}d${dayN}`, rolloverHour: 4 };
        });
        if (seedTgl.checked) seedBefore(idToIndex(`w${week}d${dayN}`));
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
  const anchorDay = s.setup.anchorDay;
  const m = /w(\d+)d(\d)/.exec(anchorDay);
  const weekSel = h('select', { class: 'sel' },
    ...Array.from({ length: 15 }, (_, i) => h('option', { value: i + 1, selected: i + 1 === +m[1] }, `Week ${i + 1}`)));
  const daySel = h('select', { class: 'sel' },
    ...DAY_NAMES.map((n, i) => h('option', { value: i + 1, selected: i + 1 === +m[2] }, `Day ${i + 1} — ${n}`)));
  const dateIn = h('input', { class: 'txt', type: 'date', value: s.setup.anchorDate || '' });
  const rollSel = h('select', { class: 'sel' },
    ...[0, 1, 2, 3, 4, 5, 6].map((hh) => h('option', { value: hh, selected: hh === s.setup.rolloverHour },
      hh === 0 ? 'Midnight (no grace)' : `${hh} AM`)));
  const saveSchedule = () => {
    store.update((st) => {
      st.setup.anchorDay = `w${weekSel.value}d${daySel.value}`;
      if (dateIn.value) st.setup.anchorDate = dateIn.value;
      st.setup.rolloverHour = +rollSel.value;
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
      h('div', { class: 'h2', style: 'font-size:14px;margin-bottom:8px' }, '📅 Schedule'),
      h('div', { class: 'tiny faint', style: 'margin-bottom:8px' },
        'Anchor: which program day falls on which real date. Move it if you shift your schedule.'),
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
      'Built for the 15-week volleyball strength & plyo program · works offline · v1',
    ),
  );
}
