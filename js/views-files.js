// Arquivos: gerador de nomes padronizados e de estrutura de pastas.
// A Prancheta não renomeia nem cria nada no disco por conta própria: ela mostra, copia,
// gera um script ou (Chrome/Edge) cria as pastas numa pasta que você escolher e autorizar.
(function () {
  'use strict';
  const M = window.Model, U = window.UI, St = window.Store, S = St.S, App = window.App;
  const { h, icon } = U;
  const Views = window.Views, H = Views.helpers;
  const EXTS = ['psd', 'ai', 'indd', 'pdf', 'png', 'jpg', 'svg', 'mp4', 'aep', 'prproj', 'zip'];
  const canPickFolder = typeof window.showDirectoryPicker === 'function';

  async function copy(text, what) {
    try { await navigator.clipboard.writeText(text); U.toast(what + ' copiado.', 'good'); }
    catch { U.toast('Não foi possível copiar automaticamente. Selecione o texto e use ⌘C / Ctrl+C.', 'warn', 6000); }
  }
  const state = () => H.vs('files', { projectId: '', solicitante: '', demanda: '', peca: '', versao: '1', data: M.isoDate(Date.now()), sufixo: '', ext: 'psd', root: '' });
  function compute() {
    const v = state();
    const name = M.buildFileName(v, S.settings.namePattern || M.DEFAULT_SETTINGS.namePattern, v.ext);
    const root = v.root || [v.solicitante, v.demanda].filter(Boolean).join(' ');
    const paths = M.folderPaths(root, S.settings.folderTemplate || M.DEFAULT_SETTINGS.folderTemplate);
    return { name, paths };
  }

  Views.arquivos = {
    render() {
      const v = state(), { name, paths } = compute();
      const field = (k, label, extra = '') => h`<div class="field"><label for="fl-${k}">${label}</label><input id="fl-${k}" data-fl="${k}" value="${v[k]}"${U.raw(extra)}></div>`;
      return h`${App.page('Arquivos', 'Nomes padronizados e estrutura de pastas para cada demanda')}
      <div class="notice">${icon('info')}<p>A Prancheta não renomeia nem cria arquivos sozinha. Aqui ela gera os nomes e a estrutura para você <strong>copiar</strong>, baixar um <strong>script</strong> para o Terminal${canPickFolder ? h` ou <strong>criar as pastas</strong> numa pasta que você escolher e autorizar` : ''}.</p></div>
      <section class="panel"><header class="panel-head"><h2>Preencher a partir de uma demanda</h2></header>
        <div class="form-grid"><div class="field full"><label for="fl-proj">Demanda (opcional)</label><select id="fl-proj" data-fl-project><option value="">—</option>${App.opt.projects().map(([id, n]) => h`<option value="${id}"${id === v.projectId ? U.raw(' selected') : ''}>${n}</option>`)}</select><small class="hint">Preenche solicitante e demanda; você pode ajustar abaixo.</small></div></div>
      </section>
      <section class="panel"><header class="panel-head"><h2>Nome de arquivo</h2><span class="muted small">padrão: ${S.settings.namePattern}</span></header>
        <div class="form-grid">
          ${field('solicitante', 'Solicitante')}${field('demanda', 'Demanda')}${field('peca', 'Tipo de peça', ' placeholder="ex.: post-feed, banner-home"')}
          ${field('versao', 'Versão', ' type="number" min="0"')}${field('data', 'Data', ' type="date"')}${field('sufixo', 'Sufixo (opcional)', ' placeholder="ex.: aprovado, CMYK"')}
          <div class="field"><label for="fl-ext">Extensão</label><input id="fl-ext" data-fl="ext" list="fl-exts" value="${v.ext}"><datalist id="fl-exts">${EXTS.map(e => h`<option value="${e}">`)}</datalist></div>
        </div>
        <div class="preview"><code data-preview-name>${name || 'Preencha ao menos um campo para gerar o nome.'}</code><button class="btn small" data-act="fl-copy-name"${name ? '' : U.raw(' disabled')}>${icon('download', 'sm')} Copiar nome</button></div>
        <details class="small"><summary>Mudar o padrão do nome</summary>
          <form class="row" data-fl-pattern><input name="pattern" value="${S.settings.namePattern}" aria-label="Padrão do nome" class="grow"><button class="btn small">Salvar padrão</button></form>
          <p class="muted">Use {solicitante} {demanda} {peca} {versao} {data} {sufixo}, separados por _ ou -. Acentos, espaços e caracteres que o sistema não aceita são trocados; campos vazios saem do nome.</p></details>
      </section>
      <section class="panel"><header class="panel-head"><h2>Estrutura de pastas</h2></header>
        <div class="form-grid"><div class="field full"><label for="fl-root">Nome da pasta principal</label><input id="fl-root" data-fl="root" value="${v.root}" placeholder="${[v.solicitante, v.demanda].filter(Boolean).join(' ') || 'ex.: Marketing Campanha de Natal'}"></div></div>
        ${paths.length ? h`<pre class="tree" data-preview-tree>${paths.map((p, i) => (i ? '  '.repeat(p.split('/').length - 1) + '└ ' : '') + p.split('/').pop() + '/').join('\n')}</pre>` : h`<p class="muted" data-preview-tree>Dê um nome à pasta principal (ou escolha uma demanda) para ver a estrutura.</p>`}
        <div class="row">
          <button class="btn small" data-act="fl-copy-paths"${paths.length ? '' : U.raw(' disabled')}>Copiar caminhos</button>
          <button class="btn small" data-act="fl-script"${paths.length ? '' : U.raw(' disabled')}>${icon('download', 'sm')} Baixar script para o Terminal</button>
          ${canPickFolder ? h`<button class="btn small primary" data-act="fl-create"${paths.length ? '' : U.raw(' disabled')}>${icon('file', 'sm')} Criar as pastas agora…</button>` : ''}
        </div>
        <p class="small muted">${canPickFolder ? 'Criar agora: o navegador pede para você escolher onde e autorizar; a Prancheta só mexe nessa pasta. ' : 'Este navegador não permite criar pastas direto (no Mac, o Safari não tem esse recurso; o Chrome e o Edge têm). '}Script: salve o arquivo, abra o Terminal na pasta onde quer a estrutura e rode <code>sh</code> seguido do nome do arquivo baixado.</p>
        <details class="small"><summary>Mudar as pastas padrão</summary>
          <form data-fl-folders><textarea name="folders" rows="7" aria-label="Pastas, uma por linha">${(S.settings.folderTemplate || []).join('\n')}</textarea><div class="row"><button class="btn small">Salvar pastas</button></div></form>
          <p class="muted">Uma pasta por linha, na ordem que preferir. Use / para subpastas (ex.: 05_Exportacoes/Redes).</p></details>
      </section>`;
    },
    mount(root) {
      const upd = () => { const { name, paths } = compute(); const n = root.querySelector('[data-preview-name]'); n.textContent = name || 'Preencha ao menos um campo para gerar o nome.'; root.querySelector('[data-act="fl-copy-name"]').disabled = !name;
        const t = root.querySelector('[data-preview-tree]'); if (t && paths.length && t.tagName === 'PRE') t.textContent = paths.map((p, i) => (i ? '  '.repeat(p.split('/').length - 1) + '└ ' : '') + p.split('/').pop() + '/').join('\n'); else if (t && (!!paths.length) !== (t.tagName === 'PRE')) App.render();
        root.querySelectorAll('[data-act^="fl-copy-paths"], [data-act="fl-script"], [data-act="fl-create"]').forEach(b => { b.disabled = !paths.length; }); };
      root.querySelectorAll('[data-fl]').forEach(i => i.addEventListener('input', () => { state()[i.dataset.fl] = i.value; upd(); }));
      const sel = root.querySelector('[data-fl-project]');
      sel.addEventListener('change', () => { const v = state(), p = St.get('projects', sel.value); v.projectId = sel.value; if (p) { v.demanda = p.name; v.solicitante = H.cname(p.clientId) || ''; } App.render(); });
      root.querySelector('[data-fl-pattern]').addEventListener('submit', async e => { e.preventDefault(); const pat = e.target.elements.pattern.value.trim(); if (!/\{\w+\}/.test(pat)) return U.toast('O padrão precisa de ao menos um campo entre chaves, como {demanda}.', 'bad'); try { await St.saveSettings({ namePattern: pat }); U.toast('Padrão salvo.', 'good'); } catch (err) { U.fail(err); } });
      root.querySelector('[data-fl-folders]').addEventListener('submit', async e => { e.preventDefault(); const lines = e.target.elements.folders.value.split('\n').map(l => l.trim()).filter(Boolean); if (!lines.length) return U.toast('Informe ao menos uma pasta.', 'bad'); try { await St.saveSettings({ folderTemplate: lines }); U.toast('Pastas padrão salvas.', 'good'); } catch (err) { U.fail(err); } });
    },
    async act(act) {
      const { name, paths } = compute();
      if (act === 'fl-copy-name' && name) copy(name, 'Nome');
      if (act === 'fl-copy-paths' && paths.length) copy(paths.join('\n'), 'Caminhos');
      if (act === 'fl-script' && paths.length) { U.downloadFile('criar-pastas_' + paths[0] + '.sh', M.folderScript(paths), 'text/x-sh'); U.toast('Script baixado. As pastas só existem depois que você rodar o script no Terminal.', 'good', 7000); }
      if (act === 'fl-create' && paths.length && canPickFolder) {
        let base;
        try { base = await window.showDirectoryPicker({ mode: 'readwrite' }); } catch (e) { if (e.name !== 'AbortError') U.toast('O navegador não deu acesso à pasta: ' + e.message, 'bad', 6000); return; }
        try {
          for (const p of paths) { let d = base; for (const seg of p.split('/')) d = await d.getDirectoryHandle(seg, { create: true }); }
          U.toast(`${paths.length} pasta(s) criada(s) em “${base.name}/${paths[0]}”. Pastas que já existiam foram mantidas.`, 'good', 8000);
        } catch (e) { U.toast('Não foi possível criar todas as pastas: ' + e.message, 'bad', 8000); }
      }
    },
  };
})();
