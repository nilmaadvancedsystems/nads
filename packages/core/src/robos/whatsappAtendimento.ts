// O WhatsApp do robô pronto para o chip (27/11/2026, o dono: "deixe tudo pronto apenas para receber o chip"). As regras
// que o robô da nuvem (robo/whatsapp.js, pelo robo/gerado/whatsapp.js) e a tela da Central dos robôs usam juntos:
//
//   - as CHAVES (config/whatsapp, só o admin grava): cada envio novo liga à parte, e a trava (liberado) também. Tudo vem
//     desligado; com a trava fechada, o que iria a um cliente vai ao WhatsApp do escritório marcado como TESTE;
//   - as mensagens do boleto de honorários e do Mandei (as das guias também, agora com o aviso do menu);
//   - as RESPOSTAS: a mensagem que o cliente manda, lida do jeito que a Baileys entrega, vira { em, tipo, texto } no
//     próprio pedido que ele respondeu (sem coleção nova no banco);
//   - o AUTOATENDIMENTO: um menu simples, sem IA ("1 – Guias do mês, 2 – Boleto..."), que reconhece a empresa pelo número
//     do cadastro e só manda o que o escritório já enviou (as guias do Fiscal, o boleto e os documentos do DP).
import { mesmoNumero } from './whatsapp';

// ---------- o número ----------

/** O WhatsApp do escritório, (38) 9138-3638: o "falar com o escritório" e o destino dos testes com a trava fechada. */
export const NUMERO_DO_ESCRITORIO = '553891383638';

const texto = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

/** 55 + DDD + número, só dígitos ('' = não parece telefone do Brasil). */
export function numeroDoWhatsapp(telefone: unknown): string {
  const d = texto(telefone).replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return '55' + d;
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d;
  return '';
}

/** 553891383638 → (38) 9138-3638 */
export function numeroFormatado(numero: unknown): string {
  const d = texto(numero).replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  return d;
}

// ---------- as chaves (config/whatsapp) ----------

export interface ChavesDoWhatsapp {
  /** as guias do lote do Fiscal (via WhatsApp) com o link da Área do Cliente */
  guias: boolean;
  /** o boleto de honorários, em PDF, depois do e-mail do lote de Boletos */
  boletos: boolean;
  /** o link do Mandei, depois do e-mail */
  mandei: boolean;
  /** a resposta do cliente fica gravada no pedido que ele respondeu */
  respostas: boolean;
  /** o menu do autoatendimento */
  autoatendimento: boolean;
  /** a trava aberta: sai para os clientes (fechada, só para os números de teste) */
  liberado: boolean;
  /** o código da empresa que os números de teste "são" no autoatendimento ('' = nenhuma) */
  empresaDeTeste: string;
  /**
   * números de teste a mais (27/11/2026: o gerente da empresa de teste), além dos do código (robo/whatsapp-regras.js). Ficam
   * no banco, não no código: o repositório é público e não leva número de cliente. Até MAX_NUMEROS_DE_TESTE.
   */
  numerosDeTeste: string[];
  atualizadoEm: string;
  atualizadoPor: string;
}

export type ChaveDoWhatsapp = 'guias' | 'boletos' | 'mandei' | 'respostas' | 'autoatendimento' | 'liberado';

export const CHAVES_DESLIGADAS: ChavesDoWhatsapp = {
  guias: false, boletos: false, mandei: false, respostas: false, autoatendimento: false, liberado: false, empresaDeTeste: '', numerosDeTeste: [], atualizadoEm: '', atualizadoPor: '',
};

export const MAX_NUMEROS_DE_TESTE = 5;

/** Os números de teste a mais: só os que parecem telefone, sem repetir, até MAX_NUMEROS_DE_TESTE. */
function numerosDeTesteValidos(v: unknown): string[] {
  const lista = Array.isArray(v) ? v.map(numeroDoWhatsapp).filter(Boolean) : [];
  return lista.filter((n, i) => lista.findIndex(m => mesmoNumero(m, n)) === i).slice(0, MAX_NUMEROS_DE_TESTE);
}

