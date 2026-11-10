// A fila do robô do Alterdata (04/11/2026). O Contábil é uma tela só: um pedido por vez, na ordem de chegada. O Vitor:
// "tambem preciso que ele aguente requisições simultaneas, um não pode atrapalhar o outro". Por isso:
//   - os pedidos que chegam juntos entram na fila (o mesmo id não entra duas vezes) e esperam a vez;
//   - antes de atender, relê o pedido: o cancelado ou já atendido sai sem rodar;
//   - cada pedido trabalha numa pasta própria e vazia (pastaDoPedido(id), uma subpasta por relatório): o arquivo de um
//     nunca é pego por outro;
//   - o pedido mensal repetido (mesma empresa e mês, pedido enquanto o outro estava na fila) não roda de novo: aponta para
//     o que já saiu (mesmoQue) e usa os arquivos dele;
//   - cada relatório tem prazo (limiteMs): estourou, o roteiro é parado (o sinal mata o Python), o relatório vira erro com
//     o motivo e a fila segue.
// O andamento (05/11/2026, Vitor: "quero que no nads tenha um feedback do que o robo ta fazendo, onde ele ta clicando com
// uma barra de progresso"): o pedido leva andamento = {pct, etapa, clique, em}; a etapa muda a cada PASSO do roteiro e o
// clique a cada CLIQUE (no máximo um a cada CLIQUE_MS no banco). Os arquivos subidos saem da pasta do pedido (05/11/2026:
// "os dados tem que sair da pasta D: e subir pro nads"): com tudo pronto e no banco, a pasta é apagada.
// Tipos: 'balancete' (o da Conferência: só o balancete, arquivo/xlsx), 'mensal' (o da página Alterdata da empresa: o
// balancete e o razão de todas as contas) e 'importar' (06/11/2026: a planilha de lançamentos de 10 colunas importada no
// Contábil, num lote novo). O banco e o roteiro entram por fora (o robô usa o Firestore e o Python; o teste,
// memória e um roteiro de mentira): teste-alterdata-fila.js.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const agora = () => new Date().toISOString();
const competenciaValida = c => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(c || ''));

/** O primeiro e o último dia da competência, como o Alterdata pede (dd/mm/aaaa). */
function periodo(competencia) {
  const [a, m] = competencia.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return ['01/' + mm + '/' + a, String(ultimo).padStart(2, '0') + '/' + mm + '/' + a];
}

/** Uma pasta nova e vazia (se já existe com coisa dentro, a próxima com -2, -3…). */
function pastaVazia(base) {
  for (let n = 1; n < 100; n++) {
    const p = n === 1 ? base : base + '-' + n;
    if (!fs.existsSync(p)) { fs.mkdirSync(p, { recursive: true }); return p; }
    if (!fs.readdirSync(p).length) return p;
  }
  throw new Error('não consegui uma pasta vazia para ' + base);
}

/**
 * @param {object} o
 * @param {object} o.banco  { pegar(id) → o pedido como estava (pendente) ou null, ler(id), atualizar(id, campos), gravarArquivo(id, relatorio, buffer, nome, tipo) → {partes},
 *                            prontoIgual(id, pedido) → {id, arquivos} | null }
 * @param {Function} o.rodar  (relatorio, {codigo, inicio, fim, pasta, destino}, passo, sinal) → Promise<{ok, erro?}>
 * @param {Function} o.pastaDoPedido  id → caminho da pasta do pedido
 * @param {number} [o.limiteMs]  o prazo de cada relatório
 */
// quantos PASSO: cada roteiro escreve (mais o "pronto" da fila), para a porcentagem da barra
const PASSOS_DO_ROTEIRO = { balancete: 6, dinamico: 6, razao: 5, importar: 6 };
const CLIQUE_MS = 700;

// O Contábil que não responde (07/11/2026: 38 pedidos da 571 seguidos, todos "a janela não abriu", um por minuto depois de um
// reinício): três falhas de ambiente seguidas fecham e reabrem o Contábil uma vez (reabrirContabil); se continuar, a fila
// pausa (pausaMs) e os pedidos ficam "esperando o Contábil" (pendentes, com esperandoContabil), em vez de virar erro; o admin é
// avisado uma vez. Sem sessão de tela ativa (SendInput com 0 eventos) o clique nem existe: pausa curta, sem queimar a fila.
const RE_JANELA = /n[ãa]o abriu|not responding|n[ãa]o respond/i;
const RE_SEM_TELA = /SendInput|no active desktop|sem sess[ãa]o de tela/i;
const FALHAS_PARA_REABRIR = 3;
const MAX_ESPERAS = 3;

