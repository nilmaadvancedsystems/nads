// O movimento do extrato de uma conta na competência (a setinha da linha do banco): cada lançamento com o
// saldo depois dele. O saldo acumula tudo o que foi importado daquela conta antes (os meses anteriores
// entram no "saldo anterior"). O começo é o saldo anterior que o primeiro extrato importado traz (a linha
// "SALDO ANTERIOR" do PDF; Vitor, 01/10/2026: antes de 2026 não há meses no sistema, então o de janeiro abre a
// conta); sem ele, conta a partir de zero.
import type { ArquivoImportado, EmpresaExtrator, RegistroAuditoria } from '../tipos';
import { bancoDoArquivo } from './bancos';

export interface LinhaDoMovimento { data: string; historico: string; valor: number; saldo: number }
/** Todos os extratos importados da conta, do primeiro ao último mês. */
export const TODOS_OS_MESES = { de: '0000-00', ate: '9999-99' } as const;

/** abertura: o saldo anterior do primeiro extrato (null = o extrato não trouxe; conta de zero) */
export interface MovimentoDoExtrato { saldoAnterior: number; abertura: number | null; linhas: LinhaDoMovimento[]; entradas: number; saidas: number }

/** ate: a última competência que entra (sem = só a competência); "todos" = movimentoDoExtrato(…, TODOS_OS_MESES.de, TODOS_OS_MESES.ate) */
export function movimentoDoExtrato(e: EmpresaExtrator, banco: string, primeiro: string, competencia: string, ate = competencia): MovimentoDoExtrato {
  const doBanco = e.arquivos.filter(a => a.lado === 'banco' && bancoDoArquivo(a, primeiro) === banco);
  // o primeiro extrato (o do lançamento mais antigo): o saldo anterior dele abre a conta
  const comeco = (a: { lancamentos: { data: string }[] }) => a.lancamentos.reduce((m, l) => (l.data < m ? l.data : m), '9999');
  const primeiroExtrato = doBanco.slice().sort((a, b) => comeco(a).localeCompare(comeco(b)))[0];
  const abertura = primeiroExtrato && typeof primeiroExtrato.saldoAnterior === 'number' ? primeiroExtrato.saldoAnterior : null;
  const todos = doBanco
    .flatMap(a => a.lancamentos)
    .map((l, i) => ({ ...l, i }))
    .sort((a, b) => a.data.localeCompare(b.data) || a.i - b.i);
  let saldo = abertura ?? 0;
  let saldoAnterior = saldo;
  const linhas: LinhaDoMovimento[] = [];
  for (const l of todos) {
    if (l.data.slice(0, 7) > ate) break;
    saldo += l.valor;
    if (l.data.slice(0, 7) >= competencia) linhas.push({ data: l.data, historico: l.historico, valor: l.valor, saldo });
    else saldoAnterior = saldo;
  }
  return {
    saldoAnterior, abertura, linhas,
    entradas: linhas.filter(l => l.valor > 0).reduce((t, l) => t + l.valor, 0),
    saidas: linhas.filter(l => l.valor < 0).reduce((t, l) => t + l.valor, 0),
  };
}

const comecoDo = (a: { lancamentos: { data: string }[] }) => a.lancamentos.reduce((m, l) => (l.data < m ? l.data : m), '9999');

/**
 * Os extratos que abrem a conta (o primeiro de cada banco) e vieram do Drive sem o saldo anterior — os importados antes
 * de a leitura guardar o saldo. A tela pede o arquivo ao robô de novo e lê só o saldo (definirSaldoAnterior).
 */
export function extratosSemSaldoAnterior(e: EmpresaExtrator, primeiro: string): ArquivoImportado[] {
  const porBanco = new Map<string, ArquivoImportado>();
  for (const a of e.arquivos) {
    if (a.lado !== 'banco' || !a.lancamentos.length) continue;
    const b = bancoDoArquivo(a, primeiro);
    const atual = porBanco.get(b);
    if (!atual || comecoDo(a) < comecoDo(atual)) porBanco.set(b, a);
  }
  return [...porBanco.values()].filter(a => typeof a.saldoAnterior !== 'number' && !!a.drive);
}

/** Grava no arquivo o saldo anterior lido do extrato (fica no histórico). */
export function definirSaldoAnterior(e: EmpresaExtrator, arquivoId: string, saldo: number, agora: Date): EmpresaExtrator {
  const a = e.arquivos.find(x => x.id === arquivoId);
  if (!a || a.saldoAnterior === saldo) return e;
  const reg: RegistroAuditoria = { ts: agora.toISOString(), acao: 'Leu o saldo anterior', detalhe: a.nome + ' · ' + (saldo / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }), tom: 'ok' };
  return { ...e, arquivos: e.arquivos.map(x => (x.id === arquivoId ? { ...x, saldoAnterior: saldo } : x)), auditoria: [reg, ...e.auditoria] };
}
