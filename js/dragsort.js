// ============================================================================
// dragsort.js — hold-and-drag reordering, the way a phone app does it.
//
// Press and hold a card for ~380 ms: it lifts, the other cards slide apart to
// show where it will land, and releasing drops it there. Moving your finger
// before the hold completes is treated as a scroll and cancels the drag, so
// normal scrolling and tapping are unaffected.
//
// Only transforms are animated during the drag (no re-render, no layout
// thrash); the new order is committed once, on release.
// ============================================================================
const HOLD_MS = 380;
const MOVE_CANCEL = 10;   // px of movement before the hold that means "scroll"

export function makeSortable(list, { onCommit, handleFilter } = {}) {
  let st = null;

  const cleanup = () => {
    if (!st) return;
    clearTimeout(st.timer);
    if (st.active) {
      list.classList.remove('sorting');
      for (const it of st.items) { it.el.style.transform = ''; it.el.style.transition = ''; }
      st.el.classList.remove('drag-lift');
      st.el.style.zIndex = '';
    }
    try { st.el.releasePointerCapture?.(st.id); } catch { /* already released */ }
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', cleanup);
    st = null;
  };

  const begin = () => {
    // measure once — everything after this is pure transform
    list.classList.add('sorting');
    const kids = [...list.children];
    st.items = kids.map((el) => {
      const r = el.getBoundingClientRect();
      return { el, top: r.top, h: r.height + 8 /* card gap */ };
    });
    st.from = kids.indexOf(st.el);
    st.to = st.from;
    st.active = true;
    st.el.classList.add('drag-lift');
    st.el.style.zIndex = '5';
    if (navigator.vibrate) navigator.vibrate(8);   // Android only; iOS ignores
  };

  const onMove = (e) => {
    if (!st) return;
    const dy = e.clientY - st.y0;
    if (!st.active) {
      if (Math.abs(dy) > MOVE_CANCEL || Math.abs(e.clientX - st.x0) > MOVE_CANCEL) cleanup();
      return;
    }
    e.preventDefault();
    st.el.style.transform = `translateY(${dy}px)`;

    // where would it land?
    const h = st.items[st.from].h;
    let to = st.from + Math.round(dy / h);
    to = Math.max(0, Math.min(st.items.length - 1, to));
    if (to !== st.to) {
      st.to = to;
      st.items.forEach((it, i) => {
        if (i === st.from) return;
        let shift = 0;
        if (st.from < to && i > st.from && i <= to) shift = -h;
        else if (st.from > to && i < st.from && i >= to) shift = h;
        it.el.style.transition = 'transform .16s ease';
        it.el.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    }
  };

  const onUp = () => {
    if (!st) return;
    const { from, to, active } = st;
    cleanup();
    if (!active) return;
    // the press became a drag, so the click it would fire is not a tap
    const swallow = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 350);
    if (to !== from) onCommit?.(from, to);
  };

  // Controls you use mid-set must never turn into a drag; the rest of the card
  // (title, meta, icons) is fair game to hold, exactly like a phone list.
  const NO_DRAG = 'input, select, textarea, a, label, .sets, .orgbar, .ex-actions, .counterbox, .seg';

  list.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return;
    if (e.target.closest(NO_DRAG)) return;
    const el = e.target.closest('[data-sortable]');
    if (!el || el.parentElement !== list) return;
    if (handleFilter && !handleFilter(el)) return;

    st = { el, id: e.pointerId, x0: e.clientX, y0: e.clientY, active: false, timer: null };
    st.timer = setTimeout(() => {
      if (!st) return;
      try { el.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      begin();
    }, HOLD_MS);

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', cleanup);
  });

  return cleanup;
}