/** As chaves na ordem da tela, com o que cada uma faz. */
export const CHAVES_DO_WHATSAPP: { chave: ChaveDoWhatsapp; rotulo: string; explica: string }[] = [
  { chave: 'guias', rotulo: 'Guias do Fiscal', explica: 'No lote do Enviar guias com a via WhatsApp, o robô manda o aviso com o link da Área do Cliente.' },
  { chave: 'boletos', rotulo: 'Boletos de honorários', explica: 'Depois do e-mail do lote de Boletos, o robô manda o boleto em PDF pelo WhatsApp do cadastro.' },
  { chave: 'mandei', rotulo: 'Mandei', explica: 'Depois do e-mail do Mandei, o robô manda o link pelo WhatsApp do ticket.' },
  { chave: 'respostas', rotulo: 'Registrar respostas', explica: 'O que o cliente responde em até 7 dias fica gravado no pedido e aparece em Respostas.' },
  { chave: 'autoatendimento', rotulo: 'Autoatendimento', explica: 'O cliente que escreve recebe o menu e pede as guias, o boleto ou os documentos do DP.' },
  { chave: 'liberado', rotulo: 'Liberar para clientes', explica: 'Desligada, tudo vai só para os números de teste (o que iria a um cliente vai ao escritório como TESTE).' },
];

const CODIGO_DE_EMPRESA = /^\d{1,8}$/;

/** config/whatsapp como veio do banco (qualquer coisa) → as chaves; o que não for true fica desligado. */
export function lerChaves(bruto: unknown): ChavesDoWhatsapp {
  if (!bruto || typeof bruto !== 'object') return { ...CHAVES_DESLIGADAS };
  const d = bruto as Record<string, unknown>;
  const empresa = texto(d.empresaDeTeste).trim();
  return {
    guias: d.guias === true, boletos: d.boletos === true, mandei: d.mandei === true, respostas: d.respostas === true,
    autoatendimento: d.autoatendimento === true, liberado: d.liberado === true,
    empresaDeTeste: CODIGO_DE_EMPRESA.test(empresa) ? empresa : '',
    numerosDeTeste: numerosDeTesteValidos(d.numerosDeTeste),
    atualizadoEm: texto(d.atualizadoEm), atualizadoPor: texto(d.atualizadoPor),
  };
}

/** O que a tela grava em config/whatsapp (só estes campos). Erro se o código da empresa de teste não for um código. */
export function chavesParaGravar(c: ChavesDoWhatsapp, quem: string, agoraIso: string): Record<string, unknown> {
  const empresa = c.empresaDeTeste.trim();
  if (empresa && !CODIGO_DE_EMPRESA.test(empresa)) throw new Error('A empresa de teste é o código do cliente (só números).');
  const ruins = c.numerosDeTeste.filter(n => n.trim() && !numeroDoWhatsapp(n));
  if (ruins.length) throw new Error('Número de teste inválido: ' + ruins.join(', ') + ' (use DDD + número).');
  return {
    guias: c.guias, boletos: c.boletos, mandei: c.mandei, respostas: c.respostas, autoatendimento: c.autoatendimento, liberado: c.liberado,
    empresaDeTeste: empresa, numerosDeTeste: numerosDeTesteValidos(c.numerosDeTeste), atualizadoEm: agoraIso, atualizadoPor: quem.slice(0, 80),
  };
}

// ---------- o pedido com a trava ----------

/**
 * O pedido da fila que o robô monta para um cliente: com a trava fechada, vai ao escritório marcado como TESTE; se o
 * telefone do cadastro for um dos números de teste (`teste`), vai direto a ele (o teste de ponta a ponta com a empresa de teste).
 */
