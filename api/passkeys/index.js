const { requireSession } = require('../../lib/auth');
const { getCredentials } = require('../../lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();

  const session = await requireSession(req, res);
  if (!session) return;

  const credentials = await getCredentials(session.username);
  res.status(200).json(
    credentials.map((c) => ({
      id: c.id,
      deviceName: c.deviceName,
      createdAt: c.createdAt,
    })),
  );
};
