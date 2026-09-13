const { generateAuthenticationOptions } = require('@simplewebauthn/server');
const { getRpFromRequest } = require('../../lib/rp');
const { getCredentials, setChallenge } = require('../../lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'invalid_username' });

  const { rpID } = getRpFromRequest(req);
  const credentials = await getCredentials(username);

  if (credentials.length === 0) {
    // 카드4 통과기준: 패스키가 하나도 없으면 그 상태를 명확히 알려준다.
    return res.status(404).json({
      error: 'no_passkeys',
      message: '이 계정에 등록된 패스키가 없습니다. 먼저 패스키를 등록해 주세요.',
    });
  }

  // 로그인용 challenge도 매번 새로 만든다.
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials: credentials.map((c) => ({
      id: c.id,
      transports: c.transports,
    })),
  });

  await setChallenge('login', username, options.challenge);

  res.status(200).json(options);
};
