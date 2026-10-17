// P53 — Joel/reviewer feedback: "tap inputs feel flat and silent." No haptic
// feedback existed anywhere in the game. This mirrors engine/audio.ts's sfx
// pattern — a small set of named, semantic buzzes rather than raw vibrate()
// calls scattered through every component, so the vocabulary stays
// consistent (a "hit" always feels the same everywhere it happens).
//
// navigator.vibrate is unsupported on iOS Safari entirely (no API at all)
// and requires a user gesture on Android — every call here is wrapped so a
// missing/blocked API is silently a no-op, never a thrown error.
function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // best-effort only — never let a haptics failure break the tap it was decorating
  }
}

export const haptics = {
  /** Light UI tap — a button press, an XP allocation tap. */
  tap() { buzz(12) },
  /** A hit that mattered — a mini-game target struck, a level crossed. */
  hit() { buzz(30) },
  /** A clean, decisive success — timing bar resolved well, a save made. */
  success() { buzz([20, 40, 20]) },
  /** Something went wrong — a miss, a missed chance, conceding. */
  fail() { buzz(60) },
  /** The big one — your own goal. */
  goal() { buzz([30, 50, 30, 50, 80]) },
}
