// As contas das seções que vieram do protótipo do Vitor (16/10/2026) e ainda não estão no core: o certificado, o resumo do
// pessoal, o filtro dos documentos, os avisos do sino e o texto dos pedidos do pessoal (admissão, férias e demissão viram
// um chamado do tipo certo com os dados no texto). Funções puras, testadas em regras.test.ts.
import type { areaCliente as ac } from '@nads/core';
import type { CertificadoDigital, DocumentoDoCliente, EstadoDaArea } from './areaCliente';

const DIA = 86_400_000;
const meioDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
const deIso = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d, 12); };
export const dataBr = (iso: string) => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
export const chaveDoMes = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');

/** O link do WhatsApp do escritório (wa.me com o 55 do Brasil na frente); '' quando não tem número que sirva. */
export function linkDoWhatsapp(numero: string | undefined): string {
  const d = String(numero ?? '').replace(/\D/g, '');
  if (d.length < 10) return '';
  return 'https://wa.me/' + (d.startsWith('55') && d.length > 11 ? d : '55' + d);
}

/** Quanto falta para o certificado vencer e o tom do aviso: vencido, vence em até 30 dias, ou em ordem. */
export function situacaoDoCertificado(c: CertificadoDigital, hoje: Date): { dias: number; tom: 'ok' | 'warn' | 'bad'; texto: string } {
  const dias = Math.round((deIso(c.validoAte).getTime() - meioDia(hoje)) / DIA);
  if (dias < 0) return { dias, tom: 'bad', texto: 'Venceu em ' + dataBr(c.validoAte) + '. Sem ele o escritório não consegue entregar as declarações.' };
  if (dias <= 30) return { dias, tom: 'warn', texto: 'Vence em ' + dataBr(c.validoAte) + (dias === 0 ? ' (hoje)' : ' (faltam ' + dias + (dias === 1 ? ' dia' : ' dias') + ')') + '. Renove antes.' };
  return { dias, tom: 'ok', texto: 'Válido até ' + dataBr(c.validoAte) + '.' };
}

/** Os números do pessoal: ativos, de férias, a folha (soma dos salários) e as admissões no ano. */
export function resumoDoPessoal(p: ac.ResumoDoPessoal | null, hoje: Date) {
  const ano = String(hoje.getFullYear());
  const fs = p?.funcionarios ?? [];
  return {
    ativos: fs.filter(f => f.ativo).length,
    /** a remuneração dos ativos no mês da guia mais nova (a base do FGTS) */
    folha: p?.total ?? 0,
    competencia: p?.competencia ?? '',
    /** quem entrou no registro neste ano (a primeira guia em que aparece) */
    admissoesNoAno: fs.filter(f => f.ativo && f.desde.startsWith(ano)).length,
    /** quem estava e saiu da guia */
    saidas: fs.filter(f => !f.ativo).length,
  };
}

