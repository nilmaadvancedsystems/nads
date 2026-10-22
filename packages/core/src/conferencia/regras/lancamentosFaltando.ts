// Os lançamentos das notas "Faltando na conta" (Vitor, 22/10/2026: "deixa uma opção de exportar os lançamentos, aí você pega
// o padrão de lançamentos do razão já lançados"): para cada nota que falta, um lançamento no padrão de importação do
// Alterdata (o de 10 colunas, creditor.planilhaDeImportacao), copiado do razão da própria conta:
//   - a contrapartida é a conta do participante nos lançamentos que já existem (pelo CNPJ ou pelo nome); a coluna "conta"
//     do relatório de notas, quando vier, vale antes;
//   - o código e o texto do histórico são os do lançamento mais recente da conta, com a nota, o CNPJ e o nome trocados;
//   - o lado sai da operação: a conta de saída/prestado é creditada (o participante é o débito) e a de entrada/tomado,
//     debitada.
// A nota de participante que ainda não tem lançamento na conta não entra: fica na lista "sem conta", para lançar à mão.
import { planilhaDeImportacao, TIPO_XLS, type LinhaDeImportacao } from '../../extratudo/creditor/arquivos/gerar';
import { slugArquivoLegado } from './consultaCsv';
import { ehLinhaIcms, mesmoNome, partesDoHistorico, type LinhaRazao, type NotaAlvo, type ResultadoVerificacao } from './verificarConta';

export { TIPO_XLS };

const soDigitos = (s: string | undefined) => String(s || '').replace(/\D/g, '');
const semZeros = (s: string) => s.replace(/^0+/, '') || s;

/** O código do histórico padrão e o texto dele ("… 00014 Pelos Serviços Prestados conf. …"). */
export function historicoDaLinha(txt: string): { codigo: string; texto: string } | null {
  const m = String(txt || '').match(/(?:^|\s)(\d{5})\s+(\p{L}.*)$/u);
  return m ? { codigo: m[1], texto: m[2].trim() } : null;
}

const diaDe = (d: string) => { const [dd, mm, aa] = String(d || '').split('/').map(Number); return aa && mm && dd ? Date.UTC(aa, mm - 1, dd) : 0; };

/** O documento da nota (CNPJ com 14 dígitos, CPF com 11). */
function docDaNota(n: NotaAlvo): string {
  const x = n as { doc?: string; cnpj?: string };
  const d = soDigitos(x.doc || x.cnpj);
  return d.length > 11 ? d.padStart(14, '0') : d;
}

/** O texto do histórico da nota, a partir do texto modelo: a nota (com os zeros do modelo), o documento e o nome trocados. */
export function historicoDaNota(modelo: string, n: { numero: string; doc: string; nome: string }): string {
  const p = partesDoHistorico(modelo);
  const generico = 'conf. NF nº ' + n.numero + (n.doc ? ' - ' + n.doc : '') + ' - ' + n.nome;
  if (!p.nota || !p.nome) return generico;
  let t = modelo;
  // a nota: cada número do modelo que é a nota dele, no mesmo tamanho (000000000000190 → 000000000000246)
  t = t.replace(/\d+/g, s => (s.length !== 11 && s.length !== 14 && semZeros(s) === p.nota ? semZeros(n.numero).padStart(s.length, '0') : s));
  if (p.doc) {
    // o documento como está no texto: com ou sem os zeros da frente e a pontuação (08.760.011/0001-81)
    const docModelo = new RegExp('0*' + semZeros(p.doc).split('').join('[./-]?'));
    if (!docModelo.test(t)) return generico;
    t = n.doc ? t.replace(docModelo, n.doc) : t.replace(new RegExp('\\s*-\\s*' + docModelo.source), '');
  }
  const i = t.lastIndexOf(p.nome);
  return i >= 0 ? t.slice(0, i) + n.nome + t.slice(i + p.nome.length) : generico;
}

/** A conta do participante nos lançamentos da conta (pelo documento do histórico, senão pelo nome) e o documento dele lá. */
function doParticipante(linhas: readonly LinhaRazao[], n: NotaAlvo, doc: string): { conta: string; doc: string } {
  const com = linhas.filter(l => soDigitos(l.contra)).map(l => ({ l, p: partesDoHistorico(l.txt) }));
  const d = doc ? semZeros(doc) : '';
  const x = (d && com.find(({ p }) => !!p.doc && semZeros(p.doc) === d)) || com.find(({ l, p }) => (!!p.nome && mesmoNome(p.nome, n.nome)) || mesmoNome(l.txt, n.nome));
  return x ? { conta: soDigitos(x.l.contra), doc: x.p.doc } : { conta: '', doc: '' };
}

export interface LancamentosFaltando {
  lancamentos: LinhaDeImportacao[];
  /** as notas sem a conta do participante: não vão no arquivo */
  semConta: NotaAlvo[];
}

/** Os lançamentos das notas faltando (só quando a conferência é de uma conta). */
export function lancamentosFaltando(r: ResultadoVerificacao): LancamentosFaltando {
  const conta = soDigitos(r.conta.codigo);
  if (r.contas || !conta || !r.faltando.length) return { lancamentos: [], semConta: r.contas ? [] : r.faltando.slice() };
  const linhas = r.linhas.filter(l => !ehLinhaIcms(l));
  // o modelo do histórico: o lançamento mais recente que tem o código e o texto
  const comHist = linhas.map(l => ({ l, h: historicoDaLinha(l.txt) })).filter(x => x.h);
  const modelo = comHist.sort((a, b) => diaDe(b.l.data) - diaDe(a.l.data))[0]?.h || null;
  const credita = r.serv ? r.serv === 'prestados' : null;
  const lancamentos: LinhaDeImportacao[] = [];
  const semConta: NotaAlvo[] = [];
  for (const n of r.faltando) {
    const daNota = docDaNota(n);
    const achado = doParticipante(linhas, n, daNota);
    // a nota sem CPF/CNPJ usa o do participante no razão
    const doc = daNota || achado.doc;
    const part = soDigitos((n as { conta?: string }).conta) || achado.conta;
    if (!part) { semConta.push(n); continue; }
    const saida = credita ?? n.tipo !== 'Entrada';
    lancamentos.push({
      automatico: '',
      data: n.data,
      debito: saida ? part : conta,
      credito: saida ? conta : part,
      valor: Math.round(Math.abs(n.valor) * 100) / 100,
      codHistorico: modelo?.codigo || '',
      historico: modelo ? historicoDaNota(modelo.texto, { numero: n.numero, doc, nome: n.nome }) : historicoDaNota('', { numero: n.numero, doc, nome: n.nome }),
      documento: semZeros(n.numero),
    });
  }
  return { lancamentos, semConta };
}

/** O .xls dos lançamentos (o padrão de importação do Alterdata). */
export const planilhaLancamentosFaltando = (l: LancamentosFaltando): Uint8Array => planilhaDeImportacao(l.lancamentos);

export const nomeLancamentosFaltando = (empresa: string, conta: string): string =>
  'lancamentos-faltando-' + slugArquivoLegado(empresa) + '-' + soDigitos(conta) + '.xls';
