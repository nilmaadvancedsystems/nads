// O cliente na entrega (16/10/2026, a cópia fiel do Entregas): a página do cliente que o Painel abre (os números, os
// avisos, o contato, a empresa na Receita, as últimas entregas, o histórico mês a mês com o Protocolo e o Extrato), quem
// costuma receber (os nomes num toque), a dica de horário que o histórico ensina, os papéis com validade, e o link do
// cliente (portais/{token}: a projeção das entregas que a página cliente.html mostra, com o PIX do escritório). Puro.
import {
  dataBr, dataHoraDaEntrega, dinheiro, documentoFormatado, quandoFoi, rotuloDaCompetencia, rotuloDoCliente, textoDosItens, totalDosItens,
  ultimasCompetencias, type ClienteDaRota, type Entrega, type MudancaNaReceita,
} from './documentos';
import { pixCopiaECola } from './guiasDoPdf';
import { diasAte, pontoConfiavel, textoDaJanela, textoDiasDeEntrega, textoPrazo } from './rotaDeEntregas';

// ---------------------------------------------------------------------------------------------------------------------
// quem costuma receber e a que horas
// ---------------------------------------------------------------------------------------------------------------------
type DoHistorico = Pick<Entrega, 'recebedor' | 'confirmadoEm' | 'status' | 'motivoFalha'>;

/** Os nomes de quem costuma assinar por este cliente (até 3, o mais frequente primeiro; empate, o mais recente). */
export function recebedoresSugeridos(entregas: readonly DoHistorico[]): string[] {
  const nomes = new Map<string, { nome: string; vezes: number; ultima: string }>();
  for (const e of entregas) {
    const nome = String(e.recebedor || '').trim().replace(/\s+/g, ' ');
    if (nome.length < 2) continue;
    const k = nome.toLowerCase();
    const a = nomes.get(k) || { nome, vezes: 0, ultima: '' };
    a.vezes++;
    if (String(e.confirmadoEm || '') > a.ultima) { a.ultima = String(e.confirmadoEm || ''); a.nome = nome; }
    nomes.set(k, a);
  }
  return [...nomes.values()].sort((a, b) => b.vezes - a.vezes || b.ultima.localeCompare(a.ultima)).slice(0, 3).map(x => x.nome);
}

/** "Costuma receber entre 9h e 11h · 2 tentativas sem sucesso por volta das 12h" (dicaDoCliente_): só com 3+ entregas. */
export function dicaDoCliente(entregas: readonly DoHistorico[]): string {
  const horas = (l: readonly DoHistorico[]) => l.map(e => { const d = new Date(String(e.confirmadoEm)); return isNaN(d.getTime()) ? null : d.getHours() + d.getMinutes() / 60; }).filter((h): h is number => h !== null);
  const ok = horas(entregas.filter(e => e.status === 'confirmada'));
  const partes: string[] = [];
  if (ok.length >= 3) {
    ok.sort((a, b) => a - b);
    const ini = Math.floor(ok[Math.floor(ok.length * 0.25)]);
    let fim = Math.ceil(ok[Math.min(ok.length - 1, Math.floor(ok.length * 0.75))]);
    if (fim <= ini) fim = ini + 1;
    partes.push('Costuma receber entre ' + ini + 'h e ' + fim + 'h');
  }
  const ruins = horas(entregas.filter(e => e.status === 'falha'));
  if (ruins.length >= 2) {
    const porFaixa = new Map<number, number>();
    for (const h of ruins) porFaixa.set(Math.floor(h), (porFaixa.get(Math.floor(h)) || 0) + 1);
    const [pior, n] = [...porFaixa.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n >= 2) partes.push(n + ' tentativas sem sucesso por volta das ' + pior + 'h');
  }
  return partes.join(' · ');
}

