/**
 * Send mail from the organizer's own Gmail, straight from their browser.
 * Uses Google Identity Services (token model): no server, no client secret, nothing stored.
 * Scope is gmail.send only: Overlap can send mail but cannot read the mailbox.
 */
import { buildIcs, type CalEvent } from './ics';

const CLIENT_ID = ((import.meta.env as Record<string, string | undefined>).VITE_GOOGLE_CLIENT_ID ?? '').trim();
const SCOPE = 'https://www.googleapis.com/auth/gmail.send';

export const gmailEnabled = CLIENT_ID !== '';

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}
interface TokenClient {
  requestAccessToken(o?: { prompt?: string }): void;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(c: {
            client_id: string;
            scope: string;
            callback: (r: TokenResponse) => void;
            error_callback?: (e: { type: string }) => void;
          }): TokenClient;
        };
      };
    };
  }
}

let gsi: Promise<void> | null = null;
function loadGsi(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gsi ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gsi = null;
      reject(new Error('google_unreachable'));
    };
    document.head.appendChild(s);
  });
  return gsi;
}

/** Warm up the Google script so the sign-in popup opens instantly on click (popups need a fresh click). */
export function preloadGoogle(): void {
  if (gmailEnabled) void loadGsi().catch(() => undefined);
}

/** Must be called straight from a click handler (before any other await) or browsers block the popup. */
export async function getGmailToken(): Promise<string> {
  await loadGsi();
  return new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (r) => (r.access_token ? resolve(r.access_token) : reject(new Error(r.error ?? 'google_denied'))),
      error_callback: (e) => reject(new Error(e.type || 'google_denied')),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

// ---- MIME ---------------------------------------------------------------------------------
const bytesToB64 = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const utf8B64 = (s: string) => bytesToB64(new TextEncoder().encode(s));
const wrap76 = (b64: string) => b64.replace(/(.{76})/g, '$1\r\n');
const b64url = (s: string) => utf8B64(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const subjectHeader = (s: string) => `=?UTF-8?B?${utf8B64(s)}?=`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const rand = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');

export interface Confirmation {
  title: string;
  organizerName?: string;
  whenText: string; // already formatted in the event zone, e.g. "Fri 6 Nov 2026, 09:30 (Asia/Shanghai)"
  utcText: string;
  meetingUrl?: string | null;
  eventLink: string;
  cal: CalEvent;
}

function buildMime(to: string, c: Confirmation): string {
  const by = c.organizerName ? ` by ${c.organizerName}` : '';
  const text = [
    `${c.title} is scheduled${by}.`,
    '',
    `When: ${c.whenText}`,
    `      ${c.utcText} (UTC)`,
    c.meetingUrl ? `Join: ${c.meetingUrl}` : '',
    `Event page (shows the time in your own zone): ${c.eventLink}`,
    '',
    'A calendar file is attached. You will get a reminder before it starts.',
  ]
    .filter((l, i, a) => l !== '' || a[i - 1] !== '')
    .join('\r\n');
  const html = `<div style="font-family:Georgia,serif;max-width:520px;color:#2b2118">
<h2 style="margin:0 0 8px">${esc(c.title)}</h2>
<p style="margin:0 0 12px">The meeting is scheduled${esc(by)}.</p>
<p style="margin:0 0 12px"><b>${esc(c.whenText)}</b><br><small>${esc(c.utcText)} UTC</small></p>
${c.meetingUrl ? `<p><a href="${esc(c.meetingUrl)}" style="display:inline-block;padding:10px 18px;background:#35617a;color:#fbf3df;text-decoration:none;border-radius:8px">Join the meeting</a></p>` : ''}
<p><a href="${esc(c.eventLink)}">Open the event</a> to see the time in your own zone.</p>
<p style="color:#6b5a44;font-size:12px">Calendar file attached. A reminder follows before it starts.</p></div>`;
  const mixed = `ovm${rand()}`;
  const alt = `ova${rand()}`;
  const part = (type: string, body: string, extra = '') =>
    `Content-Type: ${type}\r\nContent-Transfer-Encoding: base64\r\n${extra}\r\n${wrap76(utf8B64(body))}\r\n`;
  return [
    `To: ${to}`,
    `Subject: ${subjectHeader(`Meeting set: ${c.title}`)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    '',
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    '',
    `--${alt}`,
    part('text/plain; charset=UTF-8', text),
    `--${alt}`,
    part('text/html; charset=UTF-8', html),
    `--${alt}--`,
    `--${mixed}`,
    part('text/calendar; charset=UTF-8; method=PUBLISH; name="meeting.ics"', buildIcs(c.cal), 'Content-Disposition: attachment; filename="meeting.ics"\r\n'),
    `--${mixed}--`,
    '',
  ].join('\r\n');
}

/** Sends one email per recipient (nobody sees anyone else's address). Returns the addresses that failed. */
export async function sendConfirmations(token: string, recipients: string[], c: Confirmation): Promise<{ failed: string[]; reason?: string }> {
  const failed: string[] = [];
  let reason: string | undefined;
  for (const to of recipients) {
    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: b64url(buildMime(to, c)) }),
      });
      if (!res.ok) {
        failed.push(to);
        if (!reason) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          reason = body?.error?.message ?? `HTTP ${res.status}`;
        }
      }
    } catch {
      failed.push(to);
      reason ??= 'network';
    }
  }
  return { failed, reason };
}
