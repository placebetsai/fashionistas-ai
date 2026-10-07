/**
 * Infer listing placement_mode for free Instant previews.
 * Values: clothing | wall | floor | none
 * Client-side only — no schema migration required; callers may also store
 * an explicit placement_mode on the listing when present.
 */
export const PLACEMENT_MODES = Object.freeze(["clothing", "wall", "floor", "none"]);

const WALL_RE = /\b(paintings?|posters?|prints?|canvas(?:es)?|wall\s*arts?|framed\s+arts?|artworks?|tapestr(?:y|ies)|wall\s*hang(?:ing)?s?|mirrors?|wall\s*decors?|photo\s*frames?|gallery\s*walls?)\b/i;
const FLOOR_RE = /\b(furniture|sofas?|couches?|chairs?|tables?|desks?|lamps?|rugs?|carpets?|ottomans?|bookshelves?|bookcases?|dressers?|nightstands?|bed\s*frames?|cabinets?|stools?|benches?|wardrobes?|armoires?|coffee\s*tables?|side\s*tables?|floor\s*lamps?|plant\s*stands?)\b/i;
const CLOTHING_RE = /\b(clothing|apparel|garments?|tops?|shirts?|t-?shirts?|tees?|blouses?|bottoms?|pants?|trousers?|jeans?|shorts?|skirts?|dresses?|gowns?|outerwear|jackets?|coats?|parkas?|blazers?|hoodies?|sweaters?|cardigans?|shoes?|sneakers?|boots?|heels?|sandals?|activewear|swimwear|lingerie|suits?|bags?|handbags?|purses?|accessories|jewellery|jewelry)\b/i;
const CLOTHING_DEPT_RE = /\b(women'?s\s+clothing|men'?s\s+clothing|kids?\s*&?\s*baby|vintage\s*&\s*designer|sports\s*&\s*outdoor)\b/i;

/**
 * @param {{ category?: string, title?: string, description?: string, placement_mode?: string }|string|null|undefined} input
 * @returns {"clothing"|"wall"|"floor"|"none"}
 */
export function inferPlacementMode(input) {
  if (input && typeof input === "object" && typeof input.placement_mode === "string") {
    const explicit = input.placement_mode.trim().toLowerCase();
    if (PLACEMENT_MODES.includes(explicit)) return explicit;
  }
  const text = typeof input === "string"
    ? input
    : [input && input.category, input && input.title, input && input.description]
        .filter(Boolean)
        .join(" ");
  const src = String(text || "");
  if (!src.trim()) return "none";
  if (WALL_RE.test(src)) return "wall";
  if (FLOOR_RE.test(src)) return "floor";
  if (CLOTHING_DEPT_RE.test(src) || CLOTHING_RE.test(src)) return "clothing";
  return "none";
}

/**
 * Honest CTA labels for shop / closet detail. Never claim photoreal.
 * @param {"clothing"|"wall"|"floor"|"none"} mode
 */
export function placementCtas(mode) {
  const m = PLACEMENT_MODES.includes(mode) ? mode : "none";
  if (m === "clothing") {
    return [
      { href: "/try-on/", label: "Try on", tip: "Instant clothing preview — free. Not photoreal." },
    ];
  }
  if (m === "wall") {
    return [
      { href: "/see-in-space/?mode=wall", label: "See on my wall", tip: "Instant wall preview — free. Photo overlay, not photoreal." },
      { href: "/see-in-space/?mode=wall", label: "See in my space", tip: "Place this listing in a room photo — free forever." },
    ];
  }
  if (m === "floor") {
    return [
      { href: "/see-in-space/?mode=floor", label: "See in my room", tip: "Instant room preview — free. Photo overlay, not photoreal." },
      { href: "/see-in-space/?mode=floor", label: "See in my space", tip: "Place this listing in a room photo — free forever." },
    ];
  }
  // none / unknown — offer space placer + clothing try-on so shoppers are never stuck
  return [
    { href: "/see-in-space/", label: "See in my space", tip: "Place any sellable item in a room photo — free Instant preview." },
    { href: "/try-on/", label: "Try on", tip: "If this is clothing — Instant preview free." },
  ];
}

/**
 * Build a see-in-space / try-on URL with listing context.
 */
export function placementHref(base, { photoUrl, title, mode, widthCm, heightCm } = {}) {
  const u = new URL(base, "https://fashionistas.ai");
  if (mode && mode !== "none" && mode !== "clothing") u.searchParams.set("mode", mode);
  if (photoUrl) u.searchParams.set("item", photoUrl);
  if (title) u.searchParams.set("title", title);
  if (widthCm) u.searchParams.set("w", String(widthCm));
  if (heightCm) u.searchParams.set("h", String(heightCm));
  return u.pathname + u.search;
}