// ---------------------------------------------------------------------------------------------------------------------
// a página do cliente
// ---------------------------------------------------------------------------------------------------------------------
/** Os documentos com validade (TIPOS_DE_PAPEL_). */
const TIPOS_DE_PAPEL: Record<string, string> = {
  'cnd-federal': 'CND Federal', 'cnd-estadual': 'CND Estadual', 'cnd-municipal': 'CND Municipal', fgts: 'CRF do FGTS', trabalhista: 'Certidão trabalhista',
  procuracao: 'Procuração eletrônica', certificado: 'Certificado digital', outro: 'Outro documento',
};
export const nomeDoPapel = (tipo: string) => TIPOS_DE_PAPEL[tipo] || 'Documento';
/** Os papéis do cliente com o prazo, o mais urgente primeiro. */
export function papeisComPrazo(c: Pick<ClienteDaRota, 'papeis'>, hoje = new Date()) {
  return c.papeis.map(p => ({ papel: p, dias: diasAte(p.vence, hoje) }))
    .sort((a, b) => (a.dias === null ? 9999 : a.dias) - (b.dias === null ? 9999 : b.dias))
    .map(x => ({ ...x, nome: nomeDoPapel(x.papel.tipo), prazo: x.dias === null ? '' : textoPrazo(x.dias), classe: x.dias === null ? '' : x.dias < 0 ? 'vencido' : x.dias <= 15 ? 'perto' : '' }));
}

/** As ocorrências (combinado, reclamação, elogio, anotação): as 6 mais novas. */
const TIPOS_DE_OCORRENCIA: Record<string, string> = { combinado: 'Combinado', reclamacao: 'Reclamação', elogio: 'Elogio', nota: 'Anotação' };
export const ocorrenciasDoCliente = (c: Pick<ClienteDaRota, 'ocorrencias'>) =>
  c.ocorrencias.slice(0, 6).map(o => ({ ...o, rotulo: TIPOS_DE_OCORRENCIA[o.tipo] || 'Anotação', sub: (TIPOS_DE_OCORRENCIA[o.tipo] || 'Anotação') + ' · ' + (o.por || 'alguém') + ' · ' + dataHoraDaEntrega(o.em) }));

export const regimeDoCliente = (c: Pick<ClienteDaRota, 'enquadramento' | 'receita'>) =>
  c.enquadramento || (c.receita ? (c.receita.mei ? 'MEI' : c.receita.simples ? 'Simples Nacional' : '') : '');
export const regimeNaReceita = (r: { mei: boolean; simples: boolean }) => (r.mei ? 'MEI' : r.simples ? 'Simples Nacional' : 'Fora do Simples');
export const mudancasDaReceita = (c: Pick<ClienteDaRota, 'receita'>): MudancaNaReceita[] => c.receita?.mudancas || [];
export const iniciaisDoCliente = (nome: string) =>
  nome.replace(/^[\d\s.-]+/, '').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p.charAt(0)).join('').toUpperCase() || '?';

/** O que vai embaixo do nome no cabeçalho: código, CNPJ, fantasia (se for outro nome) e a cidade. */
export function subtituloDoCliente(c: ClienteDaRota): string {
  return [c.codigoOrigem ? 'Código ' + c.codigoOrigem : '', documentoFormatado(c.documento),
    c.nomeFantasia && c.nomeFantasia !== c.nome.replace(/^\d+\s*-\s*/, '') ? c.nomeFantasia : '', c.cidade].filter(Boolean).join(' · ');
}

/** As formas de honorário que contam como entregue (tiposQueContamComoHonorario_). */
export function tiposQueContamComoHonorario(forma: string): string[] {
  return ['Honorário', 'Notas', ...((forma || '').toLowerCase().includes('boleto') ? ['Boleto'] : [])];
}
/** "Paga aqui" (o cliente vem) e "Email" não pedem visita. */
export function honorarioPrecisaVisita(forma: string): boolean {
  const f = (forma || '').trim().toLowerCase();
  return !!f && !f.includes('paga aqui') && f !== 'email';
}

