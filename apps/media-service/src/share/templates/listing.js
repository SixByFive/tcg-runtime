import { h, img } from '../h.js';
import { C, SITE, canvas, brand, avatar, chip, fitSize, money, cardBack } from './common.js';

const CONDITION_LABELS = {
  M: 'Mint',
  NM: 'Near Mint',
  LP: 'Lightly Played',
  MP: 'Moderately Played',
  HP: 'Heavily Played',
  DMG: 'Damaged',
};

function conditionText(d) {
  if (d.kind !== 'SINGLE') {
    if (d.conditionMin && d.conditionMax && d.conditionMin !== d.conditionMax) {
      return `${d.conditionMax} – ${d.conditionMin}`;
    }
    return d.conditionMin || d.conditionMax || null;
  }
  return d.condition ? CONDITION_LABELS[d.condition] || d.condition : null;
}

/* ------------------------------ artwork side ------------------------------ */

function singleArt(image) {
  const w = 330;
  const hgt = 462;
  return h(
    'div',
    { position: 'absolute', left: 96, top: 84, width: w, height: hgt, transform: 'rotate(-4deg)', boxShadow: '0 22px 44px rgba(0,0,0,0.6)', borderRadius: 18 },
    image
      ? img(image, { width: w, height: hgt, borderRadius: 18, objectFit: 'contain' })
      : cardBack(w, hgt, 18),
  );
}

function stackArt(images) {
  const w = 236;
  const hgt = 330;
  const slots = [
    { left: 36, top: 150, rot: -11 },
    { left: 250, top: 150, rot: 11 },
    { left: 143, top: 96, rot: 0 },
  ];
  const nodes = slots.map((slot, i) =>
    h(
      'div',
      {
        position: 'absolute',
        left: slot.left,
        top: slot.top,
        width: w,
        height: hgt,
        borderRadius: 14,
        transform: `rotate(${slot.rot}deg)`,
        boxShadow: '0 24px 50px rgba(0,0,0,0.55)',
      },
      images[i] ? img(images[i], { width: w, height: hgt, borderRadius: 14, objectFit: 'contain' }) : cardBack(w, hgt, 14),
    ),
  );
  return h('div', { position: 'absolute', left: 40, top: 40, width: 520, height: 540 }, ...nodes);
}

/* ------------------------------- info side ------------------------------- */

function badgeRow(d) {
  const isBulk = d.kind !== 'SINGLE';
  const cond = conditionText(d);
  return h(
    'div',
    { alignItems: 'center' },
    isBulk
      ? chip(d.kind === 'BULK_TRACKED' ? 'BULK LOT' : 'MIXED LOT', { color: '#1B1300', bg: C.gold, border: C.gold, size: 16 })
      : null,
    cond
      ? h('div', { marginLeft: isBulk ? 10 : 0 }, chip(cond, { color: C.ink, bg: 'rgba(41,99,255,0.28)', border: 'rgba(108,155,255,0.5)', size: 18 }))
      : null,
    d.variant && !isBulk ? h('div', { marginLeft: 10 }, chip(d.variant, { size: 18 })) : null,
  );
}

function shippingLine(d) {
  if (d.shippingType === 'FIXED') {
    const p = Number(d.shippingPrice);
    return p > 0 ? `+ ${money(p, d.currency)} postage` : 'Free postage';
  }
  if (d.shippingType === 'DYNAMIC') return 'Postage calculated at checkout';
  return null;
}

/**
 * data: {
 *   kind: 'SINGLE'|'BULK_TRACKED'|'BULK_RANDOM',
 *   title, subtitle, price, currency, condition, conditionMin, conditionMax, variant,
 *   cardCount, inclusions: [{description, quantity}],
 *   shippingType, shippingPrice, allowOffers, willTrade,
 *   seller: { username, avatar (data uri|null) }, id,
 *   images: (data uri|null)[]
 * }
 */
export function listingTemplate(data) {
  const isBulk = data.kind !== 'SINGLE';
  const price = money(data.price, data.currency) || 'Make an offer';
  const priceSize = price.length > 9 ? 78 : price.length > 7 ? 92 : 108;
  const titleSize = fitSize(data.title, [[22, 48], [38, 40], [64, 34], [999, 30]]);
  const ship = shippingLine(data);

  const subtitle = isBulk
    ? [data.cardCount ? `${data.cardCount} cards` : null, data.kind === 'BULK_RANDOM' ? 'randomly selected' : 'contents listed']
        .filter(Boolean)
        .join('  ·  ')
    : data.subtitle;

  const inclusions = (data.inclusions || []).slice(0, 2);

  return canvas(
    isBulk ? stackArt(data.images || []) : singleArt((data.images || [])[0]),
    // RIGHT COLUMN
    h(
      'div',
      {
        position: 'absolute',
        left: 600,
        top: 48,
        width: 544,
        height: 534,
        flexDirection: 'column',
        justifyContent: 'space-between',
      },
      h('div', { justifyContent: 'flex-end' }, brand()),
      h(
        'div',
        { flexDirection: 'column' },
        badgeRow(data),
        h(
          'div',
          {
            marginTop: 18,
            width: 544,
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: -0.8,
            lineClamp: 2,
          },
          data.title || 'Card listing',
        ),
        subtitle ? h('div', { marginTop: 10, fontSize: 22, fontWeight: 700, color: C.muted }, subtitle) : null,
        inclusions.length
          ? h(
              'div',
              { marginTop: 12, flexDirection: 'column' },
              ...inclusions.map((inc) =>
                h(
                  'div',
                  { fontSize: 18, fontWeight: 400, color: C.muted, marginTop: 2, whiteSpace: 'nowrap', width: 544, overflow: 'hidden', textOverflow: 'ellipsis' },
                  `+ ${inc.quantity > 1 ? `${inc.quantity}× ` : ''}${inc.description}`,
                ),
              ),
            )
          : null,
        h(
          'div',
          { marginTop: isBulk ? 14 : 22, fontSize: priceSize, fontWeight: 900, letterSpacing: -3, lineHeight: 1 },
          price,
        ),
        ship ? h('div', { marginTop: 10, fontSize: 21, fontWeight: 700, color: C.muted }, ship) : null,
        data.allowOffers || data.willTrade
          ? h(
              'div',
              { marginTop: 18, alignItems: 'center' },
              data.allowOffers
                ? chip('Offers welcome', { color: C.green, bg: 'rgba(61,220,151,0.12)', border: 'rgba(61,220,151,0.4)' })
                : null,
              data.willTrade
                ? h('div', { marginLeft: data.allowOffers ? 10 : 0 }, chip('Open to trades', { color: C.gold, bg: 'rgba(255,200,87,0.12)', border: 'rgba(255,200,87,0.4)' }))
                : null,
            )
          : null,
      ),
      h(
        'div',
        { alignItems: 'center', justifyContent: 'space-between' },
        data.seller?.username
          ? h(
              'div',
              { alignItems: 'center' },
              avatar(data.seller.avatar, 40, data.seller.username),
              h('div', { marginLeft: 12, fontSize: 20, fontWeight: 700, color: C.muted }, `Sold by @${data.seller.username}`),
            )
          : h('div', {}),
        h('div', { fontSize: 18, fontWeight: 700, color: C.faint }, SITE),
      ),
    ),
  );
}
