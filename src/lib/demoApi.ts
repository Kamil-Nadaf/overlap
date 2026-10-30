import type { Api } from './api';
import type { AvailabilityRow, EventBundle, EventInfo, Level } from '../types';
import { generateSlots } from './slots';
import { load, save } from './storage';

// Demo backend: everything stays in this browser (localStorage). Same contract as the SQL functions.
interface P {
  id: string;
  name: string;
  pin: string;
  email: string;
  wants: boolean;
  slots: Record<string, Level>;
}
interface E extends EventInfo {
  admin: string;
  participants: P[];
}
type DB = Record<string, E>;
const KEY = 'overlap:demo:db';

const rid = (n: number) => {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
};
const db = (): DB => load<DB>(KEY, {});
const put = (d: DB) => save(KEY, d);

function bundle(e: E): EventBundle {
  const availability: AvailabilityRow[] = [];
  for (const p of e.participants) for (const [s, l] of Object.entries(p.slots)) availability.push({ p: p.id, s, l });
  const { admin: _a, participants, ...event } = e;
  void _a;
  return { event, participants: participants.map((p) => ({ id: p.id, name: p.name, has_pin: !!p.pin })), availability };
}

export const demoApi: Api = {
  mode: 'demo',
  async createEvent(n) {
    const d = db();
    const id = rid(10);
    const admin = rid(24);
    d[id] = {
      id,
      title: n.title,
      description: n.description ?? null,
      dates: [...new Set(n.dates)].sort(),
      day_start_min: n.day_start_min,
      day_end_min: n.day_end_min,
      slot_minutes: n.slot_minutes,
      timezone: n.timezone,
      meeting_url: n.meeting_url ?? null,
      organizer_name: n.organizer_name ?? null,
      final_start: null,
      final_end: null,
      admin,
      participants: [],
    };
    put(d);
    return { id, admin_token: admin };
  },
  async getEvent(id) {
    const e = db()[id];
    return e ? bundle(e) : null;
  },
  async verifyParticipant(eventId, name, pin) {
    const p = db()[eventId]?.participants.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
    if (!p) return false;
    return !p.pin || p.pin === pin;
  },
  async saveAvailability(i) {
    const d = db();
    const e = d[i.eventId];
    if (!e) throw new Error('event_not_found');
    const name = i.name.trim();
    if (!name) throw new Error('name_required');
    let p = e.participants.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (p && p.pin && p.pin !== i.pin) throw new Error('wrong_pin');
    if (!p) {
      p = { id: crypto.randomUUID(), name, pin: i.pin, email: i.email, wants: i.wantsReminder, slots: {} };
      e.participants.push(p);
    }
    p.email = i.email;
    p.wants = i.wantsReminder;
    if (!p.pin && i.pin) p.pin = i.pin;
    p.slots = {};
    for (const s of i.slots) p.slots[s.s] = s.l;
    put(d);
    return { participant_id: p.id };
  },
  async verifyAdmin(id, token) {
    return db()[id]?.admin === token;
  },
  async finalizeEvent(id, token, start, end, meetingUrl) {
    const d = db();
    const e = d[id];
    if (!e || e.admin !== token) throw new Error('forbidden');
    e.final_start = start;
    e.final_end = end;
    if (meetingUrl) e.meeting_url = meetingUrl;
    put(d);
  },
  async deleteEvent(id, token) {
    const d = db();
    if (d[id]?.admin !== token) throw new Error('forbidden');
    delete d[id];
    put(d);
  },
  async seedSample(eventId) {
    const d = db();
    const e = d[eventId];
    if (!e) return;
    const slots = generateSlots(e);
    const names = ['Aarav', 'Mei', 'Lena', 'Tomás'];
    names.forEach((nm, j) => {
      if (e.participants.some((p) => p.name === nm)) return;
      const mine: Record<string, Level> = {};
      slots.forEach((s, k) => {
        const v = (k * 7 + j * 13 + Math.floor(k / 5) * 3) % 10;
        if (v < 5) mine[s] = 2;
        else if (v < 6) mine[s] = 1;
      });
      e.participants.push({ id: crypto.randomUUID(), name: nm, pin: '', email: '', wants: false, slots: mine });
    });
    put(d);
  },
};