export function pedidoParaCliente(d: { telefone: unknown; cliente: string; texto: string }, liberado: boolean, teste: string[] = []): { para: string; texto: string; teste: boolean } | null {
  const para = numeroDoWhatsapp(d.telefone);
  if (!para || !d.texto.trim()) return null;
  if (liberado) return { para, texto: d.texto, teste: false };
  if (teste.some(t => mesmoNumero(t, para))) return { para, texto: d.texto, teste: true };
  return { para: NUMERO_DO_ESCRITORIO, texto: '[TESTE: iria para ' + (d.cliente.trim() || 'o cliente') + ', ' + numeroFormatado(para) + ']\n\n' + d.texto, teste: true };
}

// ---------- as mensagens ----------

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** 'aaaa-mm' → 'outubro de 2026' ('' se não for competência). */
export function mesPorExtenso(competencia: string): string {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(competencia) ? MESES[Number(competencia.slice(5)) - 1] + ' de ' + competencia.slice(0, 4) : '';
}

/** O fim das mensagens: com o autoatendimento ligado, como pedir o menu; sem ele, que o número só avisa. */
export function rodapeDasMensagens(atende: boolean): string {
  return atende
    ? 'Para pedir guias, boletos ou documentos, responda MENU. Para falar com a equipe, chame o escritório no WhatsApp ' + numeroFormatado(NUMERO_DO_ESCRITORIO) + '.'
    : 'Este número só envia avisos e não lê respostas. Qualquer dúvida, fale com o escritório pelo WhatsApp ' + numeroFormatado(NUMERO_DO_ESCRITORIO) + '.';
}

/** As guias do mês, com o link da Área do Cliente (a mensagem do lote do Fiscal). */
export function mensagemDasGuias(d: { cliente: string; competencia: string; link: string }, atende: boolean): string {
  const mes = mesPorExtenso(d.competencia) || 'do mês';
  return 'Olá, ' + (d.cliente.trim() || 'cliente') + '! As guias de ' + mes + ' já estão na sua Área do Cliente' + (d.link ? ': ' + d.link : '.') + '\n\n' + rodapeDasMensagens(atende);
}

const reais = (v: number) => (Number.isFinite(v) && v > 0 ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '');
const dataBr = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');

/** O boleto de honorários (vai de legenda do PDF). */
export function mensagemDoBoleto(d: { cliente: string; competencia: string; valor: number; vencimento: string }, atende: boolean): string {
  const mes = mesPorExtenso(d.competencia);
  const valor = reais(d.valor);
  const venc = dataBr(d.vencimento);
  return 'Olá, ' + (d.cliente.trim() || 'cliente') + '! Segue o boleto dos honorários contábeis' + (mes ? ' de ' + mes : '') +
    (valor ? ', no valor de ' + valor : '') + (venc ? ', com vencimento em ' + venc : '') + '.\n\nSe o pagamento já foi feito, por favor desconsidere.\n\n' + rodapeDasMensagens(atende);
}

/** O link do Mandei (o formulário onde o cliente responde e manda os arquivos). */
export function mensagemDoMandei(d: { cliente: string; numero: string; link: string }, atende: boolean): string {
  return 'Olá, ' + (d.cliente.trim() || 'cliente') + '! O escritório precisa de algumas informações' + (d.numero ? ' (pedido ' + d.numero + ')' : '') +
    '. Responda e mande os arquivos por este link: ' + d.link + '\n\n' + rodapeDasMensagens(atende);
}

// ---------- as respostas (a mensagem que chega, do jeito da Baileys) ----------

export type TipoDaMensagem = 'texto' | 'pdf' | 'documento' | 'imagem' | 'audio' | 'video' | 'outro';

export interface MensagemRecebida {
  /** o id da mensagem no WhatsApp */
  id: string;
  /** quem mandou: 55 + DDD + número */
  numero: string;
  /** quando (ISO) */
  em: string;
  tipo: TipoDaMensagem;
  /** o texto, ou a legenda do arquivo */
  texto: string;
  /** o nome do arquivo (documento) */
  arquivo: string;
}

