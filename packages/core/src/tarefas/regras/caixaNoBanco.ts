// O caixa × os bancos (Vitor, 16/10/2026: "upar o razão do caixa e procurar nos bancos valores e datas semelhantes, que às
// vezes pagou com caixa, mas tinha no banco"). Cada pagamento do caixa no período (o que saiu do caixa) procura, nos
// extratos importados, o que saiu do banco com o mesmo valor, até alguns dias de diferença. A transferência entre o caixa
// e o banco (a contrapartida é o banco) fica de fora. Só sugere: a pessoa confere e corrige no Alterdata.
import { normalizarTexto } from '../../formatos';
import type { LancamentoDoRazao } from './razao';
import { casa, palavrasDoNome } from './sugestaoDeConta';

/** Um lançamento do extrato: data 'aaaa-mm-dd', valor em centavos (+ entrou, − saiu), o histórico e o banco (o nome e a marca). */
export interface LancamentoDoExtrato { data: string; valor: number; historico: string; banco: string; marca?: string }

export interface CaixaNoBanco {
  /** o lançamento do razão do caixa (o valor como o Alterdata: crédito positivo = saiu do caixa) */
  caixa: LancamentoDoRazao;
  /** saiu do caixa (um pagamento); senão, entrou (um recebimento) */
  saida: boolean;
  /** os lançamentos do banco do mesmo valor e sentido, do mais perto para o mais longe; dias = banco − caixa */
  noBanco: (LancamentoDoExtrato & { dias: number })[];
}

/** Até quantos dias de diferença entre o caixa e o banco. */
export const DIAS_DO_CAIXA_NO_BANCO = 5;

const dia = (d: string) => { const [a, m, x] = d.split('-').map(Number); return Date.UTC(a, m - 1, x) / 86400000; };

/** A contrapartida é uma conta de banco (a transferência entre o caixa e o banco, não o pagamento). */
const BANCO = /\b(banco|bco|sicoob|sicredi|bradesco|itau|santander|nubank|inter|c6|btg|cora|stone|pagbank|pagseguro|mercado pago|caixa economica|aplicacao|aplicacoes)\b/;

/**
 * Os pagamentos do caixa nos meses do período que também saíram do banco (até 3 por lançamento). Só o que saiu (Vitor,
 * 16/10/2026: "o que sai do banco e o que está saindo do caixa"); a transferência com o banco (a contrapartida é o banco)
 * fica de fora.
 */
/** Uma nota em aberto de fornecedor (ou de cliente), para achar no caixa: a conta, o nome, a NF e quanto falta (reais). */
export interface NotaEmAbertoNoCaixa { lado: 'fornecedor' | 'cliente'; conta: string; nome: string; nf: string; aberto: number }

export interface NotaNoCaixa {
  nota: NotaEmAbertoNoCaixa;
  /** pelo número da NF no histórico, ou pelo valor (a nota inteira ou em parcelas iguais) */
  como: 'nf' | 'valor';
  /** em quantas parcelas iguais (1 = a nota inteira) */
  vezes: number;
  /** os lançamentos do caixa */
  lancamentos: LancamentoDoRazao[];
}

/** O histórico com cara de pagamento (o boleto, o título, o Pix ou a transferência para alguém; o saque, não). */
const PAGAMENTO = /\b(pagamento|pagto|pgto|boleto|deb tit|titulo|darf|gps|fatura|pix (emitido|enviado)|transf\w* realizada|ted enviada|doc enviado)\b/;
const SAQUE = /\b(saque|retirada|suprimento)\b/;
/** Os números de NF no histórico ("NF 240162", "NFs 276a284", "nota fiscal nº 1234"). */
const nfsDoHistorico = (h: string) => [...normalizarTexto(h).matchAll(/\b(?:nfs?|nfe|nota fiscal|nota|titulo|duplicata)\s+(?:n\s+|no\s+)?0*(\d{3,9})/g)].map(m => m[1]);
/** Os números do histórico (3 a 9 dígitos, sem os zeros da frente). */
const numeros = (h: string) => [...normalizarTexto(h).matchAll(/\b0*(\d{3,9})\b/g)].map(m => m[1]);

