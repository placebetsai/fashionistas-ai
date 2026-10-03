// /TEST.md — internal test notes / QA scratchpad. Never public.
import { block } from "./_lib/blocked.js";

export function onRequest(context) {
  return block(context);
}