type Solto = Record<string, unknown>;
const obj = (v: unknown): Solto | null => (v && typeof v === 'object' ? v as Solto : null);

/** O número do WhatsApp de um jid ('5538999991234@s.whatsapp.net' ou '...:12@s.whatsapp.net'); '' se for grupo, lista ou LID. */
function numeroDoJid(jid: unknown): string {
  const j = texto(jid);
  if (!j.endsWith('@s.whatsapp.net')) return '';
  return j.split('@')[0].split(':')[0].replace(/\D/g, '');
}

/**
 * Uma mensagem do messages.upsert da Baileys → o que o robô usa (null = não é de um cliente: mandada por nós, grupo,
 * status, lista de transmissão ou sem conteúdo). Os contatos novos do WhatsApp chegam com o jid em LID: aí o número de
 * telefone vem em remoteJidAlt (Baileys 7) ou senderPn.
 */
export function lerMensagemRecebida(m: unknown): MensagemRecebida | null {
  const msg = obj(m);
  const key = obj(msg?.key);
  if (!msg || !key || key.fromMe === true) return null;
  const remoto = texto(key.remoteJid);
  if (!remoto || remoto.endsWith('@g.us') || remoto.endsWith('@broadcast') || remoto === 'status@broadcast' || remoto.endsWith('@newsletter')) return null;
  const numero = numeroDoJid(remoto) || numeroDoJid(key.remoteJidAlt) || numeroDoJid(key.senderPn);
  if (!numero) return null;
  let c = obj(msg.message);
  // as mensagens "embrulhadas" (temporária, visualização única, editada)
  for (const casca of ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'documentWithCaptionMessage']) {
    const dentro = obj(obj(c?.[casca])?.message);
    if (dentro) c = dentro;
  }
  if (!c) return null;
  const segundos = Number(typeof msg.messageTimestamp === 'object' && msg.messageTimestamp ? (msg.messageTimestamp as { low?: number }).low : msg.messageTimestamp);
  const em = Number.isFinite(segundos) && segundos > 0 ? new Date(segundos * 1000).toISOString() : '';
  const base = { id: texto(key.id), numero, em };
  const doc = obj(c.documentMessage);
  if (typeof c.conversation === 'string') return { ...base, tipo: 'texto', texto: c.conversation, arquivo: '' };
  const ext = obj(c.extendedTextMessage);
  if (ext && typeof ext.text === 'string') return { ...base, tipo: 'texto', texto: ext.text, arquivo: '' };
  if (doc) {
    const nome = texto(doc.fileName).slice(0, 120);
    const pdf = texto(doc.mimetype) === 'application/pdf' || /\.pdf$/i.test(nome);
    return { ...base, tipo: pdf ? 'pdf' : 'documento', texto: texto(doc.caption), arquivo: nome };
  }
  if (obj(c.imageMessage)) return { ...base, tipo: 'imagem', texto: texto(obj(c.imageMessage)?.caption), arquivo: '' };
  if (obj(c.audioMessage)) return { ...base, tipo: 'audio', texto: '', arquivo: '' };
  if (obj(c.videoMessage)) return { ...base, tipo: 'video', texto: texto(obj(c.videoMessage)?.caption), arquivo: '' };
  // tique, reação, apagada, enquete...: não é resposta
  if (c.reactionMessage || c.protocolMessage || c.senderKeyDistributionMessage || c.pollUpdateMessage) return null;
  return { ...base, tipo: 'outro', texto: '', arquivo: '' };
}

/** Quanto tempo depois do envio a resposta ainda conta como resposta àquele pedido. */
export const RESPOSTA_VALE_MS = 7 * 864e5;
/** No máximo tantas respostas guardadas por pedido (o resto fica só no celular). */
export const MAX_RESPOSTAS_POR_PEDIDO = 20;
const MAX_LETRAS_DA_RESPOSTA = 1000;

export interface RespostaDoCliente { em: string; tipo: TipoDaMensagem; texto: string; arquivo?: string }

