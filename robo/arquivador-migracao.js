// A migração das pastas antigas para o arquivador novo (Vitor, 23/10/2026: ~320 mil arquivos de "todos os dados das
// empresas que ainda não foram feitos", em pastas por cliente: "0010 - DORNAS HAVANA LTDA - ME\DEPARTAMENTO FISCAL\DESTDA\
// 2024\04-2024.pdf", misturados com XMLs e com arquivos de 2026).
//
// O conteúdo decide primeiro (as regras de sempre). Quando ele não decide (tipo não reconhecido, PDF escaneado sem texto,
// formato sem regra), a PASTA DE ORIGEM vira pista pelo mapa (arquivador-mapa-migracao.json, versionado; e o que o admin
// decidiu por grupo, no controle): "…\DESTDA\" = o tipo DESTDA; "0010 - DORNAS HAVANA…" = o cliente 10 (o código E o nome
// conferem com o cadastro); "…\2024\" ou "04-2024" no nome = a competência. O destino sai pela mesma árvore do Dicionário
// (o tipo do formulário "Arquivar em…", arquivador-manual.js, e R.finalizar: o regime, a pasta do cliente, a raiz do ano).
// Nada é inventado: pasta sem equivalente no mapa fica em NÃO IDENTIFICADOS e entra na lista dos grupos.
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./arquivador-regras');

const VERSIONADO = path.join(__dirname, 'arquivador-mapa-migracao.json');
const k = s => R.norm(String(s || '')).replace(/[^A-Z0-9\\ ]+/g, ' ').replace(/ +/g, ' ').replace(/ ?\\ ?/g, '\\').trim();
// as pastas de data saem do caminho (o ano e o mês vêm por R.anoDaPasta)
const ehData = s => /^(19|20)\d{2}$/.test(s) || /^\d{1,2}[-. _]?(19|20)\d{2}$/.test(s) || /^(19|20)\d{2}[-. _]?\d{1,2}$/.test(s) || /^\d{1,2}$/.test(s) || /^\d{2}[.-]\d{2}[.-]\d{4}$/.test(s);

/** As partes do caminho de origem sem as de data e sem o nome do arquivo, normalizadas. */
function partesSemData(rel) { return R.partesDoCaminho(rel).slice(0, -1).filter(p => !ehData(p.trim())).map(k); }

/**
 * O mapa: o versionado + o do controle (as decisões do admin por grupo). opcoes: { controle, arquivo (o versionado) }.
 * → { tipoDaOrigem(rel), clienteDaPasta(parte), grupoDaPasta(parte), semPista(parte), anotar(entrada), estatistica }
 */
