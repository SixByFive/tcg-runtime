import { Router } from 'express';
import { listSets, getSet } from '../services/search.service.js';
import { resolveSet } from '../services/set.service.js';

const router = Router();

// GET /sets
router.get('/', async (req, res) => {
  try {
    const { era, page, pageSize } = req.query;
    const result = await listSets({
      era,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 100,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /sets/:code
router.get('/:code', async (req, res) => {
  try {
    const set = await getSet(req.params.code);
    if (!set) return res.status(404).json({ error: 'Set not found' });
    res.json(set);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /sets/:code/resolve — resolve any code/abbr/ptcg to canonical set
router.get('/:code/resolve', async (req, res) => {
  try {
    const row = await resolveSet(req.params.code);
    if (!row) return res.status(404).json({ error: 'Set not found' });
    res.json({ code: row.code, abbreviation: row.abbreviation, name: row.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
