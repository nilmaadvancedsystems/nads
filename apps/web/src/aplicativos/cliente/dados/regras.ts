// As contas das seções que vieram do protótipo do Vitor (16/10/2026) e ainda não estão no core: o certificado, a busca dos
// documentos, os avisos da Visão geral, o link do WhatsApp, o texto dos pedidos do pessoal (admissão, férias e demissão
// viram um chamado do tipo certo com os dados no texto) e juntar o PDF da guia em pedaços. Funções puras, testadas em
// regras.test.ts.
import type { CertificadoDigital, DocumentoDoCliente, EstadoDaArea } from './areaCliente';

const DIA = 86_400_000;
const meioDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
const deIso = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d, 12); };
export const dataBr = (iso: string) => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
export const chaveDoMes = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');

/** Quanto falta para o certificado vencer e o tom do aviso: vencido, vence em até 30 dias, ou em ordem. */
export function situacaoDoCertificado(c: CertificadoDigital, hoje: Date): { dias: number; tom: 'ok' | 'warn' | 'bad'; texto: string } {
  const dias = Math.round((deIso(c.validoAte).getTime() - meioDia(hoje)) / DIA);
  if (dias < 0) return { dias, tom: 'bad', texto: 'venceu em ' + dataBr(c.validoAte) + '. Sem ele o escritório não entrega as declarações.' };
  if (dias <= 30) return { dias, tom: 'warn', texto: dias === 0 ? 'vence hoje.' : 'vence em ' + dataBr(c.validoAte) + ', daqui a ' + dias + (dias === 1 ? ' dia.' : ' dias.') };
  return { dias, tom: 'ok', texto: 'válido até ' + dataBr(c.validoAte) + '.' };
}

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Os documentos que passam na busca (no nome e na descrição, sem acento), os mais novos primeiro. */
export function filtrarDocumentos(docs: DocumentoDoCliente[], busca: string): DocumentoDoCliente[] {
  const b = sem(busca.trim());
  return docs
    .filter(d => !b || sem(d.nome + ' ' + d.descricao).includes(b))
    .sort((a, z) => z.enviadoEm.localeCompare(a.enviadoEm));
}

export interface Aviso { id: string; texto: string; ir: 'documentos' | 'guias' | 'chamados' }

/** Os avisos da Visão geral (as guias já aparecem em cima): documentos novos, respostas do escritório e o certificado. */
export function avisos(e: Pick<EstadoDaArea, 'documentos' | 'chamados' | 'certificado'>, hoje: Date): Aviso[] {
  const lista: Aviso[] = [];
  const novos = e.documentos.filter(d => d.novo).length;
  if (novos) lista.push({ id: 'docs', texto: novos === 1 ? 'Um documento novo do escritório.' : novos + ' documentos novos do escritório.', ir: 'documentos' });
  for (const c of e.chamados) if (c.situacao === 'respondido') lista.push({ id: 'c-' + c.id, texto: 'O escritório respondeu: ' + c.titulo + '.', ir: 'chamados' });
  if (e.certificado) {
    const s = situacaoDoCertificado(e.certificado, hoje);
    if (s.tom !== 'ok') lista.push({ id: 'cert', texto: 'Certificado digital: ' + s.texto, ir: 'chamados' });
  }
  return lista;
}

/** O link do WhatsApp do escritório (wa.me com o 55 do Brasil na frente); '' quando não tem número que sirva. */
export function linkDoWhatsapp(numero: string | undefined): string {
  const d = String(numero ?? '').replace(/\D/g, '');
  if (d.length < 10) return '';
  return 'https://wa.me/' + (d.startsWith('55') && d.length > 11 ? d : '55' + d);
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
