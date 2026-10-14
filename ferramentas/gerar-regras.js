/* Gera supabase/metodo-regras.sql a partir dos arquivos metodo/dados-*.js.
   Uso (na pasta do repositório): node ferramentas/gerar-regras.js
   Rode de novo sempre que mudar uma dependência (deps), uma pendência ou uma versão segura. */
const path = require('path'), fs = require('fs');
const raiz = path.join(__dirname, '..');
global.window = {};
['base', 'reels-1', 'reels-2', 'reels-3', 'anuncios'].forEach(f => require(path.join(raiz, 'metodo', 'dados-' + f + '.js')));
const M = window.METODO;
const WAIVABLE = ['N1', 'N2', 'E1'];
const versao = M.campanha.build;
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const itens = M.reels.concat(M.ads);
let sql = '-- GERADO por ferramentas/gerar-regras.js a partir de metodo/dados-*.js. Não edite à mão.\n' +
  '-- Regras de bloqueio da build ' + versao + '. Rode no SQL Editor depois do metodo-schema.sql (e de novo a cada build que mudar regras).\n' +
  '-- Não apaga nada: regras que saíram da central ficam marcadas como inativas (ativo = false).\n\nbegin;\n\n';
sql += 'insert into public.metodo_pendencias_def (id, severidade, assunto, versao_regras, ativo) values\n' +
  M.pendencias.map(p => '  (' + [q(p.id), q(p.severidade), q(p.assunto), q(versao)].join(', ') + ', true)').join(',\n') +
  '\non conflict (id) do update set severidade = excluded.severidade, assunto = excluded.assunto, versao_regras = excluded.versao_regras, ativo = true;\n\n';
sql += 'insert into public.metodo_itens (item_id, tem_versao_segura, versao_regras, ativo) values\n' +
  itens.map(i => '  (' + [q(i.id), i.alt_seguro ? 'true' : 'false', q(versao)].join(', ') + ', true)').join(',\n') +
  '\non conflict (item_id) do update set tem_versao_segura = excluded.tem_versao_segura, versao_regras = excluded.versao_regras, ativo = true;\n\n';
const deps = [];
itens.forEach(i => (i.deps || []).forEach(d => deps.push('  (' + [q(i.id), q(d), (i.alt_seguro && WAIVABLE.includes(d)) ? 'true' : 'false', q(versao)].join(', ') + ', true)')));
sql += 'insert into public.metodo_dependencias (item_id, dep_id, dispensavel_versao_segura, versao_regras, ativo) values\n' + deps.join(',\n') +
  '\non conflict (item_id, dep_id) do update set dispensavel_versao_segura = excluded.dispensavel_versao_segura, versao_regras = excluded.versao_regras, ativo = true;\n\n';
sql += 'update public.metodo_dependencias set ativo = false where versao_regras <> ' + q(versao) + ';\n' +
  'update public.metodo_itens set ativo = false where versao_regras <> ' + q(versao) + ';\n' +
  'update public.metodo_pendencias_def set ativo = false where versao_regras <> ' + q(versao) + ';\n\ncommit;\n\n' +
  '-- Conferência: deve mostrar ' + itens.length + ' peças, ' + deps.length + ' dependências e ' + M.pendencias.length + ' pendências ativas.\n' +
  '-- select (select count(*) from public.metodo_itens where ativo) pecas, (select count(*) from public.metodo_dependencias where ativo) dependencias, (select count(*) from public.metodo_pendencias_def where ativo) pendencias;\n';
fs.writeFileSync(path.join(raiz, 'supabase', 'metodo-regras.sql'), sql);
console.log('supabase/metodo-regras.sql gerado: ' + itens.length + ' peças, ' + deps.length + ' dependências, ' + M.pendencias.length + ' pendências, versão ' + versao);
