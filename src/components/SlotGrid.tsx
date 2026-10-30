import { useCallback, useEffect, useRef } from 'react';
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
export function SlotGrid(p: Props) {
  const drag = useRef<{ value: Level | 0 } | null>(null);
  const suppressClick = useRef(false);
  const mineRef = useRef(p.mine);
  mineRef.current = p.mine;

  const valueFor = useCallback((slot: string): Level | 0 => {
    const cur = mineRef.current[slot] ?? 0;
    return p.brush === 0 || cur === p.brush ? 0 : p.brush;
  }, [p.brush]);

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

  const slotAt = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-slot]');
    return el?.dataset.slot ?? null;
  };

  const down = (e: React.PointerEvent, slot: string) => {
    if (e.pointerType === 'touch' && !(p.touchPaint && p.mode === 'mine')) return;
    suppressClick.current = true;
    if (p.mode === 'group') {
      p.onFocus(slot);
      return;
    }
    e.preventDefault();
    const value = valueFor(slot);
    drag.current = { value };
    p.onPaint({ [slot]: value });
  };
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const s = slotAt(e.clientX, e.clientY);
    if (s && (mineRef.current[s] ?? 0) !== drag.current.value) p.onPaint({ [s]: drag.current.value });
  };
  const click = (slot: string) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (p.mode === 'group') p.onFocus(slot);
    else p.onPaint({ [slot]: valueFor(slot) });
  };

  const rowH = p.grid.rows.length > 24 ? 26 : 32;

  return (
    <div className="flex gap-2" onPointerMove={move} style={{ touchAction: p.touchPaint && p.mode === 'mine' ? 'none' : 'manipulation', userSelect: 'none' }}>
      <div className="w-10 shrink-0 pt-[46px] sm:w-14">
        {p.grid.rows.map((r) => (
          <div key={r.minutes} className="flex items-start justify-end pr-1 text-xs text-muted" style={{ height: rowH + 2 }}>
            {r.hourStart ? <span className="-mt-1 font-medium">{r.label}</span> : <span className="-mt-1 opacity-60">{r.label.slice(3) === '30' ? ':30' : r.label.slice(3).padStart(3, ':')}</span>}
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-x-auto" style={{ touchAction: p.touchPaint && p.mode === 'mine' ? 'none' : 'manipulation' }}>
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
                const lv = p.mine[slot] ?? 0;
                const t = p.tallies.get(slot);
                const n = t?.count ?? 0;
                const heat = RAMP[Math.min(5, Math.round((5 * n) / Math.max(1, p.total)))];
                const isFocus = p.focus === slot;
                const isFinal = p.finalSlots.has(slot);
                const hour = p.grid.rows[ri].hourStart;
                const style: React.CSSProperties = { height: rowH, borderTopColor: hour ? '#b9a479' : undefined };
                let cls = 'relative flex w-full cursor-pointer items-center justify-center rounded-md border p-0 font-bold ';
                let content: React.ReactNode = null;
                let state = '';
                if (p.mode === 'mine') {
                  cls += lv === 2 ? 'border-yes-d bg-yes text-base ' : lv === 1 ? 'stripes border-[#c9a95e] text-base ' : 'border-edge-soft bg-field ';
                  content = (
                    <>
                      {lv === 2 ? '✓' : lv === 1 ? '?' : ''}
                      {n > 0 && <span className="absolute right-0.5 top-0 text-[10px] font-medium leading-none text-ink/70">{n}</span>}
                    </>
                  );
                  state = lv === 2 ? 'available' : lv === 1 ? 'if need be' : 'not available';
                } else {
                  style.background = heat;
                  cls += `border-edge-soft text-base ${n / Math.max(1, p.total) >= 0.7 ? 'text-field' : 'text-ink'} `;
                  content = n || '';
                  state = `${n} of ${p.total} free`;
                }
                if (isFocus) cls += 'outline outline-[3px] -outline-offset-1 outline-ink ';
                if (isFinal) cls += 'ring-2 ring-accent ';
                return (
                  <button
                    key={key}
                    type="button"
                    data-slot={slot}
                    aria-label={`${describeSlot(slot, p.zone)}, ${state}`}
                    className={cls}
                    style={style}
                    onPointerDown={(e) => down(e, slot)}
                    onPointerEnter={(e) => {
                      if (p.mode === 'group' && e.pointerType === 'mouse') p.onFocus(slot);
                    }}
                    onClick={() => click(slot)}
                  >
                    {content}
                  </button>
                );
              }),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
