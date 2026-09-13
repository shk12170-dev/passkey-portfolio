const { getSessionId, clearSessionCookie } = require('../lib/session');
const { deleteSession } = require('../lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const sessionId = getSessionId(req);
  await deleteSession(sessionId);
  const isLocal = req.headers.host && req.headers.host.startsWith('localhost');
  clearSessionCookie(res, isLocal);

  res.status(200).json({ loggedOut: true });
};
