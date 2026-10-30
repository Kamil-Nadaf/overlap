import type { EventBundle, NewEvent, SaveInput } from '../types';
import { demoApi } from './demoApi';

/**
 * Backend contract = the SQL functions in supabase/migrations (see docs/DATA_MODEL.md).
 * Works against PostgREST (docker stack) and Supabase (…/rest/v1) with plain fetch.
 * With no backend configured the app runs in demo mode on localStorage.
 */
export interface Api {
  mode: 'demo' | 'remote';
  createEvent(e: NewEvent): Promise<{ id: string; admin_token: string }>;
  getEvent(id: string): Promise<EventBundle | null>;
  verifyParticipant(eventId: string, name: string, pin: string): Promise<boolean>;
  saveAvailability(i: SaveInput): Promise<{ participant_id: string }>;
  verifyAdmin(id: string, token: string): Promise<boolean>;
  finalizeEvent(id: string, token: string, start: string | null, end: string | null, meetingUrl?: string): Promise<void>;
  deleteEvent(id: string, token: string): Promise<void>;
  /** demo mode only */
  seedSample?(eventId: string): Promise<void>;
}

const env = import.meta.env as Record<string, string | undefined>;
const supaUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const apiUrl = (env.VITE_API_URL || (supaUrl ? `${supaUrl}/rest/v1` : '')).replace(/\/$/, '');
const apiKey = env.VITE_API_KEY || env.VITE_SUPABASE_ANON_KEY || '';

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers.apikey = apiKey;
    // New Supabase publishable keys (sb_publishable_…) are not JWTs: send them as apikey only.
    if (!apiKey.startsWith('sb_')) headers.Authorization = `Bearer ${apiKey}`;
  }
  let res: Response;
  try {
    res = await fetch(`${apiUrl}/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
  } catch {
    throw new Error('network');
  }
  const text = await res.text();
  if (!res.ok) {
    let msg = 'server';
    try {
      msg = (JSON.parse(text) as { message?: string }).message ?? msg;
    } catch {
      /* keep default */
    }
    throw new Error(msg);
  }
  return (text ? JSON.parse(text) : null) as T;
}

const remoteApi: Api = {
  mode: 'remote',
  createEvent: (e) =>
    rpc('create_event', {
      p_title: e.title,
      p_description: e.description ?? null,
      p_dates: e.dates,
      p_day_start_min: e.day_start_min,
      p_day_end_min: e.day_end_min,
      p_slot_minutes: e.slot_minutes,
      p_timezone: e.timezone,
      p_meeting_url: e.meeting_url ?? null,
      p_organizer_name: e.organizer_name ?? null,
      p_organizer_email: e.organizer_email ?? null,
      p_reminder_offsets: e.reminder_offsets,
    }),
  getEvent: (id) => rpc<EventBundle | null>('get_event', { p_id: id }),
  verifyParticipant: (eventId, name, pin) => rpc<boolean>('verify_participant', { p_event_id: eventId, p_name: name, p_pin: pin }),
  saveAvailability: (i) =>
    rpc('save_availability', {
      p_event_id: i.eventId,
      p_name: i.name,
      p_pin: i.pin,
      p_email: i.email,
      p_wants_reminder: i.wantsReminder,
      p_slots: i.slots,
    }),
  verifyAdmin: (id, token) => rpc<boolean>('verify_admin', { p_id: id, p_token: token }),
  finalizeEvent: async (id, token, start, end, meetingUrl) => {
    await rpc('finalize_event', { p_id: id, p_admin_token: token, p_start: start, p_end: end, p_meeting_url: meetingUrl ?? null });
  },
  deleteEvent: async (id, token) => {
    await rpc('delete_event', { p_id: id, p_admin_token: token });
  },
};

export const api: Api = apiUrl ? remoteApi : demoApi;

export function friendlyError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes('wrong_pin')) return 'That PIN does not match this name.';
  if (m.includes('name_required')) return 'Please enter your name.';
  if (m.includes('event_not_found')) return 'This event was not found. It may have expired.';
  if (m.includes('forbidden')) return 'Only the organizer can do that.';
  if (m.includes('invalid_slots')) return 'Too many time slots selected.';
  if (m.includes('network')) return 'Cannot reach the server. Check your connection and try again.';
  return m && m !== 'server' ? `Something went wrong (${m.slice(0, 140)}). Please try again.` : 'Something went wrong. Please try again.';
}
