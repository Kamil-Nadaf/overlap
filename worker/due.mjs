// Pure logic: which reminder (if any) should go to a recipient right now.
// offsets are minutes before the meeting, e.g. [1440, 60].

/** Offsets that have already come due (their send time is in the past). */
export function dueOffsets(finalStartMs, offsets, nowMs) {
  return offsets.filter((o) => nowMs >= finalStartMs - o * 60_000 && nowMs < finalStartMs);
}

/**
 * Decide what to send. Only the closest due offset is emailed, so an event finalized
 * 30 minutes ahead does not trigger both a "1 day" and a "1 hour" mail at once.
 * Returns { send: offset|null, markSent: offsets[] }.
 */
export function plan(finalStartMs, offsets, nowMs, alreadySent /* Set<number> */) {
  const due = dueOffsets(finalStartMs, offsets, nowMs);
  if (due.length === 0) return { send: null, markSent: [] };
  const chosen = Math.min(...due);
  if (alreadySent.has(chosen)) return { send: null, markSent: due.filter((o) => !alreadySent.has(o)) };
  return { send: chosen, markSent: due.filter((o) => !alreadySent.has(o)) };
}

export function humanOffset(min) {
  if (min >= 1440 && min % 1440 === 0) return `${min / 1440} day${min === 1440 ? '' : 's'}`;
  if (min >= 60 && min % 60 === 0) return `${min / 60} hour${min === 60 ? '' : 's'}`;
  return `${min} minutes`;
}