function carregar(opcoes) {
  opcoes = opcoes || {};
  const ler = a => { try { return JSON.parse(fs.readFileSync(a, 'utf8').replace(/^﻿/, '')); } catch (e) { return null; } };
  const base = ler(opcoes.arquivo || VERSIONADO) || {};
  const localArq = opcoes.controle ? path.join(opcoes.controle, 'mapa-migracao.json') : null;
  const local = (localArq && ler(localArq)) || {};
  const tipos = [].concat(local.tipos || [], base.tipos || []).map(t => Object.assign({}, t, { _k: k(t.pasta) })).filter(t => t._k && t.tipoDoc)
    .sort((a, b) => b._k.length - a._k.length);   // a mais específica primeiro
  const clientes = new Map();
  // a pasta que junta matriz e filiais (27/10/2026): cliente null com matriz, filiais e, quando o Vitor decidiu, a palavra do
  // nome do arquivo que diz qual (peloNome: { "OV1": 409 }); quem lê é o R.clienteDaPasta e o pagamento de fornecedor
  for (const c of [].concat(base.clientes || [], local.clientes || [])) if (c && c.pasta) clientes.set(k(c.pasta), { cliente: c.cliente == null ? null : +c.cliente, porque: c.porque || 'mapa da migração',
    matriz: c.cliente == null && c.matriz != null ? +c.matriz : null, filiais: (c.filiais || []).map(Number), peloNome: c.peloNome ? Object.fromEntries(Object.entries(c.peloNome).map(([t, v]) => [R.norm(t), +v])) : null });
  const semPista = new Set((base.semPista || []).concat(local.semPista || []).map(k));
  return {
    estatistica: { tipos: tipos.length, clientes: clientes.size, semPista: semPista.size, local: !!localArq && fs.existsSync(localArq) },
    /** O tipo pela pasta de origem: { tipoDoc, pasta } ou null. */
    tipoDaOrigem(rel) {
      const caminho = partesSemData(rel).join('\\');
      // "nome": só quando o nome do arquivo tem o texto (ex.: a pasta EXTRATOS só dá EXTRATO ao "Extrato bb 01.2022.pdf")
      const nomeArq = R.norm(path.win32.basename(String(rel || '')));
      for (const t of tipos) { if (t.nome && !nomeArq.includes(R.norm(t.nome))) continue; const i = caminho.indexOf(t._k); if (i >= 0 && (i === 0 || caminho[i - 1] === '\\') && (caminho.length === i + t._k.length || caminho[i + t._k.length] === '\\')) return { tipoDoc: t.tipoDoc, pasta: t.pasta, porque: t.porque || 'mapa da migração' }; }
      return null;
    },
    /** undefined = o mapa não fala desta pasta; null = ela não dá o cliente; { cliente, porque } */
    clienteDaPasta(parte) { const c = clientes.get(k(parte)); return c === undefined ? undefined : c.cliente == null ? null : c; },
    /** A pasta que junta matriz e filiais: { matriz, filiais, peloNome, porque } ou null. */
    grupoDaPasta(parte) { const c = clientes.get(k(parte)); return c && c.cliente == null && c.matriz != null ? { matriz: c.matriz, filiais: c.filiais, peloNome: c.peloNome, porque: c.porque } : null; },
    semPista(parte) { return semPista.has(k(parte)); },
    /** A decisão do admin para um grupo (Para resolver): grava no mapa do controle. { pasta, cliente?, tipoDoc?, por } */
    anotar(e) {
      if (!localArq) return false;
      const atual = ler(localArq) || { _sobre: 'decisões do admin por grupo (Para resolver), pela pasta de origem; valem junto com robo/arquivador-mapa-migracao.json', tipos: [], clientes: [] };
      const pasta = String(e.pasta || '').trim();
      if (!pasta) return false;
      const em = new Date().toISOString();
      if (e.tipoDoc) { atual.tipos = (atual.tipos || []).filter(t => k(t.pasta) !== k(pasta)).concat({ pasta, tipoDoc: e.tipoDoc, porque: 'decidido por ' + (e.por || 'admin') + ' no nads em ' + em.slice(0, 10) }); }
      if (e.cliente != null && e.pastaDoCliente) { atual.clientes = (atual.clientes || []).filter(c => k(c.pasta) !== k(e.pastaDoCliente)).concat({ pasta: e.pastaDoCliente, cliente: +e.cliente, porque: 'decidido por ' + (e.por || 'admin') + ' no nads em ' + em.slice(0, 10) }); }
      fs.mkdirSync(path.dirname(localArq), { recursive: true });
      fs.writeFileSync(localArq + '.tmp', JSON.stringify(atual, null, 1)); fs.renameSync(localArq + '.tmp', localArq);
      return true;
    },
  };
}

// o que o conteúdo não decidiu e a pasta de origem pode decidir
// CONTRATO_SEM_NUMERO: o extrato do BB que as regras leram como contrato (23/10/2026: 64 na pasta EXTRATOS, "Extrato bb 01.2022.pdf")
const SEM_DECISAO_PELO_CONTEUDO = new Set(['TIPO_NAO_RECONHECIDO', 'CONTEUDO_SEM_TEXTO', 'CONTEUDO_ILEGIVEL', 'FORMATO_SEM_REGRA', 'COMPETENCIA_AUSENTE', 'CONTRATO_SEM_NUMERO']);

/**
 * A decisão pela pasta de origem para o que as regras deixaram em NAO_IDENTIFICADO. entrada: a das regras ({ nome, rel,
 * hash, … }); d: a decisão das regras. Devolve a decisão nova (ARQUIVAR, ou NAO_IDENTIFICADO com o motivo do que faltou)
 * ou null quando a pasta não diz nada.
 */
