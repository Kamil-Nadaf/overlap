import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Grid } from '../lib/slots';
import { describeSlot } from '../lib/slots';
import type { SlotTally } from '../lib/aggregate';
import type { Level } from '../types';

export type Brush = 0 | 1 | 2; // 0 erase, 1 if need be, 2 available

const RAMP = ['#fbf3df', '#e3ecc2', '#c3d98f', '#9bbd62', '#6f9b3f', '#4a7a2a'];

interface Props {
  grid: Grid;
  zone: string;
  mode: 'mine' | 'group';
  mine: Record<string, Level>;
  tallies: Map<string, SlotTally>;
  total: number; // participants, for heat scaling
  brush: Brush;
  focus: string | null;
  finalSlots: Set<string>;
  onPaint: (changes: Record<string, Level | 0>) => void;
  onFocus: (slot: string) => void;
  touchPaint?: boolean; // let a finger drag paint (disables scrolling from the grid)
}

/**
 * Time-slot table. Mouse/pen: press and drag to paint or erase.
 * Touch and keyboard: tap / Enter / Space toggles one slot (so the page can still scroll).
 */
interface CellProps {
  slot: string;
  label: string;
  lv: Level | 0;
  n: number;
  heat: string;
  dark: boolean;
  mode: 'mine' | 'group';
  isFocus: boolean;
  isFinal: boolean;
  hour: boolean;
  rowH: number;
  state: string;
  onDown: (e: React.PointerEvent, slot: string) => void;
  onEnter: (e: React.PointerEvent, slot: string) => void;
  onClick: (slot: string) => void;
}

// One slot. Memoized so painting a slot re-renders only the slots that changed (keeps phones smooth).
const Cell = memo(function Cell(c: CellProps) {
  const style: React.CSSProperties = { height: c.rowH, borderTopColor: c.hour ? '#b9a479' : undefined };
  let cls = 'relative flex w-full cursor-pointer items-center justify-center rounded-md border p-0 font-bold ';
  let content: React.ReactNode = null;
  if (c.mode === 'mine') {
    cls += c.lv === 2 ? 'border-yes-d bg-yes text-base ' : c.lv === 1 ? 'stripes border-[#c9a95e] text-base ' : 'border-edge-soft bg-field ';
    content = (
      <>
        {c.lv === 2 ? '✓' : c.lv === 1 ? '?' : ''}
        {c.n > 0 && <span className="absolute right-0.5 top-0 text-[10px] font-medium leading-none text-ink/70">{c.n}</span>}
      </>
    );
  } else {
    style.background = c.heat;
    cls += `border-edge-soft text-base ${c.dark ? 'text-field' : 'text-ink'} `;
    content = c.n || '';
  }
  if (c.isFocus) cls += 'outline outline-[3px] -outline-offset-1 outline-ink ';
  if (c.isFinal) cls += 'ring-2 ring-accent ';
  return (
    <button
      type="button"
      data-slot={c.slot}
      aria-label={`${c.label}, ${c.state}`}
      className={cls}
      style={style}
      onPointerDown={(e) => c.onDown(e, c.slot)}
      onPointerEnter={(e) => c.onEnter(e, c.slot)}
      onClick={() => c.onClick(c.slot)}
    >
      {content}
    </button>
  );
});

