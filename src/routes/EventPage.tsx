import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { DateTime } from 'luxon';
import { SlotGrid, type Brush } from '../components/SlotGrid';
import { CopyField } from '../components/CopyField';
import { Check, Globe, Video } from '../components/icons';
import { api, friendlyError } from '../lib/api';
import { getGmailToken, gmailEnabled, preloadGoogle, sendConfirmations } from '../lib/gmail';
import { bestBlocks, levelsFor, namesFor, tally, type Block } from '../lib/aggregate';
import { downloadIcs, googleCalendarUrl, outlookUrl, type CalEvent } from '../lib/ics';
import { allZones, browserZone, buildGrid, describeSlot, generateSlots, sliceGrid, weeksOf } from '../lib/slots';
import { adminKey, identityKey, load, RECENT_KEY, remove, save, type Identity } from '../lib/storage';
import { useEvent } from '../lib/useEvent';
import type { Level } from '../types';
import { eventUrl } from './Created';

const ZONE_KEY = 'overlap:zone';
const emailOk = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

export function EventPage() {
  const { id = '' } = useParams();
  const [q] = useSearchParams();
  const { bundle, loading, error, refresh } = useEvent(id);

  const [zone, setZone] = useState(() => load<string>(ZONE_KEY, browserZone()));
  const [mode, setMode] = useState<'mine' | 'group'>('mine');
  const [brush, setBrush] = useState<Brush>(2);
  const [mine, setMine] = useState<Record<string, Level>>({});
  const [dirty, setDirty] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [ident, setIdent] = useState<Identity>(() => load<Identity>(identityKey(id), { name: '', pin: '', email: '', wantsReminder: false }));
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [meetUrl, setMeetUrl] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [restored, setRestored] = useState(false);
  const [step, setStep] = useState<'details' | 'times' | 'decide'>('details');
  const [weekIdx, setWeekIdx] = useState(0);
  const [touchPaint, setTouchPaint] = useState(false);
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const [pick, setPick] = useState<{ start: string; end: string } | null>(null);
  const [useGmail, setUseGmail] = useState(() => load<boolean>('overlap:gmail', true));
  const canGmail = gmailEnabled && api.mode === 'remote';
  useEffect(() => {
    if (canGmail && isAdmin) preloadGoogle();
  }, [canGmail, isAdmin]);

  const ev = bundle?.event;
  const people = useMemo(() => bundle?.participants ?? [], [bundle]);
  const rows = useMemo(() => bundle?.availability ?? [], [bundle]);

  const slots = useMemo(() => (ev ? generateSlots(ev) : []), [ev]);
  const grid = useMemo(() => buildGrid(slots, zone), [slots, zone]);
  const weeks = useMemo(() => weeksOf(grid), [grid]);
  const week = weeks[Math.min(weekIdx, Math.max(0, weeks.length - 1))];
  const weekGrid = useMemo(() => (week ? sliceGrid(grid, week) : grid), [grid, week]);
  const tallies = useMemo(() => tally(slots, rows), [slots, rows]);
  const blocks = useMemo(() => (ev ? bestBlocks(slots, tallies, ev.slot_minutes) : []), [ev, slots, tallies]);
  const zones = useMemo(() => [...new Set([browserZone(), ev?.timezone ?? 'UTC', ...allZones()])], [ev?.timezone]);

  // Admin token from ?admin= or storage; verified by the server.
  useEffect(() => {
    const t = q.get('admin') || load<string>(adminKey(id), '');
    if (!t) return;
    void api.verifyAdmin(id, t).then((ok) => {
      if (ok) {
        setToken(t);
        setIsAdmin(true);
        save(adminKey(id), t);
      }
    }).catch(() => undefined);
  }, [id, q]);

  useEffect(() => {
    if (ev) setMeetUrl(ev.meeting_url ?? '');
  }, [ev]);

  // Remember this event in "recent".
  useEffect(() => {
    if (!ev) return;
    const recent = load<{ id: string; title: string }[]>(RECENT_KEY, []).filter((x) => x.id !== ev.id);
    save(RECENT_KEY, [{ id: ev.id, title: ev.title }, ...recent].slice(0, 8));
  }, [ev]);

  // Restore my saved slots if I was here before.
  useEffect(() => {
    if (restored || !bundle || !ident.name.trim()) return;
    setRestored(true);
    const p = bundle.participants.find((x) => x.name.toLowerCase() === ident.name.trim().toLowerCase());
    if (!p) return;
    void api.verifyParticipant(id, ident.name, ident.pin).then((ok) => {
      if (ok) setMine(levelsFor(bundle.availability, p.id));
    }).catch(() => undefined);
  }, [bundle, restored, ident.name, ident.pin, id]);

  const pickZone = (z: string) => {
    setZone(z);
    save(ZONE_KEY, z);
  };

  const paint = (changes: Record<string, Level | 0>) => {
    setMine((prev) => {
      const next = { ...prev };
      for (const [s, v] of Object.entries(changes)) {
        if (v === 0) delete next[s];
        else next[s] = v;
      }
      return next;
    });
    setDirty(true);
    setMsg(null);
  };

  const matching = people.find((p) => p.name.toLowerCase() === ident.name.trim().toLowerCase());

  const loadMine = async () => {
    if (!matching) return;
    try {
      if (await api.verifyParticipant(id, ident.name, ident.pin)) {
        setMine(levelsFor(rows, matching.id));
        setDirty(false);
        setMsg({ kind: 'ok', text: 'Loaded your saved times.' });
      } else setMsg({ kind: 'err', text: friendlyError(new Error('wrong_pin')) });
    } catch (e) {
      setMsg({ kind: 'err', text: friendlyError(e) });
    }
  };

  const doSave = async () => {
    if (!ident.name.trim()) return setMsg({ kind: 'err', text: 'Type your name first.' });
    if (ident.email && !emailOk(ident.email.trim())) return setMsg({ kind: 'err', text: 'That email address does not look right.' });
    setBusy(true);
    try {
      await api.saveAvailability({
        eventId: id,
        name: ident.name.trim(),
        pin: ident.pin,
        email: ident.email.trim(),
        wantsReminder: !!ident.email.trim(),
        slots: Object.entries(mine).map(([s, l]) => ({ s, l })),
      });
      save(identityKey(id), ident);
      setDirty(false);
      setMsg({ kind: 'ok', text: 'Saved. Everyone can see your times now.' });
      await refresh();
    } catch (e) {
      setMsg({ kind: 'err', text: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  };

  const setFinal = async (start: string | null, end: string | null) => {
    const evt = bundle?.event;
    const viaGmail = !!(start && end && evt && canGmail && useGmail);
    try {
      // Ask Google first, straight from the click, or the browser blocks the popup.
      let gToken = '';
      if (viaGmail) {
        try {
          gToken = await getGmailToken();
        } catch {
          setMsg({ kind: 'err', text: 'Google sign-in was closed or blocked. Allow the popup and try again, or untick "Send from my Gmail" to let Overlap send it.' });
          return;
        }
      }
      await api.finalizeEvent(id, token, start, end, meetUrl);
      await refresh();
      if (!start || !end) return;
      if (!viaGmail || !evt) {
        setMsg({
          kind: 'ok',
          text: api.mode === 'remote' ? 'Meeting set. Everyone who left an email is being notified (within a minute).' : 'Meeting set. Demo mode does not send email.',
        });
        return;
      }
      const emails = await api.organizerRecipients(id, token);
      if (emails.length === 0) {
        setMsg({ kind: 'ok', text: 'Meeting set. Nobody has left an email address yet, so nothing was sent.' });
        return;
      }
      await api.claimConfirmation(id, token, emails); // tells the reminder worker not to send the confirmation too
      const mins = Math.round((Date.parse(end) - Date.parse(start)) / 60000);
      const url = meetUrl.trim() || evt.meeting_url;
      const res = await sendConfirmations(gToken, emails, {
        title: evt.title,
        organizerName: evt.organizer_name ?? undefined,
        whenText: `${describeSlot(start, evt.timezone, mins)} (${evt.timezone})`,
        utcText: describeSlot(start, 'UTC', mins),
        meetingUrl: url,
        eventLink: eventUrl(id),
        cal: { uid: evt.id, title: evt.title, startIso: start, endIso: end, url, description: evt.description ?? undefined, alarmMinutes: [60] },
      });
      if (res.failed.length) await api.releaseConfirmation(id, token, res.failed); // worker retries these from the shared sender
      const ok = emails.length - res.failed.length;
      setMsg(
        res.failed.length === 0
          ? { kind: 'ok', text: `Meeting set. Sent from your Gmail to ${ok} ${ok === 1 ? 'person' : 'people'}. Reminders follow automatically.` }
          : { kind: 'err', text: `Meeting set. Your Gmail sent ${ok} of ${emails.length}; Overlap will email the rest from its own address (${(res.reason ?? 'unknown').slice(0, 120)}).` },
      );
    } catch (e) {
      setMsg({ kind: 'err', text: friendlyError(e) });
    }
  };

  if (loading && !bundle) return <Center>Loading…</Center>;
  if (error && !bundle) return <Center>{friendlyError(new Error('network'))}</Center>;
  if (!bundle || !ev) {
    return (
      <Center>
        <p className="m-0 mb-4">This event was not found. It may have expired, or the link is incomplete.</p>
        {api.mode === 'demo' && <p className="m-0 mb-4 text-sm text-muted">Demo mode only knows events created in this browser.</p>}
        <Link to="/new" className="btn">
          Create a new event
        </Link>
      </Center>
    );
  }

  const focusSlot = focus ?? blocks[0]?.start ?? null;
  const ft = focusSlot ? tallies.get(focusSlot) : undefined;
  const busyIds = ft ? people.filter((p) => !ft.yes.includes(p.id) && !ft.maybe.includes(p.id)).map((p) => p.id) : [];
  const finalStart = ev.final_start ? DateTime.fromISO(ev.final_start).toUTC().toISO({ suppressMilliseconds: true })! : null;
  const finalEnd = ev.final_end ? DateTime.fromISO(ev.final_end).toUTC().toISO({ suppressMilliseconds: true })! : null;
  const finalMinutes = finalStart && finalEnd ? Math.round((Date.parse(finalEnd) - Date.parse(finalStart)) / 60000) : 0;
  const finalSlots = new Set(finalStart && finalEnd ? slots.filter((s) => s >= finalStart && s < finalEnd) : []);
  const cal: CalEvent | null =
    finalStart && finalEnd ? { uid: ev.id, title: ev.title, startIso: finalStart, endIso: finalEnd, url: ev.meeting_url, description: ev.description ?? undefined, alarmMinutes: [60] } : null;
  const total = Math.max(1, people.length);
  const when = (b: Block) => describeSlot(b.start, zone, Math.round((Date.parse(b.end) - Date.parse(b.start)) / 60000));
  const myCount = Object.keys(mine).length;

  const sel = pick ?? (blocks[0] ? { start: blocks[0].start, end: blocks[0].end } : null);
  const goDetailsNext = () => {
    if (!ident.name.trim()) return setMsg({ kind: 'err', text: 'Type your name first.' });
    if (ident.email && !emailOk(ident.email.trim())) return setMsg({ kind: 'err', text: 'That email address does not look right.' });
    setMsg(null);
    setStep('times');
  };
  const tabs: { id: typeof step; label: string }[] = [
    { id: 'details', label: '1  Your details' },
    { id: 'times', label: '2  Pick times' },
    ...(isAdmin ? [{ id: 'decide' as const, label: '3  Decide' }] : []),
  ];
  const msgBox = msg && (
    <p role={msg.kind === 'err' ? 'alert' : 'status'} className={`m-0 rounded-lg px-3 py-2 text-base ${msg.kind === 'err' ? 'border border-[#b3402e] bg-[#f6d9d2] text-[#6b1d10]' : 'bg-[#e3efcf] text-[#2f4a22]'}`}>
      {msg.text}
    </p>
  );

  return (
    <div className="w-full max-w-[700px] px-4 sm:px-8 lg:ml-auto">
      <div className="card flex flex-col gap-4 px-3 py-5 sm:px-7">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="h-display text-2xl sm:text-3xl">{ev.title}</h1>
            <p className="m-0 mt-1 text-base text-ink-soft">
              {ev.dates.length} {ev.dates.length === 1 ? 'day' : 'days'} · {people.length} {people.length === 1 ? 'person' : 'people'} so far
              {ev.organizer_name ? ` · organized by ${ev.organizer_name}` : ''}
            </p>
          </div>
          <label className="flex items-center gap-2 text-base text-ink-soft">
            <Globe />
            <span className="font-bold">Times in</span>
            <select value={zone} onChange={(e) => pickZone(e.target.value)} className="input !w-auto max-w-56 !py-1.5 !text-base" aria-label="Time zone">
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Final banner */}
        {cal && finalStart && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-[1.5px] border-[#6b8f5a] bg-[#e3efcf] px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#4f7a45] text-field">
                <Check />
              </span>
              <div>
                <div className="h-display text-xl sm:text-2xl">Meeting set: {describeSlot(finalStart, zone, finalMinutes)}</div>
                {zone !== ev.timezone && <div className="text-sm text-[#3d4a2c]">{describeSlot(finalStart, ev.timezone, finalMinutes)} ({ev.timezone})</div>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {ev.meeting_url && (
                <a className="btn !py-2 !text-base" href={ev.meeting_url} target="_blank" rel="noreferrer">
                  <Video /> Join
                </a>
              )}
              <button type="button" className="btn btn-ghost !py-2 !text-base" onClick={() => downloadIcs(cal)}>
                .ics
              </button>
              <a className="btn btn-ghost !py-2 !text-base" href={googleCalendarUrl(cal)} target="_blank" rel="noreferrer">
                Google Calendar
              </a>
              <a className="btn btn-ghost !py-2 !text-base" href={outlookUrl(cal)} target="_blank" rel="noreferrer">
                Outlook
              </a>
              {isAdmin && (
                <button type="button" className="cursor-pointer border-0 bg-transparent px-2 text-base font-bold text-ink-soft underline" onClick={() => void setFinal(null, null)}>
                  Change
                </button>
              )}
            </div>
          </div>
        )}

        {/* Steps */}
        <div className="flex flex-wrap gap-2 border-b border-edge-soft pb-3" role="tablist" aria-label="Steps">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={step === t.id}
              onClick={() => setStep(t.id)}
              className={`cursor-pointer whitespace-pre rounded-full border px-4 py-1.5 text-base font-bold ${step === t.id ? 'border-accent bg-accent text-field' : 'border-accent bg-transparent text-accent'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* STEP 1: details */}
        {step === 'details' && (
          <div className="mx-auto flex w-full max-w-xl flex-col gap-3 py-2">
            <label className="label">
              Name
              <input className="input" value={ident.name} onChange={(e) => setIdent({ ...ident, name: e.target.value })} placeholder="Your name" autoComplete="nickname" />
            </label>
            <label className="label">
              Email <span className="font-normal text-muted">(optional, you get the meeting confirmation and a reminder)</span>
              <input className="input" type="email" value={ident.email} onChange={(e) => setIdent({ ...ident, email: e.target.value })} placeholder="you@gmail.com" />
            </label>
            <label className="label">
              PIN <span className="font-normal text-muted">(optional, locks your name so nobody else edits your times)</span>
              <input className="input !max-w-48" value={ident.pin} onChange={(e) => setIdent({ ...ident, pin: e.target.value })} placeholder="e.g. 4821" inputMode="numeric" maxLength={12} />
            </label>
            {msgBox}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn" onClick={goDetailsNext}>
                Next: pick times
              </button>
              {matching && (
                <button type="button" className="btn btn-ghost !py-2 !text-base" onClick={() => { void loadMine().then(() => setStep('times')); }}>
                  I was here: load my times
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-col gap-2 border-t border-edge-soft pt-3">
              <span className="label">Share this link with your group</span>
              <CopyField label="Participant link" value={eventUrl(id)} />
              {api.mode === 'demo' && (
                <>
                  <p className="m-0 rounded-lg bg-[#f0dfb8] px-3 py-2 text-sm text-[#5a4210]">Demo mode: data stays in this browser.</p>
                  <button type="button" className="btn btn-ghost self-start !py-2 !text-base" onClick={() => void api.seedSample?.(id).then(refresh)}>
                    Add 4 sample teammates
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: times */}
        {step === 'times' && (
          <section aria-label="Time slots" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex overflow-hidden rounded-full border border-accent" role="group" aria-label="View">
                {(['mine', 'group'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                    className={`cursor-pointer border-0 px-4 py-1.5 text-base font-bold ${mode === m ? 'bg-accent text-field' : 'bg-transparent text-accent'}`}
                  >
                    {m === 'mine' ? 'My times' : 'Everyone'}
                  </button>
                ))}
              </div>
              {mode === 'mine' ? (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Brush">
                  {(
                    [
                      [2, 'Available', 'bg-yes border-yes-d'],
                      [1, 'If need be', 'stripes border-[#c9a95e]'],
                      [0, 'Erase', 'bg-field border-[#b9a479]'],
                    ] as [Brush, string, string][]
                  ).map(([v, label, cls]) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={brush === v}
                      onClick={() => setBrush(v)}
                      className={`cursor-pointer rounded-full border px-4 py-2 text-base font-bold text-ink ${cls} ${brush === v ? 'outline outline-[3px] outline-ink' : ''}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted" aria-hidden="true">
                  0
                  {['#fbf3df', '#e3ecc2', '#c3d98f', '#9bbd62', '#6f9b3f', '#4a7a2a'].map((c) => (
                    <span key={c} className="h-4 w-6 rounded-sm border border-edge-soft" style={{ background: c }} />
                  ))}
                  {people.length} free
                </div>
              )}
            </div>

            {weeks.length > 1 && week && (
              <div className="flex items-center justify-center gap-3">
                <button type="button" className="btn btn-ghost whitespace-nowrap !px-3 !py-1.5 !text-base sm:!px-4" disabled={weekIdx <= 0} onClick={() => setWeekIdx((i) => Math.max(0, i - 1))}>
                  ‹ <span className="hidden sm:inline">Previous week</span><span className="sm:hidden">Prev</span>
                </button>
                <span className="h-display min-w-28 text-center text-xl sm:min-w-40">
                  {week.label} <span className="text-sm text-muted">({Math.min(weekIdx, weeks.length - 1) + 1}/{weeks.length})</span>
                </span>
                <button type="button" className="btn btn-ghost whitespace-nowrap !px-3 !py-1.5 !text-base sm:!px-4" disabled={weekIdx >= weeks.length - 1} onClick={() => setWeekIdx((i) => Math.min(weeks.length - 1, i + 1))}>
                  <span className="hidden sm:inline">Next week</span><span className="sm:hidden">Next</span> ›
                </button>
              </div>
            )}

            {slots.length === 0 ? (
              <p className="p-6 text-center text-lg">No time slots in this event.</p>
            ) : (
              <SlotGrid
                grid={weekGrid}
                zone={zone}
                mode={mode}
                mine={mine}
                tallies={tallies}
                total={total}
                brush={brush}
                focus={focusSlot}
                finalSlots={finalSlots}
                onPaint={paint}
                onFocus={(s) => setFocus(s)}
                touchPaint={touchPaint}
              />
            )}
            {coarse && mode === 'mine' && (
              <button type="button" aria-pressed={touchPaint} onClick={() => setTouchPaint((v) => !v)} className={`cursor-pointer self-start rounded-full border px-4 py-2 text-base font-bold ${touchPaint ? 'border-accent bg-accent text-field' : 'border-accent bg-transparent text-accent'}`}>
                {touchPaint ? 'Drag to paint: on (page will not scroll on the grid)' : 'Drag to paint: off (tap slots, or turn on)'}
              </button>
            )}
            <p className="m-0 text-sm text-muted">
              {mode === 'mine'
                ? 'Press and drag to paint (tap on a phone). Small numbers show how many others are free.'
                : 'Darker means more people are free. Hover or tap a slot to see who.'}
            </p>

            {mode === 'group' && focusSlot && ft && (
              <div className="rounded-xl border border-edge-soft bg-field/70 px-4 py-3" aria-live="polite">
                <div className="h-display text-xl">{describeSlot(focusSlot, zone, ev.slot_minutes)}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {namesFor(ft.yes, people).map((n) => (
                    <span key={'y' + n} className="rounded-full border border-yes-d bg-[#e3efcf] px-3 py-0.5 text-base">{n}</span>
                  ))}
                  {namesFor(ft.maybe, people).map((n) => (
                    <span key={'m' + n} className="stripes rounded-full border border-[#c9a95e] px-3 py-0.5 text-base">{n} <b className="text-xs">if need be</b></span>
                  ))}
                  {namesFor(busyIds, people).map((n) => (
                    <span key={'b' + n} className="rounded-full border border-dashed border-[#9c885f] px-3 py-0.5 text-base text-muted line-through">{n}</span>
                  ))}
                </div>
                {isAdmin && (
                  <button type="button" className="btn btn-ghost mt-2 !py-1.5 !text-base" onClick={() => { setPick({ start: focusSlot, end: new Date(Date.parse(focusSlot) + ev.slot_minutes * 60000).toISOString().replace('.000Z', 'Z') }); setStep('decide'); }}>
                    Use this slot for the meeting
                  </button>
                )}
              </div>
            )}

            {msgBox}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-edge-soft pt-3">
              <span className="text-base text-muted">
                {ident.name.trim() ? `Saving as ${ident.name.trim()}` : 'Add your name in step 1 first'} · {myCount} slots marked{dirty ? ' · unsaved' : ''}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-ghost !py-2 !text-base" onClick={() => setStep('details')}>
                  Back
                </button>
                <button type="button" className="btn" onClick={() => void doSave()} disabled={busy}>
                  {busy ? 'Saving…' : 'Save my times'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* STEP 3: organizer decides */}
        {step === 'decide' && isAdmin && (
          <div className="mx-auto flex w-full max-w-xl flex-col gap-4 py-2">
            <p className="m-0 text-base text-ink-soft">
              {people.length} {people.length === 1 ? 'person has' : 'people have'} replied. Pick the time, add the meeting link, and Overlap emails everyone who left an address (with add-to-calendar buttons), then reminds them before it starts. The event is deleted a day after the meeting ends.
            </p>
            <div>
              <span className="label">Best times</span>
              {blocks.length === 0 ? (
                <p className="m-0 mt-1 text-base text-muted">Nobody has marked a time yet.</p>
              ) : (
                <ol className="m-0 mt-1 flex list-none flex-col gap-2 p-0">
                  {blocks.map((b) => {
                    const on = sel?.start === b.start && sel?.end === b.end;
                    return (
                      <li key={b.start}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => setPick({ start: b.start, end: b.end })}
                          className={`w-full cursor-pointer rounded-lg border px-3 py-2 text-left font-[inherit] text-ink ${on ? 'border-accent bg-[#dbe8ee] outline outline-2 outline-accent' : 'border-edge-soft bg-field'}`}
                        >
                          <div className="text-base font-bold">{when(b)}</div>
                          <div className="text-sm text-muted">
                            {b.yes} free{b.maybe ? ` + ${b.maybe} if need be` : ''} of {people.length}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
              {sel && !blocks.some((b) => b.start === sel.start && b.end === sel.end) && (
                <p className="m-0 mt-2 rounded-lg border border-accent bg-[#dbe8ee] px-3 py-2 text-base font-bold">
                  Selected: {describeSlot(sel.start, zone, Math.round((Date.parse(sel.end) - Date.parse(sel.start)) / 60000))}
                </p>
              )}
            </div>
            <label className="label">
              Meeting link
              <input className="input" type="url" value={meetUrl} onChange={(e) => setMeetUrl(e.target.value)} placeholder="https://meet.google.com/…" />
            </label>
            {canGmail && (
              <label className="flex cursor-pointer items-start gap-2 text-base">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={useGmail}
                  onChange={(e) => {
                    setUseGmail(e.target.checked);
                    save('overlap:gmail', e.target.checked);
                  }}
                />
                <span>
                  <b>Send from my Gmail</b>
                  <span className="block text-sm text-muted">Google asks once to let Overlap send mail as you. It cannot read your inbox. Reminders later come from Overlap's address with replies going to you.</span>
                </span>
              </label>
            )}
            {msgBox}
            <button type="button" className="btn self-start" disabled={!sel} onClick={() => sel && void setFinal(sel.start, sel.end)}>
              {ev.final_start ? 'Update and email everyone' : 'Confirm and email everyone'}
            </button>
            {api.mode === 'demo' && <p className="m-0 text-sm text-muted">Demo mode: nothing is emailed. Run the Docker stack for real email.</p>}
            <div className="border-t border-edge-soft pt-3">
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button type="button" className="btn !bg-[#a8341f] !border-[#7e2515] !shadow-[0_3px_0_#7e2515]" onClick={() => void api.deleteEvent(id, token).then(() => { remove(adminKey(id)); location.hash = '#/'; })}>
                    Yes, delete for everyone
                  </button>
                  <button type="button" className="cursor-pointer border-0 bg-transparent text-base font-bold underline" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-base font-bold text-[#a8341f] underline" onClick={() => setConfirmDelete(true)}>
                  Delete this event
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="card mx-4 max-w-xl sm:mx-8 lg:ml-auto px-6 py-8 text-center text-xl">{children}</div>
  );
}