/** O tipo do arquivo pelo nome (o Blob do download). */
export function mimeDoArquivo(nome: string): string {
  const ext = (/\.([a-z0-9]{2,5})$/i.exec(nome)?.[1] || '').toLowerCase();
  return ({ pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain' } as Record<string, string>)[ext] || 'application/octet-stream';
}

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Os documentos que passam no filtro (busca no nome e na descrição, área e mês), os mais novos primeiro. */
export function filtrarDocumentos(docs: DocumentoDoCliente[], f: { busca: string; area: string; mes: string }): DocumentoDoCliente[] {
  const b = sem(f.busca.trim());
  return docs
    .filter(d => (!f.area || d.area === f.area) && (!f.mes || d.competencia === f.mes) && (!b || sem(d.nome + ' ' + d.descricao).includes(b)))
    .sort((a, z) => z.enviadoEm.localeCompare(a.enviadoEm));
}

/** Os meses que têm documento, o mais novo primeiro (para o filtro). */
export function mesesDosDocumentos(docs: DocumentoDoCliente[]): string[] {
  return [...new Set(docs.map(d => d.competencia).filter(Boolean))].sort().reverse();
}

export interface Notificacao { id: string; titulo: string; texto: string; ir: 'documentos' | 'guias' | 'chamados' }

/** O que o sino mostra: guias vencidas ou que vencem hoje, documentos novos, chamados respondidos e o certificado perto de vencer. */
export function notificacoes(e: Pick<EstadoDaArea, 'guias' | 'documentos' | 'chamados' | 'certificado'>, hoje: Date, rotuloDaGuia: (g: ac.GuiaDoCliente) => string): Notificacao[] {
  const lista: Notificacao[] = [];
  for (const g of e.guias) {
    if (g.situacao === 'vencida') lista.push({ id: 'g-' + g.id, titulo: rotuloDaGuia(g) + ' vencida', texto: 'Venceu em ' + g.vencimento, ir: 'guias' });
    else if (g.situacao === 'vence hoje') lista.push({ id: 'g-' + g.id, titulo: rotuloDaGuia(g) + ' vence hoje', texto: 'Vencimento ' + g.vencimento, ir: 'guias' });
  }
  const novos = e.documentos.filter(d => d.novo);
  if (novos.length) lista.push({ id: 'docs-' + novos.map(d => d.id).join('.'), titulo: novos.length === 1 ? 'Documento novo' : novos.length + ' documentos novos', texto: novos.map(d => d.nome).slice(0, 2).join(', ') + (novos.length > 2 ? ' e mais ' + (novos.length - 2) : ''), ir: 'documentos' });
  for (const c of e.chamados) {
    if (c.situacao === 'respondido') lista.push({ id: 'c-' + c.id + '-' + c.mensagens.length, titulo: 'O escritório respondeu', texto: c.titulo, ir: 'chamados' });
  }
  if (e.certificado) {
    const s = situacaoDoCertificado(e.certificado, hoje);
    if (s.tom !== 'ok') lista.push({ id: 'cert-' + e.certificado.validoAte, titulo: 'Certificado digital ' + (s.tom === 'bad' ? 'vencido' : 'perto de vencer'), texto: s.texto, ir: 'guias' });
  }
  return lista;
}

// ---------------------------------- os pedidos do pessoal ----------------------------------

export interface PedidoDeAdmissao {
  nome: string; cpf: string; cargo: string; salario: string; inicio: string; contrato: string; observacoes: string;
  /** a foto do funcionário, opcional (o JPEG 256×256 em base64, sem o prefixo data:) */
  foto?: string;
}
export interface PedidoDeFerias { empregado: string; inicio: string; dias: string; adiantar13: boolean; observacoes: string }
export interface PedidoDeDemissao { empregado: string; ultimoDia: string; motivo: string; aviso: string; observacoes: string }

const DATA = /^\d{2}\/\d{2}\/\d{4}$/;
const linhas = (titulo: string, campos: [string, string][]) => [titulo, '', ...campos.filter(([, v]) => v.trim()).map(([k, v]) => k + ': ' + v.trim())].join('\n');

/** Confere o pedido de admissão; devolve o erro em português, ou '' se está bom. */
export function erroDaAdmissao(p: PedidoDeAdmissao): string {
  if (!p.nome.trim()) return 'Escreva o nome do novo funcionário.';
  if (!p.cargo.trim()) return 'Escreva o cargo.';
  if (!DATA.test(p.inicio)) return 'Escreva a data de início (dd/mm/aaaa).';
  return '';
}
export function textoDaAdmissao(p: PedidoDeAdmissao): string {
  return linhas('Admissão: ' + p.nome.trim() + ' (' + p.cargo.trim() + ')', [
    ['Nome completo', p.nome], ['CPF', p.cpf], ['Cargo', p.cargo], ['Salário', p.salario], ['Início', p.inicio], ['Contrato', p.contrato], ['Observações', p.observacoes],
    ['Foto', p.foto ? 'enviada junto com o pedido' : ''],
  ]);
}

export function erroDasFerias(p: PedidoDeFerias): string {
  if (!p.empregado) return 'Escolha o funcionário.';
  if (!DATA.test(p.inicio)) return 'Marque no calendário o primeiro dia das férias.';
  // as partes (art. 134 da CLT): cada uma com pelo menos 5 dias; no máximo os 30 do período
  const dias = Number(/\d+/.exec(p.dias)?.[0] ?? 30);
  if (dias < 5) return 'Cada parte das férias tem pelo menos 5 dias.';
  if (dias > 30) return 'As férias têm no máximo 30 dias.';
  return '';
}
// ------------------------------------------------------------------ as contas que a janela mostra enquanto preenche
// (13/11/2026: "melhore visualmente esses dois, principalmente a parte de programar férias")
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const deBr = (br: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br); if (!m) return null; const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12); return d.getDate() === Number(m[1]) ? d : null; };
const maisDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
const brCurto = (d: Date) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
const comSemana = (d: Date) => SEMANA[d.getDay()] + ', ' + brCurto(d) + '/' + d.getFullYear();

