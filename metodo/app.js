/* Central de Conteúdos AVANER — Método AVANER
   Conteúdo: metodo/dados-*.js (estático). Status: Supabase (com login) ou este navegador (sem login).
   Regras de bloqueio:
     bloqueio   → não aprova, não grava, não edita, não publica
     publicacao → pode aprovar, gravar e editar; não pode publicar
     atencao    → só aviso */
(function(){
'use strict';

const M = window.METODO;
const BUILD = M.campanha.build;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};

/* ---------- Catálogo ---------- */
const STAGES = ['aprovado', 'gravado', 'editado', 'publicado'];
const LABEL_REEL = {aprovado:'Aprovado', gravado:'Gravado', editado:'Editado', publicado:'Publicado'};
const LABEL_AD = {aprovado:'Aprovado', gravado:'Produzido', editado:'No gerenciador', publicado:'No ar'};
const WAIVABLE = ['N1', 'N2', 'E1'];          // dispensados quando a peça usa a versão segura (sem números)
const SEV_LABEL = {bloqueio:'Bloqueio', publicacao:'Trava publicação', atencao:'Atenção'};
const PEND = {}; M.pendencias.forEach(p => PEND[p.id] = p);
const ITEMS = {};
M.reels.forEach(r => { r.tipo = 'reel'; ITEMS[r.id] = r; });
M.ads.forEach(a => { a.tipo = 'ad'; a.tema = a.nome; ITEMS[a.id] = a; });
M.extras.forEach(x => { x.tipo = 'extra'; ITEMS[x.id] = x; });
const dateBR = iso => iso ? iso.slice(8,10)+'/'+iso.slice(5,7) : '';
const WEEKDAY = ['dom','seg','ter','qua','qui','sex','sáb'];
const isoOf = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const parseISO = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d, 12); };
function hoje(){
  const q = new URLSearchParams(location.search).get('hoje');
  return (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) ? q : isoOf(new Date());
}
const ts = s => Date.parse(s || '') || 0;
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);

/* ---------- Estado ---------- */
const DIRTY0 = () => ({exec:{}, pend:{}, res:{}});
const state = {
  exec: store.get('metodo-exec', {}),
  pend: store.get('metodo-pend', {}),
  res:  store.get('metodo-res', {}),
  base: store.get('metodo-base', DIRTY0()),      // updated_at da última versão do banco que este navegador conhece
  dirty: store.get('metodo-dirty', DIRTY0()),    // fila de alterações ainda não confirmadas pelo banco: {base, autor, seq}
  mode: 'local',          // local | remoto
  user: null, aprovador: false,
  offline: false,
  avisos: [],             // conflitos e recusas do banco, mostrados na faixa
  regrasAviso: '',
  view: 'hoje',
  detail: null, detailMode: 'roteiro',
  reelTab: 'reels',
  pendingLocal: null      // alterações feitas sem login (ou por outra conta), aguardando decisão
};
// Compatibilidade com a fila da versão anterior (dirty = true).
Object.keys(DIRTY0()).forEach(k => { state.dirty[k] = state.dirty[k] || {}; state.base[k] = state.base[k] || {};
  Object.keys(state.dirty[k]).forEach(id => { if(state.dirty[k][id] === true) state.dirty[k][id] = {base:null, autor:null, seq:1}; }); });
function persist(){
  store.set('metodo-exec', state.exec); store.set('metodo-pend', state.pend);
  store.set('metodo-res', state.res); store.set('metodo-dirty', state.dirty); store.set('metodo-base', state.base);
}
const execOf = id => state.exec[id] || {};
const pendStatus = id => (state.pend[id] && state.pend[id].status) || 'ABERTA';
const nDirty = () => Object.keys(state.dirty.exec).length + Object.keys(state.dirty.pend).length + Object.keys(state.dirty.res).length;

/* Quem pode marcar status:
   - logado e liberado (modo remoto): sim, o banco confere de novo;
   - banco indisponível (sem internet ou sem biblioteca): sim, fica na fila deste navegador e só vai ao banco com confirmação;
   - banco disponível mas sem login: não. Evita que alguém trabalhe achando que está sincronizado. */
function canEdit(){
  if(state.mode === 'remoto') return {ok:true};
  if(Sync.status === 'indisponivel') return {ok:true, local:true};
  if(Sync.status === 'carregando') return {ok:false, motivo:'Conectando ao banco… tente de novo em alguns segundos.'};
  return {ok:false, motivo:'Entre (botão Entrar) para marcar status. Sem login, nada é salvo, para todos verem os mesmos dados.'};
}

/* ---------- Regras de bloqueio (as mesmas regras também estão no banco) ---------- */
function openDeps(item){
  const ex = execOf(item.id);
  return (item.deps || []).filter(d => PEND[d] && pendStatus(d) !== 'LIBERADA')
    .filter(d => !(ex.versao_segura && item.alt_seguro && WAIVABLE.includes(d)));
}
function blockInfo(item){
  const out = {bloqueio:[], publicacao:[], atencao:[]};
  openDeps(item).forEach(d => out[PEND[d].severidade].push(d));
  return out;
}
function canSet(item, stage){
  if(item.tipo === 'extra') return {ok:false, motivo:'Tema do banco editorial: crie o roteiro antes de produzir.'};
  const b = blockInfo(item);
  if(b.bloqueio.length) return {ok:false, motivo:'Bloqueado por '+b.bloqueio.join(', ')+'. Libere a pendência'+(item.alt_seguro ? ' ou use a versão segura' : '')+' antes de marcar.'};
  if(stage === 'publicado' && b.publicacao.length) return {ok:false, motivo:'Publicação travada por '+b.publicacao.join(', ')+'.'};
  return {ok:true};
}
function versionMismatch(item){
  const ex = execOf(item.id);
  return !!(ex.gravado && ex.versao_gravada && ex.versao_gravada !== item.versao);
}
const ganchoTemp = {};
function ganchoEscolhido(item){
  const ex = execOf(item.id);
  return ganchoTemp[item.id] || ex.gancho_escolhido || item.gancho_padrao || 'A';
}

/* ---------- Gravação de status ---------- */
function touch(kind, key, row){
  row.updated_at = new Date().toISOString();
  state[kind][key] = row;
  const d = state.dirty[kind][key];
  if(d) d.seq = (d.seq || 0) + 1;
  else state.dirty[kind][key] = {base: state.base[kind][key] || null, autor: state.user ? state.user.email : null, seq: 1};
  persist();
  Sync.push(kind, key);
}
function setStage(id, stage, value){
  const item = ITEMS[id];
  if(!item || !STAGES.includes(stage)) return {ok:false, motivo:'Peça ou etapa inválida.'};
  const e = canEdit(); if(!e.ok) return e;
  if(value){ const c = canSet(item, stage); if(!c.ok) return c; }
  const row = Object.assign({}, execOf(id));
  const idx = STAGES.indexOf(stage);
  const today = hoje();
  STAGES.forEach((s, i) => {
    if(value && i <= idx && !row[s]){ row[s] = true; row[s+'_em'] = today; }
    if(!value && i >= idx){ row[s] = false; row[s+'_em'] = null; }
  });
  if(value && idx >= 1 && !execOf(id).gravado){
    row.versao_gravada = item.versao;
    row.gancho_usado = ganchoEscolhido(item);
  }
  if(!row.gravado){ row.versao_gravada = null; row.gancho_usado = null; }
  touch('exec', id, row);
  renderAll();
  return {ok:true, local: !!e.local};
}
function setExecField(id, field, value){
  const e = canEdit(); if(!e.ok){ renderAll(); return e; }
  if(field === 'versao_segura' && value && state.mode === 'remoto' && !state.aprovador){ renderAll(); return {ok:false, motivo:'Só o aprovador autoriza a versão segura.'}; }
  const row = Object.assign({}, execOf(id));
  row[field] = value;
  touch('exec', id, row);
  renderAll();
  return {ok:true};
}
function setPend(id, status, obs){
  if(!PEND[id]) return {ok:false, motivo:'Pendência inexistente.'};
  const e = canEdit(); if(!e.ok) return e;
  if(status === 'LIBERADA' && !String(obs || '').trim()) return {ok:false, motivo:'Escreva o que foi confirmado, por quem e quando antes de liberar.'};
  const cur = state.pend[id] || {};
  if(state.mode === 'remoto' && !state.aprovador && (status === 'LIBERADA' && cur.status !== 'LIBERADA' || (cur.status === 'LIBERADA' && status === 'LIBERADA' && (obs || '') !== (cur.obs || ''))))
    return {ok:false, motivo:'Só o aprovador libera pendências ou altera o registro de uma pendência liberada.'};
  touch('pend', id, {status, obs: obs || ''});
  renderAll();
  return {ok:true};
}
function setRes(key, field, value){
  const e = canEdit(); if(!e.ok){ renderResultados(); return e; }
  const cur = state.res[key] || {dados:{}};
  const dados = Object.assign({}, cur.dados);
  if(value === '' || value == null) delete dados[field]; else dados[field] = value;
  touch('res', key, {dados});
  renderResultados();
  return {ok:true};
}

/* ---------- Sincronização (Supabase) ----------
   Cada alteração guarda a versão do banco em que foi baseada (base = updated_at).
   O envio só grava se o registro no banco ainda estiver nessa versão. Se outra pessoa alterou antes,
   nada é sobrescrito: a central traz a versão do banco e avisa quem alterou. */
