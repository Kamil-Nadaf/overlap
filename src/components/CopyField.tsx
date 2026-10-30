import { useState } from 'react';
import { Copy } from './icons';

export function CopyField({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warn' }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.getElementById(`cf-${label}`) as HTMLInputElement | null;
      el?.select();
      document.execCommand('copy');
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <input id={`cf-${label}`} readOnly value={value} aria-label={label} className="input min-w-0 flex-1 basis-64" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" onClick={copy} className={tone === 'warn' ? 'btn btn-ghost !border-[#5a4210] !text-[#5a4210]' : 'btn'}>
        <Copy /> {done ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
