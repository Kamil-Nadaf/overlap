import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, friendlyError } from '../lib/api';
import { Chat } from './icons';

/** Header button + dialog. Messages go to the site owner; hidden in demo mode (no backend to send to). */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [contact, setContact] = useState('');
  const [trap, setTrap] = useState(''); // honeypot: real people never fill this in
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [err, setErr] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    area.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  if (api.mode === 'demo') return null;

  const close = () => {
    setOpen(false);
    if (state === 'done') {
      setState('idle');
      setText('');
    }
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 3) return setErr('Write a few words first.');
    setErr('');
    if (trap) return setState('done'); // pretend success to bots
    setState('sending');
    try {
      await api.sendFeedback(text.trim(), contact.trim(), location.hash.replace(/^#/, '').replace(/\/e\/[^/?]+/, '/e/…').slice(0, 100));
      setState('done');
    } catch (x) {
      setState('idle');
      setErr(friendlyError(x));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border-0 bg-transparent px-2 py-1.5 font-[inherit] text-[length:inherit] font-medium text-ink hover:bg-accent/10 sm:px-3"
      >
        <Chat /> <span>Feedback</span>
      </button>
      {open &&
        createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <form onSubmit={send} role="dialog" aria-modal="true" aria-labelledby="fb-title" className="card w-full max-w-md px-5 py-5">
            {state === 'done' ? (
              <div className="flex flex-col items-start gap-3">
                <h2 id="fb-title" className="h-display m-0 text-2xl">
                  Thank you!
                </h2>
                <p className="m-0 text-base text-ink-soft">Your feedback was sent. It really helps.</p>
                <button type="button" className="btn" onClick={close}>
                  Close
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <h2 id="fb-title" className="h-display m-0 text-2xl">
                  Tell me what you think
                </h2>
                <label className="label">
                  Your feedback
                  <textarea
                    ref={area}
                    className="input min-h-28 resize-y"
                    maxLength={2000}
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setErr("");
                    }}
                    placeholder="What worked, what was confusing, what you'd like next"
                  />
                </label>
                <label className="label">
                  Name or email <span className="font-normal text-muted">(optional, only if you'd like a reply)</span>
                  <input className="input" maxLength={200} value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="off" />
                </label>
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="absolute -left-[9999px] h-0 w-0 opacity-0"
                  value={trap}
                  onChange={(e) => setTrap(e.target.value)}
                  name="website"
                />
                {err && <p className="m-0 rounded-lg bg-[#f3d4cc] px-3 py-2 text-base text-[#7e2515]">{err}</p>}
                <div className="flex items-center justify-end gap-3">
                  <button type="button" className="cursor-pointer border-0 bg-transparent text-base font-bold underline" onClick={close}>
                    Cancel
                  </button>
                  <button type="submit" className="btn" disabled={state === 'sending'}>
                    {state === 'sending' ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>,
        document.body,
      )}
    </>
  );
}
