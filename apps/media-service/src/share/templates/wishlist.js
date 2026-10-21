import { h, img } from '../h.js';
import { C, SITE, canvas, brand, avatar, chip, fitSize, money, cardBack } from './common.js';

const CARD_W = 300;
const CARD_H = 420;
const FAN_W = 680;
const MAX_FAN = 5;

function fan(cards, extra) {
  const n = cards.length;
  const step = n <= 1 ? 0 : Math.min(n <= 3 ? 190 : 120, (FAN_W - CARD_W) / (n - 1));
  const total = CARD_W + step * (n - 1);
  const left0 = (FAN_W - total) / 2;
  const mid = (n - 1) / 2;

  // Paint edges first so the centre card ends up on top.
  const order = cards.map((_, i) => i).sort((a, b) => Math.abs(b - mid) - Math.abs(a - mid));

  const nodes = order.map((i) => {
    const c = cards[i];
    const off = i - mid;
    return h(
      'div',
      {
        position: 'absolute',
        left: left0 + step * i,
        top: 34 + Math.abs(off) * 16,
        width: CARD_W,
        height: CARD_H,
        borderRadius: 16,
        transform: `rotate(${off * 5.5}deg)`,
        boxShadow: '0 18px 36px rgba(0,0,0,0.55)',
      },
      c.img
        ? img(c.img, { width: CARD_W, height: CARD_H, borderRadius: 16, objectFit: 'contain' })
        : cardBack(CARD_W, CARD_H, 16),
      c.grail
        ? h(
            'div',
            {
              position: 'absolute',
              top: 12,
              left: 12,
              padding: '5px 12px',
              borderRadius: 999,
              fontSize: 15,
              fontWeight: 900,
              letterSpacing: 1,
              color: '#1B1300',
              backgroundColor: C.gold,
            },
            'GRAIL',
          )
        : null,
    );
  });

  return h(
    'div',
    { position: 'absolute', left: 500, top: 70, width: FAN_W, height: 500 },
    ...nodes,
    extra > 0
      ? h(
          'div',
          { position: 'absolute', right: 6, bottom: 0 },
          chip(`+${extra} more`, { color: C.ink, bg: 'rgba(7,11,22,0.7)', size: 20 }),
        )
      : null,
  );
}

function wantRow(card) {
  const meta = [card.setLabel, card.number ? `#${card.number}` : null, money(card.price, card.currency)]
    .filter(Boolean)
    .join('  ·  ');
  return h(
    'div',
    {
      width: 400,
      marginTop: 14,
      paddingLeft: 16,
      flexDirection: 'column',
      borderLeft: `3px solid ${card.grail ? C.gold : C.blue}`,
    },
    h(
      'div',
      { fontSize: 24, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      card.name || 'Unknown card',
    ),
    meta
      ? h(
          'div',
          { marginTop: 3, fontSize: 17, fontWeight: 400, color: C.muted, whiteSpace: 'nowrap' },
          meta,
        )
      : null,
  );
}

/**
 * data: {
 *   username, avatar (data uri|null), label, total, estValue, currency, setLabel,
 *   cards: [{ name, setLabel, number, price, currency, grail, img }]
 * }
 */
export function wishlistTemplate(data) {
  const cards = data.cards || [];
  const fanCards = cards.slice(0, MAX_FAN);
  const wants = cards.slice(0, 3);
  const total = Number.isFinite(data.total) ? data.total : cards.length;
  const est = money(data.estValue, data.currency);
  const nameSize = fitSize(data.username, [[10, 68], [14, 56], [20, 44], [99, 36]]);

  const stats = [`${total} ${total === 1 ? 'card' : 'cards'}`, est ? `Est. ${est}` : null, data.setLabel || null]
    .filter(Boolean)
    .join('  ·  ');

  return canvas(
    // LEFT COLUMN
    h(
      'div',
      {
        position: 'absolute',
        left: 56,
        top: 48,
        width: 430,
        height: 534,
        flexDirection: 'column',
        justifyContent: 'space-between',
      },
      brand(),
      h(
        'div',
        { flexDirection: 'column' },
        h(
          'div',
          { alignItems: 'center' },
          avatar(data.avatar, 56, data.username),
          h(
            'div',
            { marginLeft: 16, fontSize: 18, fontWeight: 800, letterSpacing: 4, color: C.blueLight },
            (data.label || 'WISHLIST').toUpperCase(),
          ),
        ),
        h(
          'div',
          {
            marginTop: 16,
            fontSize: nameSize,
            fontWeight: 900,
            letterSpacing: -1.5,
            lineHeight: 1.05,
            width: 430,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
          data.username,
        ),
        h('div', { marginTop: 10, fontSize: 21, fontWeight: 700, color: C.muted }, stats),
        h('div', { marginTop: 16, flexDirection: 'column' }, ...wants.map(wantRow)),
      ),
      h(
        'div',
        { width: 430, fontSize: 18, fontWeight: 700, color: C.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
        `${SITE}/profile/${data.username}`,
      ),
    ),
    // RIGHT: CARD FAN
    fan(fanCards, Math.max(0, total - fanCards.length)),
  );
}