/** O que vai no pedido (respostas[]): o texto curto e, no arquivo, só o nome (o arquivo fica no celular). */
export function respostaParaGravar(r: MensagemRecebida, agoraIso: string): RespostaDoCliente {
  return {
    em: r.em || agoraIso, tipo: r.tipo, texto: r.texto.trim().slice(0, MAX_LETRAS_DA_RESPOSTA),
    ...(r.arquivo ? { arquivo: r.arquivo } : {}),
  };
}

/** A resposta em poucas palavras, para a tela: "mandou um PDF (extrato.pdf)", "áudio", o texto... */
export function textoDaResposta(r: { tipo?: string; texto?: string; arquivo?: string }): string {
  const t = texto(r.texto).trim();
  const oque: Record<string, string> = { pdf: 'mandou um PDF', documento: 'mandou um arquivo', imagem: 'mandou uma foto', audio: 'mandou um áudio', video: 'mandou um vídeo', outro: 'mandou uma mensagem' };
  if (!r.tipo || r.tipo === 'texto') return t;
  return (oque[r.tipo] || 'mandou uma mensagem') + (r.arquivo ? ' (' + r.arquivo + ')' : '') + (t ? ': ' + t : '');
}

/** O pedido que esta mensagem responde: o último que o robô mandou para o número nos últimos 7 dias (null = nenhum). */
export function pedidoRespondido(conversas: Record<string, { caminho: string; em: number }>, numero: string, agora: number): string | null {
  let achado: { caminho: string; em: number } | null = null;
  for (const [n, c] of Object.entries(conversas)) {
    if (!c || !mesmoNumero(n, numero) || agora - c.em > RESPOSTA_VALE_MS) continue;
    if (!achado || c.em > achado.em) achado = c;
  }
  return achado ? achado.caminho : null;
}

// ---------- o autoatendimento ----------

export interface EmpresaDoAtendimento { codigo: string; nome: string; clienteId: string }

export type AcaoDoAtendimento = 'guias' | 'boleto' | 'dp' | 'escritorio';

export interface ConversaDoAtendimento {
  /** 'empresa' = esperando escolher a empresa; 'menu' = esperando a opção; '' = nada em aberto */
  etapa: '' | 'empresa' | 'menu';
  empresas: EmpresaDoAtendimento[];
  empresa: EmpresaDoAtendimento | null;
  /** quando o menu (ou a pergunta da empresa) foi mandado, em ms */
  menuEm: number;
  /** quando o aviso de número fora do cadastro foi mandado, em ms */
  avisoEm: number;
}

export const CONVERSA_NOVA: ConversaDoAtendimento = { etapa: '', empresas: [], empresa: null, menuEm: 0, avisoEm: 0 };

/** a opção do menu vale por 30 min; depois, o número digitado mostra o menu de novo */
export const MENU_VALE_MS = 30 * 60000;
/** texto solto (que não é MENU nem opção) só puxa o menu de novo depois de 6 h */
export const MENU_DE_NOVO_MS = 6 * 3600000;
/** quem acabou de receber mensagem do robô (24 h) está respondendo a ela: texto solto não puxa o menu */
export const RESPONDENDO_MS = 24 * 3600000;
/** o aviso de "número fora do cadastro", no máximo uma vez por dia */
const AVISO_DE_NOVO_MS = 24 * 3600000;

const OPCOES: { acao: AcaoDoAtendimento; rotulo: string }[] = [
  { acao: 'guias', rotulo: 'Guias do mês' },
  { acao: 'boleto', rotulo: 'Boleto de honorários' },
  { acao: 'dp', rotulo: 'Documentos do DP (folha, férias, rescisão)' },
  { acao: 'escritorio', rotulo: 'Falar com o escritório' },
];

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const PEDE_MENU = /^(menu|oi|ola|bom dia|boa tarde|boa noite|inicio|opcoes|ajuda)$/;

