// As regras do WhatsApp do robô (12/11/2026), sem rede e sem banco, para o teste (apps/web › robos/dados/whatsapp.test.ts).
//
// O dono escolheu o WhatsApp pelo QR code (o WhatsApp Web, pela biblioteca Baileys), de graça, num CHIP NOVO só do
// sistema, sabendo que não é o caminho oficial do WhatsApp e que o número pode ser bloqueado. Por isso o envio tem
// freio: um de cada vez, com intervalo, um limite por hora e por dia, e só para o telefone que está no cadastro do
// cliente. E a TRAVA (como a do Mandei): enquanto LIBERADO_PARA_CLIENTES for false, só sai para os números de teste
// (NUMEROS_DE_TESTE). Liberar é mudar a constante, com o ok do escritório, e atualizar o robô.
// Desde 27/11/2026 a trava é a chave liberado de config/whatsapp (robo/whatsapp.js passa { liberado }); esta constante é só o
// valor quando nada é passado, e fica false.
const LIBERADO_PARA_CLIENTES = false;
/**
 * Para onde a trava deixa sair: o celular que o dono indicou para o teste em 17/11/2026, (38) 9919-7340 (o primeiro é o
 * que a tela usa de começo), e o WhatsApp do escritório, (38) 9138-3638 (o mesmo do e-mail de pedir extratos).
 */
const NUMEROS_DE_TESTE = ['553899197340', '553891383638'];

const LIMITE_POR_HORA = 30;
const LIMITE_POR_DIA = 150;
/** entre uma mensagem e outra, de 20 a 60 segundos (sorteado) */
const INTERVALO_MIN_MS = 20000;
const INTERVALO_MAX_MS = 60000;
const MAX_LETRAS = 4000;

const texto = v => (typeof v === 'string' ? v : v == null ? '' : String(v));

/** O número que o WhatsApp entende: 55 + DDD + número, só dígitos ('' = não parece telefone do Brasil). */
function numeroDoWhatsApp(telefone) {
  const d = texto(telefone).replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return '55' + d;
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d;
  return '';
}

const jidDe = numero => numero + '@s.whatsapp.net';

/**
 * Os jeitos de procurar o número no WhatsApp: celular do Brasil com e sem o 9 da frente (conta antiga ficou no WhatsApp
 * com 8 dígitos). 553899197340 → ['553899197340', '5538999197340'].
 */
function variantesDoNumero(numero) {
  const d = texto(numero).replace(/\D/g, '');
  if (/^55\d{2}[6-9]\d{7}$/.test(d)) return [d, d.slice(0, 4) + '9' + d.slice(4)];
  if (/^55\d{2}9[6-9]\d{7}$/.test(d)) return [d, d.slice(0, 4) + d.slice(5)];
  return d ? [d] : [];
}

/** O número do WhatsApp para mostrar: 553891383638 → (38) 9138-3638. */
function numeroFormatado(numero) {
  const d = texto(numero).replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  return d;
}

/**
 * Por que o pedido não pode sair ('' = pode). `p`: o pedido da fila ({ para, texto, clienteId }); `cliente`: o
 * documento do cliente no Entregas (null = não achou). O número de teste passa sem cliente; o de cliente só com a
 * trava aberta e se for o telefone do cadastro.
 */
function motivoParaNaoMandar(p, cliente, { liberado = LIBERADO_PARA_CLIENTES, teste = NUMEROS_DE_TESTE } = {}) {
  const para = numeroDoWhatsApp(p && p.para);
  if (!para) return 'número de WhatsApp inválido: ' + (texto(p && p.para) || 'vazio');
  const msg = texto(p && p.texto).trim();
  if (!msg) return 'mensagem vazia';
  if (msg.length > MAX_LETRAS) return 'mensagem longa demais (' + msg.length + ' letras; o máximo é ' + MAX_LETRAS + ')';
  if (teste.some(t => variantesDoNumero(t).includes(para))) return '';
  if (!liberado) return 'o WhatsApp do robô ainda não foi liberado para clientes: por enquanto só sai para os números de teste';
  if (!cliente) return 'cliente não encontrado';
  if (numeroDoWhatsApp(cliente.telefone) !== para) return numeroFormatado(para) + ' não é o telefone do cadastro deste cliente';
  return '';
}

/**
 * O freio: `enviados` são os instantes (ms) dos envios já feitos; `agora` em ms. Devolve '' (pode) ou o motivo.
 * Não espera: quem chama recusa o pedido, e a pessoa tenta mais tarde.
 */
function motivoDoFreio(enviados, agora, { porHora = LIMITE_POR_HORA, porDia = LIMITE_POR_DIA } = {}) {
  const naHora = enviados.filter(t => agora - t < 36e5).length;
  const noDia = enviados.filter(t => agora - t < 864e5).length;
  if (naHora >= porHora) return 'limite de ' + porHora + ' mensagens de WhatsApp por hora atingido; tente mais tarde';
  if (noDia >= porDia) return 'limite de ' + porDia + ' mensagens de WhatsApp por dia atingido; tente amanhã';
  return '';
}

