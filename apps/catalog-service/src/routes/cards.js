import { Router } from 'express';
import { searchCards, getCard } from '../services/search.service.js';

const router = Router();

// GET /cards?q=pikachu&setCode=sv08&rarity=Rare&withPrices=true&page=1&pageSize=50
router.get('/', async (req, res) => {
  try {
    const { q, setCode, rarity, supertype, withPrices, page, pageSize } = req.query;
    const result = await searchCards({
      q,
      setCode,
      rarity,
      supertype,
      withPrices: withPrices === 'true' || withPrices === '1',
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 50,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /cards/:id
router.get('/:id', async (req, res) => {
  try {
    const card = await getCard(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });
    res.json(card);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
