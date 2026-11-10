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
      return { el, top: r.top, h: r.height + 8 /* card gap */, mid: r.top + r.height / 2 };
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

    // Where would it land? Compare the dragged card's centre against each
    // neighbour's centre — cards on this screen vary a lot in height, so a
    // fixed row height would drop things in the wrong place.
    const self = st.items[st.from];
    const h = self.h;
    const centre = self.mid + dy;
    let to = st.from;
    for (let i = st.from + 1; i < st.items.length; i++) {
      if (centre > st.items[i].mid) to = i; else break;
    }
    if (to === st.from) {
      for (let i = st.from - 1; i >= 0; i--) {
        if (centre < st.items[i].mid) to = i; else break;
      }
    }
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
    // Walk up to the direct child of the list: for a lone card that is the
    // card, for a superset it is the group — so grabbing either card of a
    // superset drags the pair as one unit.
    let el = e.target;
    while (el && el !== list && el.parentElement !== list) el = el.parentElement;
    if (!el || el === list || !el.hasAttribute?.('data-sortable')) return;
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

// ============================================================================
// makeSwappable — hold an item, drag it onto another, let go: the two swap.
// Used for days of the week (organizer and start screen). Items are the
// elements inside `root` with a data-pos attribute; a disabled one is locked
// (can't be picked up or dropped on). A quick move before the hold is a
// scroll, so scrolling and tapping work as usual.
//   scroller: the element that scrolls (default: the page)
// ============================================================================
export function makeSwappable(root, { onSwap, scroller = null, enabled = () => true, hold = 250 } = {}) {
  const CANCEL = 10, EDGE = 56;
  let dg = null;
  const scrollY = () => (scroller ? scroller.scrollTop : window.scrollY);
  const targetAt = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest?.('[data-pos]');
    return el && root.contains(el) && !el.disabled && +el.dataset.pos !== dg.from ? el : null;
  };
  const end = () => {
    if (!dg) return;
    clearTimeout(dg.timer);
    cancelAnimationFrame(dg.raf);
    dg.el.classList.remove('lifted');
    dg.el.style.transform = ''; dg.el.style.pointerEvents = '';
    dg.over?.classList.remove('over');
    root.classList.remove('dragging');
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', end);
    dg = null;
  };
  // keep scrolling while the finger rests near the top or bottom edge
  const edgeScroll = () => {
    if (!dg?.active) return;
    const r = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    const dir = dg.y < r.top + EDGE ? -1 : dg.y > r.bottom - EDGE ? 1 : 0;
    if (dir) { if (scroller) scroller.scrollTop += dir * 8; else window.scrollBy(0, dir * 8); place(); }
    dg.raf = requestAnimationFrame(edgeScroll);
  };
  const place = () => {
    dg.el.style.transform = `translate(${dg.x - dg.x0}px, ${dg.y - dg.y0 + scrollY() - dg.s0}px) scale(1.03)`;
  };
  const move = (e) => {
    if (!dg) return;
    if (!dg.active) { if (Math.hypot(e.clientX - dg.x0, e.clientY - dg.y0) > CANCEL) end(); return; }
    e.preventDefault();
    dg.x = e.clientX; dg.y = e.clientY;
    place();
    const t = targetAt(e.clientX, e.clientY);
    if (t !== dg.over) { dg.over?.classList.remove('over'); dg.over = t; t?.classList.add('over'); }
  };
  const up = () => {
    if (!dg) return;
    const { active, over, from } = dg;
    end();
    if (!active) return;
    // the press became a drag, so the click it fires is not a tap
    const swallow = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 350);
    if (!over) return;
    navigator.vibrate?.(10);
    onSwap(from, +over.dataset.pos);
  };
  root.addEventListener('pointerdown', (e) => {
    if (!enabled() || (e.button != null && e.button !== 0)) return;
    const el = e.target.closest('[data-pos]');
    if (!el || !root.contains(el) || el.disabled) return;
    dg = { el, from: +el.dataset.pos, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY,
      s0: scrollY(), active: false, over: null, raf: 0 };
    dg.timer = setTimeout(() => {
      if (!dg) return;
      dg.active = true;
      el.classList.add('lifted');
      el.style.pointerEvents = 'none';        // so the finger "sees" the item underneath
      root.classList.add('dragging');
      navigator.vibrate?.(8);
      dg.raf = requestAnimationFrame(edgeScroll);
    }, hold);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', end);
  });
  // iPhone scrolls on touchmove whatever pointermove does: stop it mid-drag.
  root.addEventListener('touchmove', (e) => { if (dg?.active) e.preventDefault(); }, { passive: false });
  // a long press must not open the iOS callout / text selection
  root.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-pos]')) e.preventDefault(); });
}
