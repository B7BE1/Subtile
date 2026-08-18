/**
 * SubHub - Direct Subtitle File Download Proxy
 * Bypasses CORS and referrer limitations to provide direct binary streaming.
 */

export default async function handler(req, res) {
  const { url, filename = 'subtitle.srt' } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Download URL is required' });
  }

  // Security check: only allow safe target domains
  try {
    const targetUrl = new URL(url);
    const allowedHosts = [
      'subdl.com',
      'dl.subdl.com',
      'api.subdl.com',
      'opensubtitles.com',
      'api.opensubtitles.com',
      'dl.opensubtitles.org',
      'raw.githubusercontent.com'
    ];

    const isAllowed = allowedHosts.some(host => targetUrl.hostname === host || targetUrl.hostname.endsWith('.' + host));
    if (!isAllowed) {
      return res.status(403).json({ error: 'Target host not allowed for security reasons' });
    }

    // Fetch the file stream from provider
    const response = await fetch(url, {
      headers: {
        'User-Agent': process.env.OPENSUBTITLES_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Failed to fetch file from source (${response.statusText})` });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = await response.arrayBuffer();

    // Sanitize filename to prevent header injection
    const cleanFileName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFileName}"`);
    res.setHeader('Content-Length', buffer.byteLength);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Download Proxy Error:', error);
    return res.status(500).json({ error: 'Internal Download Proxy Error', details: error.message });
  }
}