/**
 * As notas em aberto que foram pagas (ou recebidas) pelo caixa (Vitor, 16/10/2026: "tinha uma nota fiscal no caixa, sendo
 * que tinha ela em aberto no fornecedor"; "pegue as notas em aberto, divida, ou até mesmo multiplique por 2, 3, 4, 5 vezes
 * aqueles valores parecidos"). Do fornecedor: o que saiu do caixa, ou o pagamento do banco lançado como entrada no caixa
 * (contrapartida o banco, histórico de pagamento). Do cliente: o que entrou no caixa sem ser do banco. Primeiro pelo número
 * da NF no histórico; depois pelo valor: a nota inteira num lançamento, ou em 2 a 10 parcelas iguais (tantos lançamentos do
 * mesmo valor quantas as parcelas). Cada lançamento vai para uma nota só.
 */
export function notasNoCaixa(caixa: readonly LancamentoDoRazao[], meses: readonly string[], notas: readonly NotaEmAbertoNoCaixa[]): NotaNoCaixa[] {
  const doPeriodo = caixa.filter(l => meses.includes(l.data.slice(0, 7)));
  const doBanco = (l: LancamentoDoRazao) => BANCO.test(normalizarTexto(l.nomeContrapartida));
  const pagamento = (l: LancamentoDoRazao) => l.valor > 0
    ? !doBanco(l)
    : doBanco(l) && PAGAMENTO.test(normalizarTexto(l.historico)) && !SAQUE.test(normalizarTexto(l.historico));
  const recebimento = (l: LancamentoDoRazao) => l.valor < 0 && !doBanco(l);
  const candidatos = (n: NotaEmAbertoNoCaixa) => doPeriodo.filter(n.lado === 'fornecedor' ? pagamento : recebimento);
  const usados = new Set<LancamentoDoRazao>();
  const out: NotaNoCaixa[] = [];
  // 1) o número da NF no histórico
  for (const n of notas) {
    const ls = candidatos(n).filter(l => !usados.has(l) && nfsDoHistorico(l.historico).includes(n.nf.replace(/^0+/, '')));
    if (!ls.length) continue;
    ls.forEach(l => usados.add(l));
    out.push({ nota: n, como: 'nf', vezes: ls.length, lancamentos: ls });
  }
  // 2) o valor: a nota inteira, ou em k parcelas iguais (k lançamentos do mesmo valor)
  for (const n of notas) {
    if (out.some(x => x.nota === n)) continue;
    const alvo = Math.round(Math.abs(n.aberto) * 100);
    for (let k = 1; k <= 10; k++) {
      const parcela = alvo / k;
      const ls = candidatos(n).filter(l => !usados.has(l) && Math.abs(Math.round(Math.abs(l.valor) * 100) - parcela) <= Math.max(1, k));
      if (ls.length < k) continue;
      const escolhidos = ls.slice(0, k);
      escolhidos.forEach(l => usados.add(l));
      out.push({ nota: n, como: 'valor', vezes: k, lancamentos: escolhidos });
      break;
    }
  }
  return out.sort((a, b) => (a.como === b.como ? 0 : a.como === 'nf' ? -1 : 1) || a.nota.nome.localeCompare(b.nota.nome));
}

/** As palavras do banco e da contabilidade que não dizem para quem foi o pagamento. */
const SEM_NOME = new Set([
  'enviado', 'recebido', 'transf', 'transferencia', 'realizada', 'ted', 'banco', 'sicoob', 'credinor', 'pgto', 'dup', 'titulo',
  'fatura', 'darf', 'gps', 'salario', 'salarios', 'salarial', 'adiant', 'adiantamento', 'compra', 'compras', 'nota', 'fiscal',
  'conf', 'pelo', 'pela', 'valor', 'vista', 'liquidas', 'fornecedores', 'fornecedor', 'clientes', 'ordenados',
]);
/** O que o lançamento diz de quem recebeu ("Pix … ***.437.336-** Adiant salarial Gabriel" → gabriel). */
const nomesDo = (texto: string) => palavrasDoNome(texto).filter(p => p.length >= 4 && !SEM_NOME.has(p));

/** O pagamento do banco que passou pelo caixa: a entrada vinda do banco e a saída para o fornecedor, o mesmo valor. */
export interface PassouPeloCaixa { entrada: LancamentoDoRazao; saida: LancamentoDoRazao; nfs: string[] }