export interface KpiDoCliente { rotulo: string; valor: string; sub: string; pendente?: boolean }
/** Os números do cliente (Entregas, Última entrega, Este mês e, com honorário, a situação do honorário no mês). */
export function kpisDoCliente(c: ClienteDaRota, historico: readonly Entrega[], meses: number, hoje = new Date()): KpiDoCliente[] {
  const comp = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
  const doMes = historico.filter(e => e.competencia === comp);
  const entregues = doMes.filter(e => e.status === 'confirmada').length;
  const naRota = doMes.filter(e => e.status !== 'confirmada' && e.status !== 'falha').length;
  const ultima = historico.find(e => e.status === 'confirmada');
  const k: KpiDoCliente[] = [
    { rotulo: 'Entregas', valor: String(historico.length), sub: meses ? 'em ' + meses + (meses === 1 ? ' mês' : ' meses') : 'nenhuma ainda' },
    { rotulo: 'Última entrega', valor: ultima ? dataBr(ultima.confirmadoEm) : '—', sub: ultima ? ultima.itens.map(i => i.tipo).filter(Boolean).slice(0, 3).join(', ') : '' },
    { rotulo: 'Este mês', valor: entregues ? entregues + (entregues === 1 ? ' entregue' : ' entregues') : naRota ? 'na rota' : 'nada ainda', sub: naRota && entregues ? naRota + ' ainda na rota' : rotuloDaCompetencia(comp) },
  ];
  if (c.honorarioForma) {
    const tipos = tiposQueContamComoHonorario(c.honorarioForma);
    const ok = honorarioPrecisaVisita(c.honorarioForma)
      ? historico.some(e => e.status === 'confirmada' && String(e.confirmadoEm || '').slice(0, 7) === comp && e.itens.some(i => tipos.includes(i.tipo)))
      : null;
    k.push({
      rotulo: 'Honorário', valor: ok === null ? c.honorarioForma : ok ? 'Entregue' : 'Pendente',
      sub: [ok === null ? '' : c.honorarioForma, c.honorarioDia ? 'dia ' + c.honorarioDia : ''].filter(Boolean).join(' · '), pendente: ok === false,
    });
  }
  return k;
}

export interface AvisoDoCliente { texto: string; grave?: boolean; tipo: 'receita' | 'recado' | 'mapa' | 'papel' }
/** Os avisos do Resumo: a Receita mudou, o recado do cadastro, sem ponto no mapa (fora da consulta) e papel vencendo em 30 dias. */
export function avisosDoCliente(c: ClienteDaRota, consulta: boolean, hoje = new Date()): AvisoDoCliente[] {
  const a: AvisoDoCliente[] = mudancasDaReceita(c).map(m => ({ texto: 'Receita: ' + m.texto, grave: m.grave, tipo: 'receita' }));
  if (c.observacao) a.push({ texto: c.observacao, tipo: 'recado' });
  if (!consulta && !pontoConfiavel(c)) a.push({ texto: c.geo ? 'No mapa da rota ele está só no centro da cidade.' : 'Sem ponto no mapa da rota.', tipo: 'mapa' });
  for (const p of c.papeis) {
    const d = diasAte(p.vence, hoje);
    if (d !== null && d <= 30) a.push({ texto: nomeDoPapel(p.tipo) + ': ' + textoPrazo(d), grave: d < 0, tipo: 'papel' });
  }
  return a;
}

/** Linhas de dado (rótulo, valor), só as que têm valor (listaDeDados_). */
export const dadosComValor = (l: readonly [string, string | undefined | null][]) => l.filter(([, v]) => v != null && String(v).trim() !== '') as [string, string][];
export const emailsDoCliente = (c: Pick<ClienteDaRota, 'email' | 'emails'>) => [c.email, ...c.emails].filter(Boolean).filter((e, i, l) => l.indexOf(e) === i);
export function enderecoCompleto(c: ClienteDaRota): string {
  return [c.endereco, c.bairro && !c.endereco.includes(c.bairro) ? c.bairro : '', c.cidade && !c.endereco.includes(c.cidade) ? c.cidade : '', c.cep ? 'CEP ' + c.cep : ''].filter(Boolean).join(' · ');
}
export const recebeQuando = (c: ClienteDaRota) => [textoDiasDeEntrega(c), textoDaJanela(c)].filter(Boolean).join(' · ');

