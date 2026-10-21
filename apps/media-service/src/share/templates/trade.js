import { h, img } from '../h.js';
import { C, SITE, canvas, brand, avatar, chip, money, cardBack } from './common.js';

const CARD_W = 200;
const CARD_H = 280;
const PANEL_W = 470;
const MAX_SHOWN = 3;
const MAX_NAMES = 2;

function fan(cards) {
  const shown = cards.slice(0, MAX_SHOWN);
  const n = shown.length;
  const step = n <= 1 ? 0 : n === 2 ? 150 : 120;
  const total = CARD_W + step * Math.max(0, n - 1);
  const left0 = (PANEL_W - total) / 2;
  const mid = (n - 1) / 2;
  const order = shown.map((_, i) => i).sort((a, b) => Math.abs(b - mid) - Math.abs(a - mid));

  const nodes = order.map((i) => {
    const c = shown[i];
    const off = i - mid;
    return h(
      'div',
      {
        position: 'absolute',
        left: left0 + step * i,
        top: 16 + Math.abs(off) * 10,
        width: CARD_W,
        height: CARD_H,
        borderRadius: 12,
        transform: `rotate(${off * 6}deg)`,
        boxShadow: '0 14px 28px rgba(0,0,0,0.55)',
      },
      c.img ? img(c.img, { width: CARD_W, height: CARD_H, borderRadius: 12, objectFit: 'contain' }) : cardBack(CARD_W, CARD_H, 12),
      c.quantity > 1
        ? h(
            'div',
            {
              position: 'absolute',
              top: 8,
              right: 8,
              padding: '3px 10px',
              borderRadius: 999,
              fontSize: 16,
              fontWeight: 900,
              backgroundColor: 'rgba(7,11,22,0.85)',
            },
            `×${c.quantity}`,
          )
        : null,
    );
  });

  return h('div', { position: 'relative', flexShrink: 0, width: PANEL_W, height: CARD_H + 30 }, ...nodes);
}

function names(cards) {
  const shown = cards.slice(0, MAX_NAMES);
  const extra = cards.length - shown.length;
  return h(
    'div',
    { flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: PANEL_W },
    ...shown.map((c) =>
      h(
        'div',
        {
          marginTop: 4,
          width: PANEL_W - 40,
          textAlign: 'center',
          fontSize: 20,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
        `${c.quantity > 1 ? `${c.quantity}× ` : ''}${c.name}${c.setLabel ? `  ·  ${c.setLabel}` : ''}`,
      ),
    ),
    extra > 0 ? h('div', { marginTop: 4, fontSize: 18, fontWeight: 700, color: C.muted }, `+ ${extra} more`) : null,
  );
}

function side(label, cards, accent) {
  return h(
    'div',
    { flexDirection: 'column', alignItems: 'center', width: PANEL_W },
    h(
      'div',
      { fontSize: 18, fontWeight: 800, letterSpacing: 4, color: accent, marginBottom: 6 },
      label,
    ),
    cards.length
      ? fan(cards)
      : h(
          'div',
          { width: PANEL_W, height: CARD_H + 30, flexShrink: 0, alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: C.faint },
          'Open to offers',
        ),
    names(cards),
  );
}

/**
 * data: {
 *   username, avatar (data uri|null),
 *   offering: [{ name, setLabel, quantity, img }], wanting: [...],
 *   topUpAmount, currency
 * }
 */
export function tradeTemplate(data) {
  const topUp = Number(data.topUpAmount) > 0 ? money(data.topUpAmount, data.currency) : null;

  return canvas(
    // HEADER
    h(
      'div',
      {
        position: 'absolute',
        left: 56,
        top: 40,
        width: 1088,
        height: 56,
        alignItems: 'center',
        justifyContent: 'space-between',
      },
      h(
        'div',
        { alignItems: 'center' },
        avatar(data.avatar, 52, data.username),
        h(
          'div',
          { marginLeft: 16, flexDirection: 'column' },
          h('div', { fontSize: 15, fontWeight: 800, letterSpacing: 4, color: C.blueLight }, 'TRADE OFFER'),
          h(
            'div',
            { marginTop: 2, width: 520, fontSize: 28, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
            `@${data.username}`,
          ),
        ),
      ),
      brand(),
    ),
    // PANELS
    h(
      'div',
      { position: 'absolute', left: 56, top: 116, width: 1088, height: 450, justifyContent: 'space-between' },
      side('OFFERING', data.offering || [], C.green),
      side('LOOKING FOR', data.wanting || [], C.gold),
    ),
    // CENTRE BADGE
    h(
      'div',
      {
        position: 'absolute',
        left: 600 - 38,
        top: 250,
        width: 76,
        height: 76,
        borderRadius: 38,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueLight} 100%)`,
        border: '3px solid rgba(255,255,255,0.25)',
      },
      h('div', { fontSize: 22, fontWeight: 900, letterSpacing: 1 }, 'FOR'),
    ),
    topUp
      ? h(
          'div',
          { position: 'absolute', left: 600 - 110, top: 340, width: 220, justifyContent: 'center' },
          chip(`+ ${topUp} top-up`, { color: C.gold, bg: 'rgba(255,200,87,0.12)', border: 'rgba(255,200,87,0.4)', size: 18 }),
        )
      : null,
    // FOOTER
    h(
      'div',
      { position: 'absolute', left: 56, top: 572, width: 1088, justifyContent: 'flex-end', fontSize: 18, fontWeight: 700, color: C.faint },
      SITE,
    ),
  );
}
