// O lembrete de vencimento ao cliente (plano do Acessórias, 17/11/2026, ficha lembrete-de-vencimento; frase do dono:
// "Seguir"). Roda no vigia, SÓ NA NUVEM (para não duplicar com o PC). Uma vez por dia, a partir das 8h: para cada link da
// Área do Cliente (areasCliente), as guias do espelho que vencem nos próximos dias e que o cliente ainda não abriu
// (areaClienteLeituras, ficha comprovante-de-leitura) vão num e-mail só, com o link da Área. A conta das guias é do core
// (areaCliente.guiasParaLembrar e emailDoLembrete, pelo robo/gerado/danfse.js).
//
//   - vem DESLIGADO: liga em Robôs › Ajustes › "Lembrete de vencimento ao cliente" (config/lembreteGuia: ligado,
//     diasAntes, maxPorDia);
//   - A TRAVA (como a do Mandei, robo/mandei.js): enquanto LIBERADO_PARA_CLIENTES for false, o e-mail vai só para os
//     INTERNOS (o escritório confere), com "[TESTE]" no assunto e para quem iria no começo do texto;
//   - "já avisado hoje" em robo/lembreteGuia { dia, tokens: [...] }: o link avisado não recebe de novo no mesmo dia;
//   - freio: no máximo maxPorDia e-mails por dia (padrão 100) e o limite do correio do vigia;
//   - a escolha de cada empresa no Cadastro (17/11/2026, o dono: "quero que a parte de vencimento tenha como escolher por cliente"):
//     cadastro.lembreteVencimento { modo: 'sim' | 'nao', diasAntes? } vale sobre o geral; 'sim' manda mesmo com o geral
//     desligado, 'nao' nunca manda. Num link de várias empresas, vale a escolha da primeira (a do e-mail).
const LIBERADO_PARA_CLIENTES = false;
const INTERNOS = ['nilmacontabilidade@gmail.com'];
const HORA_MINIMA = 8;
const SITE = 'https://cliente.nilmacontabilidade.com/cliente/';

const pacote = () => require('./gerado/danfse');

/** Para quem vai, com a trava: travado, só os internos (e quem receberia, para o escritório conferir). */
function destinoComTrava(para, { liberado = LIBERADO_PARA_CLIENTES, internos = INTERNOS } = {}) {
  if (liberado) return { para, teste: false };
  return { para: internos.slice(), teste: true, seria: para };
}

/** O link já foi avisado hoje? (estado: { dia, tokens }) */
function jaAvisado(estado, dia, token) {
  return !!estado && estado.dia === dia && Array.isArray(estado.tokens) && estado.tokens.includes(token);
}

/** O que o ajuste diz: { ligado, dias, maxPorDia } (desligado por padrão). */
function lerAjuste(cfg) {
  const c = cfg || {};
  return { ligado: c.ligado === true, dias: pacote().diasDoLembrete(c.diasAntes == null ? 2 : c.diasAntes), maxPorDia: Math.max(0, Math.min(300, Number(c.maxPorDia) || 100)) };
}

