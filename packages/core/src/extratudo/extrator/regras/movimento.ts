// O movimento do extrato de uma conta na competência (a setinha da linha do banco): cada lançamento com o
// saldo depois dele. O saldo acumula tudo o que foi importado daquela conta antes (os meses anteriores
// entram no "saldo anterior"). Sem o saldo de abertura do banco, ele conta a partir do primeiro extrato
// importado.
import type { EmpresaExtrator } from '../tipos';
import { bancoDoArquivo } from './bancos';

export interface LinhaDoMovimento { data: string; historico: string; valor: number; saldo: number }
export interface MovimentoDoExtrato { saldoAnterior: number; linhas: LinhaDoMovimento[]; entradas: number; saidas: number }

export function movimentoDoExtrato(e: EmpresaExtrator, banco: string, primeiro: string, competencia: string): MovimentoDoExtrato {
  const todos = e.arquivos
    .filter(a => a.lado === 'banco' && bancoDoArquivo(a, primeiro) === banco)
    .flatMap(a => a.lancamentos)
    .map((l, i) => ({ ...l, i }))
    .sort((a, b) => a.data.localeCompare(b.data) || a.i - b.i);
  let saldo = 0;
  let saldoAnterior = 0;
  const linhas: LinhaDoMovimento[] = [];
  for (const l of todos) {
    if (l.data.slice(0, 7) > competencia) break;
    saldo += l.valor;
    if (l.data.startsWith(competencia)) linhas.push({ data: l.data, historico: l.historico, valor: l.valor, saldo });
    else saldoAnterior = saldo;
  }
  return {
    saldoAnterior, linhas,
    entradas: linhas.filter(l => l.valor > 0).reduce((t, l) => t + l.valor, 0),
    saidas: linhas.filter(l => l.valor < 0).reduce((t, l) => t + l.valor, 0),
  };
}