/** As férias pedidas, contadas: de quando a quando, a volta, o pagamento (até 2 dias antes, art. 145 da CLT; no fim de semana, na sexta), os dias
 *  vendidos e os avisos (a data que já passou, menos de 30 dias de aviso, começar na sexta ou no sábado). Sem a data, null. */
export function contaDasFerias(p: Pick<PedidoDeFerias, 'inicio' | 'dias'>, hoje: Date, limite = ''): { de: string; ate: string; dias: number; vende: number; volta: string; pagarAte: string; avisos: string[] } | null {
  const inicio = deBr(p.inicio);
  if (!inicio) return null;
  const dias = Number(/\d+/.exec(p.dias)?.[0] ?? 30);
  const vende = Number(/vender (\d+)/.exec(p.dias)?.[1] ?? 0);
  const fim = maisDias(inicio, dias - 1), volta = maisDias(inicio, dias);
  // o pagamento até 2 dias antes; caindo no fim de semana, na sexta antes
  let pagar = maisDias(inicio, -2);
  while (pagar.getDay() === 0 || pagar.getDay() === 6) pagar = maisDias(pagar, -1);
  const avisos: string[] = [];
  const faltam = Math.round((meioDia(inicio) - meioDia(hoje)) / DIA);
  if (faltam < 0) avisos.push('Essa data já passou.');
  else if (faltam < 30) avisos.push('Faltam ' + faltam + (faltam === 1 ? ' dia' : ' dias') + ': a lei pede o aviso de férias 30 dias antes. O escritório confere se dá.');
  // (13/11/2026: "e se o cliente quiser dar só 7 dias?") pode, como uma das partes: até 3, uma com 14 ou mais e as outras com 5 ou mais
  if (dias < 5) avisos.push('Menos de 5 dias não pode: cada parte das férias tem pelo menos 5 dias.');
  else if (dias > 30) avisos.push('Passa de 30 dias: as férias de um período têm no máximo 30.');
  else if (dias < 14) avisos.push('Com ' + dias + ' dias, esta é uma das partes: a lei deixa dividir as férias em até 3, uma com pelo menos 14 dias e as outras com pelo menos 5.');
  if (inicio.getDay() === 5 || inicio.getDay() === 6) avisos.push((inicio.getDay() === 5 ? 'Começa na sexta' : 'Começa no sábado') + ': para quem folga no domingo, as férias não podem começar nos dois dias antes da folga.');
  // o limite do período da pessoa ('aaaa-mm'): o que passar do fim desse mês é pago em dobro (art. 137 da CLT)
  if (/^\d{4}-\d{2}$/.test(limite) && fim > new Date(Number(limite.slice(0, 4)), Number(limite.slice(5, 7)), 0, 23)) avisos.push('Termina depois de ' + limite.slice(5, 7) + '/' + limite.slice(0, 4) + ', o limite do período: os dias que passarem são pagos em dobro.');
  return { de: brCurto(inicio), ate: brCurto(fim) + '/' + fim.getFullYear(), dias, vende, volta: comSemana(volta), pagarAte: comSemana(pagar), avisos };
}

/** A admissão pedida, contada: o prazo do eSocial (o dia antes do primeiro dia), o fim da experiência (45 + 45) e o aviso
 *  quando está em cima da hora. Sem a data, null. */
