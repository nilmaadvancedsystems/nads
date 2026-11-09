// Avisos de falha que antes só iam para o log (07/11/2026: o login do Claude do PC venceu em 05/11 e o suporte ficou
// parado até 07/11, 272 ciclos, sem ninguém saber). Usa o mesmo aviso no celular das entregas (avisos-push.js, só o
// envio, sem ouvir o banco) e não cria coleção nem regra nova.
//   - vigiaDeLogin: o login do Claude venceu → avisa o admin na 1ª vez, de novo no máximo 1x por dia, e avisa quando volta;
//     e devolve a espera até a próxima tentativa (10 min, 20, 40, até 1 h)
//   - avisoDoPedidoFgts: o pedido do FGTS terminou em erro → quem pediu (ou o admin) com a empresa e o motivo
const LINK_SUPORTE = 'https://tarefas-nilma.web.app/';
const LINK_FGTS = 'https://tarefas-nilma.web.app/tarefas/dp/fgts';
const ESPERA_INICIAL_MS = 10 * 60000;
const ESPERA_MAXIMA_MS = 60 * 60000;
const REPETIR_AVISO_MS = 24 * 3600000;

/** O envio de aviso deste processo (criado só na primeira vez que precisa); null quando não dá (sem firebase-admin etc.). */
function envioPadrao(db, log) {
  try { return require('./avisos-push').criarEnvio(db, log); }
  catch (err) { log('aviso de falha: sem o aviso no celular (' + err.message + ')'); return null; }
}

/**
 * Quem acompanha o login do Claude. `avisar(titulo, corpo)` manda para os admins (pode falhar sem derrubar nada).
 * vencido() → ms de espera até tentar de novo; voltou() quando uma tentativa funciona.
 */
function vigiaDeLogin({ avisar, log = () => {}, agora = Date.now }) {
  let desde = 0, ultimoAviso = 0, seguidas = 0;
  const mandar = (titulo, corpo) => Promise.resolve().then(() => avisar(titulo, corpo)).catch(err => log('aviso de login não saiu:', err.message));
  return {
    estaVencido: () => desde > 0,
    vencido() {
      const t = agora();
      seguidas++;
      if (!desde) desde = t;
      if (!ultimoAviso || t - ultimoAviso >= REPETIR_AVISO_MS) {
        ultimoAviso = t;
        void mandar('Suporte do nads parado: o Claude do PC saiu do login',
          'O robô do suporte (e o do FGTS pelo Claude) não consegue usar o Claude deste PC. No PC do escritório, abra o terminal e rode "claude auth login". Os bugs ficam na fila até lá.');
      }
      return Math.min(ESPERA_INICIAL_MS * Math.pow(2, seguidas - 1), ESPERA_MAXIMA_MS);
    },
    voltou() {
      if (!desde) return false;
      const minutos = Math.round((agora() - desde) / 60000);
      desde = 0; ultimoAviso = 0; seguidas = 0;
      void mandar('Suporte do nads voltou', 'O Claude do PC está com o login de novo (ficou fora ' + minutos + ' min). A fila de bugs segue.');
      return true;
    },
  };
}

// erros que são resposta normal do portal, não falha do robô
const ERRO_NORMAL = /sem débito em aberto|já existem guias aguardando/i;
const cnpjComPontos = c => String(c).length === 11
  ? String(c).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  : String(c).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

/** O aviso de um pedido do FGTS que terminou em erro (ou null: não é erro, já avisou, ou é resposta normal do portal). */
function avisoDoPedidoFgts(p) {
  if (!p || p.status !== 'erro' || p.avisadoErroEm) return null;
  const motivo = String(p.erro || 'sem motivo registrado');
  if (ERRO_NORMAL.test(motivo)) return null;
  const quem = (p.empresa ? p.empresa + ' · ' : '') + (p.cnpj ? cnpjComPontos(p.cnpj) : 'sem CNPJ');
  const mes = /^\d{4}-\d{2}$/.test(String(p.competencia || '')) ? ' (' + p.competencia.slice(5) + '/' + p.competencia.slice(0, 4) + ')' : '';
  return { titulo: 'FGTS: a guia não saiu', corpo: quem + mes + ': ' + motivo.slice(0, 220), uid: p.criadoPorUid || '', motivo, empresa: p.empresa || (p.cnpj ? cnpjComPontos(p.cnpj) : 'sem CNPJ') };
}

/** Manda o aviso do pedido: a quem pediu; se não há quem (ou o aparelho não está cadastrado), aos admins. */
async function avisarPedidoFgts(envio, aviso, id) {
  const tag = 'fgts-erro-' + id;
  let chegou = 0;
  if (aviso.uid) chegou = await envio.enviarPara([aviso.uid], aviso.titulo, aviso.corpo, tag, LINK_FGTS);
  if (!chegou) chegou = await envio.enviar('admin', '', aviso.titulo, aviso.corpo, tag, LINK_FGTS);
  return chegou;
}

