# Send confirmation emails from the organizer's own Gmail

When the organizer clicks **Confirm and email everyone**, Google asks them (once) to let Overlap send mail as them.
The email is then sent from their browser through the Gmail API. Nothing is stored, there is no server and no secret.
Scope is `gmail.send` only: Overlap can send mail, it cannot read the mailbox.

Reminders later still come from the shared worker address (Reply-To = organizer).

## One-time setup (you, about 10 minutes)

1. Open <https://console.cloud.google.com> and create a project named **Overlap**.
2. **APIs & Services > Library**: search **Gmail API** and click **Enable**.
3. **Google Auth Platform** (or "OAuth consent screen"):
   - Audience / User type: **External**. App name **Overlap**, your email as support contact.
   - **Data access > Add or remove scopes**: add `https://www.googleapis.com/auth/gmail.send`.
   - **Audience > Test users**: add the Gmail address of every organizer (up to 100). Publishing status stays **Testing**.
4. **Clients > Create client**: type **Web application**, name **Overlap web**.
   - Authorized JavaScript origins: `https://kamil-nadaf.github.io` (no path, no trailing slash). Add `http://localhost:5173` if you run `npm run dev`.
   - Leave redirect URIs empty. Click Create and copy the **Client ID** (`....apps.googleusercontent.com`).
5. GitHub repo > Settings > Secrets and variables > Actions > new secret **`VITE_GOOGLE_CLIENT_ID`** = the Client ID (it is public by design).
6. Supabase > SQL Editor: paste and run `supabase/migrations/0003_organizer_gmail.sql`.
7. Actions > **Deploy to GitHub Pages** > Run workflow.

## What organizers see

- In "Testing" mode Google shows "Google hasn't verified this app". They click **Advanced > Go to Overlap (unsafe)** once. Only listed test users can sign in.
- To let anyone sign in without the warning you must submit the app for Google verification (gmail.send is a sensitive scope: privacy policy page, domain ownership, demo video; usually days to weeks). Not needed for a small group.
- If the Google popup is closed or the Gmail API is not enabled, the organizer can untick **Send from my Gmail** and Overlap's shared sender sends it instead. Failed addresses are retried by the worker automatically.

## How double sends are avoided

After the meeting is saved, the browser asks the backend for the recipient list (organizer only), marks them "confirmation handled" (`claim_confirmation`), sends the emails, and un-marks any that failed (`release_confirmation`) so the worker sends those.