const TABLES = {exec:{name:'metodo_execucao', key:'item_id'}, pend:{name:'metodo_pendencias', key:'id'}, res:{name:'metodo_resultados', key:'item_id'}};
const EXEC_COLS = ['aprovado','aprovado_em','gravado','gravado_em','editado','editado_em','publicado','publicado_em','versao_gravada','gancho_usado','gancho_escolhido','versao_segura','notas'];
function toDb(kind, key, row){
  const t = TABLES[kind]; const out = {}; out[t.key] = key;
  if(kind === 'exec') EXEC_COLS.forEach(c => { if(row[c] !== undefined) out[c] = row[c]; });
  if(kind === 'pend'){ out.status = row.status; out.obs = row.obs || null; }
  if(kind === 'res') out.dados = row.dados || {};
  return out;
}
function fromDb(kind, r){
  const out = {updated_at: r.updated_at, updated_by: r.updated_by || null};
  if(kind === 'exec') EXEC_COLS.forEach(c => out[c] = r[c]);
  if(kind === 'pend'){ out.status = r.status; out.obs = r.obs || ''; }
  if(kind === 'res') out.dados = r.dados || {};
  return out;
}
const isNetErr = e => !!e && !e.code && /fetch|network|load failed|timeout|offline/i.test(String(e.message || e));
const hhmm = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}); };
const cleanMsg = m => String(m || '').replace(/^METODO:\s*/, '');
const Sync = {
  sb: null, channel: null, lastError: '', status: 'carregando', inflight: {}, again: {},
  available(){ return !!this.sb; },
  cdnFail(){ this.status = 'indisponivel'; this.lastError = 'Biblioteca do Supabase não carregou (sem internet ou CDN bloqueada). Alterações ficam na fila deste navegador.'; renderAll(); },
  init(){
    const cfg = window.SUPABASE_CONFIG;
    if(!window.supabase || !cfg || !cfg.url || !cfg.anonKey){ this.status = 'indisponivel'; this.lastError = 'Supabase não configurado.'; renderAll(); return; }
    try{
      this.sb = window.supabase.createClient(cfg.url, cfg.anonKey, {auth:{persistSession:true, autoRefreshToken:true, storageKey:'metodo-auth'}, db:{retry:false}});
    }catch(e){ this.status = 'indisponivel'; this.lastError = 'Falha ao iniciar o Supabase: '+e.message; renderAll(); return; }
    this.status = 'pronto';
    this.sb.auth.onAuthStateChange((ev, session) => {
      if(ev === 'SIGNED_OUT'){ this.toLocal(); }
      else if(session && this._sessionEmail !== session.user.email){ setTimeout(() => this.onSession(session), 0); }
    });
    this.sb.auth.getSession().then(({data}) => {
      if(data && data.session) this.onSession(data.session); else renderAll();
    }).catch(e => { this.lastError = e.message; renderAll(); });
    window.addEventListener('online', () => { state.offline = false; if(state.mode === 'remoto') this.reconnect(); });
    window.addEventListener('offline', () => { state.offline = true; renderConn(); });
    setInterval(() => { if(state.mode === 'remoto' && (nDirty() || this._needLoad)) this.reconnect(); }, 30000);
    renderAll();
  },
  async login(email, pass){
    if(!this.sb) return {ok:false, motivo:'Supabase indisponível.'};
    const {data, error} = await this.sb.auth.signInWithPassword({email, password: pass});
    if(error) return {ok:false, motivo: /invalid login credentials/i.test(error.message) ? 'E-mail ou senha incorretos.' : error.message};
    await this.onSession(data.session);
    return {ok:true};
  },
  async logout(){ if(this.sb) await this.sb.auth.signOut(); this.toLocal(); },
  toLocal(){
    this._sessionEmail = null;
    state.user = null; state.aprovador = false; state.mode = 'local'; state.pendingLocal = null; state.syncing = false;
    if(this.channel){ try{ this.sb.removeChannel(this.channel); }catch(e){} this.channel = null; }
    renderAll();
  },
  async onSession(session){
    if(this._sessionEmail === session.user.email && state.user) return;
    this._sessionEmail = session.user.email;
    state.user = {email: session.user.email};
    this.lastError = '';
    state.mode = 'remoto'; state.syncing = true;   // alterações feitas agora vão para a fila desta conta
    renderAll();
    try{
      const m = await this.sb.rpc('metodo_is_membro');
      if(m.error) throw m.error;
      if(m.data !== true){ this.lastError = 'O e-mail '+session.user.email+' entrou, mas não está liberado na tabela metodo_membros. Nada foi gravado no banco.'; state.mode = 'local'; state.syncing = false; renderAll(); return; }
      const a = await this.sb.rpc('metodo_pode_aprovar');
      state.aprovador = !a.error && a.data === true;
      await this.checkRegras();
      await this.loadRemote();
      this.subscribe();
    }catch(e){
      const msg = String(e.message || e);
      if(isNetErr(e)){   // sessão válida, mas sem conexão: segue com a cópia deste navegador e a fila
        state.mode = 'remoto'; state.offline = true; state.syncing = false; this._needLoad = true; renderAll(); return;
      }
      state.syncing = false;
      this.lastError = /does not exist|schema cache|42P01|42883|PGRST202|PGRST205/.test(msg) ? 'As tabelas do Método ainda não existem no Supabase. Rode supabase/metodo-schema.sql e supabase/metodo-regras.sql.' : 'Erro ao carregar o banco: '+msg;
      state.mode = 'local'; renderAll();
    }
  },
  async checkRegras(){
    const r = await this.sb.from('metodo_dependencias').select('item_id,dep_id').eq('ativo', true);
    if(r.error){ state.regrasAviso = 'Não consegui ler as regras de bloqueio do banco ('+r.error.message+'). Rode supabase/metodo-regras.sql.'; return; }
    const banco = new Set((r.data || []).map(x => x.item_id+':'+x.dep_id));
    const local = new Set(); M.reels.concat(M.ads).forEach(i => (i.deps || []).forEach(d => local.add(i.id+':'+d)));
    const dif = [...local].filter(x => !banco.has(x)).concat([...banco].filter(x => !local.has(x)));
    state.regrasAviso = dif.length ? 'As regras de bloqueio do banco não batem com esta versão da central ('+dif.length+' diferença(s), ex.: '+dif.slice(0, 3).join(', ')+'). Rode supabase/metodo-regras.sql.' : '';
  },
  async loadRemote(){
    const me = state.user && state.user.email;
    const fresh = {}, freshBase = {};
    for(const kind of Object.keys(TABLES)){
      const t = TABLES[kind];
      const {data, error} = await this.sb.from(t.name).select('*');
      if(error) throw error;
      fresh[kind] = {}; freshBase[kind] = {};
      (data || []).forEach(r => { fresh[kind][r[t.key]] = fromDb(kind, r); freshBase[kind][r[t.key]] = r.updated_at; });
    }
    // Fila: o que este usuário fez logado volta para envio automático (com checagem de versão).
    // O que foi feito sem login, ou por outra conta neste navegador, só vai com confirmação.
    const pending = DIRTY0(); let nPending = 0;
    for(const kind of Object.keys(TABLES)) for(const k of Object.keys(state.dirty[kind])){
      const d = state.dirty[kind][k];
      if(d.autor && d.autor === me) fresh[kind][k] = state[kind][k];
      else { pending[kind][k] = {row: state[kind][k], base: d.base}; delete state.dirty[kind][k]; nPending++; }
    }
    Object.keys(TABLES).forEach(kind => { state[kind] = fresh[kind]; state.base[kind] = freshBase[kind]; });
    if(nPending) state.pendingLocal = pending;
    state.mode = 'remoto'; state.offline = false; state.syncing = false; this._needLoad = false;
    persist(); renderAll();
    await this.retry();
  },
  async reconnect(){
    if(this._needLoad && this._sessionEmail){
      try{
        const m = await this.sb.rpc('metodo_is_membro'); if(m.error) throw m.error;
        if(m.data !== true){ this.lastError = 'O e-mail '+this._sessionEmail+' não está liberado na tabela metodo_membros.'; state.mode = 'local'; renderAll(); return; }
        const a = await this.sb.rpc('metodo_pode_aprovar'); state.aprovador = !a.error && a.data === true;
        await this.checkRegras();
        this._needLoad = false;
        this.subscribe();
      }catch(e){ if(isNetErr(e)){ state.offline = true; renderConn(); return; } this.lastError = 'Erro ao reconectar: '+(e.message || e); renderConn(); return; }
    }
    await this.refresh();
  },
  async refresh(){ try{ await this.loadRemote(); }catch(e){ if(isNetErr(e)) state.offline = true; else this.lastError = 'Erro ao atualizar: '+(e.message || e); renderConn(); } },
  async sendPendingLocal(){
    const p = state.pendingLocal; if(!p || state.mode !== 'remoto') return;
    state.pendingLocal = null;
    for(const kind of Object.keys(p)) for(const k of Object.keys(p[kind])){
      state[kind][k] = p[kind][k].row;
      state.dirty[kind][k] = {base: p[kind][k].base || null, autor: state.user.email, seq: 1};
    }
    persist(); renderAll();
    await this.retry();
  },
  discardPendingLocal(){ state.pendingLocal = null; persist(); renderAll(); },
  dismissAvisos(){ state.avisos = []; renderConn(); if(state.detail) renderDetail(); },
  async push(kind, key){
    if(state.mode !== 'remoto' || !this.sb){ renderConn(); return; }
    const id = kind+':'+key;
    if(this.inflight[id]){ this.again[id] = true; return; }
    const d = state.dirty[kind][key]; if(!d) return;
    if(d.autor !== state.user.email) return;
    this.inflight[id] = true;
    try{
      const t = TABLES[kind]; const seq = d.seq;
      const row = toDb(kind, key, state[kind][key] || {});
      let res;
      if(d.base){ const upd = Object.assign({}, row); delete upd[t.key]; res = await this.sb.from(t.name).update(upd).eq(t.key, key).eq('updated_at', d.base).select(); }
      else res = await this.sb.from(t.name).insert(row).select();
      if(res.error){
        if(isNetErr(res.error)){ state.offline = true; renderConn(); return; }
        if(res.error.code === '23505') return await this.resolve(kind, key, 'conflito');
        return await this.resolve(kind, key, 'recusa', cleanMsg(res.error.message));
      }
      if(!res.data || !res.data.length) return await this.resolve(kind, key, 'conflito');
      const back = res.data[0];
      state.offline = false;
      state.base[kind][key] = back.updated_at;
      const cur = state.dirty[kind][key];
      if(cur && cur.seq !== seq){ cur.base = back.updated_at; this.again[id] = true; }
      else { delete state.dirty[kind][key]; state[kind][key] = fromDb(kind, back); }
      persist(); renderAll();
    } catch(e){
      if(isNetErr(e)) state.offline = true; else this.lastError = 'Falha ao salvar '+key+': '+(e.message || e);
      renderConn();
    } finally {
      delete this.inflight[id];
      if(this.again[id]){ delete this.again[id]; this.push(kind, key); }
    }
  },
  async resolve(kind, key, tipo, msg){
    const t = TABLES[kind];
    const r = await this.sb.from(t.name).select('*').eq(t.key, key);
    if(r.error){ if(isNetErr(r.error)) state.offline = true; renderConn(); return; }
    const srv = r.data && r.data[0];
    if(srv){ state[kind][key] = fromDb(kind, srv); state.base[kind][key] = srv.updated_at; }
    else { delete state[kind][key]; delete state.base[kind][key]; }
    delete state.dirty[kind][key];
    state.avisos.push(tipo === 'conflito'
      ? key+': sua alteração não foi gravada porque '+(srv && srv.updated_by ? srv.updated_by : 'outra pessoa')+' alterou antes'+(srv ? ' ('+hhmm(srv.updated_at)+')' : '')+'. A tela mostra agora o que está no banco; confira e refaça se precisar.'
      : key+': o banco recusou a alteração — '+msg+' A tela voltou ao que está no banco.');
    persist(); renderAll();
  },
  async retry(){
    for(const kind of Object.keys(TABLES)) for(const k of Object.keys(state.dirty[kind])) await this.push(kind, k);
    renderAll();
  },
  subscribe(){
    if(this.channel) return;
    let ch = this.sb.channel('metodo-sync');
    Object.keys(TABLES).forEach(kind => {
      const t = TABLES[kind];
      ch = ch.on('postgres_changes', {event:'*', schema:'public', table:t.name}, payload => {
        const r = payload.new; if(!r || !r[t.key]) return;
        const k = r[t.key];
        if(state.dirty[kind][k]) return;             // alteração local pendente: o envio vai checar a versão
        if(ts(r.updated_at) >= ts(state.base[kind][k])){ state[kind][k] = fromDb(kind, r); state.base[kind][k] = r.updated_at; persist(); renderAll(); }
      });
    });
    this.channel = ch.subscribe(st => {
      const was = this.rt; this.rt = st; renderConn();
      if(st === 'SUBSCRIBED' && was && was !== 'SUBSCRIBED') this.refresh();   // reconectou: busca o que mudou enquanto esteve fora
    });
  }
};
window.MetodoSync = Sync;

