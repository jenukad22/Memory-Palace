import { useEffect, useRef, type ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { color, radius } from '@/ui';
import { nowMs } from './clock';

// The project's tsconfig omits the DOM lib on purpose (see db/persist.web.ts).
// Declare exactly the two browser globals this file touches — module-scoped, no
// global fallout, no `any`.
interface KeyEventLike {
  key?: string;
  code?: string;
  repeat?: boolean;
  preventDefault?: () => void;
}
interface DocumentLike {
  addEventListener(type: 'keydown', listener: (event: KeyEventLike) => void): void;
  removeEventListener(type: 'keydown', listener: (event: KeyEventLike) => void): void;
}

const RESPONSE_KEYS = new Set([' ', 'Spacebar', 'Enter']);
const RESPONSE_CODES = new Set(['Space', 'Enter', 'NumpadEnter']);

export interface ResponsePadProps {
  /** Called with the monotonic timestamp of the press. */
  onRespond: (atMs: number) => void;
  children: ReactNode;
}

/**
 * The response surface for the PVT and CPT (SPEC.md §3.4).
 *
 * Two deliberate choices, both about latency:
 * - `onPressIn`, not `onPress` — the timestamp is taken at pointer-down, so the
 *   user's press *duration* is not added to every reaction time.
 * - On web, a `keydown` on space/enter is accepted as well; a key press is the
 *   lower-latency path where a keyboard exists.
 *
 * The clock is read inside the handler, before any state update, so React's
 * work never lands between the press and the timestamp.
 */
export function ResponsePad({ onRespond, children }: ResponsePadProps) {
  const handler = useRef(onRespond);
  useEffect(() => {
    handler.current = onRespond;
  }, [onRespond]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const doc = (globalThis as { document?: DocumentLike }).document;
    if (!doc) return;
    const onKeyDown = (event: KeyEventLike) => {
      if (event.repeat === true) return; // key auto-repeat is not a response
      const hit =
        (event.key !== undefined && RESPONSE_KEYS.has(event.key)) ||
        (event.code !== undefined && RESPONSE_CODES.has(event.code));
      if (!hit) return;
      event.preventDefault?.();
      handler.current(nowMs());
    };
    doc.addEventListener('keydown', onKeyDown);
    return () => doc.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Respond"
      onPressIn={() => handler.current(nowMs())}
      style={{ flex: 1 }}
    >
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: color.line,
          backgroundColor: color.surface1,
        }}
      >
        {children}
      </View>
    </Pressable>
  );
}