export function contaDaAdmissao(p: Pick<PedidoDeAdmissao, 'inicio' | 'contrato'>, hoje: Date): { registrarAte: string; experiencia: string; aviso: string } | null {
  const inicio = deBr(p.inicio);
  if (!inicio) return null;
  const faltam = Math.round((meioDia(inicio) - meioDia(hoje)) / DIA);
  const experiencia = /experi/i.test(p.contrato) ? 'Experiência até ' + brCurto(maisDias(inicio, 44)) + ', prorrogável até ' + comSemana(maisDias(inicio, 89)) : '';
  const aviso = faltam < 0 ? 'Essa data já passou: o registro fica atrasado no eSocial.' : faltam < 2 ? 'Em cima da hora: mande hoje para dar tempo de registrar.' : '';
  return { registrarAte: comSemana(maisDias(inicio, -1)), experiencia, aviso };
}

export function textoDasFerias(p: PedidoDeFerias): string {
  return linhas('Férias: ' + p.empregado + ' a partir de ' + p.inicio, [
    ['Funcionário', p.empregado], ['Início', p.inicio], ['Dias', p.dias], ['Adiantar metade do 13º', p.adiantar13 ? 'Sim' : 'Não'], ['Observações', p.observacoes],
  ]);
}

export function erroDaDemissao(p: PedidoDeDemissao): string {
  if (!p.empregado) return 'Escolha o funcionário.';
  if (!DATA.test(p.ultimoDia)) return 'Escreva o último dia de trabalho (dd/mm/aaaa).';
  if (!p.motivo) return 'Escolha o motivo.';
  return '';
}
export function textoDaDemissao(p: PedidoDeDemissao): string {
  return linhas('Desligamento: ' + p.empregado + ' (último dia ' + p.ultimoDia + ')', [
    ['Funcionário', p.empregado], ['Último dia', p.ultimoDia], ['Motivo', p.motivo], ['Aviso prévio', p.aviso], ['Observações', p.observacoes],
  ]);
}

/**
 * O texto do chamado aberto pela tela de Solicitações: o título resumido na primeira linha (o core tira o título do chamado
 * dela), depois o pedido; a prioridade e o anexo vão no fim.
 */
export function textoDoChamado(titulo: string, texto: string, prioridade: string, anexo: string): string {
  const extras = [prioridade && prioridade !== 'Normal' ? 'Prioridade: ' + prioridade : '', anexo ? 'Anexo enviado: ' + anexo : ''].filter(Boolean);
  const corpo = [titulo.trim(), texto.trim()].filter(Boolean).join('\n\n');
  return corpo + (extras.length ? '\n\n' + extras.join('\n') : '');
}

// ---------------------------------- o PDF da guia em pedaços ----------------------------------

/** Um pedaço do PDF como o robô grava em areasCliente/{token}/guias/{id}/pdf/{n}: n começa em 0, de 0 a total-1. */
export interface PedacoDoPdf { base64: string; n: number; total: number }

/**
 * Junta os pedaços do PDF na ordem (n = 0 até total-1). Devolve null se falta algum, se sobram pedaços ou se o total não
 * bate entre eles (o PDF ficaria quebrado). Para o repositório do banco, quando a Área do Cliente ler o espelho de verdade.
 */
export function juntarPedacosDoPdf(pedacos: PedacoDoPdf[], tipo = 'application/pdf'): Blob | null {
  if (!pedacos.length) return null;
  const total = pedacos[0].total;
  if (!Number.isInteger(total) || total < 1 || pedacos.length !== total || pedacos.some(p => p.total !== total)) return null;
  const ordem = [...pedacos].sort((a, b) => a.n - b.n);
  if (ordem.some((p, i) => p.n !== i)) return null;
  const partes = ordem.map(p => Uint8Array.from(atob(p.base64), c => c.charCodeAt(0)));
  return new Blob(partes, { type: tipo });
}

// ─── as solicitações sem chat (11/11/2026) ──────────────────────────────────
// "Por existir o WhatsApp, não precisa de um chat; um sistema de requisições já serve; o chat só fica bom no PC". A
// solicitação mostra o pedido, a situação em passos e a resposta do escritório; para conversar, o WhatsApp com o assunto.

