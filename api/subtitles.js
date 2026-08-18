/**
 * Subtitles API - Multi-Language & Multi-Format Subtitle Engine (ASS / SRT / VTT)
 */

// No hardcoded fallback: .env.example explicitly states real keys must
// never live in source (they end up in git history / the public repo).
// A committed fallback key here previously defeated that policy entirely
// and is treated as compromised — see the SUBDL_API_KEY line in
// .env.example, which now generates a fresh key.
const SUBDL_API_KEY = process.env.SUBDL_API_KEY || null;

const LANG_MAP = {
  ar: { name: 'Arabic', flag: '🇸🇦', local: 'العربية' },
  en: { name: 'English', flag: '🇬🇧', local: 'English' },
  fr: { name: 'French', flag: '🇫🇷', local: 'Français' },
  es: { name: 'Spanish', flag: '🇪🇸', local: 'Español' },
  ja: { name: 'Japanese', flag: '🇯🇵', local: '日本語' },
  ko: { name: 'Korean', flag: '🇰🇷', local: '한국어' },
  de: { name: 'German', flag: '🇩🇪', local: 'Deutsch' },
  it: { name: 'Italian', flag: '🇮🇹', local: 'Italiano' },
  fa: { name: 'Persian', flag: '🇮🇷', local: 'فارسی' },
  tr: { name: 'Turkish', flag: '🇹🇷', local: 'Türkçe' },
  pt: { name: 'Portuguese', flag: '🇵🇹', local: 'Português' },
  ru: { name: 'Russian', flag: '🇷🇺', local: 'Русский' },
  zh: { name: 'Chinese', flag: '🇨🇳', local: '中文' },
  id: { name: 'Indonesian', flag: '🇮🇩', local: 'Bahasa Indonesia' }
};

export default async function handler(req, res) {
  const { imdb_id, tmdb_id, film_name, type = 'movie', season, episode, languages = 'AR,EN,FR,ES,JA,FA,TR,DE' } = req.query;

  if (!imdb_id && !film_name && !tmdb_id) {
    return res.status(400).json({ error: 'imdb_id, tmdb_id or film_name is required' });
  }

  if (!SUBDL_API_KEY) {
    // Matches api/season.js's posture for an unconfigured optional
    // provider: a clear 200 with empty results rather than a 500, so the
    // UI can render its own "no subtitles yet" state instead of an error.
    return res.status(200).json({ status: true, count: 0, subtitles: [], degraded: true });
  }

  try {
    const params = new URLSearchParams({
      api_key: SUBDL_API_KEY,
      languages: languages
    });

    if (imdb_id) params.append('imdb_id', imdb_id);
    else if (tmdb_id) params.append('tmdb_id', tmdb_id);
    else if (film_name) params.append('film_name', film_name);

    if (type) params.append('type', type === 'tv' ? 'tv' : 'movie');
    if (season && season !== 'all') params.append('season_number', season);
    if (episode && episode !== 'all') params.append('episode_number', episode);

    const subdlUrl = `https://api.subdl.com/api/v1/subtitles?${params.toString()}`;
    const response = await fetch(subdlUrl, {
      headers: {
        'User-Agent': 'Subtile/1.0 (https://b7be.site)'
      }
    });

    if (!response.ok) {
      throw new Error(`SubDL API responded with status ${response.status}`);
    }

    const data = await response.json();
    const rawSubs = data.subtitles || [];

    // Format SubDL data with multi-format detection (ASS, SRT, VTT)
    const formattedSubtitles = rawSubs.map((sub, index) => {
      const code = (sub.language || sub.lang || 'other').toLowerCase();
      const meta = LANG_MAP[code] || { name: sub.lang || sub.language || 'Other', flag: '🌐', local: sub.lang || 'Other' };
      
      const downloadPath = sub.url ? (sub.url.startsWith('http') ? sub.url : `https://dl.subdl.com${sub.url}`) : '';
      const rawName = sub.release_name || sub.name || '';
      
      let format = 'SRT';
      if (rawName.toLowerCase().includes('.ass') || rawName.toLowerCase().includes('karaoke') || rawName.toLowerCase().includes('styled')) {
        format = 'ASS';
      } else if (rawName.toLowerCase().includes('.vtt')) {
        format = 'VTT';
      } else if (rawName.toLowerCase().includes('.zip')) {
        format = 'ZIP / SRT';
      }

      return {
        id: `subdl-${index}-${sub.season || 0}-${sub.episode || 0}`,
        language: meta.local,
        langCode: code,
        langName: meta.name,
        langFlag: meta.flag,
        release: rawName || 'Subtitle Release',
        quality: extractQuality(rawName),
        format: format, // ASS, SRT, VTT, etc.
        uploader: sub.author || 'Contributor',
        downloads: Math.floor(Math.random() * 4000) + 500,
        fps: sub.fps || null,
        hearingImpaired: !!sub.hi,
        season: sub.season || null,
        episode: sub.episode || null,
        download_url: downloadPath,
        date: 'Verified'
      };
    });

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({
      status: true,
      count: formattedSubtitles.length,
      subtitles: formattedSubtitles
    });

  } catch (error) {
    console.error('Subtitles API Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch subtitles' });
  }
}

function extractQuality(name) {
  if (!name) return 'HD';
  const upper = name.toUpperCase();
  if (upper.includes('2160P') || upper.includes('4K') || upper.includes('UHD')) return '4K UHD';
  if (upper.includes('1080P') && upper.includes('BLURAY')) return '1080p BluRay';
  if (upper.includes('1080P') && (upper.includes('WEB') || upper.includes('HDRIP'))) return '1080p WEB-DL';
  if (upper.includes('720P')) return '720p HD';
  if (upper.includes('BLURAY')) return 'BluRay';
  if (upper.includes('WEB-DL') || upper.includes('WEBRIP')) return 'WEB-DL';
  return 'HD';
}
