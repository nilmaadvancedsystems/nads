// As contas das seções que vieram do protótipo do Vitor (16/10/2026) e ainda não estão no core: o certificado, o resumo do
// pessoal, o filtro dos documentos, os avisos do sino e o texto dos pedidos do pessoal (admissão, férias e demissão viram
// um chamado do tipo certo com os dados no texto). Funções puras, testadas em regras.test.ts.
import type { areaCliente as ac } from '@nads/core';
import type { CertificadoDigital, DocumentoDoCliente, Empregado, EstadoDaArea } from './areaCliente';

const DIA = 86_400_000;
const meioDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
const deIso = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d, 12); };
export const dataBr = (iso: string) => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
export const chaveDoMes = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');

/** Quanto falta para o certificado vencer e o tom do aviso: vencido, vence em até 30 dias, ou em ordem. */
export function situacaoDoCertificado(c: CertificadoDigital, hoje: Date): { dias: number; tom: 'ok' | 'warn' | 'bad'; texto: string } {
  const dias = Math.round((deIso(c.validoAte).getTime() - meioDia(hoje)) / DIA);
  if (dias < 0) return { dias, tom: 'bad', texto: 'Venceu em ' + dataBr(c.validoAte) + '. Sem ele o escritório não consegue entregar as declarações.' };
  if (dias <= 30) return { dias, tom: 'warn', texto: 'Vence em ' + dataBr(c.validoAte) + (dias === 0 ? ' (hoje)' : ' (faltam ' + dias + (dias === 1 ? ' dia' : ' dias') + ')') + '. Renove antes.' };
  return { dias, tom: 'ok', texto: 'Válido até ' + dataBr(c.validoAte) + '.' };
}

/** Os números do pessoal: ativos, de férias, a folha (soma dos salários) e as admissões no ano. */
export function resumoDoPessoal(empregados: Empregado[], hoje: Date) {
  const ano = String(hoje.getFullYear());
  return {
    ativos: empregados.length,
    emFerias: empregados.filter(e => e.ferias === 'em ferias').length,
    folha: Math.round(empregados.reduce((s, e) => s + e.salario, 0) * 100) / 100,
    admissoesNoAno: empregados.filter(e => e.admissao.startsWith(ano)).length,
  };
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
  if (novos.length) lista.push({ id: 'docs-' + novos.map(d => d.id).join('.'), titulo: novos.length === 1 ? 'Documento novo' : novos.length + ' documentos novos', texto: novos.map(d => d.nome).slice(0, 2).join(', ') + (novos.length > 2 ? '…' : ''), ir: 'documentos' });
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

export interface PedidoDeAdmissao { nome: string; cpf: string; cargo: string; salario: string; inicio: string; contrato: string; observacoes: string }
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
  ]);
}

export function erroDasFerias(p: PedidoDeFerias): string {
  if (!p.empregado) return 'Escolha o funcionário.';
  if (!DATA.test(p.inicio)) return 'Escreva o primeiro dia das férias (dd/mm/aaaa).';
  return '';
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

/** O texto do chamado aberto pela tela de Solicitações: a prioridade e o anexo vão no fim do texto. */
export function textoDoChamado(texto: string, prioridade: string, anexo: string): string {
  const extras = [prioridade && prioridade !== 'Normal' ? 'Prioridade: ' + prioridade : '', anexo ? 'Anexo enviado: ' + anexo : ''].filter(Boolean);
  return texto.trim() + (extras.length ? '\n\n' + extras.join('\n') : '');
}

// ---------------------------------- o PDF da guia em pedaços ----------------------------------

/** Um pedaço do PDF como o robô grava em areasCliente/{token}/guias/{id}/pdf/{n}: n começa em 0, de 0 a total-1. */
export interface PedacoDoPdf { base64: string; n: number; total: number }

/**
 * Junta os pedaços do PDF na ordem (n = 0 até total-1). Devolve null se falta algum, se sobram pedaços ou se o total não
 * bate entre eles (o PDF ficaria quebrado). Para o repositório do banco, quando a Área do Cliente ler o espelho de verdade.
 */
export function juntarPedacosDoPdf(pedacos: PedacoDoPdf[]): Blob | null {
  if (!pedacos.length) return null;
  const total = pedacos[0].total;
  if (!Number.isInteger(total) || total < 1 || pedacos.length !== total || pedacos.some(p => p.total !== total)) return null;
  const ordem = [...pedacos].sort((a, b) => a.n - b.n);
  if (ordem.some((p, i) => p.n !== i)) return null;
  const partes = ordem.map(p => Uint8Array.from(atob(p.base64), c => c.charCodeAt(0)));
  return new Blob(partes, { type: 'application/pdf' });
}