function decidir(entrada, ctx, d) {
  return clientePelaPasta(entrada, ctx, d) || decidirPeloMapa(entrada, ctx, d);
}
function decidirPeloMapa(entrada, ctx, d) {
  const mapa = ctx.cadastro && ctx.cadastro.mapaMigracao;
  // d.clienteDaPasta: o cliente já dado pela pasta conferida (clientePelaPasta); o mapa só diz o tipo
  if (!mapa || !d || d.acao !== 'NAO_IDENTIFICADO' || !(SEM_DECISAO_PELO_CONTEUDO.has(d.motivo) || d.clienteDaPasta)) return null;
  const M = require('./arquivador-manual');
  let t = mapa.tipoDaOrigem(entrada.rel || '');
  // o conteúdo já disse o tipo (DAE, DARF, DEFIS…) e só faltou a competência: o nome ou as pastas de origem dão
  if (!t && d.motivo === 'COMPETENCIA_AUSENTE' && d.tipo) {
    const peloConteudo = M.TIPOS.find(x => x.id !== 'AUTO' && x.aceita.test(String(d.tipo)));
    if (peloConteudo) t = { tipoDoc: peloConteudo.id, pasta: '(o tipo pelo conteúdo: ' + d.tipo + ')', porque: 'a competência pelo nome ou pelas pastas de origem' };
  }
  if (!t) return null;
  const tipo = M.TIPOS.find(x => x.id === t.tipoDoc);
  if (!tipo || tipo.id === 'AUTO') return null;
  const cad = ctx.cadastro;
  const ev = (d.evidencias || []).slice();
  ev.push('pasta de origem "' + t.pasta + '" = ' + tipo.rotulo + ' (' + t.porque + ')');
  // o cliente: o do conteúdo (CNPJ, conta) confere com o da pasta; só a pasta, quando o código E o nome conferem
  const pista = R.clienteDaPasta(entrada.rel || '', cad);
  // o cliente que o conteúdo traz: o da decisão das regras, ou os CNPJ/CPF de clientes escritos no texto
  let doConteudo = d.cliente != null && cad.porCod.has(d.cliente) ? d.cliente : null;
  if (d.clienteDaPasta) doConteudo = null;   // o cliente vem da pasta (abaixo); o conteúdo já foi conferido
  if (doConteudo == null && !d.clienteDaPasta) {
    const texto = Array.isArray(entrada.texto) ? entrada.texto.slice(0, 3).join('\n') : String(entrada.texto || entrada.txt || '');
    const cods = [...new Set(R.documentosDoTexto(texto, true).flatMap(x => R.clientesDoDoc(x.doc, cad)))];
    if (cods.length === 1) { doConteudo = cods[0]; ev.push('CNPJ/CPF do cliente no conteúdo'); }
    else if (cods.length > 1) { if (pista && cods.includes(pista.codigo)) { doConteudo = pista.codigo; ev.push('o CNPJ do cliente da pasta está no conteúdo (com outros)'); } else return R.comMotivoDoCodigo(Object.assign({}, d, { motivo: 'CLIENTE_AMBIGUO', evidencias: ev.concat('o conteúdo traz mais de um cliente: ' + cods.join(', ')) })); }
  }
  if (doConteudo != null && pista && pista.codigo !== doConteudo) return R.comMotivoDoCodigo(Object.assign({}, d, { motivo: 'PISTA_DA_PASTA_DIVERGE', evidencias: ev.concat('o conteúdo diz o cliente ' + doConteudo + ', a pasta de origem diz ' + pista.codigo + ' (' + pista.como + ')') }));
  let cliente = null, como = null, conf = 0;
  if (doConteudo != null) { cliente = doConteudo; como = d.comoCliente || 'doc'; conf = pista ? 0.95 : 0.9; if (pista) ev.push('o cliente do conteúdo confere com a pasta de origem'); }
  else if (pista && pista.forte) { cliente = pista.codigo; como = 'pastaConferida'; conf = 0.9; ev.push(pista.como); }
  if (cliente == null) return R.comMotivoDoCodigo(Object.assign({}, d, { motivo: 'CLIENTE_NAO_LOCALIZADO', evidencias: ev.concat(pista ? 'a pasta de origem só traz o código (' + pista.como + '), sem o nome do cadastro' : 'nem o conteúdo nem a pasta de origem dizem o cliente') }));
  // a competência: o nome do arquivo ("04-2024.pdf"), senão as pastas de origem ("…\2024\04\"), senão o conteúdo
  const nome = entrada.nome || path.win32.basename(String(entrada.rel || 'arquivo'));
  const pastaComp = R.anoDaPasta(entrada.rel || '');
  let comp = R.competenciaDoNome(nome) || (pastaComp && pastaComp.mes ? pastaComp : null) || (d.competencia && d.competencia.mes ? d.competencia : null);
  if (!comp && tipo.precisa !== 'mes') comp = pastaComp ? { ano: pastaComp.ano } : d.competencia && d.competencia.ano ? { ano: d.competencia.ano } : null;
  if (tipo.precisa === 'mes' && !(comp && comp.mes)) return R.comMotivoDoCodigo(Object.assign({}, d, { cliente, motivo: 'COMPETENCIA_AUSENTE', evidencias: ev.concat('o tipo ' + tipo.rotulo + ' precisa do mês, e nem o nome nem as pastas de origem o trazem') }));
  if (tipo.precisa === 'ano' && !comp) return R.comMotivoDoCodigo(Object.assign({}, d, { cliente, motivo: 'ANO_INDETERMINADO', evidencias: ev.concat('o tipo ' + tipo.rotulo + ' precisa do ano') }));
  const ext = ((/\.[a-z0-9]+$/i.exec(nome) || ['.pdf'])[0]).toLowerCase();
  const base = nome.replace(/\.[a-z0-9]+$/i, '');
  const b = tipo.montar({ comp: comp || {}, ext, base, nome, entrada });
  if (b.erro) return R.comMotivoDoCodigo(Object.assign({}, d, { cliente, motivo: 'VOCABULARIO_AUSENTE', evidencias: ev.concat(b.erro) }));
  return R.finalizar(Object.assign({ acao: 'ARQUIVAR', cliente, comoCliente: como, confianca: conf, tipo: tipo.id.replace(/_/g, ' '), setor: tipo.setor, competencia: comp && comp.ano ? comp : null,
    anoPista: pastaComp, nomeOriginal: nome, evidencias: ev, fonte: 'mapa da migração (pasta de origem)', ocr: entrada.ocr || null, pelaMigracao: t.pasta }, b), ctx);
}

