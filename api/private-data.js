const { requireSession } = require('../lib/auth');
const { getPrivateNotes } = require('../lib/store');

// 카드1 C15~C17: 인증 안 된 요청은 여기서 401로 막힌다 (200 + 프론트 숨김 아님).
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();

  const session = await requireSession(req, res);
  if (!session) return; // requireSession이 이미 401 응답을 보냄

  // 카드5 C36~C41: ?owner=<다른 계정>으로 남의 자료를 지목해서 요청하면
  // 로그인은 돼 있어도(세션 유효) 거절되는 것을 눈으로 확인할 수 있게 한다.
  const requestedOwner = req.query.owner;
  if (requestedOwner && requestedOwner !== session.username) {
    return res.status(403).json({
      error: 'forbidden',
      message: `${session.username}(으)로 로그인한 상태에서는 ${requestedOwner}의 비공개 자료를 볼 수 없습니다.`,
    });
  }

  const notes = await getPrivateNotes(session.username);
  res.status(200).json({ username: session.username, notes });
};
