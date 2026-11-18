// O e-mail ao cliente quando o escritório responde ou conclui a solicitação dele (plano do Acessórias, 17/11/2026, ficha
// aviso-de-resposta, parte B; frase do dono: "Seguir"). Roda no vigia, SÓ NA NUVEM (ROBO_NA_NUVEM), para não mandar duas
// vezes. Ouve chamados respondidos ou concluídos; a conta de quando avisar é do core (areaCliente.precisaAvisar, pelo
// robo/gerado/danfse.js): a última resposta da equipe, mais nova que o último aviso, com 15 minutos de espera para juntar
// as seguidas. O e-mail não leva a resposta: só o título do pedido e o link da Área (a Área não tem chat).
//
//   - A TRAVA (como a do Mandei, robo/mandei.js): enquanto LIBERADO_PARA_CLIENTES for false, o e-mail vai só para os
//     INTERNOS, com "[TESTE]" no assunto e para quem iria no começo do texto;
//   - marca no chamado interno avisoEnviadoEm (o instante da resposta avisada) ou avisoConclusaoEm; o espelho do cliente
//     não leva esses campos (a projeção do chamado é lista branca, area-cliente-regras.js);
//   - freio: no máximo MAX_POR_DIA avisos por dia e o limite do correio do vigia.
const { ouvir } = require('./ouvinte');

const LIBERADO_PARA_CLIENTES = false;
const INTERNOS = ['nilmacontabilidade@gmail.com'];
const MAX_POR_DIA = 40;
const OLHAR_DE_NOVO_MS = 5 * 60 * 1000;
// só os pedidos mexidos nas últimas 48 horas: ao ligar, os respondidos e concluídos do passado não viram uma enxurrada de avisos
const RECENTE_MS = 48 * 36e5;

/** O pedido foi mexido há pouco? (atualizadoEm ISO) */
function recente(c, agora = Date.now()) {
  const t = Date.parse(String((c && c.atualizadoEm) || ''));
  return Number.isFinite(t) && agora - t <= RECENTE_MS;
}
const SITE = 'https://cliente.nilmacontabilidade.com/cliente/';

const pacote = () => require('./gerado/danfse');

/** Para quem vai, com a trava: travado, só os internos (e quem receberia, para o escritório conferir). */
function destinoComTrava(para, { liberado = LIBERADO_PARA_CLIENTES, internos = INTERNOS } = {}) {
  if (liberado) return { para, teste: false };
  return { para: internos.slice(), teste: true, seria: para };
}

/** A marca que vai no chamado depois do aviso (o instante da última resposta avisada, ou da conclusão). */
function marcaDoAviso(c, tipo, agora) {
  if (tipo === 'conclusao') return { avisoConclusaoEm: agora };
  const visiveis = (c.mensagens || []).filter(m => !m.interna && typeof m.em === 'string');
  const ultima = visiveis[visiveis.length - 1];
  return { avisoEnviadoEm: (ultima && ultima.em) || agora, ...(c.situacao === 'concluido' ? { avisoConclusaoEm: agora } : {}) };
}

const diaIso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// deps: { db, log, correio (o do vigia: enviar, podeEnviar, contar) }
function iniciarAvisoDeResposta({ db, log, correio }) {
  const chamados = new Map();
  const hoje = { dia: '', n: 0 };
  let rodando = false;
  async function atender() {
    if (rodando) return;
    rodando = true;
    try {
      const P = pacote();
      const agora = new Date();
      const dia = diaIso(agora);
      if (hoje.dia !== dia) { hoje.dia = dia; hoje.n = 0; }
      let ativos = null;
      for (const [id, c] of chamados) {
        if (!recente(c, agora.getTime())) continue;
        const tipo = P.precisaAvisar(c, agora);
        if (!tipo) continue;
        if (hoje.n >= MAX_POR_DIA || !correio.podeEnviar(1)) break;
        const codigos = (c.codigos || []).map(Number).filter(Boolean);
        if (!codigos.length || !c.token) continue;
        ativos = ativos || await require('./clientes-cache').clientesAtivos(db, log);
        let para;
        try { para = (await require('./envios-do-dp').destinatarios(db, codigos[0], ativos)).para; }
        catch (e) {
          // sem e-mail no cadastro: marca para não tentar de novo a cada volta
          await db.collection('chamados').doc(id).update(marcaDoAviso(c, tipo, agora.toISOString())).catch(() => {});
          continue;
        }
        const email = P.emailDoAviso(c.titulo, SITE + encodeURIComponent(c.token), tipo);
        const destino = destinoComTrava(para);
        try {
          await correio.enviar({ para: destino.para, assunto: (destino.teste ? '[TESTE] ' : '') + email.assunto,
            corpo: (destino.teste ? '(Trava de teste: iria para ' + destino.seria.join(', ') + ')\n\n' : '') + email.corpo });
          correio.contar();
          hoje.n++;
          const marca = marcaDoAviso(c, tipo, agora.toISOString());
          await db.collection('chamados').doc(id).update(marca);
          chamados.set(id, Object.assign({}, c, marca));
          log('aviso de resposta: ' + (c.empresa || c.token.slice(0, 6)) + ' - ' + c.titulo + (destino.teste ? ' (travado: só para o escritório)' : ''));
        } catch (err) {
          log('aviso de resposta: não consegui mandar -', err.message);
          if (/gmail-auth|insufficient|invalid_grant/i.test(err.message)) break;
        }
      }
    } catch (err) { log('aviso de resposta falhou:', err.message); } finally { rodando = false; }
  }
  ouvir('Aviso de resposta: chamados', () => db.collection('chamados').where('situacao', 'in', ['respondido', 'concluido']), snap => {
    for (const ch of snap.docChanges()) {
      if (ch.type === 'removed') chamados.delete(ch.doc.id); else chamados.set(ch.doc.id, ch.doc.data());
    }
    void atender();
  }, log);
  // a espera de 15 minutos não muda nada no banco: olha de novo de tempo em tempo
  setInterval(() => { void atender(); }, OLHAR_DE_NOVO_MS);
  log('aviso de resposta pronto' + (LIBERADO_PARA_CLIENTES ? '' : ' (travado: só para o escritório)'));
}

module.exports = { iniciarAvisoDeResposta, destinoComTrava, marcaDoAviso, recente, LIBERADO_PARA_CLIENTES, INTERNOS, MAX_POR_DIA };
