const { Redis } = require('@upstash/redis');
const { randomUUID } = require('crypto');

// Vercel Marketplace에서 Upstash Redis 통합을 연결하면 아래 두 환경변수가
// 자동으로 채워진다 (예전 @vercel/kv는 지원 종료되어 사용하지 않음).
const kv = Redis.fromEnv();

const CHALLENGE_TTL_SECONDS = 5 * 60;
const SESSION_TTL_SECONDS = 60 * 60;

const userKey = (username) => `user:${username}`;
const credentialsKey = (username) => `user:${username}:credentials`;
const privateNotesKey = (username) => `user:${username}:private`;
const challengeKey = (purpose, username) => `challenge:${purpose}:${username}`;
const sessionKey = (sessionId) => `session:${sessionId}`;

async function getUser(username) {
  return kv.get(userKey(username));
}

async function ensureUser(username) {
  const existing = await getUser(username);
  if (existing) return existing;
  const user = { username, createdAt: new Date().toISOString() };
  await kv.set(userKey(username), user);
  await kv.set(privateNotesKey(username), [
    `${username}님의 준비 중인 프로젝트 메모: 사내 SOC 자동화 스크립트 초안 작성 중`,
    `${username}님이 지원하려는 곳 목록: 보안관제센터 인턴, 침해대응팀 신입`,
    `${username}님의 이번 주 회고: WebAuthn 카운터 검증 로직을 다시 짚어볼 것`,
  ]);
  return user;
}

async function getCredentials(username) {
  return (await kv.get(credentialsKey(username))) || [];
}

async function addCredential(username, credential) {
  const list = await getCredentials(username);
  list.push(credential);
  await kv.set(credentialsKey(username), list);
  return list;
}

async function updateCredentialCounter(username, credentialID, newCounter) {
  const list = await getCredentials(username);
  const idx = list.findIndex((c) => c.id === credentialID);
  if (idx === -1) return null;
  list[idx].counter = newCounter;
  await kv.set(credentialsKey(username), list);
  return list[idx];
}

async function deleteCredential(username, credentialID) {
  const list = await getCredentials(username);
  const next = list.filter((c) => c.id !== credentialID);
  await kv.set(credentialsKey(username), next);
  return next;
}

async function getPrivateNotes(username) {
  return (await kv.get(privateNotesKey(username))) || [];
}

async function setChallenge(purpose, username, challenge) {
  await kv.set(challengeKey(purpose, username), challenge, { ex: CHALLENGE_TTL_SECONDS });
}

async function takeChallenge(purpose, username) {
  const key = challengeKey(purpose, username);
  const value = await kv.get(key);
  if (value) await kv.del(key); // 한 번 쓰면 즉시 폐기 -> 재사용(replay) 불가
  return value;
}

async function createSession(username) {
  const sessionId = randomUUID();
  await kv.set(sessionKey(sessionId), { username, createdAt: new Date().toISOString() }, {
    ex: SESSION_TTL_SECONDS,
  });
  return sessionId;
}

async function getSession(sessionId) {
  if (!sessionId) return null;
  return kv.get(sessionKey(sessionId));
}

async function deleteSession(sessionId) {
  if (!sessionId) return;
  await kv.del(sessionKey(sessionId));
}

module.exports = {
  ensureUser,
  getUser,
  getCredentials,
  addCredential,
  updateCredentialCounter,
  deleteCredential,
  getPrivateNotes,
  setChallenge,
  takeChallenge,
  createSession,
  getSession,
  deleteSession,
  SESSION_TTL_SECONDS,
};
