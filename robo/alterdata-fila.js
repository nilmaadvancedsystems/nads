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
// Tipos: 'balancete' (o da Conferência: só o balancete, arquivo/xlsx) e 'mensal' (o da página Alterdata da empresa: o
// balancete e o razão de todas as contas). O banco e o roteiro entram por fora (o robô usa o Firestore e o Python; o teste,
// memória e um roteiro de mentira): teste-alterdata-fila.js.
'use strict';
const fs = require('fs');
const path = require('path');

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
const PASSOS_DO_ROTEIRO = { balancete: 6, razao: 5 };
const CLIQUE_MS = 700;

function criarFilaAlterdata({ banco, rodar, pastaDoPedido, log = () => {}, painel = null, limiteMs = 9 * 60 * 1000, apagarPasta = true }) {
  const fila = [];
  let ocupado = false;
  let atual = null;
  const esperando = [];

  function chegou(id) {
    if (!id || fila.includes(id) || atual === id) return;
    fila.push(id);
    setImmediate(proximo);
  }
  function saiu(id) {
    const i = fila.indexOf(id);
    if (i >= 0) fila.splice(i, 1);
  }

  async function proximo() {
    if (ocupado) return;
    if (!fila.length) { while (esperando.length) esperando.shift()(); return; }
    ocupado = true;
    const id = fila.shift();
    atual = id;
    try { await atender(id); } catch (err) {
      log('Alterdata: erro', id, err.message);
      if (painel) painel.erro('alterdata', 'O robô do Alterdata parou num pedido', err.message);
      await banco.atualizar(id, { status: 'erro', erro: 'o robô parou: ' + String(err.message).slice(0, 200), fimEm: agora() }).catch(() => {});
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
    // a barra: cada passo é uma fatia igual; o último pedaço (subir para o nads) fecha em 100
    const totalPassos = relatorios.reduce((n, r) => n + PASSOS_DO_ROTEIRO[r], 0) + 1;
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
    await banco.atualizar(id, { status: 'trabalhando', inicioEm: agora(), passos: [], andamento: { pct: 0, etapa, clique: '', em: agora() } });
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
      const nome = (rel === 'razao' ? 'Razao ' : 'Balancete ') + codigo + ' ' + p.competencia + (rel === 'razao' ? '.csv' : '.xlsx');
      const destino = path.join(sub, nome);
      const r = await comPrazo(rel, { codigo, inicio, fim, pasta: sub, destino }, nome => passo(rotulo + ': ' + nome), clique);
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
    if (tipo === 'balancete') {
      if (prontos.length) await banco.atualizar(id, { status: 'pronto', arquivoNome: arquivos.balancete.nome, arquivadoEm: apagou ? '' : path.join(pasta, 'balancete'), andamento: andamentoFim, fimEm: agora() });
      else await banco.atualizar(id, { status: 'erro', erro: arquivos.balancete.erro, andamento: andamentoFim, fimEm: agora() });
    } else {
      await banco.atualizar(id, prontos.length
        ? { status: 'pronto', arquivos, erro: erros.join(' · ').slice(0, 500), arquivadoEm: apagou ? '' : pasta, andamento: andamentoFim, fimEm: agora() }
        : { status: 'erro', arquivos, erro: erros.join(' · ').slice(0, 500), andamento: andamentoFim, fimEm: agora() });
    }
    if (painel) {
      if (prontos.length) painel.atividade('alterdata', 'Gerou ' + prontos.map(r => (r === 'razao' ? 'o razão' : 'o balancete')).join(' e ') + ' ' + codigo + ' ' + comp + ' no Alterdata', p.criadoPor ? 'pedido de ' + p.criadoPor : '');
      if (erros.length) painel.erro('alterdata', 'Alterdata ' + codigo + ' ' + comp, erros.join(' · '));
    }
    log('Alterdata: fim', id, codigo, p.competencia, prontos.join('+') || 'nada', erros.length ? '(' + erros.join(' · ') + ')' : '');
  }

  return {
    chegou,
    saiu,
    /** quantos esperam (sem o que está com o robô) */
    tamanho: () => fila.length,
    /** resolve quando a fila esvazia e nada está rodando (o teste usa) */
    ocioso: () => (!ocupado && !fila.length ? Promise.resolve() : new Promise(r => esperando.push(r))),
  };
}

module.exports = { criarFilaAlterdata, periodo, pastaVazia };