/** O histórico por competência (a mais nova primeiro), com o total de cada mês. */
export function historicoPorCompetencia(historico: readonly Entrega[]): { competencia: string; rotulo: string; entregas: Entrega[]; total: number }[] {
  const grupos: { competencia: string; rotulo: string; entregas: Entrega[]; total: number }[] = [];
  const porComp = new Map<string, number>();
  for (const e of historico) {
    const comp = e.competencia || 'sem competência';
    if (!porComp.has(comp)) { porComp.set(comp, grupos.length); grupos.push({ competencia: comp, rotulo: comp === 'sem competência' ? comp : rotuloDaCompetencia(comp), entregas: [], total: 0 }); }
    const g = grupos[porComp.get(comp) as number];
    g.entregas.push(e);
    g.total = Math.round((g.total + totalDosItens(e.itens)) * 100) / 100;
  }
  return grupos;
}
/** O rótulo da situação no histórico do cliente. */
export function rotuloNoHistorico(e: Pick<Entrega, 'status' | 'recebidoPeloLink'>): { rotulo: string; tom: 'ok' | 'bad' | 'warn' } {
  if (e.status === 'confirmada') return { rotulo: e.recebidoPeloLink ? 'Recebido pelo link' : 'Entregue', tom: 'ok' };
  if (e.status === 'falha') return { rotulo: 'Não entregue', tom: 'bad' };
  return { rotulo: e.status === 'link' ? 'No link' : 'Na rota', tom: 'warn' };
}

/** O bloco que se cola no outro sistema (Copiar dados). */
export function dadosParaCopiar(c: ClienteDaRota): string {
  return [rotuloDoCliente(c), c.documento ? 'CNPJ/CPF: ' + c.documento : '', c.endereco ? 'Endereço: ' + c.endereco : '', c.telefone ? 'Telefone: ' + c.telefone : '',
    c.email ? 'E-mail: ' + c.email : '', ...c.contatos.map(x => 'Contato: ' + [x.nome, x.papel, x.telefone].filter(Boolean).join(' · '))].filter(Boolean).join('\n');
}

/** O telefone que o WhatsApp entende (55 + DDD + número), ou '' quando não dá pé. */
export function numeroDoWhatsApp(tel: string): string {
  const d = String(tel || '').replace(/\D/g, '');
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d;
  if (d.length === 10 || d.length === 11) return '55' + d;
  return '';
}
export const linkDoWhatsApp = (texto: string, tel: string) => 'https://wa.me/' + numeroDoWhatsApp(tel) + '?text=' + encodeURIComponent(texto);

// ---------------------------------------------------------------------------------------------------------------------
// a planilha (Exportar planilha / Exportar histórico)
// ---------------------------------------------------------------------------------------------------------------------
export const CABECALHO_DA_PLANILHA = ['Cliente', 'Competência', 'Documentos', 'Total (R$)', 'Recebedor', 'Data/Hora', 'Localização'];
export function linhasDaPlanilha(entregas: readonly Entrega[]): (string | number)[][] {
  return [...entregas].sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime()).map(e => [
    e.clienteNome, rotuloDaCompetencia(e.competencia), e.itens.map(i => i.tipo + (i.valor != null ? ' (' + dinheiro(i.valor) + ')' : '')).join(' | '),
    totalDosItens(e.itens) || 0, e.recebedor || '', dataHoraDaEntrega(e.criadoEm), e.geo ? e.geo.lat + ',' + e.geo.lng : '',
  ]);
}

