// Tela de senha no estilo da tela de bloqueio do Mac. Guarda só um hash da senha
// (PBKDF2-SHA256 com sal aleatório), nunca a senha. É uma trava de acesso: os dados
// no navegador não ficam criptografados (veja o README).
(function () {
  'use strict';
  const U = window.UI, St = window.Store;
  const { h, icon } = U;
  const KEY = 'lock', SESSION = 'prancheta.unlocked', ITER = 210000, MAX_TRIES = 5, WAIT_S = 30;
  const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
  async function derive(pass, saltHex, iter) {
    const salt = new Uint8Array(saltHex.match(/../g).map(x => parseInt(x, 16)));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, key, 256));
  }
  async function makeLock(pass) { const salt = hex(crypto.getRandomValues(new Uint8Array(16))); return { salt, iter: ITER, hash: await derive(pass, salt, ITER) }; }
  const matches = async (pass, lock) => (await derive(pass, lock.salt, lock.iter)) === lock.hash;
  // desbloqueado vale para esta aba; outra aba ou janela pede a senha de novo
  const isUnlocked = () => { try { return sessionStorage.getItem(SESSION) === '1'; } catch { return false; } };
  const setUnlocked = v => { try { v ? sessionStorage.setItem(SESSION, '1') : sessionStorage.removeItem(SESSION); } catch { /* sem sessionStorage: pede sempre */ } };

  function screen(mode) {
    const name = St.S.settings.name || 'Prancheta';
    const el = document.createElement('div');
    el.className = 'lock';
    el.innerHTML = U.html(h`
      <div class="lock-clock" aria-hidden="true"><p class="lock-date"></p><p class="lock-time"></p></div>
      <form class="lock-user" novalidate>
        <div class="lock-avatar" aria-hidden="true">${name[0].toUpperCase()}</div>
        <h1 class="lock-name">${name}</h1>
        ${mode === 'create' ? h`<p class="lock-hint">Crie uma senha para abrir a Prancheta</p>` : ''}
        <div class="lock-field"><input type="password" name="p1" placeholder="${mode === 'create' ? 'Nova senha' : 'Digite a senha'}" aria-label="${mode === 'create' ? 'Nova senha' : 'Senha'}" autocomplete="${mode === 'create' ? 'new-password' : 'current-password'}">${mode === 'unlock' ? h`<button class="lock-go" aria-label="Entrar">${icon('right')}</button>` : ''}</div>
        ${mode === 'create' ? h`<div class="lock-field"><input type="password" name="p2" placeholder="Repita a senha" aria-label="Repita a senha" autocomplete="new-password"><button class="lock-go" aria-label="Criar senha">${icon('right')}</button></div>` : ''}
        <p class="lock-msg" role="alert"></p>
        ${mode === 'unlock' ? h`<button type="button" class="lock-link" data-forgot>Esqueceu a senha?</button>` : ''}
      </form>`);
    const tick = () => {
      const d = new Date();
      el.querySelector('.lock-date').textContent = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
      el.querySelector('.lock-time').textContent = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };
    tick(); el._timer = setInterval(tick, 1000);
    document.body.append(el);
    el.querySelector('input').focus();
    return el;
  }

  async function gate() {
    const lock = await St.getMeta(KEY);
    if (lock && isUnlocked()) return;
    document.body.classList.add('locked');
    const el = screen(lock ? 'unlock' : 'create');
    const form = el.querySelector('form'), msg = el.querySelector('.lock-msg');
    let fails = 0, blockedUntil = 0, busy = false;
    const say = (t, shake) => { msg.textContent = t; if (shake) { form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); } };
    await new Promise(done => {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        if (busy) return;
        const p1 = form.elements.p1.value;
        if (!lock) {
          const p2 = form.elements.p2.value;
          if (p1.length < 4) return say('Use pelo menos 4 caracteres.', true);
          if (p1 !== p2) return say('As senhas não são iguais.', true);
          busy = true;
          try { await St.setMeta(KEY, await makeLock(p1)); setUnlocked(true); done(); } catch (err) { say('Não foi possível salvar a senha: ' + err.message); } finally { busy = false; }
          return;
        }
        if (Date.now() < blockedUntil) return say(`Muitas tentativas. Tente de novo em ${Math.ceil((blockedUntil - Date.now()) / 1000)} s.`, true);
        if (!p1) return;
        busy = true;
        const ok = await matches(p1, lock);
        busy = false;
        if (ok) { setUnlocked(true); done(); return; }
        form.elements.p1.value = '';
        if (++fails >= MAX_TRIES) { fails = 0; blockedUntil = Date.now() + WAIT_S * 1000; return say(`Senha incorreta. Aguarde ${WAIT_S} s para tentar de novo.`, true); }
        say('Senha incorreta.', true);
      });
      // ao criar, Enter no primeiro campo leva ao segundo
      if (!lock) form.elements.p1.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); form.elements.p2.focus(); } });
      const forgot = el.querySelector('[data-forgot]');
      if (forgot) forgot.addEventListener('click', () => forgotFlow());
    });
    clearInterval(el._timer); el.remove();
    document.body.classList.remove('locked');
  }

  // sem a senha, não há como recuperar sem abrir mão dos dados: a única saída é recomeçar
  function forgotFlow() {
    const d = U.dialog(h`<form method="dialog" class="ask"><h2>Esqueceu a senha?</h2>
      <p>Não é possível recuperar a senha. Para voltar a usar a Prancheta neste navegador, é preciso apagar todos os dados e começar de novo. Se você tem um backup exportado, poderá importá-lo depois.</p>
      <label for="forgot-confirm">Digite <strong>APAGAR</strong> para apagar tudo e criar uma nova senha</label><input id="forgot-confirm" autocomplete="off">
      <div class="actions"><button value="no" class="btn">Cancelar</button><button value="yes" class="btn danger">Apagar tudo</button></div></form>`, 'small');
    d.addEventListener('close', async () => {
      if (d.returnValue !== 'yes') return;
      if (d.querySelector('#forgot-confirm').value.trim() !== 'APAGAR') return U.toast('Confirmação incorreta: nada foi apagado.', 'bad');
      try { await St.importAll({ data: {} }, 'replace'); await St.saveSettings(structuredClone(window.Model.DEFAULT_SETTINGS)); await St.setMeta(KEY, null); setUnlocked(false); location.reload(); }
      catch (e) { U.toast('Não foi possível apagar: ' + e.message, 'bad', 6000); }
    });
  }

  async function changePassword(current, next) {
    const lock = await St.getMeta(KEY);
    if (lock && !(await matches(current, lock))) throw new Error('A senha atual não confere.');
    if (next.length < 4) throw new Error('A nova senha precisa de pelo menos 4 caracteres.');
    await St.setMeta(KEY, await makeLock(next));
  }

  window.Lock = { gate, changePassword, lockNow() { setUnlocked(false); location.reload(); } };
})();