/** Os passos da solicitação: Recebida › Em andamento › Respondida (ou Concluída). */
export const PASSOS_DA_SOLICITACAO = ['Recebida', 'Em andamento', 'Pronta'] as const;

/** Em que passo a solicitação está (0, 1 ou 2) e o rótulo do último: Respondida ou Concluída. */
export function passoDaSolicitacao(situacao: ac.SituacaoDoChamado): { passo: number; rotulo: string } {
  if (situacao === 'aberto') return { passo: 0, rotulo: 'Recebida' };
  if (situacao === 'em andamento') return { passo: 1, rotulo: 'Em andamento' };
  return { passo: 2, rotulo: situacao === 'concluido' ? 'Concluída' : 'Respondida' };
}

/** O pedido do cliente (as mensagens dele, na ordem) e as respostas do escritório, sem o formato de conversa. */
export function partesDaSolicitacao(c: Pick<ac.ChamadoDoCliente, 'mensagens'>): { pedido: string; complementos: string[]; respostas: { texto: string; em: string; autor: string }[] } {
  const doCliente = c.mensagens.filter(m => m.de === 'cliente');
  return {
    pedido: doCliente[0]?.texto ?? '',
    complementos: doCliente.slice(1).map(m => m.texto),
    respostas: c.mensagens.filter(m => m.de === 'escritorio').map(m => ({ texto: m.texto, em: m.em, autor: m.autor && m.autor !== 'Escritório' ? m.autor : '' })),
  };
}

/** O WhatsApp do escritório já com o assunto da solicitação; '' sem número que sirva. */
export function whatsappDaSolicitacao(numero: string | undefined, titulo: string): string {
  const link = linkDoWhatsapp(numero);
  return link ? link + '?text=' + encodeURIComponent('Olá! Sobre a solicitação "' + titulo + '":') : '';
}

/**
 * O nome da pessoa como a gente escreve (12/11/2026: o Registro vem das guias do FGTS, em maiúsculas):
 * "MARIA DA SILVA" → "Maria da Silva". As partículas (da, de, do, das, dos, e) ficam minúsculas.
 */
