// A limpeza única do banco do Entregas (01/11/2026: 1.009 MB de 1 GB, a cota grátis). Roda no PC, com o `firebase login`
// deste computador (firestore-client.js), e por padrão SÓ SIMULA: lê, conta e mostra o que faria. Nada muda no banco sem
// --apagar.
//
//   node limpar-banco.js                         simulação dos itens seguros (os que já são lixo)
//   node limpar-banco.js --so=dias,extratos      só esses itens
//   node limpar-banco.js --apagar                faz de verdade (antes, uma cópia de tudo que muda vai para --copia=PASTA)
//
// Os itens (os seguros vão sem --so; os do Vitor só com --so):
//   dias           robo/arquivadorNovo/dias: nos dias que já passaram (hoje e ontem ficam: o robô ainda pode gravar),
//                  os "já estavam arquivados" passam a ir só até MAX_JA_ARQUIVADOS_NO_BANCO por dia, como o robô faz
//                  desde 01/11/2026 (arquivador-acompanhamento.js). As partes do dia são remontadas; as que sobram saem.
//                  Os outros itens (arquivou, não identificado, descartado, erro) ficam todos. A contagem do mês
//                  (meses/{AAAA-MM}) não muda. O arquivo do dia no PC do arquivador tem todos.
//   extratos       extratosRecebidos/{id}/partes do extrato importado ou ignorado (regra da faxina-banco.js)
//   fgts-telas     pedidosFgts/{id}/telas e ao-vivo do pedido terminado (regra da faxina-banco.js; o PDF da guia fica)
//   feedbacks      feedbacks/{id}/partes do feedback feito (regra da faxina-banco.js)
//   -- precisam do OK do Vitor --
//   arquivamentos  arquivamentos/{id}/detalhe: o relatório de cada volta do arquivador antigo (pausado em 22/10/2026)
//   fgts-pdf       pedidosFgts/{id}/arquivo/pdf da guia pronta e já arquivada no Drive (arquivadaEm), vencida há mais de
//                  --dias-pdf=N dias (90). A Área do Cliente deixa de mostrar o PDF dessas guias velhas.
//
// --dias=extratos:7,fgtsTelas:14,feedbacks:30 troca os prazos da faxina (ex.: feedbacks:0 para os feitos de agora).
// Toda alteração grava antes a cópia do documento original em --copia (padrão: copias-limpeza-AAAA-MM-DD\, um .jsonl
// por item), para voltar se preciso. Só o Admin SDK escreve (as regras do Firestore não mudam).
'use strict';
const fs = require('fs');
const path = require('path');
const { getDb, credencialUsada } = require('./firestore-client');
const fx = require('./faxina-banco');
const { MAX_JA_ARQUIVADOS_NO_BANCO } = require('./arquivador-acompanhamento');

const PROJETO = 'entregas-2e5e2';
const SEGUROS = ['dias', 'extratos', 'fgts-telas', 'feedbacks'];
const DO_VITOR = ['arquivamentos', 'fgts-pdf'];
const UM_DIA_MS = 864e5;

// ---------- funções puras ----------

/** Os argumentos da linha de comando. */
function lerArgumentos(argv) {
  const a = { apagar: false, so: null, copia: null, diasPdf: 90, dias: {} };
  for (const x of argv) {
    if (x === '--apagar') a.apagar = true;
    else if (x.startsWith('--so=')) a.so = x.slice(5).split(',').map(s => s.trim()).filter(Boolean);
    else if (x.startsWith('--copia=')) a.copia = x.slice(8);
    else if (x.startsWith('--dias-pdf=')) a.diasPdf = Number(x.slice(11));
    else if (x.startsWith('--dias=')) for (const par of x.slice(7).split(',')) { const [k, v] = par.split(':'); if (k && v !== undefined && Number.isFinite(Number(v))) a.dias[k.trim()] = Number(v); }
    else throw new Error('argumento desconhecido: ' + x);
  }
  const conhecidos = SEGUROS.concat(DO_VITOR);
  for (const s of a.so || []) if (!conhecidos.includes(s)) throw new Error('item desconhecido em --so: ' + s + ' (vale: ' + conhecidos.join(', ') + ')');
  return a;
}

/** O tamanho aproximado de um documento no banco (o JSON dos dados; os bytes contam o tamanho, não o JSON deles). */
const tamanhoDe = dados => Buffer.byteLength(JSON.stringify(dados || {}, (k, v) => {
  if (v && typeof v === 'object' && v.type === 'Buffer' && Array.isArray(v.data)) return 'x'.repeat(Math.max(0, v.data.length - 2));
  if (v instanceof Uint8Array) return 'x'.repeat(Math.max(0, v.length - 2));
  return v;
}), 'utf8');

/** O tamanho máximo de uma parte do histórico (o mesmo do arquivador-acompanhamento.js). */
const bytesDaParte = dia => (String(dia) >= '2026-10-24' ? 250 * 1024 : 700 * 1024);

