// O envio dos boletos de honorários aos clientes (nads › Financeiro › Boletos, 10/11/2026). Roda no robô da nuvem
// (vigia-robo.js, com USAR_DRIVE_API=1, ao lado dos lotes do DP e do Fiscal):
//
//   1. a tela sobe os PDFs prontos em financeiroBoletos/{id} (com os pedaços em .../partes/{n}), lê a linha digitável e
//      aponta o cliente (contratoId, de financeiroHonorarios); quem pode no Financeiro revisa;
//   2. o Diretor dispara: envio = { status: 'fila', para (os destinatários do boleto), em, por, porUid } (as regras só
//      deixam o Diretor, em nome próprio, e nunca de novo para o que já está na fila ou enviado);
//   3. aqui: pega o boleto ('fila' -> 'enviando', numa transação: dois robôs não mandam o mesmo), confere que quem disparou é
//      Diretor, junta o PDF e manda um e-mail por boleto, com o PDF anexo, no desenho do DP com o chip 'Financeiro' e o
//      modelo de config/envioBoletos (vazio = MODELO_PADRAO). Grava 'enviado' (gmailId, assunto, enviadoEm) ou 'erro'.
//
// A TRAVA (Vitor, 10/11/2026: "testes só com destinatário interno"): enquanto LIBERADO_PARA_CLIENTES for false, só sai
// para os endereços de INTERNOS; um boleto com qualquer outro destinatário vira erro, sem mandar nada. Liberar é mudar a
// constante no código, com o ok do Vitor.
// LIBERADA em 10/11/2026 ("libera o envio de clientes"): os boletos saem para os e-mails do cliente na linha. Para voltar aos
// testes, é pôr false de novo.
//
// O que ficou 'enviando' (o robô caiu no meio) não é mandado de novo sozinho: vira erro pedindo para conferir na caixa do
// robô se saiu, antes de disparar outra vez.
const { ouvir } = require('./ouvinte');
const L = require('./lote-dp');
const dp = require('./envios-do-dp');

const COLECAO = 'financeiroBoletos';
const LIBERADO_PARA_CLIENTES = true;
const INTERNOS = ['nilmacontabilidade@gmail.com'];
// o freio próprio (o Gmail aguenta 500 destinatários por dia); passou, o boleto espera na fila e o robô tenta depois
const MAX_POR_HORA = 60;
const PRESO_MS = 30 * 60 * 1000;
const MAX_BYTES = 10 * 1024 * 1024;
const EMAIL = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[a-z]{2,}$/i;
const MODELO_PADRAO = {
  assunto: 'Boleto de honorários · {mes} · {cliente}',
  texto: 'Olá, {cliente}!\n\nSegue em anexo o boleto dos honorários contábeis de {mes}, no valor de {valor}, com vencimento em {vencimento}.\n\n' +
    'Se o pagamento já foi feito, por favor desconsidere este e-mail.\n\nQualquer dúvida, é só responder este e-mail.\n\nAtenciosamente,\nNilma Contabilidade',
};
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// ---------- funções puras (testadas sem rede) ----------

const reais = v => (typeof v === 'number' && Number.isFinite(v) ? 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '');
const dataBr = iso => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
const mesDe = comp => (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(comp || '')) ? MESES[Number(comp.slice(5)) - 1] + ' de ' + comp.slice(0, 4) : '');

/** Os destinatários que valem: e-mails válidos, sem repetir, no máximo 10. */
function destinatariosValidos(lista) {
  const vistos = new Set();
  const ok = [];
  for (const x of Array.isArray(lista) ? lista : []) {
    const e = String(x || '').trim().toLowerCase();
    if (!EMAIL.test(e) || vistos.has(e)) continue;
    vistos.add(e);
    ok.push(e);
  }
  return ok.slice(0, 10);
}

/**
 * Por que este boleto não pode sair ('' = pode). b: o documento; diretor: se quem disparou é Diretor; liberado: a trava.
 */