export function nomeDaPessoa(nome: string): string {
  const miudas = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
  return nome.trim().toLowerCase().split(/\s+/).filter(Boolean)
    .map((p, i) => (i > 0 && miudas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ');
}

/** A linha que a solicitação ganha quando o cliente anexa arquivos nela (12/11/2026): "Enviei os arquivos: rg.pdf, cpf.pdf". */
export function textoDosAnexos(nomes: readonly string[]): string {
  const lista = nomes.map(n => n.trim()).filter(Boolean);
  return (lista.length === 1 ? 'Enviei o arquivo: ' : 'Enviei os arquivos: ') + lista.join(', ') + '.';
}

// ---------- o painel das guias do mês (12/11/2026: "quero melhora nessa aba também") ----------

/** Uma marca na linha do tempo do mês: a guia (pelo vencimento) ou a entrega do escritório (a agenda). */
/** rotulo: o texto inteiro (a dica); curto: o que cabe na etiqueta do dia no calendário (DAS, FGTS, o nome da entrega) */
export interface MarcaDoMes { dia: number; tipo: 'guia' | 'paga' | 'entrega'; tom: 'vencida' | 'hoje' | 'aberta' | 'feita'; rotulo: string; curto: string; /** o nome inteiro (a lista da agenda) */ nome: string; /** a guia e a paga */ valor?: number }

export interface PainelDasGuias {
  aPagar: { valor: number; guias: number };
  vencidas: { valor: number; guias: number };
  pagas: { valor: number; guias: number };
  /** o calendário do mês: os dias, o dia da semana do dia 1 (0 = domingo), o dia de hoje (só no mês de hoje) e as marcas */
  linha: { dias: number; primeiroDia: number; hoje: number | null; marcas: MarcaDoMes[] };
}

const centavosDe = (n: number) => Math.round(n * 100) / 100;
const diaDe = (br: string) => Number(br.slice(0, 2)) || 0;

/** Os números do mês das guias e o calendário do mês (as guias, as pagas e as entregas do escritório). */
export function painelDasGuias(guias: readonly ac.GuiaDoCliente[], pagas: readonly { nome: string; valor: number; pagoEm: string }[],
  agenda: readonly ac.ItemDaAgenda[], mes: string, hoje: Date, rotulo: (g: ac.GuiaDoCliente) => string): PainelDasGuias {
  const soma = (xs: readonly { valor: number }[]) => centavosDe(xs.reduce((t, x) => t + x.valor, 0));
  const vencidas = guias.filter(g => g.situacao === 'vencida');
  const aPagar = soma(guias), pago = soma(pagas);
  const vVencidas = soma(vencidas);
  const ano = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7));
  const ehHoje = hoje.getFullYear() === ano && hoje.getMonth() + 1 === m;
  const marcas: MarcaDoMes[] = [
    ...guias.map(g => ({ dia: diaDe(g.vencimento), tipo: 'guia' as const, tom: (g.situacao === 'vencida' ? 'vencida' : g.situacao === 'vence hoje' ? 'hoje' : 'aberta') as MarcaDoMes['tom'], rotulo: rotulo(g) + ' · ' + g.vencimento.slice(0, 5), curto: g.tipo === 'outra' ? 'Guia' : g.tipo, nome: rotulo(g), valor: g.valor })),
    ...pagas.map(p => ({ dia: diaDe(p.pagoEm), tipo: 'paga' as const, tom: 'feita' as const, rotulo: p.nome + ' · pago em ' + p.pagoEm.slice(0, 5), curto: p.nome, nome: p.nome, valor: p.valor })),
    ...agenda.filter(i => i.vence.startsWith(mes)).map(i => ({ dia: Number(i.vence.slice(8, 10)) || 0, tipo: 'entrega' as const, tom: (i.situacao === 'feito' ? 'feita' : 'aberta') as MarcaDoMes['tom'], rotulo: i.nome + ' · ' + i.vence.slice(8, 10) + '/' + i.vence.slice(5, 7), curto: i.nome.replace(/\s*\(.*\)$/, ''), nome: i.nome })),
  ].filter(x => x.dia >= 1).sort((a, b) => a.dia - b.dia || a.tipo.localeCompare(b.tipo));
  return {
    aPagar: { valor: aPagar, guias: guias.length },
    vencidas: { valor: vVencidas, guias: vencidas.length },
    pagas: { valor: pago, guias: pagas.length },
    linha: { dias: new Date(ano, m, 0).getDate(), primeiroDia: new Date(ano, m - 1, 1).getDay(), hoje: ehHoje ? hoje.getDate() : null, marcas },
  };
}

// ---------- a troca de empresa (12/11/2026: "uma troca de perfil para pessoas que tenham mais de uma empresa") ----------

/** Uma empresa que a pessoa já abriu neste aparelho: o link (o token), o nome e o documento, e quando abriu por último. */
export interface PerfilGuardado { token: string; nome: string; documento: string; logo?: string; usadoEm: string }

/** quantas empresas o aparelho guarda (as mais usadas ficam) */
export const MAIS_PERFIS = 12;

/** A lista guardada com a empresa aberta agora: ela entra (ou atualiza) no alto; o resto pela última vez que abriu. */
export function perfisComEste(lista: readonly PerfilGuardado[], atual: PerfilGuardado): PerfilGuardado[] {
  const outros = lista.filter(p => p && typeof p.token === 'string' && p.token && p.token !== atual.token && typeof p.nome === 'string');
  return [atual, ...outros.sort((a, b) => String(b.usadoEm).localeCompare(String(a.usadoEm)))].slice(0, MAIS_PERFIS);
}

/**
 * A empresa para abrir quando o site abre sem link (13/11/2026: o app instalado na tela inicial abre pela raiz): a última
 * aberta neste aparelho; sem nenhuma, '' (fica o aviso para usar o link do escritório).
 */
export function ultimaEmpresa(lista: readonly PerfilGuardado[]): string {
  const validos = lista.filter(p => p && typeof p.token === 'string' && p.token && p.usadoEm);
  return [...validos].sort((a, b) => String(b.usadoEm).localeCompare(String(a.usadoEm)))[0]?.token ?? '';
}