/**
 * O dia do histórico remontado: os itens que ficam (sem repetir o id; os "já arquivados" até o teto) em partes de até
 * bytesDaParte. Devolve { partes: [[item]], ficam, saem }.
 */
function remontador(dia, teto) {
  const vistos = new Set();
  const ficam = [];
  let ja = 0, saem = 0;
  return {
    /** um item da parte antiga, na ordem */
    pôr(x) {
      const id = x && x.id;
      if (id && vistos.has(id)) { saem++; return; }
      if (id) vistos.add(id);
      if (x && x.acao === 'jaArquivado') { if (ja >= teto) { saem++; return; } ja++; }
      ficam.push(x);
    },
    fim() {
      const partes = [[]];
      let tam = 0;
      for (const x of ficam) {
        const s = JSON.stringify(x).length;
        if (tam + s > bytesDaParte(dia) && partes[partes.length - 1].length) { partes.push([]); tam = 0; }
        partes[partes.length - 1].push(x); tam += s;
      }
      return { partes, ficam: ficam.length, saem };
    },
  };
}
function remontarDia(dia, itens, teto) { const r = remontador(dia, teto); for (const x of itens) r.pôr(x); return r.fim(); }

/** A data local AAAA-MM-DD (São Paulo) de um instante. */
const diaLocal = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);

const mb = b => (b / 1048576).toFixed(1).replace('.', ',') + ' MB';

// ---------- com o banco ----------