function motivoParaNaoMandar(b, { diretor, liberado = LIBERADO_PARA_CLIENTES, internos = INTERNOS } = {}) {
  const envio = b && b.envio;
  if (!envio || envio.status !== 'fila') return 'o boleto não está na fila';
  if (!diretor) return 'só o Diretor dispara os boletos';
  if (b.fora === true) return 'o boleto foi tirado do lote';
  if (!b.contratoId) return 'o boleto está sem cliente';
  const para = destinatariosValidos(envio.para);
  if (!para.length) return 'sem e-mail válido para mandar';
  if (!liberado) {
    const de = para.filter(e => !internos.includes(e));
    if (de.length) return 'o envio aos clientes ainda não foi liberado (por enquanto só para ' + internos.join(', ') + '); não mandei para ' + de.join(', ');
  }
  return '';
}

/** O nome do anexo: "Boleto de honorários - <cliente>.pdf", sem os caracteres que o Windows e o Gmail não aceitam. */
function nomeDoAnexo(cliente) {
  const quem = String(cliente || '').normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return 'Boleto de honorários' + (quem ? ' - ' + quem : '') + '.pdf';
}

/** Os campos do modelo: {cliente} {competencia} {mes} {valor} {vencimento}. */
function camposDoModelo(b, cliente) {
  const c = String(b.competencia || '');
  return {
    cliente: String(cliente || '').trim() || 'cliente',
    competencia: /^\d{4}-\d{2}$/.test(c) ? c.slice(5) + '/' + c.slice(0, 4) : '',
    mes: mesDe(c),
    valor: reais(b.valor) || 'indicado no boleto',
    vencimento: dataBr(b.vencimento) || 'indicado no boleto',
  };
}

/** Se o freio deixa mandar mais um agora (horarios: os envios da última hora, em ms). */
function dentroDoFreio(horarios, agora = Date.now(), max = MAX_POR_HORA) {
  return horarios.filter(t => agora - t < 36e5).length < max;
}

// ---------- o robô ----------

const enviosRecentes = [];

async function ehDiretor(db, uid) {
  if (!uid) return false;
  const u = (await db.collection('usuarios').doc(String(uid)).get()).data() || {};
  return u.nivel === 'diretor';
}

/** 'fila' -> 'enviando' numa transação; devolve o documento, ou null se outro já pegou. */
async function pegar(db, ref) {
  return db.runTransaction(async t => {
    const s = await t.get(ref);
    const d = s.data();
    if (!d || !d.envio || d.envio.status !== 'fila') return null;
    t.update(ref, { 'envio.status': 'enviando', 'envio.enviandoEm': new Date().toISOString() });
    return d;
  });
}

async function mandarUm(db, ref, deps) {
  const { log } = deps;
  const b = await pegar(db, ref);
  if (!b) return;
  try {
    const motivo = motivoParaNaoMandar(b, { diretor: await ehDiretor(db, b.envio.porUid) });
    if (motivo) throw new Error(motivo);
    const contrato = (await db.collection('financeiroHonorarios').doc(String(b.contratoId)).get()).data();
    if (!contrato) throw new Error('o cliente do boleto não está mais nos honorários');
    const cliente = String(contrato.nome || '').trim();
    const buffer = await L.bufferDoArquivo(ref, b);
    if (buffer.length > MAX_BYTES) throw new Error('o PDF passa de 10 MB');
    const para = destinatariosValidos(b.envio.para);
    const cfg = (await db.collection('config').doc('envioBoletos').get()).data() || {};
    const { assunto, texto } = dp.mensagemDoEnvio(cfg, camposDoModelo(b, cliente), MODELO_PADRAO);
    const geral = deps.config ? await deps.config().catch(() => ({})) : {};
    const nome = nomeDoAnexo(cliente);
    const visual = require('./email-html').htmlDoEnvioDp({
      assunto, texto, cliente, competencia: b.competencia, chip: 'Financeiro', assinatura: geral.assinatura || 'Nilma Contabilidade', caixa: deps.caixa,
      anexos: [{ nome, rotulo: 'Boleto de honorários', valor: b.valor, vencimento: b.vencimento }],
      rodape: 'Mensagem enviada pelo sistema do escritório com o boleto do mês.',
    });
    const gmailId = await deps.enviar({
      para: para.join(', '), assunto, corpo: texto + '\n\n- ' + nome, html: visual.html, imagens: visual.imagens,
      anexos: [{ nome, mime: 'application/pdf', buffer }],
    });
    enviosRecentes.push(Date.now());
    const agora = new Date().toISOString();
    await ref.update({ 'envio.status': 'enviado', 'envio.para': para, 'envio.enviadoEm': agora, 'envio.gmailId': String(gmailId || ''), 'envio.assunto': assunto });
    log('boletos: enviado', ref.id, '(' + cliente + ') para', para.join(', '));
  } catch (err) {
    const msg = String(err.message || err).slice(0, 300);
    log('boletos:', ref.id, 'não foi:', msg);
    await ref.update({ 'envio.status': 'erro', 'envio.erro': msg, 'envio.erroEm': new Date().toISOString() }).catch(() => {});
  }
}