/* ---------- Componentes ---------- */
function statusPills(item){
  if(item.tipo === 'extra') return '';
  const b = blockInfo(item); let h = '';
  if(b.bloqueio.length) h += '<span class="pill bloq" title="'+esc(b.bloqueio.map(d => d+': '+PEND[d].assunto).join(' · '))+'">BLOQUEADO · '+b.bloqueio.join(' ')+'</span>';
  if(b.publicacao.length) h += '<span class="pill pub" title="'+esc(b.publicacao.map(d => d+': '+PEND[d].assunto).join(' · '))+'">Publicação travada · '+b.publicacao.join(' ')+'</span>';
  if(b.atencao.length) h += '<span class="pill atn">Atenção · '+b.atencao.join(' ')+'</span>';
  if(versionMismatch(item)) h += '<span class="pill ver">Roteiro mudou: gravado v'+esc(execOf(item.id).versao_gravada)+', atual v'+esc(item.versao)+'</span>';
  if(execOf(item.id).versao_segura) h += '<span class="pill ok">Versão segura</span>';
  return h;
}
function stageBar(item){
  const ex = execOf(item.id);
  return '<div class="steps" aria-label="Etapas">'+STAGES.map(s => '<i class="'+(ex[s] ? 'on' : '')+'" title="'+(item.tipo === 'ad' ? LABEL_AD : LABEL_REEL)[s]+'"></i>').join('')+'</div>';
}
function stageName(item){
  const ex = execOf(item.id); const L = item.tipo === 'ad' ? LABEL_AD : LABEL_REEL;
  for(let i = STAGES.length-1; i >= 0; i--) if(ex[STAGES[i]]) return L[STAGES[i]];
  return 'A produzir';
}
function nextAction(item){
  if(item.tipo === 'extra') return {txt:'Banco editorial: precisa de roteiro', cls:'res'};
  const ex = execOf(item.id); const b = blockInfo(item); const L = item.tipo === 'ad' ? LABEL_AD : LABEL_REEL;
  if(ex.publicado) return {txt:(item.tipo === 'ad' ? 'No ar ✓' : 'Publicado ✓'), cls:'ok'};
  if(b.bloqueio.length) return {txt:'Bloqueado: falta '+b.bloqueio.join(', '), cls:'bloq'};
  if(!ex.aprovado) return {txt:'Próximo: aprovar o roteiro', cls:''};
  if(!ex.gravado) return {txt:'Próximo: '+(item.tipo === 'ad' ? 'produzir' : 'gravar'), cls:''};
  if(!ex.editado) return {txt:'Próximo: '+(item.tipo === 'ad' ? 'subir no gerenciador' : 'editar'), cls:''};
  if(b.publicacao.length) return {txt:'Pronto, mas publicação travada: falta '+b.publicacao.join(', '), cls:'pub'};
  return {txt:'Próximo: '+(item.tipo === 'ad' ? 'colocar no ar' : 'publicar'), cls:''};
}
function reelCard(r){
  const f = M.formatos[r.formato];
  return '<button type="button" class="card" data-open="'+r.id+'">'+
    '<div class="head"><span class="code">'+r.id+'</span><span class="title">'+esc(r.tema)+'</span></div>'+
    '<div class="head"><span class="pill">'+dateBR(r.data)+' '+esc(r.hora)+'</span><span class="pill">Fase '+r.fase+'</span><span class="pill">'+esc(f ? r.formato+'. '+f.nome : '')+'</span>'+(r.classe === 'reserva' ? '<span class="pill res">Reserva</span>' : '')+'<span class="pill">'+esc(M.lotes[r.lote] ? M.lotes[r.lote].nome : r.lote)+'</span></div>'+
    '<p class="hook">“'+esc(r.gancho)+'”</p>'+
    '<div class="head">'+statusPills(r)+'</div>'+
    '<div class="meta">'+esc(nextAction(r).txt)+' · '+esc(r.duracao)+' · v'+esc(r.versao)+'</div>'+stageBar(r)+'</button>';
}
function adCard(a){
  return '<button type="button" class="card" data-open="'+a.id+'">'+
    '<div class="head"><span class="code">'+a.id+'</span><span class="title">'+esc(a.nome)+'</span></div>'+
    '<div class="head"><span class="pill">'+esc(a.fase)+'</span><span class="pill">'+esc(a.periodo)+'</span>'+(a.base ? '<span class="pill">Base '+a.base+'</span>' : '')+(/Reserva/.test(a.ativar) ? '<span class="pill res">Reserva</span>' : '')+'</div>'+
    '<p class="hook">“'+esc(a.gancho)+'”</p>'+
    '<div class="head">'+statusPills(a)+'</div>'+
    '<div class="meta">'+esc(a.ativar)+' · '+esc(a.duracao)+'</div>'+stageBar(a)+'</button>';
}
function extraCard(x){
  const f = M.formatos[x.formato];
  return '<button type="button" class="card" data-open="'+x.id+'">'+
    '<div class="head"><span class="code">'+x.id+'</span><span class="title">'+esc(x.tema)+'</span>'+(x.prioridade ? '<span class="pill ok">Prioridade</span>' : '')+'</div>'+
    '<div class="head"><span class="pill">'+esc(f ? x.formato+'. '+f.nome : '')+'</span><span class="pill">'+esc(x.uso)+'</span>'+(x.deps && x.deps.length ? '<span class="pill atn">Depende de '+x.deps.join(', ')+'</span>' : '')+'</div>'+
    '<p class="hook">“'+esc(x.gancho)+'”</p><div class="meta">Banco editorial · sem roteiro completo</div></button>';
}
function markText(s){
  return esc(s).replace(/\[[^\]]+\]/g, m => '<span class="ph" title="Preencher com dado confirmado">'+m+'</span>')
    .replace(/\((só se for verdade|só com [^)]+)\)/g, m => '<span class="flag" title="Conferir antes de gravar">'+m+'</span>');
}
function linkPend(id){ return '<button type="button" class="pill '+(pendStatus(id) === 'LIBERADA' ? 'ok' : ({bloqueio:'bloq', publicacao:'pub', atencao:'atn'})[PEND[id] ? PEND[id].severidade : 'atencao'])+'" data-goto-pend="'+id+'">'+id+(pendStatus(id) === 'LIBERADA' ? ' ✓' : '')+'</button>'; }

/* ---------- Conexão ---------- */
function renderConn(){
  const el = $('#conn'); const btn = $('#loginBtn');
  if(state.user){ btn.textContent = 'Sair ('+state.user.email+')'; btn.disabled = false; }
  else { btn.textContent = 'Entrar'; btn.disabled = !Sync.available(); btn.title = Sync.available() ? '' : 'Banco indisponível nesta página'; }
  let cls = 'local', h = '';
  const n = nDirty();
  if(state.mode === 'remoto'){
    cls = 'ok';
    h = '● Sincronizado com o banco · '+esc(state.user.email)+(state.aprovador ? ' (aprovador)' : '')+(Sync.rt === 'SUBSCRIBED' ? ' · tempo real ativo' : ' · tempo real conectando');
    if(state.syncing){ cls = 'local'; h = '● Conectando ao banco como '+esc(state.user.email)+'… alterações ficam na fila até a conexão confirmar.'; }
    else if(state.offline){ cls = 'err'; h = '● Sem conexão. '+n+' alteração(ões) na fila deste navegador; serão enviadas quando a conexão voltar, sem sobrescrever o que outra pessoa alterou. <button class="btn small" type="button" data-act="retry">Tentar agora</button>'; }
    else if(n){ cls = 'local'; h += ' · enviando '+n+' alteração(ões)…'; }
  } else if(Sync.status === 'indisponivel'){
    h = '● Banco indisponível: as alterações ficam na fila deste navegador'+(n ? ' ('+n+')' : '')+' e só vão para o banco quando alguém entrar e confirmar o envio.';
  } else if(Sync.status === 'carregando'){
    h = '● Conectando ao banco…';
  } else {
    h = '● Você não entrou. Pode ler tudo e usar o teleprompter; para marcar status, clique em Entrar.'+(n ? ' Há '+n+' alteração(ões) antigas na fila deste navegador.' : '');
  }
  if(Sync.lastError){ cls = 'err'; h += '<br>'+esc(Sync.lastError); }
  if(state.regrasAviso){ cls = 'err'; h += '<br>'+esc(state.regrasAviso); }
  if(state.pendingLocal){
    const k = Object.values(state.pendingLocal).reduce((acc, o) => acc + Object.keys(o).length, 0);
    const ids = [].concat(...Object.values(state.pendingLocal).map(o => Object.keys(o))).slice(0, 8).join(', ');
    h += '<br>'+k+' alteração(ões) feitas neste navegador fora desta conta ('+esc(ids)+'). Enviar só grava o que ninguém alterou depois; o resto é recusado e avisado. <button class="btn small" type="button" data-act="sendLocal">Enviar para o banco</button> <button class="btn small" type="button" data-act="discardLocal">Descartar</button>';
    if(cls === 'ok') cls = 'local';
  }
  if(state.avisos.length){
    cls = 'err';
    h += '<br>'+state.avisos.slice(-5).map(a => '⚠ '+esc(a)).join('<br>')+' <button class="btn small" type="button" data-act="dismissAvisos">Entendi</button>';
  }
  el.className = 'conn '+cls; el.innerHTML = h;
}

