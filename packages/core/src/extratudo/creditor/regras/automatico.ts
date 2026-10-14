// O "Importar automático" do Creditor (Vitor, 14/10/2026: "se possível já procura no e-mail sem eu precisar selecionar,
// coloque um botão de importar automático"). Para cada mês que falta, sem a pessoa escolher nada:
//   1. a pasta RECEBIMENTO DE CLIENTES no Drive (os arquivos do mês);
//   2. o e-mail do escritório: os anexos PDF recebidos do começo do mês até DIAS_DEPOIS dias depois do fim (o relatório
//      de fevereiro chega em março), do contato do cliente ou que falam de liquidação/títulos, sem os de outros meses.
// Cada candidato é aberto: só fica o que está num dos dois formatos aceitos (arquivos/formatos.ts), é da empresa (o
// cedente) e tem títulos liquidados no mês. Mais de um relatório no mês (duas carteiras) vão juntos.
import type { AnexoDoEmail } from '../drive';
import type { RelatorioBanco, Titulo } from '../tipos';
import { TOTAIS_VAZIOS } from '../arquivos/banco';
import { juntarRelatorios } from './competencia';
import { relatorioDaEmpresa } from '../arquivos/formatos';
import { mesDoAnexo } from './mesDoEmail';

/** Até quantos dias depois do fim do mês o relatório pode chegar por e-mail. */
export const DIAS_DEPOIS = 45;
/** Quantos anexos abrir por mês, no máximo (cada um é um download pelo robô). */
export const MAX_CANDIDATOS = 8;

const ISO = (d: Date) => d.toISOString().slice(0, 10);

/** O período da busca no e-mail para o mês: do dia 1 até DIAS_DEPOIS depois do fim (sem passar de hoje). */
export function periodoDaBuscaAutomatica(mes: string, hoje: Date): { de: string; ate: string } {
  const [a, m] = mes.split('-').map(Number);
  const fim = new Date(Date.UTC(a, m, 0));
  fim.setUTCDate(fim.getUTCDate() + DIAS_DEPOIS);
  const ate = ISO(fim) < ISO(hoje) ? ISO(fim) : ISO(hoje);
  return { de: mes + '-01', ate };
}

// o relatório de liquidação do Sicoob e o do Bradesco (Vitor, 14/10/2026: "tem relatório de liquidação do Bradesco e do Sicoob")
const PALAVRAS = /liquid|\btit(ulos?)?\b|\btit\.|cobranca|carteira|credliq|sicoob|bradesco/;
// "títulos pagos", comprovante: o que a empresa pagou (não é recebimento), a não ser que o nome fale de liquidação
const PAGOS = /\bpagos?\b|pagamento|comprovante/;
const norm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Os anexos que vale abrir para o mês, o mais provável primeiro: PDF, sem citar outro mês, e do contato do cliente ou
 * falando de liquidação/títulos (no nome, no assunto ou no começo do corpo). O mesmo arquivo em dois e-mails vale um.
 */
export function candidatosDoEmail(anexos: readonly AnexoDoEmail[], mes: string, emailsDoCliente: readonly string[]): AnexoDoEmail[] {
  const doCliente = new Set(emailsDoCliente.map(e => e.trim().toLowerCase()).filter(Boolean));
  const vistos = new Set<string>();
  const pontuados: { a: AnexoDoEmail; pontos: number }[] = [];
  for (const a of anexos) {
    if (!/\.pdf$/i.test(a.nome)) continue;
    const m = mesDoAnexo(a, mes);
    if (m === 'outro') continue;
    const remetente = (/<([^>]+)>/.exec(a.de)?.[1] || a.de).trim().toLowerCase();
    if (PAGOS.test(norm(a.nome)) && !/liquid/.test(norm(a.nome))) continue;
    const fala = PALAVRAS.test(norm(a.nome + ' ' + a.assunto + ' ' + (a.trecho || '')));
    const cliente = doCliente.has(remetente);
    if (!fala && !cliente) continue;
    const chave = a.nome.toLowerCase() + '|' + a.tamanho;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    pontuados.push({ a, pontos: (m === 'do-mes' ? 2 : 0) + (fala ? 2 : 0) + (cliente ? 1 : 0) });
  }
  return pontuados.sort((x, y) => y.pontos - x.pontos || String(y.a.em).localeCompare(String(x.a.em))).slice(0, MAX_CANDIDATOS).map(x => x.a);
}

/** O relatório lido serve para o mês da empresa? Formato aceito, o cedente é ela e tem título liquidado no mês. */
export function relatorioServeNoMes(r: RelatorioBanco, mes: string, empresa: string): boolean {
  if (!r.formato || !relatorioDaEmpresa(r.cedente, empresa)) return false;
  const mm = mes.slice(5, 7) + '/' + mes.slice(0, 4);
  return r.grupos.some(g => g.titulos.some(t => t.liquidacao.slice(3) === mm));
}

/** A chave do título, para não entrar duas vezes o mesmo (dois arquivos do mesmo mês com títulos em comum). */
const chaveDoTitulo = (t: Titulo) => t.nossoNumero + ':' + t.liquidacao + ':' + t.valor;

/**
 * Junta os relatórios do mês sem repetir título (Vitor, 14/10/2026: janeiro da 58 veio em "TIT LIQUIDADOS SICOOB" e
 * "TIT LIQUIDADOS SICOOB TV"). O maior entra primeiro; dos outros, só os títulos novos (o grupo cortado perde os totais
 * impressos, que não valem mais). usados: os relatórios que trouxeram algum título (os índices, em ordem).
 */
export function juntarSemRepetir(rels: readonly RelatorioBanco[]): { relatorio: RelatorioBanco; usados: number[] } {
  const ordem = rels.map((r, i) => ({ r, i, n: r.grupos.reduce((t, g) => t + g.titulos.length, 0) })).sort((a, b) => b.n - a.n);
  const vistos = new Set<string>();
  const partes: RelatorioBanco[] = [];
  const usados: number[] = [];
  for (const { r, i } of ordem) {
    let cortado = false;
    const grupos = r.grupos.map(g => {
      const titulos = g.titulos.filter(t => !vistos.has(chaveDoTitulo(t)));
      if (titulos.length === g.titulos.length) return g;
      cortado = true;
      return { ...g, titulos, impresso: { ...TOTAIS_VAZIOS }, registros: null };
    }).filter(g => g.titulos.length);
    grupos.forEach(g => g.titulos.forEach(t => vistos.add(chaveDoTitulo(t))));
    if (!grupos.length) continue;
    partes.push(cortado ? { ...r, grupos, totalGeral: { ...TOTAIS_VAZIOS }, registrosGeral: null } : r);
    usados.push(i);
  }
  return { relatorio: partes.length ? juntarRelatorios(partes) : rels[0], usados: usados.sort((a, b) => a - b) };
}