/**
 * O motivo que junta os avisos (08/11/2026): o texto antes dos dois-pontos, sem o " · aviso" do pedido. Assim "o robô não
 * conseguiu entrar no gov.br com o certificado (Chrome do X): <o que a página mostrava>" é o mesmo motivo para o lote todo,
 * ainda que o detalhe mude um pouco de um lote para o outro.
 */
const chaveDoMotivo = m => String(m || '').split(' · ')[0].split(':')[0].trim().toLowerCase();

/**
 * Os avisos pendentes viram um por destinatário e motivo (08/11/2026: 25 guias com o mesmo erro de login viraram 25
 * notificações no celular do Sávio). itens: [{ id, aviso }] (o aviso de avisoDoPedidoFgts). Devolve [{ ids, id, aviso }]:
 * um pedido só fica como estava ("FGTS: a guia não saiu", com a empresa); mais de um vira "FGTS: N guias não saíram — <motivo>",
 * com as primeiras empresas no corpo.
 */
function juntarAvisosFgts(itens) {
  const grupos = new Map();
  for (const it of itens) {
    const k = (it.aviso.uid || '') + '\n' + chaveDoMotivo(it.aviso.motivo);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(it);
  }
  return [...grupos.values()].map(g => {
    const ids = g.map(it => it.id);
    if (g.length === 1) return { ids, id: ids[0], aviso: g[0].aviso };
    const primeiro = g[0].aviso;
    const iguais = g.every(it => it.aviso.motivo === primeiro.motivo);
    const motivo = iguais ? primeiro.motivo : primeiro.motivo.split(' · ')[0];
    const empresas = [...new Set(g.map(it => it.aviso.empresa).filter(Boolean))];
    const MOSTRA = 3;
    const lista = empresas.slice(0, MOSTRA).join(', ') + (empresas.length > MOSTRA ? ' e mais ' + (empresas.length - MOSTRA) : '');
    return {
      ids, id: 'lote-' + ids[0],
      aviso: { titulo: 'FGTS: ' + g.length + ' guias não saíram', corpo: motivo.slice(0, 200) + ' — ' + lista, uid: primeiro.uid, motivo },
    };
  });
}

const JANELA_AVISOS_MS = 60000;
const SEGURA_NO_MAXIMO_MS = 10 * 60000;

/**
 * Segura os avisos de erro do FGTS e manda juntos (08/11/2026). Solta quando passa `janelaMs` sem erro novo e a fila do FGTS
 * não está trabalhando (`ocupado()`), ou quando o erro mais antigo já esperou `maximoMs` (para ninguém ficar sem saber).
 * enviar(aviso, id) manda um aviso (avisarPedidoFgts); aoAvisar(ids) marca os pedidos (avisadoErroEm); aoFalhar(err, ids).
 */
function agrupadorDeAvisosFgts({ enviar, aoAvisar = async () => {}, aoFalhar = () => {}, ocupado = () => false, janelaMs = JANELA_AVISOS_MS, maximoMs = SEGURA_NO_MAXIMO_MS, agora = Date.now, relogio = { setTimeout, clearTimeout } }) {
  let pendentes = [], primeiro = 0, ultimo = 0, timer = null;
  function agendar(ms) {
    if (timer) relogio.clearTimeout(timer);
    timer = relogio.setTimeout(() => { timer = null; conferir(); }, Math.max(ms, 0));
  }
  function conferir() {
    if (!pendentes.length) return;
    const t = agora();
    if ((t - ultimo >= janelaMs && !ocupado()) || t - primeiro >= maximoMs) { void soltar(); return; }
    // falta a janela sem erro novo, ou a fila ainda trabalha (aí confere de novo daqui a uma janela); nunca passa do máximo
    const falta = Math.max(janelaMs - (t - ultimo), 0) || janelaMs;
    agendar(Math.min(falta, maximoMs - (t - primeiro)));
  }
  async function soltar() {
    if (timer) { relogio.clearTimeout(timer); timer = null; }
    const lote = pendentes;
    pendentes = [];
    await Promise.all(juntarAvisosFgts(lote).map(g => Promise.resolve()
      .then(() => enviar(g.aviso, g.id))
      .then(() => aoAvisar(g.ids, g.aviso))
      .catch(err => aoFalhar(err, g.ids))));
  }
  return {
    /** Guarda o aviso do pedido. */
    adicionar(id, aviso) {
      const t = agora();
      if (!pendentes.length) primeiro = t;
      ultimo = t;
      pendentes.push({ id, aviso });
      agendar(janelaMs);
    },
    pendentes: () => pendentes.length,
    /** Manda já o que está guardado (testes, ou o robô saindo). */
    soltar,
  };
}

module.exports = { vigiaDeLogin, avisoDoPedidoFgts, avisarPedidoFgts, juntarAvisosFgts, agrupadorDeAvisosFgts, chaveDoMotivo, envioPadrao, LINK_SUPORTE, LINK_FGTS };
