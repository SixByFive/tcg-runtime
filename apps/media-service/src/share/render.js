import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { getFonts } from './fonts.js';
import { loadImage, loadImages } from './images.js';
import { WIDTH, HEIGHT } from './templates/common.js';
import { wishlistTemplate } from './templates/wishlist.js';
import { listingTemplate } from './templates/listing.js';
import { tradeTemplate } from './templates/trade.js';

// Card art is drawn ~300x420 on a 1200x630 canvas; 2x source keeps it crisp when
// the PNG is shown on high-DPI phones.
const CARD_IMG = { width: 420, height: 588, fit: 'contain' };
const AVATAR_IMG = { width: 160, height: 160, fit: 'cover' };

async function buildWishlist(data) {
  const cards = (data.cards || []).slice(0, 5);
  const [avatar, ...imgs] = await Promise.all([
    loadImage(data.avatarUrl, AVATAR_IMG),
    ...cards.map((c) => loadImage(c.imageUrl, CARD_IMG)),
  ]);
  return wishlistTemplate({
    ...data,
    avatar,
    cards: (data.cards || []).map((c, i) => ({ ...c, img: imgs[i] ?? null })),
  });
}

async function buildListing(data) {
  const wanted = (data.imageUrls || []).slice(0, data.kind === 'SINGLE' ? 1 : 3);
  const [avatar, images] = await Promise.all([
    loadImage(data.seller?.avatarUrl, AVATAR_IMG),
    loadImages(wanted, CARD_IMG),
  ]);
  return listingTemplate({
    ...data,
    images,
    seller: data.seller ? { ...data.seller, avatar } : null,
  });
}

async function buildTrade(data) {
  const offering = (data.offering || []).slice(0, 3);
  const wanting = (data.wanting || []).slice(0, 3);
  const [avatar, ...imgs] = await Promise.all([
    loadImage(data.avatarUrl, AVATAR_IMG),
    ...offering.map((c) => loadImage(c.imageUrl, CARD_IMG)),
    ...wanting.map((c) => loadImage(c.imageUrl, CARD_IMG)),
  ]);
  return tradeTemplate({
    ...data,
    avatar,
    offering: (data.offering || []).map((c, i) => ({ ...c, img: i < offering.length ? imgs[i] ?? null : null })),
    wanting: (data.wanting || []).map((c, i) => ({ ...c, img: i < wanting.length ? imgs[offering.length + i] ?? null : null })),
  });
}

const BUILDERS = {
  trade: buildTrade,
  wishlist: buildWishlist,
  listing: buildListing,
};

export const SHARE_KINDS = Object.keys(BUILDERS);

export async function renderShareImage(kind, data) {
  const build = BUILDERS[kind];
  if (!build) throw Object.assign(new Error(`Unknown share kind: ${kind}`), { status: 400 });

  const tree = await build(data || {});
  const svg = await satori(tree, { width: WIDTH, height: HEIGHT, fonts: getFonts() });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
  return Buffer.from(png);
}
