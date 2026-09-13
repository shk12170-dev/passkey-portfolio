// WebAuthn은 challenge를 만든 origin/rpID와 응답을 검증하는 origin/rpID가
// 정확히 일치해야 한다. Vercel은 배포마다 호스트가 달라질 수 있으므로
// 매 요청의 Host 헤더에서 rpID/origin을 계산한다. 커스텀 도메인을 쓰면
// RP_ID 환경변수로 고정할 수 있다.
function getRpFromRequest(req) {
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = process.env.RP_ID || forwardedHost || req.headers.host;
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const protocol = isLocal ? 'http' : 'https';

  return {
    rpID: host.split(':')[0],
    origin: `${protocol}://${host}`,
    rpName: 'DK SECURITY Passkey Portfolio',
  };
}

module.exports = { getRpFromRequest };