/** Só os envios das últimas 24 h (o resto não conta mais para o freio). */
const enviosQueContam = (enviados, agora) => enviados.filter(t => agora - t < 864e5);

/** Quanto esperar antes de mandar (ms): o intervalo sorteado desde o último envio. `sorteio` de 0 a 1. */
function esperaAntesDeMandar(ultimo, agora, sorteio) {
  if (!ultimo) return 0;
  const intervalo = INTERVALO_MIN_MS + Math.round((INTERVALO_MAX_MS - INTERVALO_MIN_MS) * Math.min(1, Math.max(0, sorteio)));
  return Math.max(0, ultimo + intervalo - agora);
}

/** O anexo que pode ir pelo WhatsApp (17/11/2026): por enquanto só o PDF da solicitação. '' = pode. */
function motivoDoAnexo(anexo) {
  if (!anexo) return '';
  if (anexo.mime !== 'application/pdf') return 'pelo WhatsApp só vai anexo em PDF';
  if (!anexo.buffer || !anexo.buffer.length) return 'o PDF chegou vazio';
  return '';
}

// Os tiques do WhatsApp (17/11/2026): o status da mensagem que a Baileys avisa (3 = entregue no celular, 4 = lida,
// 5 = ouvida) vira entregueEm / lidoEm no próprio pedido da fila, para o nads mostrar no histórico.
const ENTREGUE = 3;
const LIDO = 4;
/** quanto tempo o robô ainda espera o tique de uma mensagem mandada */
const RASTREIO_MS = 7 * 864e5;

/** O que gravar no pedido com este status (null = nada novo). `r`: o que já foi marcado ({ entregueEm, lidoEm }). */
function marcasDaEntrega(r, status, agoraIso) {
  const s = Number(status);
  if (!Number.isFinite(s) || s < ENTREGUE) return null;
  const novo = {};
  if (!r.entregueEm) novo.entregueEm = agoraIso;
  if (s >= LIDO && !r.lidoEm) novo.lidoEm = agoraIso;
  return Object.keys(novo).length ? novo : null;
}

/** Só as mensagens dos últimos 7 dias e ainda não lidas continuam esperando o tique. */
function rastreioQueConta(rastreio, agora) {
  const fica = {};
  for (const [id, r] of Object.entries(rastreio || {})) {
    if (r && typeof r.caminho === 'string' && !r.lidoEm && agora - (Number(r.em) || 0) < RASTREIO_MS) fica[id] = r;
  }
  return fica;
}

const SITUACOES = ['desligado', 'desconectado', 'aguardando-qr', 'conectando', 'conectado'];

/**
 * O que vai em robo/estado.whatsapp (o nads lê): a situação, o QR enquanto espera, o número conectado e a trava (a chave
 * liberado de config/whatsapp, 27/11/2026; sem ela, LIBERADO_PARA_CLIENTES).
 * Só os campos desta lista; o resto nem vai ao banco.
 */
function estadoParaOBanco(e, agora, { liberado = LIBERADO_PARA_CLIENTES, teste = NUMEROS_DE_TESTE } = {}) {
  const situacao = SITUACOES.includes(e && e.situacao) ? e.situacao : 'desligado';
  return {
    situacao,
    qr: situacao === 'aguardando-qr' ? texto(e.qr).slice(0, 2000) : '',
    numero: situacao === 'conectado' ? texto(e.numero).replace(/\D/g, '').slice(0, 15) : '',
    nome: situacao === 'conectado' ? texto(e.nome).slice(0, 80) : '',
    desde: situacao === 'conectado' ? texto(e.desde) : '',
    motivo: texto(e && e.motivo).slice(0, 300),
    liberado: liberado === true,
    teste: teste.slice(),
    atualizadoEm: new Date(agora).toISOString(),
  };
}

/** Os comandos que a tela pode pedir (pela fila, tipo 'whatsapp-conectar' / 'whatsapp-desconectar'): só admin. */
function podeComandar(usuario) {
  return !!usuario && usuario.ativo !== false && Array.isArray(usuario.roles) && usuario.roles.includes('admin');
}

module.exports = {
  LIBERADO_PARA_CLIENTES, NUMEROS_DE_TESTE, LIMITE_POR_HORA, LIMITE_POR_DIA, INTERVALO_MIN_MS, INTERVALO_MAX_MS, MAX_LETRAS, SITUACOES,
  numeroDoWhatsApp, jidDe, variantesDoNumero, motivoDoAnexo, marcasDaEntrega, rastreioQueConta, numeroFormatado, motivoParaNaoMandar, motivoDoFreio, enviosQueContam, esperaAntesDeMandar, estadoParaOBanco, podeComandar,
};
