// Os bancos da empresa no Extrator: uma linha por banco (extrato + razão de cada um). Com os bancos no Cadastro
// (Tarefas › Cadastro), as linhas são as contas de lá que valem na competência. Sem cadastro, como antes: a lista
// provisória de empresas/bancos.ts e os bancos adicionados na tela (valendo de uma competência em diante).
// Arquivo sem banco, ou da linha genérica "Banco", é do primeiro banco (os importados antes de ter mais de um).
import { bancosDaEmpresa, rotuloDaConta, type BancoDaEmpresa } from '../../../empresas/bancos';
import { bancosDoCadastroNa, primeiroBancoDoCadastro } from '../../../empresas/cadastro/regras';
import type { CadastroDaEmpresa } from '../../../empresas/cadastro/tipos';
import type { ArquivoImportado, EmpresaExtrator, LancamentoDoArquivo, RegistroAuditoria } from '../tipos';
import { conferir } from './conferencia';

/** O banco de um arquivo (o primeiro banco da empresa, se o arquivo é de antes ou da linha genérica). */
export function bancoDoArquivo(a: ArquivoImportado, primeiro: string): string {
  return a.banco && a.banco !== 'banco' ? a.banco : primeiro;
}

/**
 * As linhas de banco da competência e o primeiro banco (o dos arquivos sem banco). Com os bancos cadastrados,
 * vêm do Cadastro (e os adicionados na tela do Extrator, de antes, ficam de fora: o cadastro já os trouxe);
 * sem cadastro, como antes.
 */
export function bancosDaEmpresaNa(e: EmpresaExtrator, cadastro: CadastroDaEmpresa | null, codigo: number | null, competencia: string): { bancos: BancoDaEmpresa[]; primeiro: string } {
  if (cadastro?.bancos) return { bancos: bancosDoCadastroNa(cadastro, codigo, competencia), primeiro: primeiroBancoDoCadastro(cadastro, codigo) };
  const cadastrados = bancosDaEmpresa(codigo);
  return { bancos: bancosNaCompetencia(e, cadastrados, competencia), primeiro: cadastrados[0].id };
}

/**
 * As linhas da competência ('aaaa-mm'): os bancos cadastrados e os adicionados até ela. A linha genérica
 * "Banco" (empresa sem cadastro) sai quando já há banco adicionado e ela não tem arquivo nenhum.
 */
export function bancosNaCompetencia(e: EmpresaExtrator, cadastrados: readonly BancoDaEmpresa[], competencia: string): BancoDaEmpresa[] {
  const adicionados = (e.bancos || []).filter(b => b.desde <= competencia && !cadastrados.some(c => c.id === b.id)).map(({ desde: _desde, ...b }) => b);
  const primeiro = cadastrados[0]?.id;
  const semArquivo = (id: string) => !e.arquivos.some(a => primeiro && bancoDoArquivo(a, primeiro) === id);
  const base = cadastrados.length === 1 && cadastrados[0].id === 'banco' && adicionados.length && semArquivo('banco') ? [] : cadastrados;
  return [...base, ...adicionados];
}

/** Os arquivos de um banco e lado com lançamento na competência. */
export function arquivosDoBanco(e: EmpresaExtrator, banco: string, primeiro: string, lado: ArquivoImportado['lado'], competencia: string): ArquivoImportado[] {
  return e.arquivos.filter(a => a.lado === lado && bancoDoArquivo(a, primeiro) === banco && a.lancamentos.some(l => l.data.startsWith(competencia)));
}

/**
 * O banco está Ok no período (Vitor, 01/10/2026): todo mês com movimento tem o extrato e o razão, e o extrato
 * e o razão batem entre si — a conferência não deixa nenhuma pendência (cada lançamento com a mesma data e o
 * mesmo valor do outro lado). Os meses marcados "sem movimento" ficam de fora; só com eles, não está Ok.
 */
export function bancoOkNoPeriodo(e: EmpresaExtrator, banco: string, primeiro: string, meses: readonly string[], semMovimento: readonly string[] = []): boolean {
  const comMovimento = meses.filter(m => !semMovimento.includes(m));
  if (!comMovimento.length) return false;
  const doMes = (lado: ArquivoImportado['lado'], mes: string): LancamentoDoArquivo[] =>
    arquivosDoBanco(e, banco, primeiro, lado, mes).flatMap(a =>
      a.lancamentos.flatMap((l, i) => (l.data.startsWith(mes) ? [{ ...l, id: a.id + ':' + i, idArquivo: a.id, lado }] : [])));
  return comMovimento.every(mes => {
    const extrato = doMes('banco', mes);
    const razao = doMes('sistema', mes);
    if (!extrato.length || !razao.length) return false;
    return conferir(extrato, razao).linhas.every(l => l.situacao === 'ok');
  });
}

/** Adiciona um banco à empresa, valendo desta competência em diante (fica na auditoria). */
export function adicionarBanco(e: EmpresaExtrator, banco: BancoDaEmpresa, desde: string, agora: Date): EmpresaExtrator {
  if ((e.bancos || []).some(b => b.id === banco.id)) return e;
  const conta = rotuloDaConta(banco);
  const reg: RegistroAuditoria = { ts: agora.toISOString(), acao: 'Adicionou banco', detalhe: banco.nome + (conta ? ' · ' + conta : '') + ' · a partir de ' + desde.slice(5) + '/' + desde.slice(0, 4), tom: 'ok' };
  return { ...e, bancos: [...(e.bancos || []), { ...banco, desde }], auditoria: [reg, ...e.auditoria] };
}