/**
 * As abas da barra de baixo do celular (13/11/2026: "cara de app no celular"): a Visão geral, as Guias, os Documentos (se a
 * área tem) e as Solicitações; o resto fica no "Mais", que abre o menu inteiro.
 */
export function abasDoCelular<T extends string>(abas: readonly T[]): T[] {
  const fixas = ['inicio', 'guias', 'documentos', 'chamados'] as const;
  return fixas.filter(f => abas.includes(f as T)) as T[];
}

/** Há quanto tempo a empresa abriu ("há 7 anos", "há 5 meses", "este mês"), pela data 'aaaa-mm-dd'. */
export function tempoDeEmpresa(abertura: string, hoje: Date): string {
  const m = /^(\d{4})-(\d{2})/.exec(abertura);
  if (!m) return '';
  const meses = (hoje.getFullYear() - Number(m[1])) * 12 + (hoje.getMonth() + 1 - Number(m[2]));
  if (meses < 1) return 'este mês';
  if (meses < 12) return 'há ' + meses + (meses === 1 ? ' mês' : ' meses');
  const anos = Math.floor(meses / 12);
  return 'há ' + anos + (anos === 1 ? ' ano' : ' anos');
}

/** Os dados cadastrais num texto só, um por linha, para colar num formulário ou num e-mail. */
export function dadosParaCopiar(f: { razaoSocial: string; nomeFantasia?: string; cnpj: string; inscricaoEstadual?: string; inscricaoMunicipal?: string; regime?: string; cnae?: string; endereco?: string }): string {
  return [
    ['Razão social', f.razaoSocial], ['Nome fantasia', f.nomeFantasia], ['CNPJ', f.cnpj], ['Inscrição estadual', f.inscricaoEstadual],
    ['Inscrição municipal', f.inscricaoMunicipal], ['Regime', f.regime], ['Atividade principal', f.cnae], ['Endereço', f.endereco],
  ].filter(([, v]) => v).map(([r, v]) => r + ': ' + v).join('\n');
}

/**
 * O token da área num link colado (13/11/2026: abrir outra empresa pela troca): aceita o link inteiro
 * (https://…/cliente/<token>/guias) ou só o token; devolve '' se não parece um.
 */
export function tokenDoLink(texto: string): string {
  const t = texto.trim();
  const doLink = /\/cliente\/([^/?#\s]+)/.exec(t)?.[1];
  const token = doLink ? decodeURIComponent(doLink) : t;
  return /^[A-Za-z0-9_-]{6,}$/.test(token) ? token : '';
}

/** "hoje", "ontem" ou "dd/mm", pela data ISO (a última vez que a empresa foi aberta). */
export function diaRelativo(iso: string, hoje: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(hoje) - dia(d)) / 86_400_000);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'ontem';
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
}

/** O selo do regime (13/11/2026: "simples nacional verde"): o Simples e o MEI em verde; os outros, neutros. */
export function seloDoRegime(regime: string): string {
  return /simples|mei\b|microempreendedor/i.test(regime) ? 'badge badge-ok' : 'badge badge-neutral';
}

/** As iniciais do nome para o quadradinho da empresa sem logo ("Personaly Company Ltda" → "PC"). */
export function iniciaisDaEmpresa(nome: string): string {
  const palavras = nome.replace(/\b(ltda|me|epp|eireli|s\/?a|sa|do|da|de|dos|das|e)\b\.?/gi, ' ').trim().split(/\s+/).filter(Boolean);
  return ((palavras[0]?.[0] ?? '') + (palavras[1]?.[0] ?? '')).toUpperCase() || '?';
}

// ------------------------------------------------------------------- o calendário da janela de férias (13/11/2026)
const brLongo = (d: Date) => brCurto(d) + '/' + d.getFullYear();
const mesmoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** A primeira data boa para começar as férias: a segunda-feira com pelo menos 30 dias de aviso ('dd/mm/aaaa'). */
export function primeiraDataDasFerias(hoje: Date): string {
  let d = maisDias(hoje, 30);
  while (d.getDay() !== 1) d = maisDias(d, 1);
  return brLongo(d);
}

