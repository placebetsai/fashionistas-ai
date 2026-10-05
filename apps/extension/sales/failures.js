// sales/failures.js — the "3 consecutive failures => needs_input" rule.
//
// WHY IT EXISTS: a marketplace that redesigned its closet page (or is showing
// a wall we do not recognise) must never be able to kill the scan of the other
// shops, and must never be silently retried forever either. The seller gets
// ONE line per stuck item — the NEEDS_ISRAEL.txt convention: one line, no
// noise, nothing faked — and the scan moves on.
//
// Pure state machine on a plain JSON object so it survives
// chrome.scripting.executeScript serialization and a browser restart.

/** Consecutive failures on ONE item before it is parked as needs_input. */
export const STRIKE_LIMIT = 3;

/** Keys already parked: they are never counted (or reported) again. */
export function isParked(state, key) {
  return !!state && Array.isArray(state.gaveUp) && state.gaveUp.indexOf(key) !== -1;
}

/**
 * Record one failed read of `key`.
 * @returns {{count:number, reached:boolean, parked:boolean, line:string|null}}
 *   `reached` is true ONLY on the transition into needs_input, so the report
 *   line is emitted exactly once per item.
 */
export function noteFailure(state, key, limit = STRIKE_LIMIT) {
  if (!state || !key) return { count: 0, reached: false, parked: false, line: null };
  if (!state.failures || typeof state.failures !== "object") state.failures = {};
  if (!Array.isArray(state.gaveUp)) state.gaveUp = [];
  if (state.gaveUp.indexOf(key) !== -1) {
    return { count: limit, reached: false, parked: true, line: null };
  }
  const count = (state.failures[key] || 0) + 1;
  state.failures[key] = count;
  if (count < limit) {
    return { count, reached: false, parked: false, line: null };
  }
  delete state.failures[key];
  state.gaveUp.push(key);
  return { count, reached: true, parked: true, line: reportLine(key, count) };
}

/** A read that worked resets the streak — only CONSECUTIVE failures count. */
export function noteSuccess(state, key) {
  if (state && state.failures) delete state.failures[key];
}

/** The one-line report for a parked item (NEEDS_ISRAEL.txt style). */
export function reportLine(key, count) {
  return (
    `NEEDS_INPUT ${key} — sale state unreadable after ${count} attempts; ` +
    `parked until the selector source is fixed.`
  );
}

export default { STRIKE_LIMIT, isParked, noteFailure, noteSuccess, reportLine };