/* ---------- Hoje ---------- */
function faseDe(iso){
  if(iso < '2026-11-09') return 1; if(iso < '2026-11-17') return 2; if(iso <= M.campanha.fim_condicao) return 3; return 4;
}
function renderHoje(){
  const t = hoje(); const live = M.campanha.live;
  const dLive = daysBetween(t, live);
  const fase = faseDe(t); const F = M.fases[fase];
  const doDia = M.reels.filter(r => r.data === t);
  const prox = M.reels.filter(r => r.data > t && daysBetween(t, r.data) <= 7);
  const adsAtivos = M.ads.filter(a => a.inicio <= t && (!a.fim || a.fim >= t));
  const fila = M.reels.concat(M.ads).filter(i => !execOf(i.id).gravado && !blockInfo(i).bloqueio.length)
    .sort((a, b) => (a.lote || 'L9').localeCompare(b.lote || 'L9') || (a.classe === 'reserva') - (b.classe === 'reserva') || String(a.data || a.inicio).localeCompare(String(b.data || b.inicio)));
  const bloqProx = M.reels.filter(r => r.data >= t && daysBetween(t, r.data) <= 7 && blockInfo(r).bloqueio.length);
  const atrasados = M.reels.filter(r => r.data < t && r.classe !== 'reserva' && !execOf(r.id).publicado);
  const versoes = M.reels.concat(M.ads).filter(versionMismatch);
  const nBloq = M.pendencias.filter(p => p.severidade === 'bloqueio' && pendStatus(p.id) !== 'LIBERADA').length;
  let h = '<p class="eyebrow">Hoje · '+WEEKDAY[parseISO(t).getDay()]+' '+dateBR(t)+'</p><h2>Painel de hoje</h2>'+
    '<p class="lede">Fase '+fase+' · '+esc(F.nome)+' ('+esc(F.periodo)+'). CTA da fase: '+esc(F.cta)+'</p>'+
    '<div class="today-hero">'+
      '<div class="hero-box"><b>'+(dLive > 0 ? dLive : dLive === 0 ? 'HOJE' : '—')+'</b><span>'+(dLive > 0 ? 'dias até a apresentação de '+dateBR(live)+', '+esc(M.campanha.live_hora) : dLive === 0 ? 'apresentação às '+esc(M.campanha.live_hora) : 'apresentação já aconteceu')+'</span></div>'+
      '<div class="hero-box"><b>'+doDia.length+'</b><span>Reel(s) programado(s) para hoje</span></div>'+
      '<div class="hero-box"><b>'+nBloq+'</b><span>bloqueios abertos</span></div>'+
      '<div class="hero-box"><b>'+M.reels.filter(r => execOf(r.id).gravado).length+'/30</b><span>Reels gravados</span></div>'+
    '</div>';
  if(versoes.length) h += '<div class="alertbox"><b>Roteiro mudou depois da gravação:</b> '+versoes.map(i => '<button type="button" class="pill ver" data-open="'+i.id+'">'+i.id+'</button>').join(' ')+'. Confira se precisa regravar.</div>';
  if(bloqProx.length) h += '<div class="alertbox"><b>Programados nos próximos 7 dias e ainda bloqueados:</b> '+bloqProx.map(r => '<button type="button" class="pill bloq" data-open="'+r.id+'">'+r.id+' · '+dateBR(r.data)+'</button>').join(' ')+'</div>';
  if(atrasados.length) h += '<div class="warnbox"><b>Data passou e não está publicado:</b> '+atrasados.map(r => '<button type="button" class="pill pub" data-open="'+r.id+'">'+r.id+'</button>').join(' ')+'</div>';
  h += '<div class="section-block"><h3>Para publicar hoje</h3>'+(doDia.length ? '<div class="grid">'+doDia.map(reelCard).join('')+'</div>' : '<p class="empty">Nenhum Reel programado para hoje.</p>')+'</div>';
  h += '<div class="section-block"><h3>Próximos 7 dias</h3>'+(prox.length ? '<div class="grid">'+prox.map(reelCard).join('')+'</div>' : '<p class="empty">Nada programado nos próximos 7 dias.</p>')+'</div>';
  h += '<div class="section-block"><h3>Anúncios do período</h3>'+(adsAtivos.length ? '<div class="grid">'+adsAtivos.map(adCard).join('')+'</div>' : '<p class="empty">Nenhum anúncio no período de hoje. O teste começa em 26/10.</p>')+'</div>';
  h += '<div class="section-block"><h3>Fila de gravação (liberados, por lote)</h3>'+(fila.length ? '<div class="grid">'+fila.slice(0, 8).map(i => i.tipo === 'ad' ? adCard(i) : reelCard(i)).join('')+'</div><p class="count">'+fila.length+' peça(s) liberada(s) para gravar. Mostrando as 8 primeiras.</p>' : '<p class="empty">Nenhuma peça liberada aguardando gravação.</p>')+'</div>';
  $('#view-hoje').innerHTML = h;
}

/* ---------- Calendário ---------- */
function renderCalendario(){
  const t = hoje(); const showRes = store.get('metodo-cal-res', true);
  let h = '<p class="eyebrow">Seu plano de trabalho</p><h2>Calendário</h2><p class="lede">Reels de 31/10 a 29/11 e início dos anúncios. Cada peça mostra o próximo passo. Borda verde: publicado. Borda vermelha: bloqueado. Tracejado: reserva.</p>'+
    '<details class="howto" '+(store.get('metodo-howto-fechado', false) ? '' : 'open')+'><summary>Como trabalhar pelo calendário</summary><ol>'+
      '<li><b>Clique numa peça</b> do dia. Abre a ficha com o roteiro, o guia, o cenário e a câmera.</li>'+
      '<li>Cada peça mostra o <b>próximo passo</b>: aprovar, gravar, editar ou publicar. Vermelho = bloqueado (a ficha diz o que falta e qual é a alternativa).</li>'+
      '<li>Para gravar, use <b>▶ Teleprompter</b> (texto rolando) ou <b>▶ Modo guia</b> (só os 5 tópicos, para falar com as suas palavras).</li>'+
      '<li>Depois de cada etapa, clique em <b>Gravado</b>, <b>Editado</b> ou <b>Publicado</b> na ficha. Fica salvo para todos.</li>'+
      '<li>Grave com antecedência: a aba <b>Lotes</b> mostra o que dá para gravar junto, e a aba <b>Pendências</b> mostra o que falta para destravar.</li>'+
      '</ol></details>'+
    '<div class="filters"><label class="small"><input type="checkbox" id="calRes" '+(showRes ? 'checked' : '')+'> Mostrar reservas</label></div>';
  h += '<div class="cal-week">'+['seg','ter','qua','qui','sex','sáb','dom'].map(d => '<div class="cal-head">'+d+'</div>').join('')+'</div>';
  const start = parseISO('2026-10-26'), end = parseISO('2026-11-29');
  for(let d = new Date(start); d <= end; ){
    h += '<div class="cal-week">';
    for(let i = 0; i < 7; i++){
      const iso = isoOf(d);
      const reels = M.reels.filter(r => r.data === iso && (showRes || r.classe !== 'reserva'));
      const adsIni = M.ads.filter(a => a.inicio === iso);
      const out = iso < '2026-10-26' || iso > '2026-11-29';
      h += '<div class="cal-day'+(iso === t ? ' today' : '')+(iso === M.campanha.live ? ' live' : '')+(out || (!reels.length && !adsIni.length && iso !== M.campanha.live) ? ' out' : '')+'" data-day="'+iso+'">'+
        '<div class="d"><span>'+WEEKDAY[d.getDay()]+' '+dateBR(iso)+'</span>'+(iso === M.campanha.live ? '<span>LIVE '+esc(M.campanha.live_hora)+'</span>' : '')+(iso === M.campanha.fim_condicao ? '<span>fim turma</span>' : '')+'</div>'+
        reels.map(r => { const b = blockInfo(r); const ex = execOf(r.id);
          return '<button type="button" class="cal-item'+(ex.publicado ? ' st-pub' : b.bloqueio.length ? ' st-bloq' : '')+(r.classe === 'reserva' ? ' res' : '')+'" data-open="'+r.id+'"><b>'+r.id+'</b> '+esc(r.hora)+' · '+esc(r.tema)+'<br><span class="na '+nextAction(r).cls+'">'+esc(nextAction(r).txt)+'</span></button>'; }).join('')+
        (adsIni.length ? '<div class="cal-ads">▶ anúncios: '+adsIni.map(a => a.id).join(', ')+'</div>' : '')+
        '</div>';
      d.setDate(d.getDate()+1);
    }
    h += '</div>';
  }
  $('#view-calendario').innerHTML = h;
  $('#calRes').onchange = e => { store.set('metodo-cal-res', e.target.checked); renderCalendario(); };
  const ht = $('#view-calendario .howto'); if(ht) ht.addEventListener('toggle', () => store.set('metodo-howto-fechado', !ht.open));
}

