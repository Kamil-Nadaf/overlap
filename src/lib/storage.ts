// localStorage can throw (private mode, blocked). Never let that break the app.
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export interface Identity {
  name: string;
  pin: string;
  email: string;
  wantsReminder: boolean;
}
export const identityKey = (eventId: string) => `overlap:id:${eventId}`;
export const adminKey = (eventId: string) => `overlap:admin:${eventId}`;
export const RECENT_KEY = 'overlap:recent';