/** 'semTela' | 'janela' | '' — o que as mensagens de erro de um pedido dizem sobre o ambiente (todas precisam ser de ambiente). */
function classeDoErro(erros) {
  const l = (erros || []).map(e => String(e || '')).filter(Boolean);
  if (!l.length) return '';
  if (l.some(e => RE_SEM_TELA.test(e)) && l.every(e => RE_SEM_TELA.test(e) || RE_JANELA.test(e))) return 'semTela';
  return l.every(e => RE_JANELA.test(e)) ? 'janela' : '';
}

/** A frase para quem pediu (o detalhe técnico vai junto, no fim). */
function mensagemClara(classe, erros, extra) {
  const detalhe = [...new Set((erros || []).map(e => String(e).trim()).filter(Boolean))].join(' · ');
  const base = classe === 'semTela'
    ? 'O robô não conseguiu clicar no Contábil: o servidor está sem sessão de tela ativa.'
    : classe === 'janela'
      ? 'O Contábil não respondeu ao robô (as janelas dos relatórios não abriram), então nada foi gerado.'
      : '';
  if (!base) return detalhe;
  return (base + (extra ? ' ' + extra : ' Peça de novo em alguns minutos; se continuar, avise o suporte.') + ' Detalhe: ' + detalhe).slice(0, 500);
}

