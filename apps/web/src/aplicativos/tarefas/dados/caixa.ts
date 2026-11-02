// O caixa do escritório (19/10/2026: "o Movimento de Caixa e o Plano de Contas do Toriba, no nads"): os lançamentos de
// entrada e saída (financeiroCaixa) e o plano de contas (financeiroPlano), no banco do Entregas. Só o admin e o diretor.
// Interface + a versão de exemplo; a do banco é caixa.firestore.ts.
import { financeiro } from '@nads/core';
import type { ListaAoVivo } from './agentes';

/** o que a tela manda gravar de um lançamento: sem id é novo; o resto (origem, quem criou) o repositório guarda */
export interface RascunhoDeLancamento {
  id?: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: financeiro.TipoDeLancamento;
  observacoes?: string;
  conta?: string;
}

/** o que a tela manda gravar de uma conta do plano: sem id é nova */
export type RascunhoDeConta = Omit<financeiro.ContaDoPlano, 'id'> & { id?: string };

/** o que a tela manda gravar de uma importação (o id vem da tela, porque as linhas já levam o id dela) */
export type NovaImportacao = Omit<financeiro.ImportacaoDeExtrato, 'importadoEm' | 'importadoPor'>;

export interface RepoCaixa {
  readonly exemplos: boolean;
  /** todos os lançamentos (ao vivo), por data e id */
  lancamentos(): ListaAoVivo<financeiro.LancamentoDeCaixa>;
  /** o plano de contas (ao vivo), por classificação */
  plano(): ListaAoVivo<financeiro.ContaDoPlano>;
  /** cria (sem id) ou altera; devolve o id */
  salvarLancamento(l: RascunhoDeLancamento, quem: string): Promise<string>;
  excluirLancamento(id: string): Promise<void>;
  /** cria (sem id) ou altera; devolve o id */
  salvarConta(c: RascunhoDeConta): Promise<string>;
  /** o extrato do banco (23/10/2026, à parte do Caixa): as linhas importadas (ao vivo), por data */
  extrato(): ListaAoVivo<financeiro.LancamentoDoBanco>;
  /** as importações de extrato (ao vivo), da mais nova para a mais velha */
  importacoes(): ListaAoVivo<financeiro.ImportacaoDeExtrato>;
  /**
   * grava uma importação: só as linhas que ainda não estão no banco (o id é fixo, então o mesmo extrato não duplica;
   * financeiro.separarJaImportadas); quantos, entradas e saídas da importação são os das linhas gravadas nela; devolve
   * quantas entraram e quantas já estavam
   */
  importarExtrato(i: NovaImportacao, linhas: financeiro.LancamentoDoBanco[], quem: string): Promise<{ novas: number; repetidas: number }>;
  /** apaga a importação e as linhas que vieram nela */
  desfazerImportacao(id: string): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

const AGORA = () => new Date().toISOString();
const DIA = (dias: number) => { const d = new Date(); d.setDate(d.getDate() - dias); return d.toISOString().slice(0, 10); };

/** Nos exemplos: um plano pequeno e alguns lançamentos do mês (e um saldo anterior). */
export function criarCaixaMemoria(): RepoCaixa {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const c = (id: string, codigo: string, descricao: string, tipo: financeiro.TipoDeConta, pai: string | null, movimentavel = true): financeiro.ContaDoPlano =>
    ({ id, codigo, descricao, tipo, nivel: codigo.split('.').length, pai, ativo: true, movimentavel });
  let plano: financeiro.ContaDoPlano[] = [
    c('p1', '1', 'Ativo', 'ATIVO', null, false), c('p11', '1.1', 'Caixa', 'ATIVO', 'p1'),
    c('p4', '4', 'Receitas', 'RECEITA', null, false), c('p41', '4.1', 'Receitas operacionais', 'RECEITA', 'p4', false), c('p4101', '4.1.01', 'Honorários contábeis', 'RECEITA', 'p41'),
    c('p5', '5', 'Despesas', 'DESPESA', null, false), c('p5101', '5.1.01', 'Material de escritório', 'DESPESA', 'p5'),
  ];
  const l = (id: string, dias: number, tipo: financeiro.TipoDeLancamento, descricao: string, valor: number, conta?: string, observacoes?: string): financeiro.LancamentoDeCaixa =>
    ({ id, data: DIA(dias), descricao, valor, tipo, conta, observacoes, origem: 'nads', criadoEm: AGORA(), criadoPor: 'Exemplo' });
  let lancamentos: financeiro.LancamentoDeCaixa[] = [
    l('ex-1', 60, 'E', 'Saldo trazido do ano passado (EXEMPLO)', 1500.5, 'p11'),
    l('ex-2', 3, 'E', 'Honorários de setembro, Comércio Exemplo (EXEMPLO)', 850, 'p4101'),
    l('ex-3', 2, 'S', 'Papel e toner (EXEMPLO)', 212.9, 'p5101', 'Nota na pasta do financeiro'),
    l('ex-4', 1, 'E', 'Troco do cofre (EXEMPLO)', 100),
    l('ex-5', 0, 'S', 'Lanche da equipe (EXEMPLO)', 48.75),
  ];
  const ordenados = <T,>(xs: T[]) => [...xs];
  let extrato: financeiro.LancamentoDoBanco[] = [
    { id: 'exb-1', data: DIA(5), historico: 'PIX RECEBIDO COMERCIO EXEMPLO (EXEMPLO)', valor: 1200, tipo: 'E', banco: 'Sicoob', importacao: 'exi-1' },
    { id: 'exb-2', data: DIA(4), historico: 'TARIFA DO PACOTE (EXEMPLO)', valor: 39.9, tipo: 'S', banco: 'Sicoob', importacao: 'exi-1' },
    { id: 'exb-3', data: DIA(2), historico: 'PAGAMENTO DE BOLETO (EXEMPLO)', valor: 310, tipo: 'S', banco: 'Sicoob', importacao: 'exi-1' },
  ];
  let importacoes: financeiro.ImportacaoDeExtrato[] = [
    { id: 'exi-1', banco: 'Sicoob', marca: 'sicoob', rotuloDaConta: 'Ag. 3144 · C/C 12.345-6', arquivo: 'extrato-exemplo.pdf', de: DIA(5), ate: DIA(2), quantos: 3, entradas: 1200, saidas: 349.9, saldoFinal: 4850.1, importadoEm: AGORA(), importadoPor: 'Exemplo' },
  ];
  return {
    exemplos: true,
    lancamentos: () => ({ carregada: true, lista: ordenados(lancamentos), erro: '' }),
    plano: () => ({ carregada: true, lista: ordenados(plano), erro: '' }),
    async salvarLancamento(r, quem) {
      const id = r.id || 'ex-' + Date.now();
      const anterior = lancamentos.find(x => x.id === id);
      const novo: financeiro.LancamentoDeCaixa = {
        id, data: r.data, descricao: r.descricao.trim(), valor: r.valor, tipo: r.tipo, observacoes: r.observacoes?.trim() || undefined, conta: r.conta || undefined,
        origem: anterior?.origem ?? 'nads', toribaId: anterior?.toribaId, criadoEm: anterior?.criadoEm ?? AGORA(), criadoPor: anterior?.criadoPor ?? quem,
        ...(anterior ? { atualizadoEm: AGORA(), atualizadoPor: quem } : {}),
      };
      lancamentos = anterior ? lancamentos.map(x => (x.id === id ? novo : x)) : [...lancamentos, novo];
      mudou();
      return id;
    },
    async excluirLancamento(id) { lancamentos = lancamentos.filter(x => x.id !== id); mudou(); },
    async salvarConta(r) {
      const id = r.id || 'ex-c' + Date.now();
      const nova: financeiro.ContaDoPlano = { ...r, id };
      plano = plano.some(x => x.id === id) ? plano.map(x => (x.id === id ? nova : x)) : [...plano, nova];
      mudou();
      return id;
    },
    extrato: () => ({ carregada: true, lista: [...extrato].sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id)), erro: '' }),
    importacoes: () => ({ carregada: true, lista: [...importacoes].sort((a, b) => b.importadoEm.localeCompare(a.importadoEm)), erro: '' }),
    async importarExtrato(i, linhas, quem) {
      const { novas } = financeiro.separarJaImportadas(linhas, extrato);
      const r = financeiro.resumoDoExtrato(novas);
      extrato = [...extrato, ...novas.map(l => { const c = { ...l }; delete c.idAntigo; return c; })];
      importacoes = [{ ...i, quantos: r.quantos, entradas: r.entradas, saidas: r.saidas, importadoEm: AGORA(), importadoPor: quem }, ...importacoes];
      mudou();
      return { novas: novas.length, repetidas: linhas.length - novas.length };
    },
    async desfazerImportacao(id) {
      extrato = extrato.filter(x => x.importacao !== id);
      importacoes = importacoes.filter(x => x.id !== id);
      mudou();
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
