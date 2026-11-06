// Os números do balancete e do razão para dentro do nads (05/11/2026, Vitor: "os dados tem que sair da pasta D: e subir pro
// nads"; os arquivos já subiam para baixar, agora sobem também lidos). O robô lê os dois arquivos que o Alterdata gerou:
//   - o balancete (Xlsx Dados): coluna C = descrição com [código] (o recuo é o nível), E = saldo anterior com D/C,
//     F = débitos, G = créditos, H = saldo atual com D/C (o mesmo layout que a Conferência lê em @nads/core);
//   - o razão (CSV do Alterdata, ISO-8859-1, ';'): ContaCurto;ContaNome;ContaCompleto;Data;Historico;ContraPartida;
//     Documento;Lote;Debito;Credito;SaldoAnterior;Saldo.
// E grava em pedidosAlterdata/{id}/numeros/: "balancete" (as contas), "razao" (o resumo por conta) e "razao-nnn" (os
// lançamentos, em pedaços abaixo de 1 MiB). Os testes: teste-alterdata-numeros.js.
'use strict';
const XLSX = require('xlsx');

/** "1.234,56D" → { valor: 1234.56, dc: 'D' }; '' → null. */
function valorDc(t) {
  const s = String(t == null ? '' : t).trim();
  if (!s) return null;
  const m = s.match(/^(-?[\d.]+(?:,\d+)?)\s*([DC])?$/i);
  if (!m) return null;
  return { valor: Number(m[1].replace(/\./g, '').replace(',', '.')), dc: (m[2] || '').toUpperCase() };
}