/**
 * O cliente pela pasta de origem (Vitor, 23/10/2026): o conteúdo não achou o cliente (CLIENTE_NAO_LOCALIZADO) ou ficou entre
 * dois (CLIENTE_AMBIGUO), e a pasta "0NNN - NOME…" da migração tem o código E o nome conferidos no cadastro. Vale se o
 * conteúdo não contradiz: nenhum CNPJ/CPF de OUTRO cliente (no ambíguo, a pasta tem de ser um dos dois, da mesma raiz de
 * CNPJ — matriz e filial). Decide de novo pelas regras com o cliente dado (como a decisão do admin), confiança 0,9.
 */
function clientePelaPasta(entrada, ctx, d) {
  if (!d || d.acao !== 'NAO_IDENTIFICADO' || !['CLIENTE_NAO_LOCALIZADO', 'CLIENTE_AMBIGUO'].includes(d.motivo)) return null;
  const cad = ctx.cadastro;
  const pista = R.clienteDaPasta(entrada.rel || '', cad);
  if (!pista || !pista.forte) return null;
  const cli = cad.porCod.get(pista.codigo);
  if (!cli) return null;
  // o que o conteúdo traz: os CNPJ/CPF de clientes (o texto do PDF, o XML)
  const texto = entrada.xml ? String(entrada.xml) : Array.isArray(entrada.texto) ? entrada.texto.slice(0, 3).join('\n') : String(entrada.texto || entrada.txt || entrada.ofx || '');
  const outros = [...new Set(R.documentosDoTexto(texto, true).flatMap(x => R.clientesDoDoc(x.doc, cad)))].filter(c => c !== pista.codigo);
  const raiz = c => { const x = cad.porCod.get(c); return x && x.doc && x.doc.length === 14 ? x.doc.slice(0, 8) : null; };
  if (outros.length && !(d.motivo === 'CLIENTE_AMBIGUO' && raiz(pista.codigo) && outros.every(c => raiz(c) === raiz(pista.codigo)))) return null;
  const confirmados = new Map(ctx.confirmados || []);
  if (entrada.hash) confirmados.set(entrada.hash, pista.codigo);
  let d2 = null;
  try { d2 = R.decidir(entrada, Object.assign({}, ctx, { confirmados })); } catch (e) { return null; }
  if (!d2 || d2.acao !== 'ARQUIVAR' || Number(d2.cliente) !== pista.codigo) {
    // as regras com o cliente dado ainda não chegam: o mapa da migração pela subpasta, com o cliente da pasta
    const t = d2 && d2.acao === 'NAO_IDENTIFICADO' ? decidirPeloMapa(entrada, Object.assign({}, ctx, { confirmados }), Object.assign({}, d2, { cliente: null, clienteDaPasta: true })) : null;
    return t && t.acao === 'ARQUIVAR' ? t : null;
  }
  d2.confianca = Math.min(d2.confianca || 0.9, 0.9);
  d2.comoCliente = 'pastaConferida';
  d2.evidencias = (d2.evidencias || []).concat('o cliente pela pasta de origem (' + pista.como + '); o conteúdo não traz o CNPJ de outro cliente' + (outros.length ? ' (só o da mesma empresa, matriz/filial)' : '') + ' — era ' + d.motivo);
  return d2;
}

/**
 * A chave de GRUPO de um não identificado (Para resolver em lote): o motivo + a pasta de origem sem as de data
 * ("0010 - DORNAS HAVANA LTDA - ME\DEPARTAMENTO FISCAL\DESTDA"). rel = o caminho na origem.
 */
function chaveDoGrupo(motivo, rel) {
  const partes = R.partesDoCaminho(rel).slice(0, -1).filter(p => !ehData(p.trim()));
  return { motivo: motivo || 'SEM_MOTIVO_REGISTRADO', pasta: partes.slice(0, 4).join('\\') || '(solto na Claudio Secretario)' };
}

module.exports = { carregar, decidir, clientePelaPasta, chaveDoGrupo, partesSemData, VERSIONADO };
