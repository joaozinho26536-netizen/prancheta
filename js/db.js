// Persistência em IndexedDB. Mantém uma cópia em memória (Store.S) que só
// muda depois que a transação no banco é confirmada, então a tela nunca mostra
// algo que não foi salvo. Outras abas são avisadas por BroadcastChannel.
(function () {
  'use strict';
  const M = window.Model;
  const DB_NAME = 'prancheta', DB_VERSION = 1, ACTIVITY_MAX = 500, HISTORY_MAX = 50;
  const LABELS = { projects: 'Projeto', tasks: 'Tarefa', clients: 'Solicitante', events: 'Evento', revisions: 'Revisão', refs: 'Referência', notes: 'Anotação', goals: 'Meta', sessions: 'Sessão de trabalho', breaks: 'Pausa', workdays: 'Expediente' };
  const NAME_KEY = { projects: 'name', clients: 'name', refs: 'name', tasks: 'title', events: 'title', notes: 'title', goals: 'title', revisions: 'version' };

  let db = null;
  const listeners = new Set();
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('prancheta') : null;
  const S = { settings: structuredClone(M.DEFAULT_SETTINGS) };
  for (const s of M.STORES) S[s] = [];

  function req(r) { return new Promise((ok, fail) => { r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); }); }
  function open() {
    return new Promise((ok, fail) => {
      if (!window.indexedDB) return fail(new Error('Este navegador não oferece IndexedDB.'));
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        for (const s of M.STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
      };
      r.onsuccess = () => { db = r.result; db.onversionchange = () => db.close(); ok(); };
      r.onerror = () => fail(r.error);
      r.onblocked = () => fail(new Error('Feche as outras abas da Prancheta e recarregue.'));
    });
  }
  // executa fn(stores) numa transação; resolve só quando o banco confirma
  function tx(names, fn) {
    return new Promise((ok, fail) => {
      let t;
      try { t = db.transaction(names, 'readwrite'); } catch (e) { return fail(e); }
      const stores = Object.fromEntries(names.map(n => [n, t.objectStore(n)]));
      let out;
      t.oncomplete = () => ok(out);
      t.onerror = () => fail(t.error || new Error('Falha ao gravar.'));
      t.onabort = () => fail(t.error || new Error('Gravação cancelada (o espaço de armazenamento pode estar cheio).'));
      try { out = fn(stores); } catch (e) { t.abort(); fail(e); }
    });
  }
  async function loadAll() {
    const t = db.transaction([...M.STORES, 'meta'], 'readonly');
    for (const s of M.STORES) S[s] = await req(t.objectStore(s).getAll());
    const meta = await req(t.objectStore('meta').get('settings'));
    S.settings = { ...structuredClone(M.DEFAULT_SETTINGS), ...(meta ? meta.value : {}) };
    S.settings.dashboard = { ...M.DEFAULT_SETTINGS.dashboard, ...S.settings.dashboard };
    S.activity.sort((a, b) => b.at - a.at);
  }
  function emit(remote) { for (const fn of listeners) fn(remote); if (!remote && channel) channel.postMessage('changed'); }
  if (channel) channel.onmessage = async () => { await loadAll(); emit(true); };

  function diff(old, next) {
    const ch = {};
    for (const k of new Set([...Object.keys(old), ...Object.keys(next)])) {
      if (k === 'history' || k === 'updated') continue;
      const a = old[k] ?? '', b = next[k] ?? '';
      if (JSON.stringify(a) !== JSON.stringify(b)) ch[k] = [a, b];
    }
    return ch;
  }
  function activityEntry(type, rec, verb) {
    const name = rec[NAME_KEY[type]];
    return { id: M.uid(), at: Date.now(), type, ref: rec.id, text: `${LABELS[type] || type} ${verb}${name ? ': ' + name : ''}` };
  }

  // salva (cria ou altera) um registro; retorna o registro salvo
  async function save(type, input, { verb, quiet } = {}) {
    const errors = M.validate(type, input);
    if (Object.keys(errors).length) { const e = new Error('Há campos inválidos.'); e.fields = errors; throw e; }
    const old = input.id ? S[type].find(r => r.id === input.id) : null;
    const now = Date.now();
    const rec = { ...input, id: input.id || M.uid(), created: old ? old.created : (input.created || now), updated: now };
    if (old) {
      const ch = diff(old, rec);
      if (!Object.keys(ch).length) return old;
      // o histórico guarda mudanças de conteúdo; pausas, checklist, imagem e lembretes ficam de fora (ruído)
      for (const k of ['pauses', 'checklist', 'image', 'remindedAt']) delete ch[k];
      if (Object.keys(ch).length) rec.history = [{ at: now, changes: ch }, ...(old.history || [])].slice(0, HISTORY_MAX);
    } else rec.history = [];
    const act = quiet ? null : activityEntry(type, rec, verb || (old ? 'atualizado(a)' : 'criado(a)'));
    await tx([type, 'activity'], st => { st[type].put(rec); if (act) st.activity.put(act); });
    S[type] = old ? S[type].map(r => r.id === rec.id ? rec : r) : [...S[type], rec];
    if (act) { S.activity.unshift(act); pruneActivity(); }
    emit();
    return rec;
  }
  function pruneActivity() {
    if (S.activity.length <= ACTIVITY_MAX) return;
    const drop = S.activity.splice(ACTIVITY_MAX);
    tx(['activity'], st => drop.forEach(a => st.activity.delete(a.id))).catch(() => {});
  }
  // exclusão com as relações resolvidas na mesma transação
  async function remove(type, id) {
    const rec = S[type].find(r => r.id === id);
    if (!rec) return;
    const unlink = [];   // [store, campo]
    let cascade = [];    // [store, id]
    if (type === 'projects') {
      for (const s of ['tasks', 'sessions', 'notes', 'refs', 'events']) unlink.push([s, 'projectId']);
      cascade = S.revisions.filter(r => r.projectId === id).map(r => ['revisions', r.id]);
    }
    if (type === 'clients') for (const s of ['projects', 'tasks', 'notes']) unlink.push([s, 'clientId']);
    if (type === 'tasks') { unlink.push(['sessions', 'taskId']); unlink.push(['events', 'taskId']); }
    const changed = [];
    for (const [s, f] of unlink) for (const r of S[s]) if (r[f] === id) changed.push([s, { ...r, [f]: null, updated: Date.now() }]);
    const stores = [...new Set([type, 'activity', ...changed.map(c => c[0]), ...cascade.map(c => c[0])])];
    const act = type === 'activity' ? null : activityEntry(type, rec, 'excluído(a)');
    await tx(stores, st => {
      st[type].delete(id);
      for (const [s, r] of changed) st[s].put(r);
      for (const [s, rid] of cascade) st[s].delete(rid);
      if (act) st.activity.put(act);
    });
    S[type] = S[type].filter(r => r.id !== id);
    for (const [s, r] of changed) S[s] = S[s].map(x => x.id === r.id ? r : x);
    for (const [s, rid] of cascade) S[s] = S[s].filter(x => x.id !== rid);
    if (act) S.activity.unshift(act);
    emit();
  }
  async function saveSettings(patch) {
    const next = { ...S.settings, ...patch };
    await tx(['meta'], st => st.meta.put({ key: 'settings', value: next }));
    S.settings = next; emit();
  }
  function exportAll() {
    const data = { settings: S.settings };
    for (const s of M.STORES) data[s] = S[s];
    return { app: 'prancheta', version: 1, exportedAt: new Date().toISOString(), data };
  }
  // mode 'replace' apaga tudo e grava o backup; 'merge' junta por id sem duplicar
  async function importAll(backup, mode) {
    const data = backup.data, result = {};
    const next = {};
    for (const s of M.STORES) {
      const inc = data[s] || [];
      if (mode === 'replace') { next[s] = inc; result[s] = { added: inc.length, updated: 0 }; }
      else { const m = M.mergeRecords(S[s], inc); next[s] = m.records; result[s] = { added: m.added, updated: m.updated }; }
    }
    const settings = mode === 'replace' && data.settings ? { ...structuredClone(M.DEFAULT_SETTINGS), ...data.settings } : S.settings;
    await tx([...M.STORES, 'meta'], st => {
      for (const s of M.STORES) { st[s].clear(); next[s].forEach(r => st[s].put(r)); }
      st.meta.put({ key: 'settings', value: settings });
    });
    await loadAll(); emit();
    return result;
  }
  async function clearDemo() {
    const victims = M.STORES.flatMap(s => S[s].filter(r => r.demo).map(r => [s, r.id]));
    await tx(M.STORES, st => victims.forEach(([s, id]) => st[s].delete(id)));
    await loadAll(); emit();
    return victims.length;
  }
  async function bulkPut(list) { // [[store, rec]], usado pelos dados de demonstração
    await tx([...new Set(list.map(x => x[0]))], st => list.forEach(([s, r]) => st[s].put(r)));
    await loadAll(); emit();
  }

  window.Store = {
    S, LABELS, async init() { await open(); await loadAll(); },
    save, remove, saveSettings, exportAll, importAll, clearDemo, bulkPut, reload: async () => { await loadAll(); emit(); },
    onChange(fn) { listeners.add(fn); },
    get(type, id) { return id ? S[type].find(r => r.id === id) : undefined; },
  };
})();
