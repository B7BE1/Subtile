/**
 * VirusTotal Subtitle Scanner
 * Downloads subtitle file, computes SHA-256 hash, checks against VirusTotal API.
 * Requires VIRUSTOTAL_API_KEY env var (free: https://www.virustotal.com/gui/my-apikey)
 */

const crypto = require('crypto');

const VT_API = 'https://www.virustotal.com/api/v3';

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'VirusTotal API key not configured', configured: false });
  }

  try {
    const targetUrl = new URL(url);
    const allowedHosts = [
      'subdl.com', 'dl.subdl.com', 'api.subdl.com',
      'kitsunekko.net', 'animetosho.org', 'storage.animetosho.org',
      'opensubtitles.com', 'api.opensubtitles.com', 'dl.opensubtitles.org',
      'subscene.com', 'subscene.best',
      'raw.githubusercontent.com', 'github.com'
    ];
    const isAllowed = allowedHosts.some(host => targetUrl.hostname === host || targetUrl.hostname.endsWith('.' + host));
    if (!isAllowed) {
      return res.status(403).json({ error: 'Target host not allowed' });
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch file' });
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_SIZE) {
      return res.status(413).json({ error: 'File too large' });
    }

    const hash = crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');

    const vtResponse = await fetch(${VT_API}/files/, {
      headers: { 'x-apikey': apiKey, 'Accept': 'application/json' }
    });

    if (vtResponse.status === 404) {
      const analysisRes = await fetch(${VT_API}/files, {
        method: 'POST',
        headers: { 'x-apikey': apiKey },
        body: (() => {
          const fd = new FormData();
          fd.append('file', new Blob([buffer]), 'subtitle.srt');
          return fd;
        })()
      });

      if (analysisRes.ok) {
        const analysisData = await analysisRes.json();
        return res.status(200).json({
          status: 'analyzing',
          hash: hash,
          vtId: analysisData.data?.id || null,
          message: 'File submitted for analysis'
        });
      }

      return res.status(200).json({
        status: 'unknown',
        hash: hash,
        message: 'File not found in VirusTotal database'
      });
    }

    const vtData = await vtResponse.json();
    const stats = vtData.data?.attributes?.last_analysis_stats || {};
    const malicious = stats.malicious || 0;
    const suspicious = stats.suspicious || 0;
    const undetected = stats.undetected || 0;
    const total = malicious + suspicious + undetected;

    let status = 'clean';
    if (malicious > 0) status = 'malicious';
    else if (suspicious > 0) status = 'suspicious';

    return res.status(200).json({
      status: status,
      hash: hash,
      malicious: malicious,
      suspicious: suspicious,
      undetected: undetected,
      total: total,
      link: https://www.virustotal.com/gui/file/
    });

  } catch (error) {
    console.error('VirusTotal scan error:', error);
    return res.status(500).json({ error: 'Scan failed', details: error.message });
  }
}