/**
 * VVIQ item content — OUR wording (SPEC.md sec 0/3). The 16-item, 4-scene-group
 * structure follows the published paradigm; every string here is original.
 * Single eyes-open pass, self-paced, rating 1-5, higher = more vivid.
 */

export interface VviqItem {
  /** The scene the group asks the user to picture. */
  scene: string;
  /** The aspect this item asks them to rate. */
  prompt: string;
}

export const VVIQ_ITEMS: readonly VviqItem[] = [
  // Group 1 — someone you see often
  {
    scene: 'Think of someone you see often.',
    prompt: 'The exact contours of their face — jaw, hairline, the set of their eyes.',
  },
  {
    scene: 'Think of someone you see often.',
    prompt: 'How they hold themselves standing — posture, where their weight rests.',
  },
  {
    scene: 'Think of someone you see often.',
    prompt: 'Their walk — stride, rhythm, what their arms do.',
  },
  {
    scene: 'Think of someone you see often.',
    prompt: 'The clothes they wear most — colors, fit, how the fabric falls.',
  },
  // Group 2 — the sun climbing past a low horizon
  {
    scene: 'Picture the sun rising over a low horizon.',
    prompt: 'The sun just clearing the horizon into a hazy sky.',
  },
  {
    scene: 'Picture the sun rising over a low horizon.',
    prompt: 'The sky deepening to blue as the haze burns off.',
  },
  {
    scene: 'Picture the sun rising over a low horizon.',
    prompt: 'Clouds rolling in — a storm building, lightning cutting through.',
  },
  {
    scene: 'Picture the sun rising over a low horizon.',
    prompt: 'A rainbow standing against the clearing sky.',
  },
  // Group 3 — a shop you know well
  {
    scene: 'Bring to mind a shop you visit often.',
    prompt: 'The shopfront from across the street — window, sign, doorway.',
  },
  {
    scene: 'Bring to mind a shop you visit often.',
    prompt: 'The window display — what sits in it and how it is arranged.',
  },
  {
    scene: 'Bring to mind a shop you visit often.',
    prompt: 'Stepping inside — the colors, shapes, and the aisle you would walk first.',
  },
  {
    scene: 'Bring to mind a shop you visit often.',
    prompt: 'Reaching the counter, paying, a hand giving you change.',
  },
  // Group 4 — a quiet stretch of country
  {
    scene: 'Imagine a quiet stretch of countryside.',
    prompt: 'The whole scene at once — land meeting sky.',
  },
  {
    scene: 'Imagine a quiet stretch of countryside.',
    prompt: 'Individual trees — their color, height, the way they lean.',
  },
  {
    scene: 'Imagine a quiet stretch of countryside.',
    prompt: 'The far hills and what the light does to them.',
  },
  {
    scene: 'Imagine a quiet stretch of countryside.',
    prompt: 'Wind moving through it all — grass bending, branches swaying.',
  },
];

/** Rating anchors — our wording; higher = more vivid. */
export const VVIQ_ANCHORS: readonly { value: number; label: string }[] = [
  { value: 1, label: 'Nothing visual — just the thought itself' },
  { value: 2, label: 'A faint, fleeting impression' },
  { value: 3, label: 'Partly there — some details come through' },
  { value: 4, label: 'Mostly clear, easy to hold' },
  { value: 5, label: 'As clear as actually seeing it' },
];
