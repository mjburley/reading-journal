import { kv } from '@vercel/kv';

const BOOKS_KEY = 'reading-journal-books';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const books = await kv.get(BOOKS_KEY);
      return res.status(200).json(books || []);
    }

    if (req.method === 'POST') {
      const books = req.body;
      await kv.set(BOOKS_KEY, books);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