/* ---------- Reels ---------- */
const reelFilter = store.get('metodo-reel-filter', {fase:'', lote:'', formato:'', classe:'', status:'', q:''});
function matchStatus(i, st){
  if(!st) return true;
  const ex = execOf(i.id); const b = blockInfo(i);
  if(st === 'bloqueado') return b.bloqueio.length > 0;
  if(st === 'liberado') return !b.bloqueio.length && !ex.gravado;
  if(st === 'versao') return versionMismatch(i);
  if(st === 'afazer') return !ex.aprovado;
  return !!ex[st] && (st === 'publicado' || !ex[STAGES[STAGES.indexOf(st)+1]]);
}
function renderReels(){
  const f = reelFilter;
  let h = '<p class="eyebrow">Biblioteca</p><h2>Reels</h2>'+
    '<div class="subtabs" role="tablist"><button type="button" role="tab" data-reeltab="reels" aria-selected="'+(state.reelTab === 'reels')+'">30 Reels (24 + 6 reservas)</button><button type="button" role="tab" data-reeltab="extras" aria-selected="'+(state.reelTab === 'extras')+'">Banco editorial (16)</button></div>';
  if(state.reelTab === 'extras'){
    h += '<p class="lede">Temas extras com gancho e formato. Antes de produzir, o tema ganha roteiro completo e entra na biblioteca com código próprio.</p><div class="grid">'+M.extras.map(extraCard).join('')+'</div>';
    $('#view-reels').innerHTML = h; return;
  }
  const opt = (v, l, cur) => '<option value="'+esc(v)+'"'+(String(cur) === String(v) ? ' selected' : '')+'>'+esc(l)+'</option>';
  h += '<div class="filters" id="reelFilters">'+
    '<input type="search" data-f="q" placeholder="Buscar..." value="'+esc(f.q)+'">'+
    '<select data-f="fase">'+opt('', 'Todas as fases', f.fase)+[1,2,3,4].map(n => opt(n, 'Fase '+n+' · '+M.fases[n].nome, f.fase)).join('')+'</select>'+
    '<select data-f="lote">'+opt('', 'Todos os lotes', f.lote)+Object.keys(M.lotes).map(k => opt(k, M.lotes[k].nome, f.lote)).join('')+'</select>'+
    '<select data-f="formato">'+opt('', 'Todos os formatos', f.formato)+Object.keys(M.formatos).map(k => opt(k, k+'. '+M.formatos[k].nome, f.formato)).join('')+'</select>'+
    '<select data-f="classe">'+opt('', 'Prioritários e reservas', f.classe)+opt('prioritario', 'Só prioritários', f.classe)+opt('reserva', 'Só reservas', f.classe)+'</select>'+
    '<select data-f="status">'+opt('', 'Qualquer status', f.status)+opt('liberado', 'Liberado para gravar', f.status)+opt('bloqueado', 'Bloqueado', f.status)+opt('afazer', 'Não aprovado', f.status)+opt('aprovado', 'Aprovado', f.status)+opt('gravado', 'Gravado', f.status)+opt('editado', 'Editado', f.status)+opt('publicado', 'Publicado', f.status)+opt('versao', 'Roteiro mudou após gravar', f.status)+'</select>'+
    '<button type="button" class="btn small" data-act="clearFilters">Limpar</button></div>';
  const q = f.q.trim().toLowerCase();
  const list = M.reels.filter(r => (!f.fase || r.fase == f.fase) && (!f.lote || r.lote === f.lote) && (!f.formato || r.formato == f.formato) && (!f.classe || r.classe === f.classe) && matchStatus(r, f.status) &&
    (!q || [r.id, r.tema, r.gancho, r.gancho_alt, r.roteiro.join(' '), r.legenda].join(' ').toLowerCase().includes(q)));
  h += '<p class="count">'+list.length+' de 30</p>'+(list.length ? '<div class="grid">'+list.map(reelCard).join('')+'</div>' : '<p class="empty">Nenhum Reel com esses filtros.</p>');
  $('#view-reels').innerHTML = h;
  $$('#reelFilters [data-f]').forEach(el => el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => {
    reelFilter[el.dataset.f] = el.value; store.set('metodo-reel-filter', reelFilter);
    const pos = el.tagName === 'INPUT' ? el.selectionStart : null;
    renderReels();
    if(pos !== null){ const n = $('#reelFilters [data-f="q"]'); n.focus(); try{ n.setSelectionRange(pos, pos); }catch(e){} }
  }));
}

/* ---------- Anúncios ---------- */
const VERBA = [
  {fase:'Teste', periodo:'26/10 a 08/11', valor:1500, nota:'AN01, AN02 e AN03; AN04 e AN05 só com números liberados.'},
  {fase:'Captação', periodo:'09/11 a 16/11', valor:3000, nota:'Os 2 ou 3 melhores do teste + AN06 e AN09. AN07, AN08 e AN10 conforme liberação e resultado.'},
  {fase:'Remarketing', periodo:'17/11 a 27/11', valor:500, nota:'AN11 e AN12. AN13 só com a condição aprovada (T1).'},
  {fase:'Reserva', periodo:'condicional', valor:5000, nota:'Só se o custo por inscrição e o custo por diagnóstico estiverem dentro da meta. Decisão do Michael.'}
];
function renderAnuncios(){
  const brl = v => 'R$ '+v.toLocaleString('pt-BR');
  let h = '<p class="eyebrow">Biblioteca</p><h2>Anúncios</h2><p class="lede">14 anúncios prontos, mas não todos no ar ao mesmo tempo. Todo link leva utm_content com o código do anúncio. Verba inicial: R$ 5.000, com reserva de R$ 5.000 condicionada aos indicadores.</p>'+
    '<div class="table-wrap"><table><thead><tr><th>Etapa</th><th>Período</th><th>Verba</th><th>Regra</th></tr></thead><tbody>'+
    VERBA.map(v => '<tr><td><b>'+v.fase+'</b></td><td>'+v.periodo+'</td><td class="mono">'+brl(v.valor)+'</td><td>'+esc(v.nota)+'</td></tr>').join('')+'</tbody></table></div>';
  ['Teste', 'Captação', 'Remarketing', 'Permanente'].forEach(fase => {
    const l = M.ads.filter(a => a.fase === fase);
    h += '<div class="section-block"><h3>'+fase+'</h3><div class="grid">'+l.map(adCard).join('')+'</div></div>';
  });
  $('#view-anuncios').innerHTML = h;
}

/* ---------- Lotes ---------- */
function renderLotes(){
  let h = '<p class="eyebrow">Produção</p><h2>Lotes de gravação</h2><p class="lede">Os lotes agrupam as peças pelo que cada uma precisa para ser gravada. Reservas entram se uma prioritária cair.</p>';
  Object.keys(M.lotes).forEach(k => {
    const L = M.lotes[k]; const reels = M.reels.filter(r => r.lote === k);
    const grav = reels.filter(r => execOf(r.id).gravado).length;
    const bloq = reels.filter(r => blockInfo(r).bloqueio.length).length;
    h += '<div class="section-block"><h3>'+esc(L.nome)+' · '+grav+'/'+reels.length+' gravados'+(bloq ? ' · '+bloq+' bloqueado(s)' : '')+'</h3><p class="muted small">'+esc(L.criterio)+'. Quando: '+esc(L.quando)+'.</p>'+
      '<div class="grid">'+reels.map(reelCard).join('')+(L.extras || []).map(id => extraCard(ITEMS[id])).join('')+'</div></div>';
  });
  $('#view-lotes').innerHTML = h;
}

/* ---------- Pendências ---------- */
function afetados(id){ return M.reels.concat(M.ads, M.extras).filter(i => (i.deps || []).includes(id)); }
function renderPendencias(){
  const open = M.pendencias.filter(p => pendStatus(p.id) !== 'LIBERADA');
  $('#pendBadge').textContent = open.filter(p => p.severidade === 'bloqueio').length || '';
  let h = '<p class="eyebrow">Auditoria</p><h2>Pendências e bloqueios</h2><p class="lede">Bloqueio: a peça não pode ser aprovada, gravada nem publicada. Trava publicação: pode gravar, não pode publicar. Atenção: só aviso. Para liberar, registre o que foi confirmado, por quem e quando. Só o aprovador libera.</p>'+(state.mode === 'remoto' && !state.aprovador ? '<div class="infobox">Você pode escrever registros e reabrir pendências. Liberar é com o aprovador.</div>' : '')+(canEdit().ok ? '' : '<div class="warnbox">'+esc(canEdit().motivo)+'</div>')+
    '<div class="stats">'+['bloqueio','publicacao','atencao'].map(s => '<div class="stat"><b>'+open.filter(p => p.severidade === s).length+'</b><span>'+SEV_LABEL[s]+' abertos</span></div>').join('')+'<div class="stat"><b>'+(M.pendencias.length - open.length)+'</b><span>Liberadas</span></div></div>';
  ['bloqueio','publicacao','atencao'].forEach(sev => {
    h += '<h3>'+SEV_LABEL[sev]+'</h3>';
    M.pendencias.filter(p => p.severidade === sev).forEach(p => {
      const st = state.pend[p.id] || {}; const lib = pendStatus(p.id) === 'LIBERADA';
      const af = afetados(p.id);
      h += '<div class="pend sev-'+sev+(lib ? ' liberada' : '')+'" id="pend-'+p.id+'">'+
        '<h4><span class="mono">'+p.id+'</span> · '+esc(p.assunto)+' '+(lib ? '<span class="pill ok">LIBERADA</span>' : '<span class="pill '+({bloqueio:'bloq', publicacao:'pub', atencao:'atn'})[sev]+'">ABERTA</span>')+'</h4>'+
        '<p><b>O que falta:</b> '+esc(p.falta)+'</p>'+
        '<p><b>Responsável:</b> '+esc(p.responsavel)+'</p>'+
        (p.alternativa ? '<p><b>Alternativa segura:</b> '+esc(p.alternativa)+'</p>' : '<p><b>Alternativa segura:</b> não há. Sem isso, a peça não sai.</p>')+
        '<p><b>Peças afetadas:</b> '+(af.length ? af.map(i => '<button type="button" class="pill" data-open="'+i.id+'">'+i.id+'</button>').join(' ') : 'nenhuma no momento')+'</p>'+
        '<textarea data-pend-obs="'+p.id+'" placeholder="Registro: o que foi confirmado, por quem e quando">'+esc(st.obs || '')+'</textarea>'+
        '<div class="row">'+(lib ? '<button type="button" class="btn small" data-pend-set="'+p.id+'" data-v="ABERTA">Reabrir</button>' : '<button type="button" class="btn small go" data-pend-set="'+p.id+'" data-v="LIBERADA">Marcar como liberada</button>')+
        '<button type="button" class="btn small" data-pend-save="'+p.id+'">Salvar registro</button><span class="msg" data-pend-msg="'+p.id+'">'+(st.updated_at ? 'Atualizado em '+new Date(st.updated_at).toLocaleString('pt-BR')+(st.updated_by ? ' por '+esc(st.updated_by) : '') : '')+'</span></div></div>';
    });
  });
  $('#view-pendencias').innerHTML = h;
}

