import { h, img } from '../h.js';

export const WIDTH = 1200;
export const HEIGHT = 630;

export const C = {
  bg: '#070B16',
  bg2: '#0E1630',
  ink: '#FFFFFF',
  muted: 'rgba(255,255,255,0.62)',
  faint: 'rgba(255,255,255,0.38)',
  line: 'rgba(255,255,255,0.12)',
  panel: 'rgba(255,255,255,0.07)',
  blue: '#2963FF',
  blueLight: '#6C9BFF',
  gold: '#FFC857',
  green: '#3DDC97',
};

export const SITE = 'tcg.sixbyfive.com';

export function canvas(...children) {
  return h(
    'div',
    {
      width: WIDTH,
      height: HEIGHT,
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'Inter',
      color: C.ink,
      backgroundColor: C.bg,
      backgroundImage: `linear-gradient(135deg, ${C.bg} 0%, ${C.bg2} 55%, ${C.bg} 100%)`,
    },
    // soft colour pools behind the artwork
    h('div', {
      position: 'absolute',
      left: 380,
      top: -160,
      width: 900,
      height: 900,
      backgroundImage: 'radial-gradient(circle, rgba(41,99,255,0.34) 0%, rgba(41,99,255,0) 62%)',
    }),
    h('div', {
      position: 'absolute',
      left: -220,
      top: 360,
      width: 620,
      height: 620,
      backgroundImage: 'radial-gradient(circle, rgba(108,155,255,0.14) 0%, rgba(108,155,255,0) 65%)',
    }),
    ...children,
  );
}

export function brand() {
  return h(
    'div',
    { alignItems: 'center' },
    h(
      'div',
      {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        fontWeight: 900,
        letterSpacing: 0.5,
        backgroundImage: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueLight} 100%)`,
      },
      h('div', {}, 'SBF'),
    ),
    h('div', { marginLeft: 12, fontSize: 20, fontWeight: 700, color: C.muted }, 'SixByFive TCG'),
  );
}

export function avatar(src, size, fallbackText = '') {
  if (src) {
    return img(src, { width: size, height: size, borderRadius: size / 2, objectFit: 'cover' });
  }
  return h(
    'div',
    {
      width: size,
      height: size,
      borderRadius: size / 2,
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: Math.round(size * 0.42),
      fontWeight: 800,
      backgroundImage: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueLight} 100%)`,
    },
    h('div', {}, (fallbackText || '?').slice(0, 1).toUpperCase()),
  );
}

export function chip(text, { color = C.ink, bg = C.panel, border = C.line, size = 18 } = {}) {
  return h(
    'div',
    {
      alignItems: 'center',
      padding: '6px 14px',
      borderRadius: 999,
      fontSize: size,
      fontWeight: 700,
      color,
      backgroundColor: bg,
      border: `1px solid ${border}`,
    },
    text,
  );
}

/** Fit a single-line headline into `maxChars` worth of width by stepping the size down. */
export function fitSize(text, steps) {
  const len = String(text || '').length;
  for (const [maxLen, size] of steps) {
    if (len <= maxLen) return size;
  }
  return steps[steps.length - 1][1];
}

export function money(amount, currency = 'GBP') {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return null;
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

/** Placeholder shown where a card image failed to load. */
export function cardBack(width, height, radius) {
  return h(
    'div',
    {
      width,
      height,
      borderRadius: radius,
      alignItems: 'center',
      justifyContent: 'center',
      border: `2px solid ${C.line}`,
      backgroundImage: `linear-gradient(160deg, ${C.blue} 0%, #14214A 70%)`,
      fontSize: Math.round(width * 0.2),
      fontWeight: 900,
      color: 'rgba(255,255,255,0.55)',
    },
    h('div', {}, 'SBF'),
  );
}
