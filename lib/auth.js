const { getSessionId } = require('./session');
const { getSession } = require('./store');

// 카드1 통과기준: 비공개 자료 요청은 세션이 없거나 만료되면 401로 거절한다.
// (200을 내려준 뒤 프론트에서 숨기는 방식 금지)
async function requireSession(req, res) {
  const sessionId = getSessionId(req);
  const session = await getSession(sessionId);
  if (!session) {
    res.status(401).json({ error: 'unauthenticated', message: '패스키 로그인이 필요합니다.' });
    return null;
  }
  return session;
}

module.exports = { requireSession };
