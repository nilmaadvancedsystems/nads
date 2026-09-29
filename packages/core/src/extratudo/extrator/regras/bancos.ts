// Os bancos da empresa no Extrator: uma linha por banco (extrato + razão de cada um). Os cadastrados vêm de
// empresas/bancos.ts (provisório); os que a pessoa adiciona na tela ficam na empresa, valendo de uma
// competência em diante. Arquivo sem banco = do primeiro banco (os importados antes de ter mais de um).
import { rotuloDaConta, type BancoDaEmpresa } from '../../../empresas/bancos';
import type { ArquivoImportado, EmpresaExtrator, RegistroAuditoria } from '../tipos';

/** O banco de um arquivo (o primeiro banco da empresa, se o arquivo é de antes). */
export function bancoDoArquivo(a: ArquivoImportado, primeiro: string): string {
  return a.banco || primeiro;
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

/** Adiciona um banco à empresa, valendo desta competência em diante (fica na auditoria). */
export function adicionarBanco(e: EmpresaExtrator, banco: BancoDaEmpresa, desde: string, agora: Date): EmpresaExtrator {
  if ((e.bancos || []).some(b => b.id === banco.id)) return e;
  const conta = rotuloDaConta(banco);
  const reg: RegistroAuditoria = { ts: agora.toISOString(), acao: 'Adicionou banco', detalhe: banco.nome + (conta ? ' · ' + conta : '') + ' · a partir de ' + desde.slice(5) + '/' + desde.slice(0, 4), tom: 'ok' };
  return { ...e, bancos: [...(e.bancos || []), { ...banco, desde }], auditoria: [reg, ...e.auditoria] };
}
