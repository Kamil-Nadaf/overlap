import { api } from './api';
import { adminKey, identityKey, load, RECENT_KEY, remove, save } from './storage';

/** Delete an event for everyone (organizer only), then forget it in this browser. Throws on failure. */
export async function deleteMyEvent(id: string, token: string): Promise<void> {
  await api.deleteEvent(id, token);
  remove(adminKey(id));
  remove(identityKey(id));
  save(RECENT_KEY, load<{ id: string; title: string }[]>(RECENT_KEY, []).filter((x) => x.id !== id));
}
