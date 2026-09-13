const { verifyAuthenticationResponse } = require('@simplewebauthn/server');
const { getRpFromRequest } = require('../../lib/rp');
const {
  takeChallenge,
  getCredentials,
  updateCredentialCounter,
  createSession,
  SESSION_TTL_SECONDS,
} = require('../../lib/store');
const { setSessionCookie } = require('../../lib/session');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { username, credential } = req.body || {};
  if (!username || !credential) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  // 이미 쓴 challenge는 여기서 사라진다(KV에서 삭제됨) -> 같은 값으로 다시
  // 로그인 시도하면 challenge_expired_or_missing으로 거절된다 (재생 공격 방어).
  const expectedChallenge = await takeChallenge('login', username);
  if (!expectedChallenge) {
    return res.status(400).json({ error: 'challenge_expired_or_missing' });
  }

  const credentials = await getCredentials(username);
  const matching = credentials.find((c) => c.id === credential.id);
  if (!matching) {
    // 삭제된 패스키(카드4)로는 여기서 걸러진다.
    return res.status(401).json({ error: 'unknown_credential' });
  }

  const { rpID, origin } = getRpFromRequest(req);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: matching.id,
        publicKey: Buffer.from(matching.publicKey, 'base64url'),
        counter: matching.counter,
        transports: matching.transports,
      },
    });
  } catch (err) {
    return res.status(401).json({ error: 'verification_failed', message: err.message });
  }

  if (!verification.verified) {
    return res.status(401).json({ error: 'not_verified' });
  }

  await updateCredentialCounter(username, matching.id, verification.authenticationInfo.newCounter);

  const sessionId = await createSession(username);
  const isLocal = req.headers.host && req.headers.host.startsWith('localhost');
  setSessionCookie(res, sessionId, SESSION_TTL_SECONDS, isLocal);

  res.status(200).json({ verified: true, username });
};