function criarFilaAlterdata({ banco, rodar, pastaDoPedido, log = () => {}, painel = null, limiteMs = 9 * 60 * 1000, apagarPasta = true,
  reabrirContabil = null, pausaMs = 30 * 60 * 1000, pausaSemTelaMs = 5 * 60 * 1000, pausado = () => false }) {
  const fila = [];
  let ocupado = false;
  let atual = null;
  const esperando = [];
  // o ambiente: falhas seguidas, se já reabriu o Contábil nesta sequência, a pausa
  let falhasSeguidas = 0;
  let jaReabriu = false;
  let reabrirAgora = false;
  let pausadoAte = 0;
  let pausaMotivo = '';
  let pausaTimer = null;
  let avisouPausa = false;
  let avisouSemTela = false;
  const marcados = new Set();
  const emPausa = () => pausadoAte > Date.now();

  function pausar(ms, motivo) {
    pausadoAte = Date.now() + ms;
    pausaMotivo = motivo;
    clearTimeout(pausaTimer);
    pausaTimer = setTimeout(() => {
      pausadoAte = 0; falhasSeguidas = 0; jaReabriu = false; marcados.clear();
      log('Alterdata: fim da pausa; a fila volta a tentar');
      setImmediate(proximo);
    }, ms);
    if (pausaTimer.unref) pausaTimer.unref();
    log('Alterdata: fila pausada por ' + Math.round(ms / 60000) + ' min (' + motivo + ')');
  }

  /** Depois de um pedido que não saiu por causa do ambiente: 'esperar' (volta para a fila, pausada) ou 'erro' (termina com a mensagem). */
  function aposFalhaDeAmbiente(classe, esperasAntes) {
    if (classe === 'semTela') {
      if (!avisouSemTela) { avisouSemTela = true; if (painel) painel.erro('alterdata', 'O servidor está sem sessão de tela ativa', 'o robô não consegue clicar no Contábil (SendInput sem eventos); a fila foi pausada e os pedidos esperam'); }
      if (esperasAntes >= MAX_ESPERAS) return 'erro';
      pausar(pausaSemTelaMs, 'o servidor está sem sessão de tela ativa');
      return 'esperar';
    }
    falhasSeguidas++;
    if (falhasSeguidas < FALHAS_PARA_REABRIR) return 'erro';
    if (!jaReabriu && reabrirContabil) { jaReabriu = true; falhasSeguidas = 0; reabrirAgora = true; return 'erro'; }
    if (!avisouPausa) { avisouPausa = true; if (painel) painel.erro('alterdata', 'O Contábil do servidor não está respondendo', 'as janelas dos relatórios não abrem, nem depois de reabrir o Contábil; pausei a fila por ' + Math.round(pausaMs / 60000) + ' min e os pedidos esperam'); }
    if (esperasAntes >= MAX_ESPERAS) return 'erro';
    pausar(pausaMs, 'esperando o Contábil');
    return 'esperar';
  }
  function deuCerto() { falhasSeguidas = 0; jaReabriu = false; avisouPausa = false; avisouSemTela = false; }
  const textoEspera = () => (pausaMotivo === 'esperando o Contábil' ? 'esperando o Contábil voltar a responder' : pausaMotivo);
  const camposEspera = () => ({ esperandoContabil: textoEspera(), andamento: { pct: 0, etapa: textoEspera(), clique: '', em: agora() } });

  // Os pedidos mensais iguais que esperavam na fila (mesma empresa e mês) recebem o resultado deste, sem rodar de novo
  // (07/11/2026: 38 pedidos iguais da 571, um por minuto). Cada um é relido antes: só o ainda pendente é atendido.
  const lidos = new Map();   // id → {codigo, competencia, tipo} (o que não muda no pedido)
  async function repassar(id, p, final) {
    for (const q of [...fila]) {
      let d = lidos.get(q);
      if (!d) { const l = await banco.ler(q); if (!l) continue; d = { codigo: Number(l.codigo), competencia: l.competencia, tipo: l.tipo || 'balancete' }; lidos.set(q, d); }
      if (d.tipo !== 'mensal' || d.codigo !== Number(p.codigo) || d.competencia !== p.competencia) continue;
      const agoraQ = await banco.ler(q);
      if (!agoraQ || agoraQ.status !== 'pendente') continue;
      saiu(q);
      const passos = [{ n: 1, nome: 'o mesmo pedido (empresa e mês) já foi atendido agora há pouco: recebeu o mesmo resultado', quando: agora() }];
      await banco.atualizar(q, { status: final.status, mesmoQue: id, arquivos: final.arquivos, erro: final.erro || '', passos, andamento: final.andamento, inicioEm: agora(), fimEm: agora() }).catch(() => {});
      log('Alterdata: pedido igual na fila', q, '→', id, final.status);
    }
  }

  function chegou(id) {
    if (!id || fila.includes(id) || atual === id) return;
    fila.push(id);
    setImmediate(proximo);
  }
  function saiu(id) {
    const i = fila.indexOf(id);
    if (i >= 0) fila.splice(i, 1);
  }
  /** "Passar na frente" (a Central dos robôs): o pedido que ainda espera vira o próximo; o que já está rodando não muda. */
  function naFrente(id) {
    const i = fila.indexOf(id);
    if (i > 0) { fila.splice(i, 1); fila.unshift(id); }
  }

  async function proximo() {
    if (ocupado) return;
    if (!fila.length) { while (esperando.length) esperando.shift()(); return; }
    // pausado pela Central dos robôs: ninguém novo começa; retomar() põe a fila para andar de novo
    if (pausado()) { while (esperando.length) esperando.shift()(); return; }
    if (emPausa()) {
      // pausada: ninguém roda; os pedidos que esperam ficam marcados (uma vez) como "esperando o Contábil"
      ocupado = true;
      for (const q of [...fila]) if (!marcados.has(q)) { marcados.add(q); await banco.atualizar(q, camposEspera()).catch(() => {}); }
      ocupado = false;
      while (esperando.length) esperando.shift()();
      return;
    }
    ocupado = true;
    const id = fila.shift();
    atual = id;
    try { await atender(id); } catch (err) {
      log('Alterdata: erro', id, err.message);
      if (painel) painel.erro('alterdata', 'O robô do Alterdata parou num pedido', err.message);
      await banco.atualizar(id, { status: 'erro', erro: 'o robô parou: ' + String(err.message).slice(0, 200), fimEm: agora() }).catch(() => {});
    }
    if (reabrirAgora) {
      reabrirAgora = false;
      log('Alterdata: ' + FALHAS_PARA_REABRIR + ' pedidos seguidos sem a janela abrir; fechando e abrindo o Contábil uma vez');
      try { await reabrirContabil(); } catch (err) { log('Alterdata: não consegui reabrir o Contábil', err.message); }
    }
    atual = null;
    ocupado = false;
    if (painel) painel.fazendo('alterdata', null);
    setImmediate(proximo);
  }

  /** Roda um relatório com prazo: estourou, o sinal para o roteiro e volta o erro. */
  async function comPrazo(relatorio, args, passo, clique) {
    const ctl = new AbortController();
    let relogio;
    const prazo = new Promise(resolve => {
      relogio = setTimeout(() => { ctl.abort(); resolve({ ok: false, prazo: true, erro: 'passou de ' + Math.round(limiteMs / 60000) + ' min sem terminar; o robô parou e seguiu a fila' }); }, limiteMs);
    });
    try {
      return await Promise.race([rodar(relatorio, args, passo, ctl.signal, clique).catch(e => ({ ok: false, erro: e.message })), prazo]);
    } finally { clearTimeout(relogio); }
  }

  async function atender(id) {
    // pegar: de uma vez só (transação), passa de pendente a trabalhando nesta máquina; null = cancelado, já pego por outra
    // máquina, ou o Contábil daqui não está pronto (o pedido fica para quem estiver)
    const p = banco.pegar ? await banco.pegar(id) : await banco.ler(id);
    if (!p || p.status !== 'pendente') return;
    const tipo = p.tipo || 'balancete';
    const codigo = Number(p.codigo);
    if (tipo === 'importar') return importar(id, p, codigo);
    if (tipo !== 'balancete' && tipo !== 'mensal') { await banco.atualizar(id, { status: 'erro', erro: 'tipo de relatório desconhecido: ' + tipo, fimEm: agora() }); return; }
    if (!Number.isInteger(codigo) || codigo <= 0) { await banco.atualizar(id, { status: 'erro', erro: 'código da empresa inválido', fimEm: agora() }); return; }
    if (!competenciaValida(p.competencia)) { await banco.atualizar(id, { status: 'erro', erro: 'competência inválida', fimEm: agora() }); return; }

    // o mesmo mês da mesma empresa já saiu enquanto este esperava: usa o que saiu
    if (tipo === 'mensal') {
      const igual = await banco.prontoIgual(id, p);
      if (igual) {
        await banco.atualizar(id, { status: 'pronto', mesmoQue: igual.id, arquivos: igual.arquivos, passos: [{ n: 1, nome: 'o mesmo mês já tinha saído agora há pouco: são os mesmos arquivos', quando: agora() }], inicioEm: agora(), fimEm: agora() });
        log('Alterdata: pedido igual', id, '→', igual.id);
        return;
      }
    }

    const [inicio, fim] = periodo(p.competencia);
    const comp = p.competencia.slice(5) + '/' + p.competencia.slice(0, 4);
    const relatorios = tipo === 'mensal' ? ['balancete', 'razao'] : ['balancete'];
    // no pedido mensal o balancete é o Balancete Dinâmico (06/11/2026, Vitor: "e mais facil ele puxar o balancete dinamico
    // ao invez do balancete"): Consultas → Balancete Dinâmico → Exportar (XLS com o saldo anterior de cada conta)
    const roteiroDe = rel => (tipo === 'mensal' && rel === 'balancete' ? 'dinamico' : rel);
    // a barra: cada passo é uma fatia igual; o último pedaço (subir para o nads) fecha em 100
    const totalPassos = relatorios.reduce((n, r) => n + PASSOS_DO_ROTEIRO[roteiroDe(r)], 0) + 1;
    const passos = [];
    let etapa = 'começando';
    let ultimoClique = 0;
    const pct = () => Math.min(99, Math.round(passos.length / totalPassos * 100));
    const passo = nome => {
      passos.push({ n: passos.length + 1, nome: String(nome).slice(0, 200), quando: agora() });
      etapa = String(nome).slice(0, 200);
      return banco.atualizar(id, { passos, andamento: { pct: pct(), etapa, clique: '', em: agora() } }).catch(() => {});
    };
    const clique = nome => {
      if (Date.now() - ultimoClique < CLIQUE_MS) return;
      ultimoClique = Date.now();
      return banco.atualizar(id, { andamento: { pct: pct(), etapa, clique: String(nome).slice(0, 120), em: agora() } }).catch(() => {});
    };
    await banco.atualizar(id, { status: 'trabalhando', esperandoContabil: '', inicioEm: agora(), passos: [], andamento: { pct: 0, etapa, clique: '', em: agora() } });
    const pasta = pastaVazia(pastaDoPedido(id));
    const arquivos = {};
    for (const rel of relatorios) {
      // o pedido cancelado no meio não segue para o próximo relatório
      const agoraP = await banco.ler(id);
      if (!agoraP || agoraP.status === 'cancelado') { log('Alterdata: cancelado no meio', id); return; }
      const rotulo = rel === 'razao' ? 'razão' : 'balancete';
      if (painel) painel.fazendo('alterdata', (rel === 'razao' ? 'Razão ' : 'Balancete ') + codigo + ' ' + comp + ' no Alterdata');
      log('Alterdata:', rotulo, codigo, p.competencia, id);
      const sub = pastaVazia(path.join(pasta, rel));
      const nome = (rel === 'razao' ? 'Razao ' : 'Balancete ') + codigo + ' ' + p.competencia + (rel === 'razao' ? '.csv' : roteiroDe(rel) === 'dinamico' ? '.xls' : '.xlsx');
      const destino = path.join(sub, nome);
      const r = await comPrazo(roteiroDe(rel), { codigo, inicio, fim, pasta: sub, destino }, nome => passo(rotulo + ': ' + nome), clique);
      if (!r.ok || !fs.existsSync(destino)) {
        arquivos[rel] = { status: 'erro', nome: '', tamanho: 0, partes: 0, erro: String(r.erro || 'o arquivo não apareceu').slice(0, 300) };
        log('Alterdata: erro', rotulo, codigo, p.competencia, arquivos[rel].erro);
        // estourou o prazo: o Contábil provavelmente travou; o próximo relatório deste pedido nem tenta
        if (r.prazo) {
          for (const resto of relatorios.slice(relatorios.indexOf(rel) + 1)) arquivos[resto] = { status: 'erro', nome: '', tamanho: 0, partes: 0, erro: 'não tentei: o ' + rotulo + ' travou antes' };
          break;
        }
        continue;
      }
      const buf = fs.readFileSync(destino);
      clique('subindo o ' + rotulo + ' para o nads');
      const g = await banco.gravarArquivo(id, rel, buf, nome, tipo);
      arquivos[rel] = { status: 'pronto', nome, tamanho: buf.length, partes: g.partes, erro: '' };
      await passo(rotulo + ' pronto');
    }
    const prontos = relatorios.filter(r => arquivos[r].status === 'pronto');
    const erros = relatorios.filter(r => arquivos[r].status === 'erro').map(r => (r === 'razao' ? 'razão' : 'balancete') + ': ' + arquivos[r].erro);
    // os números para dentro do nads (o balancete e o razão lidos, por conta), se o banco souber importar
    if (banco.importar && prontos.length) {
      await passo('lendo os números para o nads');
      for (const rel of prontos) {
        try {
          const resumo = await banco.importar(id, rel, path.join(pasta, rel, arquivos[rel].nome), p);
          if (resumo) arquivos[rel].importado = resumo;
        } catch (err) {
          arquivos[rel].importado = { erro: String(err.message).slice(0, 200) };
          log('Alterdata: não consegui ler os números do', rel, id, err.message);
        }
      }
    }
    const fimP = await banco.ler(id);
    if (fimP && fimP.status === 'cancelado') return;
    // tudo pronto e no banco: a cópia da pasta sai (com erro, fica para ver o que houve)
    const apagou = apagarPasta && prontos.length === relatorios.length;
    if (apagou) { try { fs.rmSync(pasta, { recursive: true, force: true }); } catch (err) { log('Alterdata: não apaguei a pasta', pasta, err.message); } }
    const andamentoFim = { pct: 100, etapa: prontos.length ? 'pronto' : 'erro', clique: '', em: agora() };
    // sem nada pronto e por causa do ambiente (Contábil mudo, sem tela): conta a falha; pode voltar à fila, esperando
    const classe = prontos.length ? '' : classeDoErro(relatorios.map(r => arquivos[r].erro));
    if (prontos.length) deuCerto();
    const acao = classe ? aposFalhaDeAmbiente(classe, Number(p.esperas || 0)) : 'erro';
    if (acao === 'esperar') {
      await banco.atualizar(id, { status: 'pendente', onde: '', esperas: Number(p.esperas || 0) + 1, ...camposEspera(), arquivos, erro: '', fimEm: '' });
      fila.unshift(id);
      log('Alterdata: pedido de volta para a fila,', textoEspera(), id);
      return;
    }
    const semRotulo = erros.map(e => e.replace(/^(razão|balancete): /, ''));
    const msgErro = classe ? mensagemClara(classe, semRotulo, reabrirAgora ? 'O robô vai fechar e abrir o Contábil agora; peça de novo em uns 5 minutos.' : '') : erros.join(' · ').slice(0, 500);
    let final;
    if (tipo === 'balancete') {
      final = prontos.length ? { status: 'pronto', arquivoNome: arquivos.balancete.nome, arquivadoEm: apagou ? '' : path.join(pasta, 'balancete'), andamento: andamentoFim, fimEm: agora() }
        : { status: 'erro', erro: classe ? msgErro : arquivos.balancete.erro, andamento: andamentoFim, fimEm: agora() };
    } else {
      final = prontos.length
        ? { status: 'pronto', arquivos, erro: msgErro, arquivadoEm: apagou ? '' : pasta, andamento: andamentoFim, fimEm: agora() }
        : { status: 'erro', arquivos, erro: msgErro, andamento: andamentoFim, fimEm: agora() };
    }
    await banco.atualizar(id, final);
    if (tipo === 'mensal' && !emPausa()) await repassar(id, p, final);
    if (painel) {
      if (prontos.length) painel.atividade('alterdata', 'Gerou ' + prontos.map(r => (r === 'razao' ? 'o razão' : 'o balancete')).join(' e ') + ' ' + codigo + ' ' + comp + ' no Alterdata', p.criadoPor ? 'pedido de ' + p.criadoPor : '');
      // o "Refazer" da Central só onde nada saiu: com o balancete pronto e o razão com erro, o pedido fica 'pronto'
      if (erros.length) painel.erro('alterdata', 'Alterdata ' + codigo + ' ' + comp, erros.join(' · '), prontos.length ? {} : { pedido: id });
    }
    log('Alterdata: fim', id, codigo, p.competencia, prontos.join('+') || 'nada', erros.length ? '(' + erros.join(' · ') + ')' : '');
  }

  /**
   * A importação dos lançamentos no Contábil (06/11/2026, Vitor: "importar os lancamentos direto no alterdata"): o pedido
   * leva a planilha de 10 colunas (planilha, base64) e o nome do lote; o robô grava a planilha na pasta do pedido, roda o
   * roteiro (Importação financeira → empresa → novo lote → planilha → Importação Personalizada - Excel → Concluir) e
   * apaga a pasta. A mesma planilha da mesma empresa já importada não entra de novo (o duplo clique, o pedido repetido):
   * o pedido aponta para o que já importou (mesmoQue).
   */
  async function importar(id, p, codigo) {
    const erro = msg => banco.atualizar(id, { status: 'erro', erro: msg, fimEm: agora(), andamento: { pct: 100, etapa: 'erro', clique: '', em: agora() } });
    if (!Number.isInteger(codigo) || codigo <= 0) return erro('código da empresa inválido');
    const lote = String(p.lote || '').trim();
    if (!lote) return erro('sem o nome do lote');
    const buf = Buffer.from(String(p.planilha || ''), 'base64');
    if (buf.length < 512) return erro('a planilha veio vazia');
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    if (banco.importadoIgual) {
      const igual = await banco.importadoIgual(id, codigo, sha256);
      if (igual) {
        await banco.atualizar(id, { status: 'pronto', sha256, mesmoQue: igual.id, resultado: 'esta mesma planilha já foi importada nesta empresa (lote "' + (igual.lote || '') + '"); não importei de novo', inicioEm: agora(), fimEm: agora(), andamento: { pct: 100, etapa: 'pronto', clique: '', em: agora() } });
        log('Alterdata: importação igual', id, '→', igual.id);
        return;
      }
    }
    const total = PASSOS_DO_ROTEIRO.importar + 1;
    const passos = [];
    let etapa = 'começando';
    let ultimoClique = 0;
    const pct = () => Math.min(99, Math.round(passos.length / total * 100));
    const passo = nome => {
      passos.push({ n: passos.length + 1, nome: String(nome).slice(0, 200), quando: agora() });
      etapa = String(nome).slice(0, 200);
      return banco.atualizar(id, { passos, andamento: { pct: pct(), etapa, clique: '', em: agora() } }).catch(() => {});
    };
    const clique = nome => {
      if (Date.now() - ultimoClique < CLIQUE_MS) return;
      ultimoClique = Date.now();
      return banco.atualizar(id, { andamento: { pct: pct(), etapa, clique: String(nome).slice(0, 120), em: agora() } }).catch(() => {});
    };
    await banco.atualizar(id, { status: 'trabalhando', esperandoContabil: '', sha256, inicioEm: agora(), passos: [], andamento: { pct: 0, etapa, clique: '', em: agora() } });
    if (painel) painel.fazendo('alterdata', 'Importando lançamentos na ' + codigo + ' no Alterdata');
    log('Alterdata: importar', codigo, '"' + lote + '"', id);
    const pasta = pastaVazia(pastaDoPedido(id));
    const destino = path.join(pasta, 'lancamentos ' + codigo + '.xls');
    fs.writeFileSync(destino, buf);
    const r = await comPrazo('importar', { codigo, lote, destino }, passo, clique);
    const msgs = Array.isArray(r.mensagens) ? r.mensagens.map(m => String(m).slice(0, 300)).slice(0, 10) : [];
    if (apagarPasta) { try { fs.rmSync(pasta, { recursive: true, force: true }); } catch (err) { log('Alterdata: não apaguei a pasta', pasta, err.message); } }
    const fimP = await banco.ler(id);
    if (fimP && fimP.status === 'cancelado') return;
    const andamentoFim = { pct: 100, etapa: r.ok ? 'pronto' : 'erro', clique: '', em: agora() };
    if (r.ok) deuCerto();
    const classe = r.ok ? '' : classeDoErro([r.erro]);
    if (classe && aposFalhaDeAmbiente(classe, Number(p.esperas || 0)) === 'esperar') {
      await banco.atualizar(id, { status: 'pendente', onde: '', esperas: Number(p.esperas || 0) + 1, ...camposEspera(), erro: '', fimEm: '' });
      fila.unshift(id);
      log('Alterdata: importação de volta para a fila,', textoEspera(), id);
      return;
    }
    if (r.ok) {
      await banco.atualizar(id, { status: 'pronto', resultado: msgs.join(' · ') || 'importação concluída', empresaAlterdata: String(r.empresa || '').slice(0, 200), andamento: andamentoFim, fimEm: agora() });
      if (painel) painel.atividade('alterdata', 'Importou lançamentos na ' + codigo + ' (lote "' + lote + '") no Alterdata', p.criadoPor ? 'pedido de ' + p.criadoPor : '');
    } else {
      await banco.atualizar(id, { status: 'erro', erro: classe ? mensagemClara(classe, [r.erro]) : String(r.erro || 'não deu').slice(0, 500), resultado: msgs.join(' · '), andamento: andamentoFim, fimEm: agora() });
      if (painel) painel.erro('alterdata', 'Importação na ' + codigo, String(r.erro || ''));
    }
    log('Alterdata: fim da importação', id, codigo, r.ok ? 'ok' : 'erro: ' + r.erro);
  }

  return {
    chegou,
    saiu,
    naFrente,
    /** depois da pausa da Central dos robôs: a fila volta a andar */
    retomar: () => { setImmediate(proximo); },
    /** quantos esperam (sem o que está com o robô) */
    tamanho: () => fila.length,
    pausada: () => emPausa(),
    /** se um pedido está com o robô agora (o diagnóstico da tela espera) */
    ocupado: () => ocupado,
    /** resolve quando a fila esvazia e nada está rodando (o teste usa) */
    ocioso: () => (!ocupado && (!fila.length || emPausa()) ? Promise.resolve() : new Promise(r => esperando.push(r))),
  };
}

module.exports = { criarFilaAlterdata, periodo, pastaVazia, classeDoErro, mensagemClara };
