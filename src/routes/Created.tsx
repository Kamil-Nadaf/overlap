import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CopyField } from '../components/CopyField';
import { Check } from '../components/icons';
import { adminKey, load } from '../lib/storage';
import { api, friendlyError } from '../lib/api';
import { deleteMyEvent } from '../lib/deleteEvent';
import { useEvent } from '../lib/useEvent';

export const eventUrl = (id: string) => `${location.origin}${location.pathname}#/e/${id}`;

export function Created() {
  const { id = '' } = useParams();
  const { bundle } = useEvent(id);
  const token = load<string>(adminKey(id), '');
  const ev = bundle?.event;
  const nav = useNavigate();
  const [asking, setAsking] = useState(false);
  const [err, setErr] = useState('');
  const remove = () =>
    void deleteMyEvent(id, token).then(
      () => nav('/'),
      (e) => {
        setAsking(false);
        setErr(friendlyError(e));
      },
    );

  return (
    <div className="card mx-4 mb-4 max-w-2xl sm:mx-8 lg:ml-auto px-5 py-7 sm:px-9">
      <div className="mb-1 flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-[2.5px] border-[#4f7a45] text-[#4f7a45]">
          <Check size={26} />
        </span>
        <h1 className="h-display text-3xl sm:text-4xl">Your grid is ready</h1>
      </div>
      {ev && (
        <p className="mb-5 text-lg text-ink-soft">
          {ev.title} · {ev.dates.length} {ev.dates.length === 1 ? 'day' : 'days'} · {ev.timezone}
        </p>
      )}
      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-1.5 text-sm font-bold text-ink-soft">Send this link to everyone</div>
          <CopyField label="Participant link" value={eventUrl(id)} />
        </div>
        {token && (
          <div className="rounded-xl border border-[#c9a95e] bg-[#f0dfb8] p-4">
            <div className="mb-1 text-base font-bold text-[#5a4210]">Your private organizer link</div>
            <p className="m-0 mb-3 text-base text-ink-soft">
              Keep this to yourself. It lets you pick the final time and edit the meeting link. It is also saved in this browser.
            </p>
            <CopyField label="Organizer link" tone="warn" value={`${eventUrl(id)}?admin=${token}`} />
          </div>
        )}
        {ev?.meeting_url && (
          <div className="flex items-center gap-3 rounded-xl border border-edge-soft bg-field px-4 py-3 text-base">
            <span className="font-bold">Meeting link attached:</span>
            <span className="min-w-0 break-all text-muted">{ev.meeting_url}</span>
          </div>
        )}
        {api.mode === 'demo' && (
          <p className="m-0 rounded-lg bg-[#f0dfb8] px-3 py-2 text-sm text-[#5a4210]">
            Demo mode: this link only works in this browser. Connect a backend to share it with other people.
          </p>
        )}
      </div>
      {err && <p className="m-0 mt-4 rounded-lg bg-[#f3d4cc] px-3 py-2 text-base text-[#7e2515]">{err}</p>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        {token ? (
          asking ? (
            <span className="flex items-center gap-2">
              <button type="button" className="btn !bg-[#a8341f] !border-[#7e2515] !shadow-[0_3px_0_#7e2515]" onClick={remove}>
                Yes, delete it
              </button>
              <button type="button" className="cursor-pointer border-0 bg-transparent text-base font-bold underline" onClick={() => setAsking(false)}>
                Keep it
              </button>
            </span>
          ) : (
            <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-base font-bold text-[#a8341f] underline" onClick={() => setAsking(true)}>
              Created by mistake? Delete it
            </button>
          )
        ) : (
          <span />
        )}
        <Link to={`/e/${id}`} className="btn">
          Open the grid <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
