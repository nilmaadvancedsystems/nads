// O Creditor com o Cadastro da empresa (Tarefas › Cadastro, 2026-09-30):
// - o plano de contas do cadastro, quando a empresa tem, vale no lugar do balancete da Conferência;
// - as contas padrão (banco, juros, descontos, históricos) moram no cadastro. Enquanto a empresa não tem, valem
//   as que o Creditor já tinha salvado (extrator/{slug}/creditor/contas, que continua lá, sem mudar); a primeira
//   confirmação no Creditor grava no cadastro;
// - sem conta do banco escolhida, vale a conta contábil do Sicoob cadastrado (o relatório é do Sicoob).
import type { RepoCadastro } from '../../../empresas/cadastro/repo';
import { comContasPadrao } from '../../../empresas/cadastro/regras';
import type { CadastroDaEmpresa, PlanoDeContas } from '../../../empresas/cadastro/tipos';
import type { RepoCreditor } from '../repo';
import type { BalanceteDaEmpresa, ConfigCreditor } from './balancete';

/** O plano do cadastro como o Creditor o vê (sem plano no cadastro, o balancete de sempre). */
export function balanceteComCadastro(plano: PlanoDeContas | null, doBalancete: BalanceteDaEmpresa): BalanceteDaEmpresa {
  if (!plano?.contas.length) return doBalancete;
  return {
    origem: 'cadastro',
    em: plano.importadoEm || undefined,
    contas: plano.contas.map(c => ({ codigo: c.codigo, nome: c.nome, grupo: c.grupo, sintetica: !!c.sintetica, ordem: c.ordem })),
  };
}

/** As contas que valem: as do cadastro (ou, sem elas, as salvas no Creditor), com o Sicoob como conta do banco. */
export function configComCadastro(c: CadastroDaEmpresa, salvaNoCreditor: ConfigCreditor): ConfigCreditor {
  const base: ConfigCreditor = c.contasPadrao
    ? { contas: { ...c.contasPadrao.contas }, nomes: { ...c.contasPadrao.nomes }, atualizadoEm: c.atualizadoEm }
    : { ...salvaNoCreditor, contas: { ...salvaNoCreditor.contas }, nomes: { ...salvaNoCreditor.nomes } };
  if (!base.contas.banco) {
    const sicoob = c.bancos?.find(b => b.marca === 'sicoob' && b.contaContabil);
    if (sicoob?.contaContabil) base.contas.banco = sicoob.contaContabil;
  }
  return base;
}

/**
 * O repositório do Creditor lendo e gravando as contas no Cadastro. `codigoDe` dá o código do ERP da empresa
 * (para o documento do cadastro nascer com ele). Os clientes aprendidos continuam onde estavam.
 */
export function comCadastro(repo: RepoCreditor, cadastro: RepoCadastro, codigoDe: (nome: string) => number | null = () => null): RepoCreditor {
  const doCadastro = (nome: string) => cadastro.cadastro(nome, codigoDe(nome));
  return {
    exemplos: repo.exemplos,
    balancete: nome => { doCadastro(nome); return balanceteComCadastro(cadastro.plano(nome), repo.balancete(nome)); },
    config: nome => configComCadastro(doCadastro(nome), repo.config(nome)),
    clientes: nome => repo.clientes(nome),
    carregada: nome => { doCadastro(nome); return repo.carregada(nome) && cadastro.carregada(nome); },
    salvarConfig(nome, c) {
      if (!repo.carregada(nome) || !cadastro.carregada(nome)) return; // antes de chegar do banco, nunca grava
      const atual = doCadastro(nome);
      const novo = comContasPadrao(atual, { contas: c.contas, nomes: c.nomes }, 'Creditor', new Date());
      if (novo !== atual) cadastro.salvar(nome, novo);
    },
    salvarClientes: (nome, c) => repo.salvarClientes(nome, c),
    assinar(f) {
      const um = repo.assinar(f);
      const outro = cadastro.assinar(f);
      return () => { um(); outro(); };
    },
    // as duas só crescem: a soma muda sempre que uma delas muda
    versao: () => repo.versao() + cadastro.versao(),
  };
}