/* ---------- Resultados ---------- */
const META = {cpl:17, diag:350, contrato:1400, conv:25, presenca:35};
function renderResultados(){
  const F = (state.res.FUNIL && state.res.FUNIL.dados) || {};
  const n = k => { const v = parseFloat(String(F[k] == null ? '' : F[k]).replace(',', '.')); return isFinite(v) ? v : null; };
  const brl = v => v == null ? '—' : 'R$ '+v.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
  const pct = v => v == null ? '—' : v.toLocaleString('pt-BR', {maximumFractionDigits:1})+'%';
  const div = (a, b) => (a != null && b) ? a / b : null;
  const inv = n('investimento'), ins = n('inscritos'), pre = n('presentes'), dr = n('diag_realizados'), ct = n('contratos');
  const cpl = div(inv, ins), cdiag = div(inv, dr), cct = div(inv, ct);
  const pres = div(pre, ins) != null ? div(pre, ins) * 100 : null;
  const conv = div(ct, dr) != null ? div(ct, dr) * 100 : null;
  const sem = (v, ok) => v == null ? '<span class="pill">sem dados</span>' : ok ? '<span class="pill ok">dentro</span>' : '<span class="pill bloq">fora</span>';
  const field = (k, l) => '<label class="stat"><span>'+l+'</span><input type="number" min="0" step="any" inputmode="decimal" data-res="FUNIL" data-k="'+k+'" value="'+esc(F[k] == null ? '' : F[k])+'" style="width:100%;margin-top:4px;padding:6px;border:1px solid var(--line);border-radius:6px;background:var(--paper-raised)"></label>';
  let h = '<p class="eyebrow">Controle</p><h2>Resultados</h2><p class="lede">Preencha os números reais. As metas são as da estratégia: custo por inscrição até R$ 17, custo por diagnóstico até R$ 350, custo por contrato até R$ 1.400, conversão base de 25% e comparecimento base de 35%.</p>'+
    (canEdit().ok ? '' : '<div class="warnbox">'+esc(canEdit().motivo)+'</div>')+'<h3>Funil da campanha</h3><div class="stats">'+field('investimento', 'Investimento em mídia (R$)')+field('inscritos', 'Inscritos')+field('presentes', 'Presentes na live')+field('diag_agendados', 'Diagnósticos agendados')+field('diag_realizados', 'Diagnósticos realizados')+field('contratos', 'Contratos fechados')+'</div>'+
    '<div class="table-wrap"><table><thead><tr><th>Indicador</th><th>Atual</th><th>Meta</th><th>Situação</th></tr></thead><tbody>'+
    '<tr><td>Custo por inscrição</td><td class="mono">'+brl(cpl)+'</td><td>até R$ 17,00</td><td>'+sem(cpl, cpl <= META.cpl)+'</td></tr>'+
    '<tr><td>Comparecimento</td><td class="mono">'+pct(pres)+'</td><td>base 35%</td><td>'+sem(pres, pres >= META.presenca)+'</td></tr>'+
    '<tr><td>Custo por diagnóstico</td><td class="mono">'+brl(cdiag)+'</td><td>até R$ 350,00</td><td>'+sem(cdiag, cdiag <= META.diag)+'</td></tr>'+
    '<tr><td>Diagnóstico → contrato</td><td class="mono">'+pct(conv)+'</td><td>base 25%</td><td>'+sem(conv, conv >= META.conv)+'</td></tr>'+
    '<tr><td>Custo por contrato</td><td class="mono">'+brl(cct)+'</td><td>até R$ 1.400,00</td><td>'+sem(cct, cct <= META.contrato)+'</td></tr>'+
    '</tbody></table></div>'+
    '<div class="infobox">Reserva de R$ 5.000: os indicadores '+(cpl != null && cdiag != null ? (cpl <= META.cpl && cdiag <= META.diag ? '<b>estão dentro</b> da meta de custo por inscrição e por diagnóstico' : '<b>não estão</b> dentro da meta') : 'ainda não têm dados suficientes')+'. A decisão de liberar é do Michael.</div>';
  const adF = [['gasto','Gasto R$'],['impressoes','Impressões'],['cliques','Cliques'],['inscricoes','Inscrições'],['agendamentos','Agend.']];
  h += '<h3>Anúncios</h3><div class="table-wrap"><table><thead><tr><th>Anúncio</th>'+adF.map(x => '<th>'+x[1]+'</th>').join('')+'<th>Custo/inscr.</th></tr></thead><tbody>'+
    M.ads.map(a => { const d = (state.res[a.id] && state.res[a.id].dados) || {}; const c = div(parseFloat(d.gasto), parseFloat(d.inscricoes));
      return '<tr><td><button type="button" class="pill" data-open="'+a.id+'">'+a.id+'</button> '+esc(a.nome)+'</td>'+adF.map(x => '<td><input type="number" min="0" step="any" inputmode="decimal" data-res="'+a.id+'" data-k="'+x[0]+'" value="'+esc(d[x[0]] == null ? '' : d[x[0]])+'"></td>').join('')+'<td class="mono">'+(c != null && isFinite(c) ? brl(c) : '—')+'</td></tr>'; }).join('')+'</tbody></table></div>';
  const rF = [['views','Visualiz.'],['alcance','Alcance'],['salvos','Salvos'],['compart','Compart.'],['coment','Coment.'],['seguidores','Seguid.']];
  h += '<h3>Reels</h3><div class="table-wrap"><table><thead><tr><th>Reel</th>'+rF.map(x => '<th>'+x[1]+'</th>').join('')+'</tr></thead><tbody>'+
    M.reels.map(r => { const d = (state.res[r.id] && state.res[r.id].dados) || {};
      return '<tr><td><button type="button" class="pill" data-open="'+r.id+'">'+r.id+'</button> '+esc(r.tema)+(execOf(r.id).publicado ? '' : ' <span class="muted small">(não publicado)</span>')+'</td>'+rF.map(x => '<td><input type="number" min="0" step="1" inputmode="numeric" data-res="'+r.id+'" data-k="'+x[0]+'" value="'+esc(d[x[0]] == null ? '' : d[x[0]])+'"></td>').join('')+'</tr>'; }).join('')+'</tbody></table></div>';
  $('#view-resultados').innerHTML = h;
}

/* ---------- Formatos ---------- */
function renderFormatos(){
  let h = '<p class="eyebrow">Linguagem</p><h2>Os 10 formatos</h2><p class="lede">Cada Reel usa um formato. A dica é a regra de gravação do formato.</p><div class="grid">';
  Object.keys(M.formatos).forEach(k => {
    const f = M.formatos[k]; const rs = M.reels.filter(r => r.formato == k); const xs = M.extras.filter(x => x.formato == k); const as = M.ads.filter(a => a.formato == k);
    h += '<div class="card"><div class="head"><span class="code">'+k+'</span><span class="title">'+esc(f.nome)+'</span></div><p class="hook">'+esc(f.dica)+'</p>'+
      '<div class="head">'+rs.map(r => '<button type="button" class="pill'+(r.classe === 'reserva' ? ' res' : '')+'" data-open="'+r.id+'">'+r.id+'</button>').join(' ')+'</div>'+
      (as.length ? '<div class="head small">Anúncios: '+as.map(a => '<button type="button" class="pill" data-open="'+a.id+'">'+a.id+'</button>').join(' ')+'</div>' : '')+
      (xs.length ? '<div class="head small">Banco: '+xs.map(x => '<button type="button" class="pill" data-open="'+x.id+'">'+x.id+'</button>').join(' ')+'</div>' : '')+
      '<div class="meta">'+rs.length+' Reel(s)</div></div>';
  });
  $('#view-formatos').innerHTML = h+'</div>';
}

