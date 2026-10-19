// O certificado digital do cofre do nads vencendo (Vitor, 19/10/2026: "quero que notifique quando o certificado venceu ou
// está próximo de vencer"). O cofre (cofre/{empresa}) guarda a validade às claras justamente para este aviso; o .pfx e a
// senha continuam embaralhados (o robô não abre nada).
//
// Uma vez por dia, a partir das 8h: avisa o admin no celular e por e-mail o certificado que vence em 30, 15, 7 e 3 dias e
// no dia; o vencido, toda segunda-feira até subirem o novo. O papeis-vencendo.js faz o mesmo para o cadastro antigo do
// Entregas (clientes.papeis).
const HORA_MINIMA = 8;
const MARCOS = [30, 15, 7, 3, 0];
const SEGUNDA = 1;

const pad2 = n => String(n).padStart(2, '0');
const diaIso = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const dataBr = iso => iso.split('-').reverse().join('/');

/** Os dias até a validade (aaaa-mm-dd); negativo = vencido há. */
function diasAte(validade, hoje) {
  const p = String(validade || '').split('-').map(Number);
  if (p.length !== 3 || !p[0]) return null;
  const alvo = new Date(p[0], p[1] - 1, p[2]);
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - base) / 864e5);
}

/**
 * Os certificados do cofre com a validade e os dias. docs: os dados de cofre/{empresa} (só as empresas com certificado;
 * as contas gov.br de pessoa ficam de fora).
 */
function certificadosDoCofre(docs, hoje) {
  return (docs || [])
    .filter(d => d && d.tipo !== 'gov' && d.temCertificado && /^\d{4}-\d{2}-\d{2}$/.test(String(d.validade || '')))
    .map(d => ({ empresa: d.empresa || 'empresa', codigo: d.codigo == null ? null : d.codigo, validade: d.validade, dias: diasAte(d.validade, hoje) }))
    .filter(c => c.dias !== null);
}

/** O que avisar hoje: quem cai exatamente num marco e, na segunda-feira, todos os vencidos. */
function certificadosParaAvisar(certs, hoje) {
  const segunda = hoje.getDay() === SEGUNDA;
  return certs.filter(c => MARCOS.includes(c.dias) || (c.dias < 0 && segunda)).sort((a, b) => a.dias - b.dias);
}

const quando = c => (c.dias < 0 ? 'venceu há ' + (-c.dias) + (c.dias === -1 ? ' dia' : ' dias') : c.dias === 0 ? 'vence hoje' : 'vence em ' + c.dias + ' dias');
const nomeDe = c => (c.codigo != null ? c.codigo + ' · ' : '') + c.empresa;

function textoDoPush(lista) {
  if (lista.length === 1) return { titulo: 'Certificado digital', corpo: 'O de ' + nomeDe(lista[0]) + ' ' + quando(lista[0]) + ' (' + dataBr(lista[0].validade) + ')' };
  const vencidos = lista.filter(c => c.dias < 0).length;
  return {
    titulo: lista.length + ' certificados digitais' + (vencidos ? ' (' + vencidos + (vencidos === 1 ? ' vencido)' : ' vencidos)') : ''),
    corpo: lista.slice(0, 3).map(c => nomeDe(c) + ' ' + quando(c)).join(' · ') + (lista.length > 3 ? ' …' : ''),
  };
}

/** O e-mail: os de hoje e, embaixo, a situação de todos os vencidos e dos que vencem em até 30 dias. */
function textoDoEmail(lista, todos) {
  const linha = c => '- ' + nomeDe(c) + ': ' + quando(c) + ' (' + dataBr(c.validade) + ')';
  const proximos = todos.filter(c => c.dias <= 30).sort((a, b) => a.dias - b.dias);
  return {
    assunto: 'Certificados digitais: ' + (lista.length === 1 ? 'o de ' + nomeDe(lista[0]) + ' ' + quando(lista[0]) : lista.length + ' para olhar'),
    corpo: [
      'Os certificados digitais do cofre do nads que pedem atenção hoje:',
      '',
      ...lista.map(linha),
      '',
      'Todos os vencidos e os que vencem em até 30 dias:',
      ...proximos.map(linha),
      '',
      'Para subir o certificado novo: nads › Senhas › Certificados (https://tarefas-nilma.web.app/tarefas/senhas/certificados).',
    ].join('\n'),
  };
}

function iniciarCertificadosDoCofre({ db, log, avisos, enviar, destino }) {
  const estadoRef = db.collection('robo').doc('estado');
  let rodando = false;
  let feitoEm = '';

  async function talvez() {
    const agora = new Date();
    const hoje = diaIso(agora);
    if (rodando || feitoEm === hoje || agora.getHours() < HORA_MINIMA) return;
    rodando = true;
    try {
      const estado = (await estadoRef.get()).data() || {};
      if (estado.certificadosCofreEm === hoje) { feitoEm = hoje; return; }
      const snap = await db.collection('cofre').where('temCertificado', '==', true).get();
      const todos = certificadosDoCofre(snap.docs.map(d => d.data()), agora);
      const lista = certificadosParaAvisar(todos, agora);
      // o resumo para a faixa do nads (o admin abre a Tarefas e vê): um documento só, em vez de cada um ler o cofre inteiro
      const atencao = todos.filter(c => c.dias <= 30).sort((a, b) => a.dias - b.dias).map(c => ({ empresa: c.empresa, codigo: c.codigo, validade: c.validade }));
      await db.collection('robo').doc('certificados').set({ em: agora.toISOString(), dia: hoje, atencao });
      // marca antes de avisar: o vigia religado não manda de novo no mesmo dia
      await estadoRef.set({ certificadosCofreEm: hoje }, { merge: true });
      feitoEm = hoje;
      if (!lista.length) return;
      if (avisos) {
        const p = textoDoPush(lista);
        await avisos.enviar('admin', '', p.titulo, p.corpo, 'certificados').catch(err => log('push do certificado não saiu:', err.message));
      }
      if (enviar && destino) {
        const { para } = await destino();
        const e = textoDoEmail(lista, todos);
        await enviar({ para, assunto: e.assunto, corpo: e.corpo }).catch(err => log('e-mail do certificado não saiu:', err.message));
      }
      log('aviso de certificado do cofre:', lista.map(c => nomeDe(c) + ' ' + quando(c)).join(', '));
    } catch (err) {
      log('aviso de certificado do cofre falhou:', err.message);
    } finally { rodando = false; }
  }

  setTimeout(talvez, 6 * 60 * 1000);
  setInterval(talvez, 60 * 60 * 1000);
  log('aviso de certificado do cofre ligado (a partir das ' + HORA_MINIMA + 'h; 30, 15, 7, 3 e no dia; vencidos às segundas)');
}

module.exports = { diasAte, certificadosDoCofre, certificadosParaAvisar, textoDoPush, textoDoEmail, iniciarCertificadosDoCofre, MARCOS };
