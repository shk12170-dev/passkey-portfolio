const { requireSession } = require('../../lib/auth');
const { getCredentials, deleteCredential } = require('../../lib/store');

// 카드4: 패스키 하나를 지워도 본인 계정 것만 지울 수 있다 (세션의 username 기준).
module.exports = async (req, res) => {
  if (req.method !== 'DELETE') return res.status(405).end();

  const session = await requireSession(req, res);
  if (!session) return;

  const { id } = req.query;
  const before = await getCredentials(session.username);
  if (!before.some((c) => c.id === id)) {
    return res.status(404).json({ error: 'not_found' });
  }

  const after = await deleteCredential(session.username, id);
  res.status(200).json({
    deleted: true,
    remaining: after.length,
  });
};