/* ---------- Detalhe da peça ---------- */
function scriptLines(item){
  const g = ganchoEscolhido(item);
  const lines = item.roteiro.slice();
  let note = '';
  if(g === 'B' && item.gancho_alt){
    if(item.formato === 4) note = 'Abertura em texto na tela (gancho B): '+item.gancho_alt;
    else if(!item.gancho_padrao) lines[0] = item.gancho_alt;
  }
  return {lines, note, g};
}
function openDetail(id, mode){
  const item = ITEMS[id]; if(!item) return;
  if(id !== state.detail) state.detailMode = 'roteiro';
  state.detail = id; if(mode) state.detailMode = mode;
  if(item.tipo === 'extra') state.detailMode = 'roteiro';
  if(location.hash !== '#'+state.view+'/'+id) history.replaceState(null, '', '#'+state.view+'/'+id);
  renderDetail();
  $('#detail').hidden = false; document.body.style.overflow = 'hidden';
}
function closeDetail(){
  state.detail = null; $('#detail').hidden = true; document.body.style.overflow = '';
  history.replaceState(null, '', '#'+state.view);
}
function renderDetail(){
  const id = state.detail; if(!id) return;
  const item = ITEMS[id]; const ex = execOf(id); const b = blockInfo(item);
  const L = item.tipo === 'ad' ? LABEL_AD : LABEL_REEL;
  const f = M.formatos[item.formato];
  let h = '<div class="d-top"><div><p class="eyebrow">'+(item.tipo === 'ad' ? 'Anúncio · '+esc(item.fase) : item.tipo === 'extra' ? 'Banco editorial' : 'Reel · Fase '+item.fase+(item.classe === 'reserva' ? ' · Reserva' : ''))+'</p><h2>'+id+' · '+esc(item.tema)+'</h2></div><button type="button" class="btn" data-act="closeDetail" aria-label="Fechar">Fechar ✕</button></div>';
  if(item.tipo === 'extra'){
    h += '<dl class="kv"><dt>Gancho</dt><dd>'+esc(item.gancho)+'</dd><dt>Formato</dt><dd>'+esc(f ? item.formato+'. '+f.nome+' — '+f.dica : '')+'</dd><dt>Uso</dt><dd>'+esc(item.uso)+'</dd><dt>Prioridade</dt><dd>'+(item.prioridade ? 'Sim' : 'Não')+'</dd><dt>Dependências</dt><dd>'+((item.deps || []).map(linkPend).join(' ') || 'nenhuma')+'</dd></dl>'+
      '<div class="infobox">Tema sem roteiro completo. Para produzir, escreva o roteiro com gancho alternativo, guia de 5 tópicos e dependências, e inclua na biblioteca com código próprio.</div>';
    $('#detailPanel').innerHTML = h; return;
  }
  h += '<div class="head">'+statusPills(item)+'</div>';
  if(state.avisos.length) h += '<div class="alertbox">'+state.avisos.slice(-5).map(x => '⚠ '+esc(x)).join('<br>')+' <button class="btn small" type="button" data-act="dismissAvisos">Entendi</button></div>';
  if(b.bloqueio.length) h += '<div class="alertbox"><b>BLOQUEADO.</b> Não aprovar, gravar nem publicar esta versão enquanto faltar:<ul>'+b.bloqueio.map(d => '<li><b>'+d+'</b> · '+esc(PEND[d].assunto)+': '+esc(PEND[d].falta)+(PEND[d].alternativa ? '<br><i>Alternativa segura: '+esc(PEND[d].alternativa)+'</i>' : '')+'</li>').join('')+'</ul></div>';
  if(b.publicacao.length) h += '<div class="warnbox"><b>Pode gravar, não pode publicar</b> enquanto faltar: '+b.publicacao.map(d => d+' ('+esc(PEND[d].assunto)+')').join('; ')+'.</div>';
  if(b.atencao.length) h += '<div class="infobox"><b>Atenção antes de gravar:</b> '+b.atencao.map(d => d+' · '+esc(PEND[d].assunto)+(PEND[d].alternativa ? ' (alternativa: '+esc(PEND[d].alternativa)+')' : '')).join('; ')+'.</div>';
  if(item.alt_seguro) h += '<div class="warnbox"><b>Versão segura disponível:</b> '+esc(item.alt_seguro)+'<br><label><input type="checkbox" data-act="versaoSegura" '+(ex.versao_segura ? 'checked' : '')+(!canEdit().ok || (state.mode === 'remoto' && !state.aprovador && !ex.versao_segura) ? ' disabled' : '')+'> Gravar a versão segura (dispensa '+item.deps.filter(d => WAIVABLE.includes(d)).join(', ')+'; nenhum número entre colchetes pode ser falado, e o texto na tela e a legenda também precisam sair sem números)</label></div>';
  if(versionMismatch(item)) h += '<div class="alertbox">Gravado na versão '+esc(ex.versao_gravada)+' com o gancho '+esc(ex.gancho_usado || 'A')+'. O roteiro atual é a versão '+esc(item.versao)+'. Confira se precisa regravar. <button type="button" class="btn small" data-act="ackVersion">Marcar gravação como atual</button></div>';
  h += '<h3 style="margin-top:14px">Produção</h3><div class="stage-row">'+STAGES.map(s => { const c = canSet(item, s);
    const ed = canEdit(); const off = !ed.ok || (!ex[s] && !c.ok);
    return '<button type="button" class="stage'+(ex[s] ? ' on' : '')+'" data-stage="'+s+'" '+(off ? 'disabled title="'+esc(!ed.ok ? ed.motivo : c.motivo)+'"' : '')+'>'+(ex[s] ? '✓ ' : '')+L[s]+'<small>'+(ex[s] ? dateBR(ex[s+'_em'] || '') : (!ed.ok ? 'entre para marcar' : c.ok ? 'marcar' : 'travado'))+'</small></button>'; }).join('')+'</div>'+
    '<p class="msg'+(canEdit().ok ? '' : ' err')+'" id="stageMsg">'+(canEdit().ok ? (canEdit().local ? 'Banco indisponível: a marcação fica na fila deste navegador.' : '') : esc(canEdit().motivo))+'</p>';
  h += '<div class="d-actions"><button type="button" class="btn primary" data-act="tp" data-mode="roteiro">▶ Teleprompter</button><button type="button" class="btn" data-act="tp" data-mode="guia">▶ Modo guia</button><button type="button" class="btn" data-act="copy" data-what="'+(item.tipo === 'ad' ? 'copy' : 'legenda')+'">Copiar '+(item.tipo === 'ad' ? 'copy' : 'legenda')+'</button></div>';
  const g = ganchoEscolhido(item);
  h += '<div class="hook-switch" role="radiogroup" aria-label="Gancho">'+
    '<label><input type="radio" name="gancho" value="A" '+(g === 'A' ? 'checked' : '')+'> <span><b>Gancho A</b><br>'+markText(item.gancho)+'</span></label>'+
    '<label><input type="radio" name="gancho" value="B" '+(g === 'B' ? 'checked' : '')+'> <span><b>Gancho B</b><br>'+markText(item.gancho_alt)+'</span></label></div>';
  const modes = item.tipo === 'ad' ? [['roteiro','Roteiro'],['guia','Guia'],['producao','Produção'],['anuncio','Copy e público']] : [['roteiro','Roteiro'],['guia','Guia'],['producao','Produção'],['anuncio','Anúncio']];
  if(!modes.some(m => m[0] === state.detailMode)) state.detailMode = 'roteiro';
  h += '<div class="d-modes" role="tablist">'+modes.map(m => '<button type="button" role="tab" data-dmode="'+m[0]+'" aria-selected="'+(state.detailMode === m[0])+'">'+m[1]+'</button>').join('')+'</div>';
  const sl = scriptLines(item);
  if(state.detailMode === 'roteiro'){
    h += (sl.note ? '<div class="infobox">'+esc(sl.note)+'</div>' : '')+'<div class="script">'+sl.lines.map((p, i) => '<p'+(i === 0 ? ' class="hookline"' : '')+'>'+markText(p)+'</p>').join('')+'</div>'+
      '<p class="small muted">Palavras: '+sl.lines.join(' ').split(/\s+/).length+' · Duração prevista: '+esc(item.duracao)+' · Versão '+esc(item.versao)+'</p>';
  } else if(state.detailMode === 'guia'){
    const guia = item.guia || item.roteiro;
    h += '<p class="small muted">Para gravar em conversa, sem ler. Fale cada tópico com as suas palavras.</p><ol class="guide-list">'+guia.map(p => '<li>'+markText(p)+'</li>').join('')+'</ol>';
  } else if(state.detailMode === 'producao'){
    const kv = (k, v) => v ? '<dt>'+k+'</dt><dd>'+v+'</dd>' : '';
    if(item.tipo === 'reel'){
      h += '<dl class="kv">'+kv('Publicação', dateBR(item.data)+' às '+esc(item.hora))+kv('Objetivo', esc(item.objetivo))+kv('Formato', esc(f ? item.formato+'. '+f.nome : '')+'<br><span class="muted small">'+esc(f ? f.dica : '')+'</span>')+
        kv('Duração', esc(item.duracao))+kv('Texto na tela', esc(item.texto_tela))+kv('Cenário', esc(item.cenario))+kv('Câmera', esc(item.camera))+kv('Direção', esc(item.direcao))+kv('Edição', esc(item.edicao))+
        kv('Legenda', esc(item.legenda))+kv('CTA', esc(item.cta)+'<br><span class="muted small">Regra da fase '+item.fase+': '+esc(M.fases[item.fase].cta)+'</span>')+kv('Lote', esc(M.lotes[item.lote] ? M.lotes[item.lote].nome+' · '+M.lotes[item.lote].criterio : item.lote))+
        kv('Dependências', (item.deps.map(linkPend).join(' ') || 'nenhuma'))+'</dl>';
    } else {
      h += '<dl class="kv">'+kv('Período', esc(item.periodo))+kv('Ativação', esc(item.ativar))+kv('Reel base', item.base ? '<button type="button" class="pill" data-open="'+item.base+'">'+item.base+'</button>' : 'peça própria')+kv('Formato', item.formato ? esc(item.formato+'. '+M.formatos[item.formato].nome) : 'Estático')+kv('Duração', esc(item.duracao))+kv('Objetivo', esc(item.objetivo))+kv('Dependências', (item.deps.map(linkPend).join(' ') || 'nenhuma'))+'</dl>';
    }
    h += '<h3>Notas da produção</h3><textarea class="notes" data-act="notas" placeholder="Arquivo, take escolhido, ajustes, link do vídeo...">'+esc(ex.notas || '')+'</textarea><button type="button" class="btn small" data-act="saveNotas">Salvar notas</button>'+
      (ex.updated_at ? '<p class="small muted">Última alteração: '+new Date(ex.updated_at).toLocaleString('pt-BR')+(ex.updated_by ? ' por '+esc(ex.updated_by) : '')+(ex.versao_gravada ? ' · gravado na versão '+esc(ex.versao_gravada)+', gancho '+esc(ex.gancho_usado || 'A') : '')+'</p>' : '');
  } else if(state.detailMode === 'anuncio'){
    if(item.tipo === 'ad'){
      h += '<dl class="kv"><dt>Público</dt><dd>'+esc(item.publico)+'</dd><dt>Destino</dt><dd>'+esc(item.destino)+'</dd><dt>Título</dt><dd>'+esc(item.titulo)+'</dd><dt>Copy</dt><dd>'+markText(item.copy)+'</dd><dt>Botão</dt><dd>'+esc(item.cta)+'</dd><dt>Rodapé</dt><dd>'+esc(M.campanha.rodape_conformidade)+' <span class="muted small">(obrigatório quando houver número ou simulação)</span></dd><dt>UTM</dt><dd class="mono">utm_source=meta&amp;utm_medium=paid&amp;utm_campaign=metodo-avaner&amp;utm_content='+item.id+'</dd></dl>';
    } else {
      const ads = M.ads.filter(a => a.base === item.id);
      h += '<dl class="kv"><dt>Potencial</dt><dd>'+esc(item.anuncio || 'Não indicado para anúncio.')+'</dd><dt>Anúncios</dt><dd>'+(ads.map(a => '<button type="button" class="pill" data-open="'+a.id+'">'+a.id+' · '+esc(a.nome)+'</button>').join(' ') || 'nenhum anúncio usa este Reel como base')+'</dd></dl>';
    }
  }
  $('#detailPanel').innerHTML = h;
}

/* ---------- Teleprompter (mesmo motor da v4) ---------- */
const tp = {on:false, speed:3, size:store.get('avaner-tpsize', 38), raf:0, last:0, acc:0, lock:null, item:null, mode:'roteiro'};
function applyTP(){ $('#tpText').style.fontSize = tp.size+'px'; $('#tpSpd').textContent = 'vel '+tp.speed; $('#tpPlay').textContent = tp.on ? '❚❚ Pausar' : '▶ Rolar'; $('#tpMode').textContent = tp.mode === 'guia' ? 'Ver roteiro' : 'Ver guia'; }
function tpHtml(item, mode){
  const b = blockInfo(item); const ex = execOf(item.id); const sl = scriptLines(item);
  const markTp = s => esc(s).replace(/\[[^\]]+\]/g, m => '<span style="color:#F4C46B">'+m+'</span>');
  let h = '<p class="tp-meta">'+esc(item.id+' · '+item.tema+' · v'+item.versao+' · gancho '+sl.g+(mode === 'guia' ? ' · MODO GUIA' : ''))+'</p>';
  if(b.bloqueio.length) h += '<p class="tp-warn">BLOQUEADO ('+b.bloqueio.join(', ')+'): não grave esta versão.</p>';
  if(ex.versao_segura && item.alt_seguro) h += '<p class="tp-warn">VERSÃO SEGURA: '+esc(item.alt_seguro)+' Não fale os números entre colchetes.</p>';
  if(mode === 'guia') return h+'<ol>'+(item.guia || item.roteiro).map(p => '<li>'+markTp(p)+'</li>').join('')+'</ol>';
  if(sl.note) h += '<p class="tp-meta">'+esc(sl.note)+'</p>';
  return h+sl.lines.map(p => '<p>'+markTp(p)+'</p>').join('');
}
function openTP(id, mode){
  const item = ITEMS[id]; if(!item || !item.roteiro) return;
  tp.item = id; tp.mode = mode || 'roteiro';
  $('#tpText').innerHTML = tpHtml(item, tp.mode);
  $('#tp').hidden = false; document.body.style.overflow = 'hidden'; $('#tpScroll').scrollTop = 0; applyTP();
  try{ navigator.wakeLock && navigator.wakeLock.request('screen').then(l => tp.lock = l).catch(() => {}); }catch(e){}
}
function closeTP(){ stopTP(); $('#tp').hidden = true; document.body.style.overflow = state.detail ? 'hidden' : ''; try{ tp.lock && tp.lock.release(); }catch(e){} tp.lock = null; }
function stepTP(ts){ if(!tp.on) return; if(tp.last){ tp.acc += (ts-tp.last)*tp.speed*0.012; const px = Math.floor(tp.acc); if(px > 0){ $('#tpScroll').scrollTop += px; tp.acc -= px; } } tp.last = ts; tp.raf = requestAnimationFrame(stepTP); }
function startTP(){ tp.on = true; tp.last = 0; tp.raf = requestAnimationFrame(stepTP); applyTP(); }
function stopTP(){ tp.on = false; cancelAnimationFrame(tp.raf); applyTP(); }
window.MetodoTP = tp;