// ---------------------------------------------------------------------------------------------------------------------
// o link do cliente (portais/{token}) e quem responde por ele
// ---------------------------------------------------------------------------------------------------------------------
export const ENDERECO_DO_ENTREGAS = 'https://entregas-2e5e2.web.app/';
export const linkDoPortal = (token: string) => ENDERECO_DO_ENTREGAS + 'cliente.html?portal=' + token;
export const linkDaAssinatura = (token: string) => ENDERECO_DO_ENTREGAS + 'entregas.html?assinar=' + token;
export const linkDoProtocolo = (codigo: string) => ENDERECO_DO_ENTREGAS + 'cliente.html?protocolo=' + codigo;
export const MESES_NO_PORTAL = 4;

/** As empresas que um link mostra: a principal e as que a seguem (grupoLocal), ativas. Quem segue outra responde só por si. */
export function empresasDoLink(dono: ClienteDaRota | null | undefined, clientes: ReadonlyMap<string, ClienteDaRota>): ClienteDaRota[] {
  if (!dono) return [];
  if (dono.grupoLocal) return [dono];
  return [dono, ...[...clientes.values()].filter(x => x.id !== dono.id && x.grupoLocal === dono.id && x.ativo)];
}
/** Os clientes cujo link mostra as entregas deste: ele mesmo (se tem link) e a principal do grupo (se tem). */
export function donosDoLinkDe(clienteId: string | null, clientes: ReadonlyMap<string, ClienteDaRota>): ClienteDaRota[] {
  const c = clienteId ? clientes.get(clienteId) : undefined;
  if (!c) return [];
  const donos = c.portalToken ? [c] : [];
  const principal = c.grupoLocal ? clientes.get(c.grupoLocal) : undefined;
  if (principal?.portalToken) donos.push(principal);
  return donos;
}

/** A entrega como o cliente vê no link (projecaoDaEntrega_). */
export function projecaoDaEntrega(e: Entrega) {
  return {
    id: e.id, competencia: e.competencia || '', itens: e.itens.map(i => ({ tipo: i.tipo || '', valor: i.valor == null ? null : i.valor })),
    vencimento: e.vencimento || '', temGuia: !!e.temGuia,
    pagamento: e.codigoPagamento?.codigo ? { tipo: e.codigoPagamento.tipo || 'boleto', codigo: e.codigoPagamento.codigo } : null,
    status: e.status || 'pendente', quando: quandoFoi(e) || '', recebedor: e.recebedor || '', temAssinatura: !!e.temAssinatura, temFoto: !!e.temFoto,
    motivoFalha: e.status === 'falha' ? e.motivoFalha || '' : '', peloLink: e.canal === 'link' || e.recebidoPeloLink,
  };
}

export interface DadosDoEscritorio { pixChave: string; pixNome: string; pixCidade: string; honorarioTexto: string; whatsapp: string }
export const ESCRITORIO_VAZIO: DadosDoEscritorio = { pixChave: '', pixNome: '', pixCidade: '', honorarioTexto: '', whatsapp: '' };
export function escritorioDoDocumento(d: Record<string, unknown> | null | undefined): DadosDoEscritorio {
  const t = (v: unknown) => (v == null ? '' : String(v));
  return d ? { pixChave: t(d.pixChave), pixNome: t(d.pixNome), pixCidade: t(d.pixCidade), honorarioTexto: t(d.honorarioTexto), whatsapp: t(d.whatsapp) } : ESCRITORIO_VAZIO;
}

/**
 * O que se grava no link do cliente (atualizarPortalDoCliente_): as entregas das empresas do link (as na rota e as dos
 * últimos 4 meses, até 80, a mais nova primeiro; com mais de uma empresa, o nome de cada), e o escritório (o PIX, o recado e
 * se o honorário do mês já foi entregue).
 */
