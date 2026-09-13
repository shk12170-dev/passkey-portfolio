const COOKIE_NAME = 'dk_sid';

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return header.split(';').reduce((acc, pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return acc;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function getSessionId(req) {
  return parseCookies(req)[COOKIE_NAME] || null;
}

function setSessionCookie(res, sessionId, maxAgeSeconds, isLocal) {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAgeSeconds}`,
    'SameSite=Lax',
  ];
  if (!isLocal) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(res, isLocal) {
  const attrs = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    'SameSite=Lax',
  ];
  if (!isLocal) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

module.exports = { getSessionId, setSessionCookie, clearSessionCookie, COOKIE_NAME };