/** O texto do menu da empresa. */
export function textoDoMenu(empresa: EmpresaDoAtendimento): string {
  return 'Olá! Este é o atendimento automático da Nilma Contabilidade para ' + empresa.nome + '.\n\nResponda com o número:\n' +
    OPCOES.map((o, i) => (i + 1) + ' – ' + o.rotulo).join('\n');
}

/** A pergunta da empresa, para o número que está em mais de um cadastro. */
export function textoDasEmpresas(empresas: EmpresaDoAtendimento[]): string {
  return 'Olá! Este número está no cadastro de mais de uma empresa. Responda com o número da empresa:\n' +
    empresas.map((e, i) => (i + 1) + ' – ' + e.nome).join('\n');
}

export const TEXTO_FORA_DO_CADASTRO = 'Olá! Este é o atendimento automático da Nilma Contabilidade, mas não achamos este número no cadastro de nenhuma empresa. ' +
  'Fale com o escritório pelo WhatsApp ' + numeroFormatado(NUMERO_DO_ESCRITORIO) + '.';

export const TEXTO_DO_ESCRITORIO = 'Certo! Avisamos a equipe do escritório. Se preferir, chame direto no WhatsApp ' + numeroFormatado(NUMERO_DO_ESCRITORIO) + '.';

export interface PassoDoAtendimento {
  /** o que responder ('' = nada) */
  responder: string;
  /** o que o robô vai buscar e mandar (null = nada) */
  acao: { tipo: AcaoDoAtendimento; empresa: EmpresaDoAtendimento } | null;
  conversa: ConversaDoAtendimento;
}

/**
 * O próximo passo do autoatendimento: a conversa guardada (null = nunca falou), o texto que chegou, as empresas do número
 * no cadastro, a hora e quando o robô mandou a última mensagem a este número (0 = nunca). Sem rede e sem banco.
 */
export function passoDoAtendimento(
  guardada: ConversaDoAtendimento | null, recebido: string, empresas: EmpresaDoAtendimento[], agora: number, ultimoEnvioEm = 0,
): PassoDoAtendimento {
  const c: ConversaDoAtendimento = { ...CONVERSA_NOVA, ...(guardada || {}), empresas };
  const t = normal(recebido);
  const pediuMenu = PEDE_MENU.test(t);
  const n = /^\d{1,2}$/.test(t) ? Number(t) : 0;
  const nada = (conversa = c): PassoDoAtendimento => ({ responder: '', acao: null, conversa });

  if (!empresas.length) {
    if (agora - c.avisoEm < AVISO_DE_NOVO_MS) return nada();
    return { responder: TEXTO_FORA_DO_CADASTRO, acao: null, conversa: { ...c, etapa: '', empresa: null, avisoEm: agora } };
  }
  // a empresa escolhida antes ainda é deste número?
  const empresa = (c.empresa ? empresas.find(e => e.codigo === c.empresa?.codigo) : undefined) || (empresas.length === 1 ? empresas[0] : null);
  const abrirMenu = (): PassoDoAtendimento => (empresa
    ? { responder: textoDoMenu(empresa), acao: null, conversa: { ...c, etapa: 'menu', empresa, menuEm: agora } }
    : { responder: textoDasEmpresas(empresas), acao: null, conversa: { ...c, etapa: 'empresa', empresa: null, menuEm: agora } });
  const vale = agora - c.menuEm < MENU_VALE_MS;

  if (pediuMenu) {
    // "menu" com várias empresas pergunta de novo qual
    if (empresas.length > 1 && t === 'menu') return { responder: textoDasEmpresas(empresas), acao: null, conversa: { ...c, etapa: 'empresa', empresa: null, menuEm: agora } };
    return abrirMenu();
  }
  if (n && vale && c.etapa === 'empresa') {
    const escolhida = empresas[n - 1];
    if (!escolhida) return { responder: textoDasEmpresas(empresas), acao: null, conversa: { ...c, menuEm: agora } };
    return { responder: textoDoMenu(escolhida), acao: null, conversa: { ...c, etapa: 'menu', empresa: escolhida, menuEm: agora } };
  }
  if (n && vale && c.etapa === 'menu' && empresa) {
    const opcao = OPCOES[n - 1];
    if (!opcao) return { responder: textoDoMenu(empresa), acao: null, conversa: { ...c, empresa, menuEm: agora } };
    // depois de atender, o "obrigado" que vem não puxa o menu de novo (menuEm = agora); o número digitado reabre o menu
    return { responder: opcao.acao === 'escritorio' ? TEXTO_DO_ESCRITORIO : '', acao: { tipo: opcao.acao, empresa }, conversa: { ...c, etapa: '', empresa, menuEm: agora } };
  }
  if (n) return abrirMenu();
  // texto solto: é resposta a uma mensagem do robô, ou o menu acabou de ir? então não repete o menu
  if (agora - ultimoEnvioEm < RESPONDENDO_MS || agora - c.menuEm < MENU_DE_NOVO_MS) return nada();
  return abrirMenu();
}