/** "1.234,56" ou "-1481,73" → número; '' → 0. */
function numero(t) {
  const s = String(t == null ? '' : t).trim();
  if (!s) return 0;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** O balancete .xlsx do Alterdata → [{codigo, nome, nivel, sintetica, anterior, anteriorDc, debito, credito, saldo, dc}]. */
function lerBalancete(buf) {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
  const contas = [];
  for (const r of linhas) {
    const desc = String(r[2] || '');
    const mt = desc.match(/\[\s*(\d+)\s*\]/);
    if (!mt) continue;
    const saldo = valorDc(r[7]);
    if (!saldo) continue;
    const anterior = valorDc(r[4]) || { valor: 0, dc: '' };
    const nome = desc.slice(0, desc.indexOf(mt[0])).replace(/[-–\s]+$/, '').trim() || mt[1];
    contas.push({
      codigo: mt[1], nome: nome.slice(0, 80), nivel: desc.match(/^ */)[0].length,
      anterior: anterior.valor, anteriorDc: anterior.dc || 'D',
      debito: numero(r[5]), credito: numero(r[6]), saldo: saldo.valor, dc: saldo.dc || 'D',
    });
  }
  contas.forEach((c, i) => { const p = contas[i + 1]; c.sintetica = !!(p && p.nivel > c.nivel); });
  return contas;
}

/**
 * O Balancete Dinâmico (.xls, Consultas → Balancete Dinâmico → Exportar; 06/11/2026) → as mesmas contas de lerBalancete.
 * Colunas: Código, Classificação (1.1.1.01.001: o nível é a quantidade de pedaços), Descrição, Saldo anterior, Debito,
 * Credito, Saldo atual. Sintética: a conta que tem outra classificação embaixo dela.
 * O sinal no Excel depende da ORIGEM da conta (a "Configuração para salvar em excel": devedora = devedor +, credora e
 * indefinida = devedor −), e a origem não vem no arquivo. Sempre vale anterior + débito + crédito = saldo (com os sinais
 * do arquivo), e o débito tem o sinal do devedor: com movimento, o sinal do débito (ou o contrário do do crédito) diz a
 * convenção da conta. Sem movimento não há como saber: usa a convenção da maioria das contas irmãs (o mesmo grupo) e marca
 * dcIncerto.
 */
function lerDinamico(buf) {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
  if (!linhas.length) return [];
  const cab = linhas[0].map(c => String(c).trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
  const col = nome => cab.indexOf(nome);
  const ix = { codigo: col('codigo'), cls: col('classificacao'), nome: col('descricao'), anterior: col('saldo anterior'), debito: col('debito'), credito: col('credito'), saldo: col('saldo atual') };
  if (Object.values(ix).some(i => i < 0)) throw new Error('o XLS do Balancete Dinâmico não tem as colunas esperadas (' + linhas[0].join(';').slice(0, 120) + ')');
  const num = v => (typeof v === 'number' ? v : numero(v));
  const r2 = n => Math.round(n * 100) / 100;
  const brutas = [];
  for (const l of linhas.slice(1)) {
    const codigo = String(l[ix.codigo] ?? '').trim();
    const cls = String(l[ix.cls] ?? '').trim();
    if (!codigo || !cls) continue;
    const d = num(l[ix.debito]), c = num(l[ix.credito]);
    brutas.push({ codigo, cls, nome: String(l[ix.nome] ?? '').trim().slice(0, 80), a: num(l[ix.anterior]), d, c, s: num(l[ix.saldo]),
      devedor: d ? Math.sign(d) : c ? -Math.sign(c) : 0 });
  }
  const pai = cls => cls.slice(0, Math.max(0, cls.lastIndexOf('.')));
  // a convenção da maioria por grupo (as contas com movimento de cada pai), para as contas sem movimento
  const porPai = new Map();
  for (const x of brutas) if (x.devedor) { const k = pai(x.cls); porPai.set(k, (porPai.get(k) || 0) + x.devedor); }
  const classes = brutas.map(x => x.cls);
  // a conta sem movimento e sem saldo não tem sinal a escolher; com saldo e sem movimento: o sinal sai do total da mãe
  // (a soma das filhas, + devedor, tem que dar o saldo da mãe); as de baixo para cima, até 16 incertas por grupo
  const pelaMae = new Map();
  for (let rodada = 0; rodada < 6; rodada++) {
    const sinal = x => x.devedor || pelaMae.get(x.cls) || 0;
    for (const mae of brutas) {
      if (!sinal(mae)) continue;
      const filhas = brutas.filter(x => pai(x.cls) === mae.cls);
      if (!filhas.length) continue;
      const abertas = filhas.filter(x => !sinal(x) && x.s);
      if (!abertas.length || abertas.length > 16) continue;
      if (filhas.some(x => !sinal(x) && !x.s && x.a)) continue;
      const alvo = mae.s * sinal(mae);
      const certo = filhas.filter(x => sinal(x)).reduce((t, x) => t + x.s * sinal(x), 0);
      const achou = [];
      for (let m = 0; m < (1 << abertas.length) && achou.length < 2; m++) {
        const t = abertas.reduce((acc, x, i) => acc + x.s * ((m >> i) & 1 ? 1 : -1), certo);
        if (Math.abs(t - alvo) < 0.015) achou.push(m);
      }
      // uma resposta só: o sinal que soma o saldo da mãe é este (no arquivo, x.s * dev = + devedor)
      if (achou.length === 1) abertas.forEach((x, i) => pelaMae.set(x.cls, (achou[0] >> i) & 1 ? 1 : -1));
    }
  }
  return brutas.map(x => {
    let dev = x.devedor || pelaMae.get(x.cls) || 0, incerto = false;
    if (!dev) {
      incerto = !!(x.a || x.s);
      let k = pai(x.cls);
      while (k && !porPai.get(k)) k = pai(k);
      dev = Math.sign(porPai.get(k) || 0) || -1;
    }
    const ant = x.a * dev, sal = x.s * dev;   // + devedor, − credor
    const conta = {
      codigo: x.codigo, classificacao: x.cls, nome: x.nome, nivel: x.cls.split('.').length - 1,
      anterior: r2(Math.abs(ant)), anteriorDc: ant < 0 ? 'C' : 'D',
      debito: r2(Math.abs(x.d)), credito: r2(Math.abs(x.c)),
      saldo: r2(Math.abs(sal)), dc: sal < 0 ? 'C' : 'D',
      sintetica: classes.some(y => y.startsWith(x.cls + '.')),
    };
    if (incerto) conta.dcIncerto = true;
    return conta;
  });
}

/** Uma linha do CSV com ';' e aspas ("" = aspa dentro do campo). */
function campos(linha) {
  const r = [];
  let cur = '', dentro = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (dentro) {
      if (ch === '"' && linha[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') dentro = false; else cur += ch;
    } else if (ch === '"') dentro = true;
    else if (ch === ';') { r.push(cur); cur = ''; } else cur += ch;
  }
  r.push(cur);
  return r;
}

/** "21/11/2025" → "2025-11-21". */
const dataIso = t => { const m = String(t || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };

/**
 * O razão .csv do Alterdata → { contas: [{conta, nome, completo, anterior, debito, credito, saldo, n}],
 *   lancamentos: [{conta, data, historico, contra, documento, lote, debito, credito, saldo}] }.
 * No CSV do Alterdata o saldo vem com o sinal ao contrário (− devedor, + credor: o débito deixa mais negativo); aqui ele
 * sai como no balancete: + devedor, − credor (anterior + débitos − créditos = saldo).
 */
function lerRazao(buf) {
  const texto = buf.toString('latin1').replace(/^﻿/, '');
  const linhas = texto.split(/\r?\n/).filter(l => l.trim());
  if (!linhas.length) return { contas: [], lancamentos: [] };
  const cab = campos(linhas[0]).map(c => c.trim());
  const col = nome => cab.indexOf(nome);
  const ix = {
    conta: col('ContaCurto'), nome: col('ContaNome'), completo: col('ContaCompleto'), data: col('Data'), historico: col('Historico'),
    contra: col('ContraPartida'), documento: col('Documento'), lote: col('Lote'), debito: col('Debito'), credito: col('Credito'),
    anterior: col('SaldoAnterior'), saldo: col('Saldo'),
  };
  if (ix.conta < 0 || ix.data < 0 || ix.debito < 0 || ix.credito < 0) throw new Error('o CSV do razão não tem o cabeçalho do Alterdata (' + cab.slice(0, 5).join(';') + ')');
  const lancamentos = [];
  const porConta = new Map();
  for (const l of linhas.slice(1)) {
    const f = campos(l);
    const conta = String(f[ix.conta] || '').trim();
    if (!conta) continue;
    const lanc = {
      conta, data: dataIso(f[ix.data]), historico: String(f[ix.historico] || '').trim().slice(0, 300),
      contra: String(f[ix.contra] || '').trim(), documento: String(f[ix.documento] || '').trim(), lote: String(f[ix.lote] || '').trim(),
      debito: numero(f[ix.debito]), credito: numero(f[ix.credito]), saldo: -numero(f[ix.saldo]),
    };
    lancamentos.push(lanc);
    let c = porConta.get(conta);
    if (!c) {
      c = { conta, nome: String(f[ix.nome] || '').trim().slice(0, 80), completo: String(f[ix.completo] || '').trim(), anterior: -numero(f[ix.anterior]), debito: 0, credito: 0, saldo: 0, n: 0 };
      porConta.set(conta, c);
    }
    c.debito = Math.round((c.debito + lanc.debito) * 100) / 100;
    c.credito = Math.round((c.credito + lanc.credito) * 100) / 100;
    c.saldo = lanc.saldo;
    c.n++;
  }
  return { contas: [...porConta.values()], lancamentos };
}

/** Pedaços de uma lista que cabem num documento do Firestore (abaixo de ~900 KB em JSON). */
function emPedacos(lista, limite = 900 * 1000) {
  const pedacos = [];
  let atual = [], tam = 0;
  for (const x of lista) {
    const t = JSON.stringify(x).length + 1;
    if (atual.length && tam + t > limite) { pedacos.push(atual); atual = []; tam = 0; }
    atual.push(x);
    tam += t;
  }
  if (atual.length) pedacos.push(atual);
  return pedacos;
}

module.exports = { lerBalancete, lerDinamico, lerRazao, emPedacos, valorDc, numero, campos };
