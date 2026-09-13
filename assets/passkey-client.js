(function () {
  const { startRegistration, startAuthentication, browserSupportsWebAuthn } = SimpleWebAuthnBrowser;

  const usernameInput = document.getElementById('pk-username');
  const deviceNameInput = document.getElementById('pk-device-name');
  const statusEl = document.getElementById('pk-status');
  const authView = document.getElementById('pk-auth-view');
  const privateView = document.getElementById('pk-private-view');
  const notesList = document.getElementById('pk-notes-list');
  const passkeyList = document.getElementById('pk-passkey-list');
  const whoamiEl = document.getElementById('pk-whoami');

  function setStatus(message, tone) {
    statusEl.textContent = message;
    statusEl.style.color = tone === 'error' ? 'var(--accent-red)'
      : tone === 'ok' ? 'var(--accent-green)'
      : 'var(--text-sub)';
  }

  function currentUsername() {
    return usernameInput.value.trim();
  }

  async function api(path, options) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    let body = null;
    try { body = await res.json(); } catch (_) { /* no body */ }
    return { res, body };
  }

  async function refreshPrivateArea() {
    const { res, body } = await api('/api/private-data');
    if (res.status === 401) {
      authView.hidden = false;
      privateView.hidden = true;
      return;
    }
    authView.hidden = true;
    privateView.hidden = false;
    whoamiEl.textContent = body.username;
    notesList.innerHTML = '';
    body.notes.forEach((note) => {
      const li = document.createElement('li');
      li.textContent = note;
      notesList.appendChild(li);
    });
    await refreshPasskeyList();
  }

  async function refreshPasskeyList() {
    const { res, body } = await api('/api/passkeys');
    if (!res.ok) return;
    passkeyList.innerHTML = '';
    if (body.length === 0) {
      const li = document.createElement('li');
      li.textContent = '등록된 패스키가 없습니다. 마지막 패스키를 지우면 이 계정은 다시 로그인할 수 없으니, 새 패스키를 먼저 등록하세요.';
      passkeyList.appendChild(li);
      return;
    }
    body.forEach((pk) => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = `${pk.deviceName} · 등록일 ${new Date(pk.createdAt).toLocaleString('ko-KR')}`;
      const delBtn = document.createElement('button');
      delBtn.className = 'sim-btn';
      delBtn.style.marginLeft = '10px';
      delBtn.style.padding = '4px 10px';
      delBtn.style.fontSize = '11px';
      delBtn.textContent = '삭제';
      delBtn.onclick = () => deletePasskey(pk.id);
      li.appendChild(label);
      li.appendChild(delBtn);
      passkeyList.appendChild(li);
    });
  }

  async function deletePasskey(id) {
    const { res } = await api(`/api/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) {
      setStatus('패스키를 삭제했습니다.', 'ok');
      await refreshPasskeyList();
    } else {
      setStatus('패스키 삭제에 실패했습니다.', 'error');
    }
  }

  async function registerPasskey() {
    const username = currentUsername();
    if (!username) return setStatus('아이디를 입력해주세요.', 'error');

    setStatus('등록용 challenge 요청 중...');
    const { res: optRes, body: options } = await api('/api/webauthn/register-options', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    if (!optRes.ok) return setStatus('등록 옵션 요청 실패: ' + (options && options.error), 'error');

    let attResp;
    try {
      attResp = await startRegistration({ optionsJSON: options });
    } catch (err) {
      setStatus('등록이 취소되었거나 실패했습니다: ' + err.message, 'error');
      return;
    }

    const deviceName = deviceNameInput.value.trim() || undefined;
    const { res: verifyRes, body: verifyBody } = await api('/api/webauthn/register-verify', {
      method: 'POST',
      body: JSON.stringify({ username, credential: attResp, deviceName }),
    });

    if (verifyRes.ok && verifyBody.verified) {
      setStatus('패스키 등록 완료! 이제 이 패스키로 로그인할 수 있습니다.', 'ok');
    } else {
      setStatus('등록 검증 실패: ' + (verifyBody && (verifyBody.message || verifyBody.error)), 'error');
    }
  }

  async function loginPasskey() {
    const username = currentUsername();
    if (!username) return setStatus('아이디를 입력해주세요.', 'error');

    setStatus('로그인용 challenge 요청 중...');
    const { res: optRes, body: options } = await api('/api/webauthn/login-options', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    if (optRes.status === 404) return setStatus(options.message, 'error');
    if (!optRes.ok) return setStatus('로그인 옵션 요청 실패: ' + (options && options.error), 'error');

    let authResp;
    try {
      authResp = await startAuthentication({ optionsJSON: options });
    } catch (err) {
      setStatus('로그인이 취소되었거나 실패했습니다: ' + err.message, 'error');
      return;
    }

    const { res: verifyRes, body: verifyBody } = await api('/api/webauthn/login-verify', {
      method: 'POST',
      body: JSON.stringify({ username, credential: authResp }),
    });

    if (verifyRes.ok && verifyBody.verified) {
      setStatus('로그인 성공!', 'ok');
      await refreshPrivateArea();
    } else {
      setStatus('로그인 검증 실패: ' + (verifyBody && (verifyBody.message || verifyBody.error)), 'error');
    }
  }

  async function logout() {
    await api('/api/logout', { method: 'POST' });
    setStatus('로그아웃했습니다.');
    await refreshPrivateArea();
  }

  document.getElementById('pk-register-btn').addEventListener('click', registerPasskey);
  document.getElementById('pk-login-btn').addEventListener('click', loginPasskey);
  document.getElementById('pk-logout-btn').addEventListener('click', logout);
  document.getElementById('pk-add-passkey-btn').addEventListener('click', async () => {
    usernameInput.value = whoamiEl.textContent;
    await registerPasskey();
  });

  if (!browserSupportsWebAuthn()) {
    setStatus('이 브라우저는 패스키(WebAuthn)를 지원하지 않습니다.', 'error');
  } else {
    refreshPrivateArea();
  }
})();