// ---------- os documentos do autoatendimento ----------

/** No máximo tantos arquivos por pedido do cliente. */
export const MAX_ARQUIVOS_DO_ATENDIMENTO = 5;

export interface RegistroDeEnvio {
  /** 'aaaa-mm' */
  competencia: string;
  /** quando foi enviado (ISO) */
  enviadoEm: string;
  arquivos: { nome: string; id: string }[];
}

/** O envio mais recente (pela competência e, no empate, pela hora) que tem arquivo; null = nenhum. */
export function envioMaisRecente(registros: RegistroDeEnvio[]): RegistroDeEnvio | null {
  const com = registros.filter(r => r.arquivos.length > 0 && /^\d{4}-\d{2}$/.test(r.competencia));
  com.sort((a, b) => b.competencia.localeCompare(a.competencia) || b.enviadoEm.localeCompare(a.enviadoEm));
  return com[0] ? { ...com[0], arquivos: com[0].arquivos.slice(0, MAX_ARQUIVOS_DO_ATENDIMENTO) } : null;
}

const NOMES_DA_ACAO: Record<Exclude<AcaoDoAtendimento, 'escritorio'>, [string, string]> = {
  guias: ['a guia', 'as guias'], boleto: ['o boleto de honorários', 'os boletos de honorários'], dp: ['o documento do DP', 'os documentos do DP'],
};

/** O texto que vai antes dos arquivos ("Segue as guias de outubro de 2026 (2 arquivos).") ou o "não achei". */
export function textoDosDocumentos(acao: Exclude<AcaoDoAtendimento, 'escritorio'>, empresa: EmpresaDoAtendimento, achado: RegistroDeEnvio | null): string {
  const [um, varios] = NOMES_DA_ACAO[acao];
  if (!achado) {
    return 'Não achamos ' + varios + ' de ' + empresa.nome + ' já enviados pelo escritório. Se precisar, fale com a equipe pelo WhatsApp ' + numeroFormatado(NUMERO_DO_ESCRITORIO) + '.';
  }
  const mes = mesPorExtenso(achado.competencia);
  const qtos = achado.arquivos.length;
  return (qtos === 1 ? 'Segue ' + um : 'Seguem ' + varios) + ' de ' + empresa.nome + (mes ? ' (' + mes + ')' : '') + (qtos > 1 ? ', ' + qtos + ' arquivos' : '') + '.';
}

// ---------- as respostas na tela (Central dos robôs › Ajustes › WhatsApp e o histórico do Pedir extratos) ----------

/** a tela lê as respostas dos últimos tantos dias (uma leitura quando a pessoa pede, não ao vivo) */
export const DIAS_DAS_RESPOSTAS = 7;

const ORIGENS_DO_PEDIDO: Record<string, string> = {
  'lote-fiscal': 'Guias do Fiscal', boleto: 'Boleto de honorários', mandei: 'Mandei', autoatendimento: 'Autoatendimento',
};