/* ---------- Navegação ---------- */
const VIEWS = ['hoje','calendario','reels','anuncios','lotes','pendencias','resultados','formatos'];
const RENDER = {hoje:renderHoje, calendario:renderCalendario, reels:renderReels, anuncios:renderAnuncios, lotes:renderLotes, pendencias:renderPendencias, resultados:renderResultados, formatos:renderFormatos};
function goToView(v, push){
  if(!VIEWS.includes(v)) v = 'calendario';
  state.view = v;
  $$('#tabs [data-view]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === v)));
  $$('.view').forEach(s => s.classList.toggle('active', s.id === 'view-'+v));
  RENDER[v]();
  if(push !== false) history.replaceState(null, '', '#'+v);
  window.scrollTo(0, 0);
}
function renderAll(){
  renderConn();
  renderPendencias();          // atualiza o contador da aba
  if(state.view !== 'pendencias') RENDER[state.view]();
  if(state.detail) renderDetail();
}
function routeFromHash(){
  const m = location.hash.replace('#', '').split('/');
  goToView(m[0] || 'calendario', false);
  if(m[1] && ITEMS[m[1]]) openDetail(m[1]); else if(state.detail) closeDetail();
}

/* ---------- Eventos ---------- */
document.addEventListener('click', e => {
  const t = e.target;
  const tab = t.closest('#tabs [data-view]'); if(tab){ goToView(tab.dataset.view); return; }
  const rt = t.closest('[data-reeltab]'); if(rt){ state.reelTab = rt.dataset.reeltab; renderReels(); return; }
  const gp = t.closest('[data-goto-pend]'); if(gp){ const id = gp.dataset.gotoPend; if(state.detail) closeDetail(); goToView('pendencias'); const el = document.getElementById('pend-'+id); if(el) el.scrollIntoView({block:'start'}); return; }
  const op = t.closest('[data-open]'); if(op){ $('#globalResults').hidden = true; openDetail(op.dataset.open); return; }
  const st = t.closest('[data-stage]');
  if(st && state.detail){
    const ex = execOf(state.detail); const s = st.dataset.stage;
    const r = setStage(state.detail, s, !ex[s]);
    const msg = $('#stageMsg'); if(msg){ msg.className = 'msg '+(r.ok ? 'ok' : 'err'); msg.textContent = r.ok ? (state.mode === 'remoto' ? 'Enviado ao banco.' : 'Na fila deste navegador (banco indisponível).') : r.motivo; }
    return;
  }
  const dm = t.closest('[data-dmode]'); if(dm){ state.detailMode = dm.dataset.dmode; renderDetail(); return; }
  const ps = t.closest('[data-pend-set]');
  if(ps){
    const id = ps.dataset.pendSet; const obs = $('[data-pend-obs="'+id+'"]').value;
    const r = setPend(id, ps.dataset.v, obs);
    if(!r.ok){ const m = $('[data-pend-msg="'+id+'"]'); m.className = 'msg err'; m.textContent = r.motivo; }
    else { const m = $('[data-pend-msg="'+id+'"]'); if(m){ m.className = 'msg ok'; m.textContent = 'Salvo.'; } }
    return;
  }
  const pv = t.closest('[data-pend-save]');
  if(pv){ const id = pv.dataset.pendSave; const obs = $('[data-pend-obs="'+id+'"]').value; const r = setPend(id, pendStatus(id), obs); const m = $('[data-pend-msg="'+id+'"]'); if(m){ m.className = 'msg '+(r.ok ? 'ok' : 'err'); m.textContent = r.ok ? 'Registro salvo.' : r.motivo; } return; }
  const a = t.closest('[data-act]'); if(!a) return;
  const act = a.dataset.act;
  if(act === 'closeDetail') closeDetail();
  else if(act === 'tp') openTP(state.detail, a.dataset.mode);
  else if(act === 'copy'){ const it = ITEMS[state.detail]; const txt = a.dataset.what === 'copy' ? it.copy : it.legenda; try{ navigator.clipboard.writeText(txt).then(() => { a.textContent = 'Copiado ✓'; }, () => { a.textContent = 'Copie manualmente'; }); }catch(err){ a.textContent = 'Copie manualmente'; } }
  else if(act === 'saveNotas'){ const v = $('[data-act="notas"]').value; const r = setExecField(state.detail, 'notas', v); const m = $('#stageMsg'); if(m && !r.ok){ m.className = 'msg err'; m.textContent = r.motivo; } }
  else if(act === 'ackVersion'){ const r = setExecField(state.detail, 'versao_gravada', ITEMS[state.detail].versao); const m = $('#stageMsg'); if(m && !r.ok){ m.className = 'msg err'; m.textContent = r.motivo; } }
  else if(act === 'clearFilters'){ Object.keys(reelFilter).forEach(k => reelFilter[k] = ''); store.set('metodo-reel-filter', reelFilter); renderReels(); }
  else if(act === 'retry') Sync.retry();
  else if(act === 'sendLocal') Sync.sendPendingLocal();
  else if(act === 'discardLocal') Sync.discardPendingLocal();
  else if(act === 'dismissAvisos') Sync.dismissAvisos();
});
document.addEventListener('change', e => {
  const t = e.target;
  if(t.name === 'gancho' && state.detail){
    if(canEdit().ok) setExecField(state.detail, 'gancho_escolhido', t.value);
    else { ganchoTemp[state.detail] = t.value; renderDetail(); }   // sem login: vale só nesta tela (teleprompter)
    return;
  }
  if(t.dataset && t.dataset.act === 'versaoSegura' && state.detail){ const r = setExecField(state.detail, 'versao_segura', t.checked); const m = $('#stageMsg'); if(m && !r.ok){ m.className = 'msg err'; m.textContent = r.motivo; } return; }
  if(t.dataset && t.dataset.res){ setRes(t.dataset.res, t.dataset.k, t.value); }
});
$('#detail').addEventListener('click', e => { if(e.target.id === 'detail') closeDetail(); });
window.addEventListener('hashchange', routeFromHash);

$('#tpPlay').onclick = () => tp.on ? stopTP() : startTP();
$('#tpFast').onclick = () => { tp.speed = Math.min(10, tp.speed+1); applyTP(); };
$('#tpSlow').onclick = () => { tp.speed = Math.max(1, tp.speed-1); applyTP(); };
$('#tpBig').onclick = () => { tp.size = Math.min(80, tp.size+4); store.set('avaner-tpsize', tp.size); applyTP(); };
$('#tpSmall').onclick = () => { tp.size = Math.max(22, tp.size-4); store.set('avaner-tpsize', tp.size); applyTP(); };
$('#tpMode').onclick = () => { tp.mode = tp.mode === 'guia' ? 'roteiro' : 'guia'; $('#tpText').innerHTML = tpHtml(ITEMS[tp.item], tp.mode); $('#tpScroll').scrollTop = 0; applyTP(); };
$('#tpMirror').onclick = () => $('#tp').classList.toggle('mirror');
$('#tpTop').onclick = () => { $('#tpScroll').scrollTop = 0; };
$('#tpClose').onclick = closeTP;
$('#tpScroll').addEventListener('click', () => tp.on ? stopTP() : startTP());
document.addEventListener('keydown', e => {
  if(!$('#tp').hidden){ if(e.key === 'Escape') closeTP(); if(e.key === ' '){ e.preventDefault(); tp.on ? stopTP() : startTP(); } return; }
  if(e.key === 'Escape' && state.detail) closeDetail();
});

/* Login */
$('#loginBtn').onclick = () => {
  if(state.user){ Sync.logout(); return; }
  $('#loginMsg').textContent = ''; $('#login').hidden = false; $('#loginEmail').focus();
};
$('#loginCancel').onclick = () => { $('#login').hidden = true; };
$('#loginForm').onsubmit = async e => {
  e.preventDefault();
  const m = $('#loginMsg'); m.className = 'msg'; m.textContent = 'Entrando…';
  const r = await Sync.login($('#loginEmail').value.trim(), $('#loginPass').value);
  if(r.ok){ $('#login').hidden = true; $('#loginPass').value = ''; }
  else { m.className = 'msg err'; m.textContent = r.motivo; }
};

/* Tema */
const THEMES = ['sistema', 'claro', 'escuro'];
function applyTheme(){ const t = store.get('avaner-theme-metodo', 'sistema'); if(t === 'sistema') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t === 'claro' ? 'light' : 'dark'); $('#themeToggle').textContent = 'Tema: '+t; }
$('#themeToggle').onclick = () => { const t = store.get('avaner-theme-metodo', 'sistema'); store.set('avaner-theme-metodo', THEMES[(THEMES.indexOf(t)+1) % 3]); applyTheme(); };

/* Busca global */
const gIn = $('#globalSearch'), gRes = $('#globalResults');
gIn.addEventListener('input', () => {
  const q = gIn.value.trim().toLowerCase();
  if(q.length < 2){ gRes.hidden = true; return; }
  const hits = [];
  Object.values(ITEMS).forEach(i => {
    const hay = [i.id, i.tema, i.gancho, i.gancho_alt, (i.roteiro || []).join(' '), i.legenda || '', i.copy || ''].join(' ');
    const k = hay.toLowerCase().indexOf(q); if(k >= 0) hits.push('<button type="button" data-open="'+i.id+'"><b class="mono">'+i.id+'</b> '+esc(i.tema)+'<br><span class="muted">…'+esc(hay.slice(Math.max(0, k-30), k+60))+'…</span></button>');
  });
  M.pendencias.forEach(p => { if((p.id+' '+p.assunto+' '+p.falta).toLowerCase().includes(q)) hits.push('<button type="button" data-goto-pend="'+p.id+'"><b class="mono">'+p.id+'</b> Pendência · '+esc(p.assunto)+'</button>'); });
  gRes.innerHTML = hits.slice(0, 14).join('') || '<div class="empty">Nada encontrado.</div>';
  gRes.hidden = false;
});
gIn.addEventListener('keydown', e => { if(e.key === 'Escape'){ gIn.value = ''; gRes.hidden = true; } });
document.addEventListener('click', e => { if(!e.target.closest('.gwrap')) gRes.hidden = true; });

/* ---------- Início ---------- */
$('#footerBuild').textContent = 'Central de Conteúdos AVANER · build '+BUILD+' · '+M.reels.length+' Reels · '+M.ads.length+' anúncios · '+M.extras.length+' temas extras';
applyTheme();
routeFromHash();
renderAll();

/* Ganchos para testes automatizados (não alteram dados). */
window.MetodoApp = {state, ITEMS, blockInfo, canSet, canEdit, setStage, setPend, setExecField, openDeps};
})();
