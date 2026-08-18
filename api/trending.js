/**
 * Centralized Global Trending API
 * Serves the exact same Top 10 list to all users worldwide.
 */

import trendingData from '../data/trending.json' assert { type: 'json' };

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Cache for 60 seconds on CDN edge, revalidate in background
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({
      updatedAt: new Date().toISOString(),
      count: trendingData.length,
      featured: trendingData[0],
      trending: trendingData
    });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