/** Um dia no calendário das férias: o que ele é para o pedido (o pagamento, as férias, a volta) e se dá para escolher. */
export interface DiaDasFerias {
  br: string; dia: number; doMes: boolean; passou: boolean; hoje: boolean;
  ferias: boolean; inicio: boolean; fim: boolean; volta: boolean; pagamento: boolean;
  /** sexta e sábado: as férias não podem começar nos dois dias antes da folga do domingo */
  evitar: boolean;
}

/** O mês ('aaaa-mm') do calendário das férias, em semanas inteiras de domingo a sábado, com o pedido marcado. */
export function mesDasFerias(mes: string, p: Pick<PedidoDeFerias, 'inicio' | 'dias'>, hoje: Date, previaAte = ''): DiaDasFerias[] {
  const ano = Number(mes.slice(0, 4)), m0 = Number(mes.slice(5, 7)) - 1;
  const primeiro = new Date(ano, m0, 1, 12), ultimo = new Date(ano, m0 + 1, 0, 12);
  const comeco = maisDias(primeiro, -primeiro.getDay()), semanas = Math.ceil((primeiro.getDay() + ultimo.getDate()) / 7);
  const inicio = deBr(p.inicio);
  const dias = Number(/\d+/.exec(p.dias)?.[0] ?? 30);
  // a prévia enquanto escolhe o último dia (o mouse em cima de um dia depois do começo)
  const previa = deBr(previaAte);
  const fim = inicio ? (previa && meioDia(previa) > meioDia(inicio) ? previa : maisDias(inicio, dias - 1)) : null, volta = fim ? maisDias(fim, 1) : null;
  let pagar = inicio ? maisDias(inicio, -2) : null;
  while (pagar && (pagar.getDay() === 0 || pagar.getDay() === 6)) pagar = maisDias(pagar, -1);
  return Array.from({ length: semanas * 7 }, (_, k) => {
    const d = maisDias(comeco, k);
    return {
      br: brLongo(d), dia: d.getDate(), doMes: d.getMonth() === m0, passou: meioDia(d) < meioDia(hoje), hoje: mesmoDia(d, hoje),
      ferias: !!inicio && !!fim && meioDia(d) >= meioDia(inicio) && meioDia(d) <= meioDia(fim),
      inicio: !!inicio && mesmoDia(d, inicio), fim: !!fim && mesmoDia(d, fim), volta: !!volta && mesmoDia(d, volta), pagamento: !!pagar && mesmoDia(d, pagar),
      evitar: d.getDay() === 5 || d.getDay() === 6,
    };
  });
}

/** Os dias como o pedido guarda: o do botão pronto (30, 15, 10) ou "N dias corridos" quando marcado no calendário. */
export function textoDosDias(n: number): string {
  return n === 30 ? '30 dias' : n === 15 ? '15 dias (primeira parte)' : n === 10 ? '10 dias (uma parte)' : n + ' dias corridos';
}

/**
 * Marcar no calendário, como numa reserva de hotel (13/11/2026: "coloca para poder marcar no calendário para selecionar os
 * dias, tipo de um hotel"): o primeiro toque escolhe o começo (e mantém os dias, para a conta já aparecer); o segundo, o
 * último dia, e os dias saem da conta. Tocar antes do começo (ou nele) recomeça dali.
 */
export function marcarNoCalendario(p: Pick<PedidoDeFerias, 'inicio' | 'dias'>, clicado: string, fase: 'inicio' | 'fim'): { inicio: string; dias: string; fase: 'inicio' | 'fim' } {
  const ini = deBr(p.inicio), c = deBr(clicado);
  if (!c) return { inicio: p.inicio, dias: p.dias, fase };
  if (fase === 'inicio' || !ini || meioDia(c) <= meioDia(ini)) return { inicio: clicado, dias: p.dias, fase: 'fim' };
  return { inicio: p.inicio, dias: textoDosDias(Math.round((meioDia(c) - meioDia(ini)) / DIA) + 1), fase: 'inicio' };
}