export function SlotGrid(p: Props) {
  const drag = useRef<{ value: Level | 0 } | null>(null);
  const suppressClick = useRef(false);
  const pRef = useRef(p); // latest props, so the handlers below stay stable and cells can be memoized
  pRef.current = p;

  useEffect(() => {
    const up = () => {
      drag.current = null;
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  const valueFor = (slot: string): Level | 0 => {
    const q = pRef.current;
    const cur = q.mine[slot] ?? 0;
    return q.brush === 0 || cur === q.brush ? 0 : q.brush;
  };
  const onDown = useCallback((e: React.PointerEvent, slot: string) => {
    const q = pRef.current;
    if (e.pointerType === 'touch' && !(q.touchPaint && q.mode === 'mine')) return;
    suppressClick.current = true;
    if (q.mode === 'group') {
      q.onFocus(slot);
      return;
    }
    e.preventDefault();
    const value = valueFor(slot);
    drag.current = { value };
    q.onPaint({ [slot]: value });
  }, []);
  const onEnter = useCallback((e: React.PointerEvent, slot: string) => {
    const q = pRef.current;
    if (q.mode === 'group' && e.pointerType === 'mouse') q.onFocus(slot);
  }, []);
  const onClick = useCallback((slot: string) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const q = pRef.current;
    if (q.mode === 'group') q.onFocus(slot);
    else q.onPaint({ [slot]: valueFor(slot) });
  }, []);
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-slot]');
    const s = el?.dataset.slot;
    if (s && (pRef.current.mine[s] ?? 0) !== drag.current.value) pRef.current.onPaint({ [s]: drag.current.value });
  };

  // Time labels are slow to compute (Luxon), so only recompute them when the grid or zone changes.
  const labels = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of p.grid.cells) for (const slot of row) if (slot) m.set(slot, describeSlot(slot, p.zone));
    return m;
  }, [p.grid, p.zone]);

  const rowH = p.grid.rows.length > 24 ? 26 : 32;
  const touchAction = p.touchPaint && p.mode === 'mine' ? 'none' : 'manipulation';
  const total = Math.max(1, p.total);

  return (
    <div className="flex gap-2" onPointerMove={move} style={{ touchAction, userSelect: 'none' }}>
      <div className="w-10 shrink-0 pt-[46px] sm:w-14">
        {p.grid.rows.map((r) => (
          <div key={r.minutes} className="flex items-start justify-end pr-1 text-xs text-muted" style={{ height: rowH + 2 }}>
            {r.hourStart ? <span className="-mt-1 font-medium">{r.label}</span> : <span className="-mt-1 opacity-60">{r.label.slice(3) === '30' ? ':30' : r.label.slice(3).padStart(3, ':')}</span>}
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-x-auto" style={{ touchAction }}>
        <div style={{ minWidth: p.grid.cols.length * 40 }}>
          <div className="sticky top-0 z-[5] mb-0.5 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${p.grid.cols.length}, minmax(0, 1fr))` }}>
            {p.grid.cols.map((c) => (
              <div key={c.dateKey} className="flex h-11 flex-col items-center justify-center rounded-md bg-paper/80 leading-tight">
                <span className="text-base font-bold">{c.weekday}</span>
                <span className="text-xs text-muted">{c.label}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${p.grid.cols.length}, minmax(0, 1fr))` }}>
            {p.grid.cells.map((row, ri) =>
              row.map((slot, ci) => {
                const key = `${ri}-${ci}`;
                if (!slot) return <div key={key} style={{ height: rowH }} className="rounded-sm bg-ink/5" aria-hidden="true" />;
                const lv = (p.mine[slot] ?? 0) as Level | 0;
                const n = p.tallies.get(slot)?.count ?? 0;
                const state = p.mode === 'mine' ? (lv === 2 ? 'available' : lv === 1 ? 'if need be' : 'not available') : `${n} of ${p.total} free`;
                return (
                  <Cell
                    key={key}
                    slot={slot}
                    label={labels.get(slot) ?? slot}
                    lv={lv}
                    n={n}
                    heat={RAMP[Math.min(5, Math.round((5 * n) / total))]}
                    dark={n / total >= 0.7}
                    mode={p.mode}
                    isFocus={p.focus === slot}
                    isFinal={p.finalSlots.has(slot)}
                    hour={p.grid.rows[ri].hourStart}
                    rowH={rowH}
                    state={state}
                    onDown={onDown}
                    onEnter={onEnter}
                    onClick={onClick}
                  />
                );
              }),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
