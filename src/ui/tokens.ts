/**
 * Design tokens — the only source of colors/sizes for components and screens
 * (DESIGN.md sec 1). No literal colors or type sizes elsewhere in /src/ui or
 * /src/assessment.
 */

export const color = {
  bg0: '#0B0E14',
  surface1: '#131824',
  surface2: '#1B2230',
  line: '#263042',
  lineStrong: '#34405A',
  textPrimary: '#E9EDF5',
  textSecondary: '#97A1B4',
  textMuted: '#5B6478',
  ink: '#0B0E14',
  accent: '#E3A84E',
  accentPressed: '#C08A35',
  accentTint: 'rgba(227,168,78,0.16)',
  success: '#4CC685',
  successTint: 'rgba(76,198,133,0.14)',
  error: '#E06456',
  errorTint: 'rgba(224,100,86,0.14)',
  // Corsi C3 key faces (DESIGN.md sec 2.7)
  corsiKeyTop: '#202839',
  corsiKeyBottom: '#171D2A',
} as const;

export type ColorToken = keyof typeof color;

export const typeScale = {
  stimulus: { fontSize: 72, lineHeight: 76, fontWeight: '600', tabular: true },
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heading: { fontSize: 19, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  secondary: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.2, tabular: true },
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.9,
    uppercase: true,
  },
  // 22/600 tabular for keypad keys and slot digits (DESIGN.md sec 2.6)
  digitKey: { fontSize: 22, lineHeight: 28, fontWeight: '600', tabular: true },
} as const;

export type TypeVariant = keyof typeof typeScale;

export const space = {
  sp1: 4,
  sp2: 8,
  sp3: 12,
  sp4: 16,
  sp5: 24,
  sp6: 32,
  sp7: 48,
  sp8: 64,
} as const;

export const radius = {
  sm: 6, // buttons, inputs, keys, slots, blocks
  md: 10, // cards
  lg: 16, // sheets
  full: 999, // battery progress track ONLY (DESIGN.md prohibition 2)
} as const;

export const hit = {
  minTarget: 44,
  controlHeight: 52,
  controlHeightSm: 40,
} as const;

export const motion = {
  tapFlashMs: 150, // Corsi tap depress, key press flash
  advanceMs: 250, // Likert auto-advance delay (screens own the timer)
} as const;