/** O mapa respostas.r1, r2... do pedido em ordem (o robô grava sem ler, por merge); o que não for resposta fica fora. */
export function respostasDoPedido(bruto: unknown): RespostaDoCliente[] {
  const m = obj(bruto);
  if (!m) return [];
  return Object.entries(m)
    .filter(([k, v]) => /^r\d+$/.test(k) && obj(v))
    .sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1)))
    .map(([, v]) => {
      const x = v as Solto;
      const tipo = (['texto', 'pdf', 'documento', 'imagem', 'audio', 'video', 'outro'] as TipoDaMensagem[]).includes(x.tipo as TipoDaMensagem) ? x.tipo as TipoDaMensagem : 'outro';
      return { em: texto(x.em), tipo, texto: texto(x.texto), ...(texto(x.arquivo) ? { arquivo: texto(x.arquivo) } : {}) };
    });
}

export interface RespostaRecebida {
  id: string;
  /** a empresa (ou o nome do cliente do pedido) */
  empresa: string;
  /** de onde veio: Guias do Fiscal, Boleto, Mandei, Pedir extratos, Autoatendimento */
  origem: string;
  /** o número que respondeu (formatado); vazio quando é a resposta a um pedido */
  numero: string;
  /** a última resposta (ISO) */
  quando: string;
  /** o cliente pediu para falar com o escritório pelo autoatendimento */
  pedeEscritorio: boolean;
  /** foi para o escritório como teste (trava fechada) */
  teste: boolean;
  respostas: RespostaDoCliente[];
  /** a última, em poucas palavras */
  ultima: string;
}

/** Um documento da fila (solicitacoesEmail) com resposta → o que a tela mostra. */
export function lerRespostaRecebida(id: string, bruto: unknown): RespostaRecebida {
  const d = obj(bruto) || {};
  const respostas = respostasDoPedido(d.respostas);
  const origem = texto(d.origem);
  return {
    id,
    empresa: texto(d.empresa) || texto(d.clienteNome) || 'Cliente',
    origem: ORIGENS_DO_PEDIDO[origem] || (texto(d.tipo) === 'whatsapp' ? 'Pedir extratos' : 'WhatsApp'),
    numero: d.tipo === 'whatsapp-recebida' ? numeroFormatado(d.numero) : '',
    quando: texto(d.respondidoEm),
    pedeEscritorio: d.pedeEscritorio === true,
    teste: d.teste === true,
    respostas,
    ultima: texto(d.ultimaResposta) || (respostas.length ? textoDaResposta(respostas[respostas.length - 1]) : ''),
  };
}

/** A partir de quando a tela lê as respostas (ISO). */
export function desdeDasRespostas(agora: Date): string {
  return new Date(agora.getTime() - DIAS_DAS_RESPOSTAS * 864e5).toISOString();
}

/** O "de → para" da confirmação: só o que mudou ("Guias do Fiscal: desligada → ligada"). */
export function mudancasDasChaves(antes: ChavesDoWhatsapp, depois: ChavesDoWhatsapp): string[] {
  const estado = (v: boolean) => (v ? 'ligada' : 'desligada');
  const lista = CHAVES_DO_WHATSAPP.filter(c => antes[c.chave] !== depois[c.chave]).map(c => c.rotulo + ': ' + estado(antes[c.chave]) + ' → ' + estado(depois[c.chave]));
  const nums = (c: ChavesDoWhatsapp) => c.numerosDeTeste.map(numeroFormatado).join(', ') || 'nenhum';
  if (nums(antes) !== nums(depois)) lista.push('Números de teste a mais: ' + nums(antes) + ' → ' + nums(depois));
  if (antes.empresaDeTeste.trim() !== depois.empresaDeTeste.trim()) lista.push('Empresa de teste: ' + (antes.empresaDeTeste.trim() || 'nenhuma') + ' → ' + (depois.empresaDeTeste.trim() || 'nenhuma'));
  return lista;
}
