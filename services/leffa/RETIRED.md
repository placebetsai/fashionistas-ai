# RETIRED — do not wire this up

The Leffa try-on service lives here for **history only**.

It was retired on **2026-10-04** for three independent, measured reasons:

1. **Legally unsellable.** Leffa code is MIT, but both training sets are
   non-commercial (VITON-HD `CC BY-NC 4.0`, DressCode YNAP). Charging for it
   was blocked.
2. **17.5 min for garbage.** 10 steps = 1049.6 s and the output was visibly
   smeared. Linear fit: 95.4 s/step + 95.8 s overhead.
3. **No fast setting exists.** Leffa defaults to 50 steps -> 81 min.

**Replaced by FASHN VTON v1.5** (Apache-2.0, commercial-clean), called from
`functions/api/tryon/hd.js`.

Do not start this service. Do not point `/api/tryon/hd` at it.
