// Os honorários dos clientes (19/10/2026, fase 2 do Financeiro): os contratos (financeiroHonorarios, com o valor mensal
// digitado no nads) e os recebimentos por competência (financeiroRecebimentos), no banco do Entregas. Só o admin e o diretor.
// Interface + a versão de exemplo; a do banco é honorarios.firestore.ts.
import { financeiro } from '@nads/core';
import type { ListaAoVivo } from './agentes';

/** o que a tela manda gravar de um contrato: sem id é novo */
export interface RascunhoDeContrato {
  id?: string;
  clienteId: string;
  codigo: string;
  nome: string;
  cnpj: string;
  valor: number;
  ativo: boolean;
  observacoes?: string;
}

/** o que a tela manda gravar de um recebimento (o id sai do contrato e da competência) */
export interface RascunhoDeRecebimento {
  contratoId: string;
  competencia: string;
  valor: number;
  recebidoEm: string;
  forma: financeiro.FormaDeRecebimento;
  lancamentoId?: string;
  observacoes?: string;
}

export interface RepoHonorarios {
  readonly exemplos: boolean;
  /** todos os contratos (ao vivo), por código */
  contratos(): ListaAoVivo<financeiro.ContratoDeHonorario>;
  /** todos os recebimentos (ao vivo) */
  recebimentos(): ListaAoVivo<financeiro.RecebimentoDeHonorario>;
  /** cria (sem id) ou altera; devolve o id */
  salvarContrato(c: RascunhoDeContrato, quem: string): Promise<string>;
  /** só o valor (a edição na própria linha) */
  definirValor(id: string, valor: number, quem: string): Promise<void>;
  /** grava o recebimento do mês (troca o que já houver) */
  receber(r: RascunhoDeRecebimento, quem: string): Promise<void>;
  /** apaga o recebimento do mês */
  desfazer(contratoId: string, competencia: string): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** Nos exemplos: seis clientes, um sem valor, um parado, e dois recebimentos de setembro/2026. */
export function criarHonorariosMemoria(): RepoHonorarios {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const agora = () => new Date().toISOString();
  const c = (id: string, codigo: string, nome: string, valor: number, ativo = true): financeiro.ContratoDeHonorario =>
    ({ id, clienteId: '', codigo, nome, cnpj: '11222333000181', valor, ativo, criadoEm: agora(), criadoPor: 'Exemplo' });
  let contratos: financeiro.ContratoDeHonorario[] = [
    c('h1', '101', 'ALFA COMERCIO EXEMPLO LTDA', 850), c('h2', '102', 'BETA SERVICOS EXEMPLO LTDA', 420), c('h3', '103', 'GAMA TRANSPORTES EXEMPLO LTDA', 1200),
    c('h4', '104', 'DELTA PADARIA EXEMPLO ME', 0), c('h5', '105', 'EPSILON CLINICA EXEMPLO LTDA', 650), c('h6', '106', 'ZETA CONSTRUTORA EXEMPLO LTDA', 900, false),
  ];
  const r = (contratoId: string, valor: number, forma: financeiro.FormaDeRecebimento): financeiro.RecebimentoDeHonorario =>
    ({ id: financeiro.idDoRecebimento(contratoId, '2026-09'), contratoId, competencia: '2026-09', valor, recebidoEm: '2026-10-05', forma, por: 'Exemplo', em: agora() });
  let recebimentos: financeiro.RecebimentoDeHonorario[] = [r('h1', 850, 'pix'), r('h3', 1200, 'boleto')];
  return {
    exemplos: true,
    contratos: () => ({ carregada: true, lista: [...contratos], erro: '' }),
    recebimentos: () => ({ carregada: true, lista: [...recebimentos], erro: '' }),
    async salvarContrato(d, quem) {
      const id = d.id || 'ex-h' + Date.now();
      const antes = contratos.find(x => x.id === id);
      const novo: financeiro.ContratoDeHonorario = {
        id, clienteId: d.clienteId, codigo: d.codigo, nome: d.nome, cnpj: d.cnpj, valor: d.valor, ativo: d.ativo, observacoes: d.observacoes?.trim() || undefined,
        criadoEm: antes?.criadoEm ?? agora(), criadoPor: antes?.criadoPor ?? quem, ...(antes ? { atualizadoEm: agora(), atualizadoPor: quem } : {}),
      };
      contratos = antes ? contratos.map(x => (x.id === id ? novo : x)) : [...contratos, novo];
      mudou();
      return id;
    },
    async definirValor(id, valor, quem) { contratos = contratos.map(x => (x.id === id ? { ...x, valor, atualizadoEm: agora(), atualizadoPor: quem } : x)); mudou(); },
    async receber(d, quem) {
      const id = financeiro.idDoRecebimento(d.contratoId, d.competencia);
      recebimentos = [...recebimentos.filter(x => x.id !== id), { ...d, id, por: quem, em: agora() }];
      mudou();
    },
    async desfazer(contratoId, competencia) { const id = financeiro.idDoRecebimento(contratoId, competencia); recebimentos = recebimentos.filter(x => x.id !== id); mudou(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