/**
 * O pagamento do banco que passou pelo caixa (Vitor, 16/10/2026: "tinha 700,00 da Nova Tratores que passou batido"): no
 * razão do caixa, a entrada vinda do banco (contrapartida o banco) e, até 3 dias, a saída do mesmo valor para quem não é
 * banco (o fornecedor). O certo é D Fornecedor, C Banco, sem o caixa no meio. Vale com o histórico de pagamento na
 * entrada ou com a mesma NF nos dois; a mesma NF e o mesmo dia vêm primeiro. Cada lançamento num par só.
 */
export function passouPeloCaixa(caixa: readonly LancamentoDoRazao[], meses: readonly string[]): PassouPeloCaixa[] {
  const doPeriodo = caixa.filter(l => meses.includes(l.data.slice(0, 7)));
  const doBanco = (l: LancamentoDoRazao) => BANCO.test(normalizarTexto(l.nomeContrapartida));
  const entradas = doPeriodo.filter(l => l.valor < 0 && doBanco(l) && !SAQUE.test(normalizarTexto(l.historico)));
  const saidas = doPeriodo.filter(l => l.valor > 0 && !doBanco(l));
  const usadas = new Set<LancamentoDoRazao>();
  const out: PassouPeloCaixa[] = [];
  for (const e of entradas) {
    const nfsE = nfsDoHistorico(e.historico);
    const pagamento = PAGAMENTO.test(normalizarTexto(e.historico));
    const nomesE = nomesDo(e.historico);
    const c = Math.round(-e.valor * 100);
    const pares = saidas
      .filter(s => !usadas.has(s) && Math.abs(Math.round(s.valor * 100) - c) <= 1 && Math.abs(dia(s.data) - dia(e.data)) <= 3)
      .map(s => {
        // a mesma nota nos dois: o número da NF (ou do título) de um aparece no outro
        const nfs = [...new Set([...nfsDoHistorico(s.historico), ...nfsE])].filter(n => numeros(e.historico).includes(n) && numeros(s.historico).includes(n));
        return { s, nfs, nota: (nfs.length ? 4 : 0) + (s.data === e.data ? 2 : 0) - Math.abs(dia(s.data) - dia(e.data)) };
      })
      // a mesma NF nos dois; sem ela, o PIX que diz para quem foi só com o nome batendo, e o que não diz nada só no mesmo dia
      // (Vitor, 23/10/2026: o "Adiant salarial Gabriel" virou o pagamento de uma compra de insumos de dois dias antes —
      // "faz isso só quando for a mesma data, se tiver sem descrição clara; caso contrário nem coloque como sugestão")
      .filter(x => x.nfs.length > 0 || (pagamento && (nomesE.length
        ? nomesDo(x.s.historico + ' ' + x.s.nomeContrapartida).some(a => nomesE.some(w => casa(w, a) || casa(a, w)))
        : x.s.data === e.data)))
      .sort((a, b) => b.nota - a.nota);
    if (!pares.length) continue;
    usadas.add(pares[0].s);
    out.push({ entrada: e, saida: pares[0].s, nfs: pares[0].nfs });
  }
  return out;
}

export function caixaNoBanco(caixa: readonly LancamentoDoRazao[], extrato: readonly LancamentoDoExtrato[], meses: readonly string[], dias = DIAS_DO_CAIXA_NO_BANCO): CaixaNoBanco[] {
  return caixa
    .filter(l => meses.includes(l.data.slice(0, 7)) && Math.round(l.valor * 100) > 0 && !BANCO.test(normalizarTexto(l.nomeContrapartida)))
    .map(l => {
      const centavos = Math.round(Math.abs(l.valor) * 100);
      // no razão do Alterdata o crédito vem positivo: no caixa, é o que saiu
      const saida = l.valor > 0;
      const noBanco = extrato
        .filter(b => Math.abs(b.valor) === centavos && (saida ? b.valor < 0 : b.valor > 0))
        .map(b => ({ ...b, dias: dia(b.data) - dia(l.data) }))
        .filter(b => Math.abs(b.dias) <= dias)
        .sort((a, b) => Math.abs(a.dias) - Math.abs(b.dias) || a.dias - b.dias)
        .slice(0, 3);
      return { caixa: l, saida, noBanco };
    })
    .filter(x => x.noBanco.length > 0);
}
