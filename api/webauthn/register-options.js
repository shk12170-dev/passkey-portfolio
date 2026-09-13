const { generateRegistrationOptions } = require('@simplewebauthn/server');
const { getRpFromRequest } = require('../../lib/rp');
const { ensureUser, getCredentials, setChallenge } = require('../../lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { username } = req.body || {};
  if (!username || typeof username !== 'string' || username.length > 40) {
    return res.status(400).json({ error: 'invalid_username' });
  }

  const { rpID, rpName } = getRpFromRequest(req);
  await ensureUser(username);
  const existingCredentials = await getCredentials(username);

  // 등록용 challenge를 서버가 새로 만든다. 요청마다 값이 다르다.
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: username,
    attestationType: 'none',
    // 같은 기기에 이미 등록된 자격증명은 제외 목록으로 넘겨 중복 등록을 막되,
    // 다른 기기/다른 인증기로 두 번째 패스키를 추가하는 것은 막지 않는다.
    excludeCredentials: existingCredentials.map((c) => ({
      id: c.id,
      transports: c.transports,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  // challenge 확인 전까지 서버가 보관한다 (KV, TTL 5분).
  await setChallenge('register', username, options.challenge);

  res.status(200).json(options);
};
