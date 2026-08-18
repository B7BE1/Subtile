/**
 * Subtile - Upload Subtitle Serverless API
 * Handles saving uploaded subtitles to Supabase / Postgres Database.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Method Not Allowed' });
  }

  const {
    tmdb_id,
    title,
    arabic_title,
    type = 'movie',
    year,
    poster,
    language = 'ar',
    release_name,
    quality = '1080p BluRay',
    season = null,
    episode = null,
    format = 'SRT',
    file_url,
    uploader_name = 'Anonymous',
    hearing_impaired = false,
    fps = '23.976'
  } = req.body || {};

  if (!release_name || (!tmdb_id && !title)) {
    return res.status(400).json({ error: 'Missing required fields (release_name, tmdb_id/title)' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  // 1. If Supabase is configured, save to Postgres
  if (supabaseUrl && supabaseKey) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation'
      };

      // Upsert media title
      let mediaId = null;
      if (tmdb_id) {
        const mediaCheck = await fetch(`${supabaseUrl}/rest/v1/media_titles?tmdb_id=eq.${tmdb_id}&select=id`, { headers });
        const mediaRows = await mediaCheck.json();
        
        if (Array.isArray(mediaRows) && mediaRows.length > 0) {
          mediaId = mediaRows[0].id;
        } else {
          // Insert media
          const mediaInsert = await fetch(`${supabaseUrl}/rest/v1/media_titles`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              tmdb_id: String(tmdb_id),
              title: title || 'Untitled',
              arabic_title: arabic_title || null,
              type: type,
              year: year ? Number(year) : null,
              poster: poster || null
            })
          });
          const insertedMedia = await mediaInsert.json();
          if (Array.isArray(insertedMedia) && insertedMedia.length > 0) {
            mediaId = insertedMedia[0].id;
          }
        }
      }

      // Insert subtitle record
      const subInsert = await fetch(`${supabaseUrl}/rest/v1/subtitles`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          media_id: mediaId,
          language: language.toLowerCase() === 'en' ? 'en' : 'ar',
          release_name: release_name,
          quality: quality,
          season: season ? Number(season) : null,
          episode: episode && episode !== 'All' ? Number(episode) : null,
          format: format.toUpperCase(),
          file_url: file_url || 'https://subtile.org/files/custom.srt',
          hearing_impaired: Boolean(hearing_impaired),
          fps: fps,
          status: 'approved'
        })
      });

      const result = await subInsert.json();
      return res.status(201).json({
        success: true,
        message: 'Subtitle uploaded and saved to Supabase successfully',
        data: result
      });
    } catch (err) {
      console.error('Supabase Upload Error:', err);
      return res.status(500).json({ error: 'Database insertion failed', details: err.message });
    }
  }

  // 2. Fallback in case Supabase is not yet connected
  return res.status(200).json({
    success: true,
    message: 'Subtitle received successfully (Simulated mode: Connect Supabase in Vercel to persist)',
    data: {
      id: `local-sub-${Date.now()}`,
      release_name,
      language,
      quality,
      uploader: uploader_name,
      date: new Date().toISOString().split('T')[0]
    }
  });
}