export function projecaoDoPortal(dono: ClienteDaRota, empresas: readonly ClienteDaRota[], todas: readonly Entrega[], esc: DadosDoEscritorio, agora = new Date()) {
  const comps = ultimasCompetencias(MESES_NO_PORTAL, agora);
  const nomeDe = new Map(empresas.map(x => [x.id, x.nomeFantasia || x.nome || '']));
  const vistas = new Set<string>();
  const minhas = todas.filter(e => { if (vistas.has(e.id) || !e.clienteId || !nomeDe.has(e.clienteId)) return false; vistas.add(e.id); return true; });
  const lista = minhas.filter(e => e.status === 'pendente' || comps.includes(e.competencia))
    .sort((a, b) => String(quandoFoi(b) || '').localeCompare(String(quandoFoi(a) || '')))
    .slice(0, 80)
    .map(e => (empresas.length > 1 ? { ...projecaoDaEntrega(e), empresa: nomeDe.get(e.clienteId as string) || '' } : projecaoDaEntrega(e)));
  const comp = comps[0];
  const doHonorario = minhas.filter(e => e.competencia === comp && e.itens.some(i => { const t = i.tipo.toLowerCase(); return t.includes('honor') || t.includes('boleto'); }));
  return {
    clienteNome: (dono.nome || '') + (empresas.length > 1 ? ' e mais ' + (empresas.length - 1) + (empresas.length === 2 ? ' empresa' : ' empresas') : ''),
    entregas: { atualizadoEm: agora.toISOString(), lista },
    escritorio: {
      pix: pixCopiaECola(esc.pixChave, esc.pixNome, esc.pixCidade), nome: esc.pixNome || '', honorarioTexto: esc.honorarioTexto || '', whatsapp: esc.whatsapp || '',
      honorarioMes: doHonorario.length ? comp : '', honorarioEntregue: doHonorario.some(e => e.status === 'confirmada'),
    },
  };
}

/** O token novo (do link do cliente: 40 caracteres; da assinatura e do link de rota: 32). */
export function tokenAleatorio(bytes: number, aleatorio: (n: number) => Uint8Array): string {
  return Array.from(aleatorio(bytes)).map(b => b.toString(16).padStart(2, '0')).join('');
}
/** O código do protocolo de papel (12 caracteres sem I e O; 32 símbolos, a regra do banco confere o formato). */
const LETRAS_DO_PROTOCOLO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function codigoDoProtocolo(aleatorio: (n: number) => Uint8Array): string {
  return Array.from(aleatorio(12)).map(b => LETRAS_DO_PROTOCOLO[b % 32]).join('');
}
/** O retrato do protocolo do mês (protocolos/{codigo}): o que a página de conferência mostra. */
export function retratoDoProtocolo(cliente: Pick<ClienteDaRota, 'nome' | 'documento'>, comp: string, ordenadas: readonly Entrega[], total: number, emitidoPor: string, uid: string, agora: string) {
  const situacao = (e: Entrega) => (e.status === 'confirmada' ? (e.recebidoPeloLink ? 'Recebido pelo link' : 'Entregue') : e.status === 'falha' ? 'Não entregue' : e.status === 'link' ? 'No link, aguardando' : 'Na rota');
  return {
    clienteNome: String(cliente.nome || '').slice(0, 200), documento: String(cliente.documento || ''), competencia: String(comp || '').slice(0, 7),
    entregas: ordenadas.slice(0, 200).map(e => ({
      docs: e.itens.map(i => i.tipo + (i.valor != null ? ' ' + dinheiro(i.valor) : '')).join(', '), situacao: situacao(e), quando: quandoFoi(e) || '',
      recebedor: e.status === 'confirmada' ? e.recebedor || '' : '', por: e.entregadoPorNome || '',
    })),
    total: total || 0, emitidoEm: agora, emitidoPor, emitidoPorUid: uid,
  };
}
/** Os itens do resumo que vai no link da assinatura ("DAS — R$ 10,00"). */
export const itensDoResumo = (e: Pick<Entrega, 'itens'>) => e.itens.map(i => i.tipo + (i.valor != null ? ' — ' + dinheiro(i.valor) : ''));
/** O texto do documento para a linha do histórico. */
export const documentosDaEntrega = (e: Pick<Entrega, 'itens'>) => textoDosItens(e.itens) || 'sem documentos';