const diaIso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// deps: { db, log, correio (o do vigia: enviar, podeEnviar, contar), clientesAtivos(db, log) }
function iniciarLembreteDeGuias({ db, log, correio }) {
  const configRef = db.collection('config').doc('lembreteGuia');
  const estadoRef = db.collection('robo').doc('lembreteGuia');
  let rodando = false;
  let feitoHoje = '';
  async function talvez() {
    const agora = new Date();
    const hoje = diaIso(agora);
    if (rodando || feitoHoje === hoje || agora.getHours() < HORA_MINIMA) return;
    rodando = true;
    try {
      const ajuste = lerAjuste((await configRef.get()).data());
      // o geral desligado: só as empresas com "Mandar" no Cadastro; sem nenhuma, duas leituras por hora e nada mais
      const soAsQueMandam = ajuste.ligado ? null : new Set((await db.collection('cadastro').where('lembreteVencimento.modo', '==', 'sim').get()).docs.map(d => Number(d.get('codigo'))).filter(Boolean));
      if (soAsQueMandam && !soAsQueMandam.size) return;
      const P = pacote();
      const estado = (await estadoRef.get()).data() || {};
      const avisados = estado.dia === hoje && Array.isArray(estado.tokens) ? estado.tokens.slice() : [];
      const ativos = await require('./clientes-cache').clientesAtivos(db, log);
      const dp = require('./envios-do-dp');
      let enviados = 0;
      const pulos = {};
      const pular = m => { pulos[m] = (pulos[m] || 0) + 1; };
      for (const link of (await db.collection('areasCliente').get()).docs) {
        const token = link.id;
        if (jaAvisado({ dia: hoje, tokens: avisados }, hoje, token)) { pular('já avisado hoje'); continue; }
        const codigos = (link.get('codigos') || []).map(Number).filter(Boolean);
        if (!codigos.length) continue;
        if (soAsQueMandam && !soAsQueMandam.has(codigos[0])) continue;
        // a escolha da empresa no Cadastro sobre o padrão do escritório
        const cad = (await db.collection('cadastro').where('codigo', '==', codigos[0]).limit(1).get()).docs[0];
        const daEmpresa = P.lembreteDaEmpresa(cad ? cad.get('lembreteVencimento') : null, ajuste);
        if (!daEmpresa.ligado) { pular('não manda (escolha da empresa)'); continue; }
        const guias = (await link.ref.collection('guias').get()).docs.map(d => Object.assign({ id: d.id }, d.data()));
        if (!guias.length) continue;
        const abertas = new Set((await db.collection('areaClienteLeituras').where('token', '==', token).get()).docs.map(d => String(d.get('guiaId') || '')));
        const vao = P.guiasParaLembrar(guias, agora, daEmpresa.dias, abertas);
        if (!vao.length) continue;
        if (enviados >= ajuste.maxPorDia || !correio.podeEnviar(1)) { pular('limite do dia'); continue; }
        let para;
        let empresa;
        try { const d = await dp.destinatarios(db, codigos[0], ativos); para = d.para; empresa = String(d.cliente.nome || link.get('nome') || '').trim(); }
        catch (e) { pular('sem e-mail'); continue; }
        const email = P.emailDoLembrete(empresa, vao, SITE + encodeURIComponent(token));
        const destino = destinoComTrava(para);
        try {
          await correio.enviar({
            para: destino.para, assunto: (destino.teste ? '[TESTE] ' : '') + email.assunto,
            corpo: (destino.teste ? '(Trava de teste: iria para ' + destino.seria.join(', ') + ')\n\n' : '') + email.texto,
          });
          correio.contar();
          enviados++;
          avisados.push(token);
          await estadoRef.set({ dia: hoje, tokens: avisados }, { merge: false });
        } catch (err) {
          log('lembrete de vencimento: não consegui mandar para', empresa, '-', err.message);
          if (/gmail-auth|insufficient|invalid_grant/i.test(err.message)) break;
        }
      }
      feitoHoje = hoje;
      const resumo = Object.entries(pulos).map(([k, v]) => v + ' ' + k).join(', ');
      log('lembrete de vencimento: ' + enviados + ' e-mail(s)' + (LIBERADO_PARA_CLIENTES ? '' : ' (travado: só para o escritório)') + (resumo ? '; de fora: ' + resumo : ''));
      await estadoRef.set({ ultima: { em: new Date().toISOString(), enviados, pulos } }, { merge: true });
    } catch (err) {
      log('lembrete de vencimento falhou:', err.message);
    } finally { rodando = false; }
  }
  setTimeout(talvez, 9 * 60 * 1000);
  setInterval(talvez, 60 * 60 * 1000);
  log('lembrete de vencimento pronto (só age se estiver ligado em Robôs › Ajustes)');
}

module.exports = { iniciarLembreteDeGuias, destinoComTrava, jaAvisado, lerAjuste, LIBERADO_PARA_CLIENTES, INTERNOS };