async function main() {
  const a = lerArgumentos(process.argv.slice(2));
  Object.assign(fx.DIAS, a.dias);
  const itens = a.so || SEGUROS;
  const db = getDb(PROJETO);
  const agora = Date.now();
  const pastaCopia = a.copia || path.join(__dirname, 'copias-limpeza-' + diaLocal(agora));
  const modo = a.apagar ? 'APAGANDO (com cópia em ' + pastaCopia + ')' : 'SIMULAÇÃO (nada muda no banco)';
  console.log('Limpeza do banco ' + PROJETO + ' — ' + modo + '\ncredencial: ' + credencialUsada() + '\nitens: ' + itens.join(', ') + '\n');
  if (a.apagar) fs.mkdirSync(pastaCopia, { recursive: true });
  const copiar = (item, ref, dados) => { if (a.apagar) fs.appendFileSync(path.join(pastaCopia, item + '.jsonl'), JSON.stringify({ caminho: ref.path, dados }) + '\n'); };
  const relatorio = [];

  // os pedaços de arquivo, pela regra da faxina-banco.js (o documento de cima fica, com partesApagadasEm)
  async function faxina(item, colecao, consulta) {
    const r = { item, documentos: 0, bytes: 0, pais: 0 };
    const snap = await consulta.get();
    for (const pai of snap.docs) {
      const plano = fx.oQueApagar(colecao, pai.data(), agora);
      if (!plano) continue;
      let achou = 0;
      for (const sub of plano.apagar) {
        const filhos = await pai.ref.collection(sub).get();
        for (const f of filhos.docs) {
          const dados = f.data();
          r.bytes += tamanhoDe(dados); r.documentos++; achou++;
          copiar(item, f.ref, dados);
          if (a.apagar) await f.ref.delete();
        }
      }
      if (achou) r.pais++;
      if (a.apagar) await pai.ref.update({ partesApagadasEm: new Date(agora).toISOString() });
    }
    return r;
  }

  for (const item of itens) {
    try {
      if (item === 'dias') {
        const r = { item, documentos: 0, bytes: 0, pais: 0, detalhe: [] };
        const col = db.collection('robo').doc('arquivadorNovo').collection('dias');
        const ontem = diaLocal(agora - UM_DIA_MS);
        const refs = (await col.select('dia').get()).docs;
        const porDia = new Map();
        for (const d of refs) { const dia = String(d.get('dia') || d.id.slice(0, 10)); if (dia < ontem) (porDia.get(dia) || porDia.set(dia, []).get(dia)).push(d.ref); }
        for (const [dia, lista] of [...porDia.entries()].sort()) {
          // as partes em ordem (o número está no id: AAAA-MM-DD-n); na memória fica só o que vai ficar no banco, e a
          // cópia de cada parte vai para o disco assim que é lida (um dia de releitura tem 1.000 partes, ~225 MB)
          lista.sort((x, y) => Number(x.id.slice(11)) - Number(y.id.slice(11)));
          const rm = remontador(dia, MAX_JA_ARQUIVADOS_NO_BANCO);
          const antigas = [];
          let bytesAntes = 0;
          for (let i = 0; i < lista.length; i += 10) {
            for (const s of await db.getAll(...lista.slice(i, i + 10))) {
              if (!s.exists) continue;
              const dados = s.data();
              bytesAntes += tamanhoDe(dados);
              antigas.push({ ref: s.ref, parte: Number(dados.parte), em: dados.em });
              for (const x of dados.itens || []) rm.pôr(x);
              copiar('dias', s.ref, dados);
            }
          }
          const novo = rm.fim();
          if (!novo.saem) continue;
          const bytesDepois = novo.partes.reduce((s, p, n) => s + tamanhoDe({ dia, parte: n, em: '', itens: p }), 0);
          r.documentos += antigas.length - novo.partes.length; r.bytes += bytesAntes - bytesDepois; r.pais++;
          r.detalhe.push(dia + ': ' + antigas.length + ' → ' + novo.partes.length + ' partes, ' + novo.saem.toLocaleString('pt-BR') + ' "já arquivados" saem, ' + novo.ficam.toLocaleString('pt-BR') + ' itens ficam (' + mb(bytesAntes) + ' → ' + mb(bytesDepois) + ')');
          if (!a.apagar) continue;
          // primeiro as partes novas (por cima das de mesmo número), depois as que sobraram: se parar no meio, sobra
          // repetido (a próxima rodada tira, pelo id), nunca falta
          const emDa = n => (antigas.find(p => p.parte === n) || {}).em || new Date(agora).toISOString();
          for (let n = 0; n < novo.partes.length; n++) await col.doc(dia + '-' + n).set({ dia, parte: n, em: emDa(n), itens: novo.partes[n] });
          for (const p of antigas) if (!(p.parte < novo.partes.length && p.ref.id === dia + '-' + p.parte)) await p.ref.delete();
        }
        relatorio.push(r);
      } else if (item === 'extratos') {
        relatorio.push(await faxina(item, 'extratosRecebidos', db.collection('extratosRecebidos').where('status', 'in', ['importado', 'ignorado'])));
      } else if (item === 'fgts-telas') {
        relatorio.push(await faxina(item, 'pedidosFgts', db.collection('pedidosFgts').where('status', 'in', fx.FIM_DO_FGTS)));
      } else if (item === 'feedbacks') {
        relatorio.push(await faxina(item, 'feedbacks', db.collection('feedbacks').where('status', '==', 'feito')));
      } else if (item === 'arquivamentos') {
        const r = { item, documentos: 0, bytes: 0, pais: 0 };
        for (const pai of (await db.collection('arquivamentos').get()).docs) {
          const filhos = await pai.ref.collection('detalhe').get();
          if (filhos.size) r.pais++;
          for (const f of filhos.docs) { const dados = f.data(); r.documentos++; r.bytes += tamanhoDe(dados); copiar(item, f.ref, dados); if (a.apagar) await f.ref.delete(); }
        }
        relatorio.push(r);
      } else if (item === 'fgts-pdf') {
        const r = { item, documentos: 0, bytes: 0, pais: 0 };
        for (const pai of (await db.collection('pedidosFgts').where('status', '==', 'pronto').get()).docs) {
          const p = pai.data();
          const venc = Date.parse(String(p.vencimento || '').replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$3-$2-$1'));
          if (!p.arquivadaEm || !Number.isFinite(venc) || agora - venc < a.diasPdf * UM_DIA_MS) continue;
          for (const f of (await pai.ref.collection('arquivo').get()).docs) { const dados = f.data(); r.documentos++; r.bytes += tamanhoDe(dados); copiar(item, f.ref, dados); if (a.apagar) await f.ref.delete(); }
          r.pais++;
        }
        relatorio.push(r);
      }
    } catch (err) {
      relatorio.push({ item, erro: err && err.message ? err.message : String(err) });
    }
  }

  console.log((a.apagar ? 'Feito' : 'Faria') + ':');
  let total = 0;
  for (const r of relatorio) {
    if (r.erro) { console.log('  ' + r.item.padEnd(14) + ' ERRO: ' + r.erro); continue; }
    total += r.bytes;
    console.log('  ' + r.item.padEnd(14) + ' ' + String(r.documentos).padStart(5) + ' documento(s) ' + (a.apagar ? 'apagado(s)' : 'a apagar') + ', ~' + mb(r.bytes).padStart(9) + ' de dados, de ' + r.pais + (r.item === 'dias' ? ' dia(s)' : ' documento(s) de cima'));
    for (const d of r.detalhe || []) console.log('      ' + d);
  }
  console.log('  total ~' + mb(total) + ' de dados (os índices saem junto; o Google mede o tamanho uma vez por dia)');
  if (!a.apagar) console.log('\nNada foi apagado. Para fazer: node limpar-banco.js --apagar' + (a.so ? ' --so=' + a.so.join(',') : ''));
}

if (require.main === module) main().then(() => process.exit(0)).catch(err => { console.error('a limpeza parou:', err && err.message ? err.message : err); process.exit(1); });

module.exports = { lerArgumentos, remontarDia, bytesDaParte, tamanhoDe, SEGUROS, DO_VITOR };
