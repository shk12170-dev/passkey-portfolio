const { verifyRegistrationResponse } = require('@simplewebauthn/server');
const { getRpFromRequest } = require('../../lib/rp');
const { takeChallenge, addCredential, getCredentials } = require('../../lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { username, credential, deviceName } = req.body || {};
  if (!username || !credential) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  const expectedChallenge = await takeChallenge('register', username);
  if (!expectedChallenge) {
    return res.status(400).json({ error: 'challenge_expired_or_missing' });
  }

  const { rpID, origin } = getRpFromRequest(req);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (err) {
    return res.status(400).json({ error: 'verification_failed', message: err.message });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return res.status(400).json({ error: 'not_verified' });
  }

  const { credential: verifiedCredential } = verification.registrationInfo;

  const existing = await getCredentials(username);
  if (existing.some((c) => c.id === verifiedCredential.id)) {
    return res.status(409).json({ error: 'credential_already_registered' });
  }

  // 서버에는 공개키만 저장한다 (개인키는 등록 요청 본문에도, 서버 저장값에도 없다).
  await addCredential(username, {
    id: verifiedCredential.id,
    publicKey: Buffer.from(verifiedCredential.publicKey).toString('base64url'),
    counter: verifiedCredential.counter,
    transports: verifiedCredential.transports || [],
    deviceName: (deviceName && String(deviceName).slice(0, 60)) || '이름 없는 패스키',
    createdAt: new Date().toISOString(),
  });

  res.status(200).json({ verified: true });
};
