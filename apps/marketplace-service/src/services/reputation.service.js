import { Op } from 'sequelize';
import { CardListing, UserReputation } from '../models/index.js';

/**
 * Recount all approved reviews for a seller and write fresh totals.
 * "Approved" = reviewStatus IS NULL or 'approved'.
 */
export async function recalcReputation(sellerId) {
  const reviews = await CardListing.findAll({
    where: {
      sellerId,
      rating: { [Op.ne]: null },
      [Op.or]: [{ reviewStatus: null }, { reviewStatus: 'approved' }],
    },
    attributes: ['rating'],
  });

  let positive = 0, neutral = 0, negative = 0;
  for (const r of reviews) {
    if (r.rating >= 4) positive++;
    else if (r.rating === 3) neutral++;
    else negative++;
  }

  const [rep] = await UserReputation.findOrCreate({
    where:    { userId: sellerId },
    defaults: { userId: sellerId },
  });
  await rep.update({ positive, neutral, negative, score: positive - negative });
  return rep;
}