function iniciarBoletosFinanceiro(db, deps) {
  const { log } = deps;
  let ocupado = false;
  let deNovo = false;
  let depois = null;
  async function atender() {
    if (ocupado) { deNovo = true; return; }
    ocupado = true;
    require('./ocupado').marcar('boletos-financeiro', 'Boletos do Financeiro');
    try {
      do {
        deNovo = false;
        const snap = await db.collection(COLECAO).where('envio.status', '==', 'fila').get();
        const fila = snap.docs.sort((a, b) => String(a.get('envio.em')).localeCompare(String(b.get('envio.em'))));
        for (const doc of fila) {
          if (!dentroDoFreio(enviosRecentes)) {
            log('boletos: freio de ' + MAX_POR_HORA + ' por hora; os outros esperam na fila');
            if (!depois) depois = setTimeout(() => { depois = null; void atender(); }, 10 * 60 * 1000);
            break;
          }
          await mandarUm(db, doc.ref, deps);
        }
      } while (deNovo);
    } catch (err) { log('boletos: não li a fila:', err.message); } finally { ocupado = false; require('./ocupado').marcar('boletos-financeiro', null); }
  }
  // o que ficou 'enviando' quando o robô caiu: erro, para a pessoa conferir antes de mandar de novo
  async function soltarPresos() {
    try {
      const snap = await db.collection(COLECAO).where('envio.status', '==', 'enviando').get();
      for (const d of snap.docs) {
        const desde = Date.parse(d.get('envio.enviandoEm') || d.get('envio.em') || '');
        if (ocupado || !(Date.now() - desde > PRESO_MS)) continue;
        await d.ref.update({ 'envio.status': 'erro', 'envio.erro': 'o robô parou no meio do envio; confira na caixa do robô se o e-mail saiu antes de mandar de novo', 'envio.erroEm': new Date().toISOString() });
      }
    } catch (e) { /* tenta de novo depois */ }
  }
  ouvir('Boletos do Financeiro', () => db.collection(COLECAO).where('envio.status', '==', 'fila'), () => { void atender(); }, log);
  setInterval(soltarPresos, 15 * 60 * 1000);
  void soltarPresos();
  log('boletos do Financeiro: ligado' + (LIBERADO_PARA_CLIENTES ? '' : ' (só para ' + INTERNOS.join(', ') + ')'));
}

module.exports = {
  iniciarBoletosFinanceiro, mandarUm,
  // puras, pro teste
  destinatariosValidos, motivoParaNaoMandar, nomeDoAnexo, camposDoModelo, dentroDoFreio, reais, dataBr, mesDe,
  MODELO_PADRAO, LIBERADO_PARA_CLIENTES, INTERNOS, COLECAO,
};
