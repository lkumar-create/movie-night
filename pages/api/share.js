import { kv } from '@vercel/kv';

// Generate short ID
function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export default async function handler(req, res) {
  // POST - Save results
  if (req.method === 'POST') {
    try {
      const { recommendations, searchParams } = req.body;
      
      if (!recommendations || recommendations.length === 0) {
        return res.status(400).json({ error: 'No recommendations to save' });
      }

      const id = generateId();
      
      // Store for 30 days
      await kv.set(`results:${id}`, {
        recommendations,
        searchParams,
        createdAt: Date.now()
      }, { ex: 30 * 24 * 60 * 60 });

      return res.status(200).json({ id });
    } catch (error) {
      console.error('Error saving results:', error);
      return res.status(500).json({ error: 'Failed to save results' });
    }
  }

  // GET - Retrieve results
  if (req.method === 'GET') {
    try {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'No ID provided' });
      }

      const data = await kv.get(`results:${id}`);
      
      if (!data) {
        return res.status(404).json({ error: 'Results not found or expired' });
      }

      return res.status(200).json(data);
    } catch (error) {
      console.error('Error retrieving results:', error);
      return res.status(500).json({ error: 'Failed to retrieve results' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
