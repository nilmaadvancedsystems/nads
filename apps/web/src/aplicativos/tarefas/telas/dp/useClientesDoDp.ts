// Os clientes do DP como valem hoje (06/10/2026): a planilha do DP (core empresas/dp.ts) com o que foi mudado no
// Cadastro (o responsável do DP, em Cadastro › Responsáveis) e nas Configurações do DP (os parâmetros). Usado pelo Painel
// e pelas Configurações do DP; grava no cadastro da empresa (cadastro/{slug}).
import { empresas, formatos } from '@nads/core';
import { useOperador } from '../../casca/operador';
import { useGravarCadastro, useRepo, useTodosOsCadastros } from '../../dados/repo';

export function useClientesDoDp() {
  const repo = useRepo();
  const todos = useTodosOsCadastros();
  const gravar = useGravarCadastro();
  const por = useOperador().operador?.nome || '';
  const daLista = new Map(repo.listarEmpresas().filter(e => e.codigo != null).map(e => [e.codigo as number, e]));
  const clientes = empresas.CLIENTES_DO_DP.map(base => {
    const emp = daLista.get(base.codigo) || { codigo: base.codigo, nome: base.nome, regime: base.enquadramento };
    const cadastro = todos.porId.get(formatos.slug(emp.nome)) || null;
    return { ...empresas.clienteDoDpNoCadastro(base, cadastro), base, nomeNaTela: emp.nome, cadastro, mudado: !!cadastro?.dp && Object.keys(cadastro.dp).length > 0 };
  });
  return {
    carregado: todos.carregada,
    clientes,
    /** muda parâmetros do DP de um cliente (null = volta o da planilha) */
    mudarDp(codigo: number, mudar: Parameters<typeof empresas.cadastro.definirParametrosDp>[1]) {
      if (!todos.carregada) return;
      const c = clientes.find(x => x.codigo === codigo);
      if (!c) return;
      void gravar(c.nomeNaTela, c.codigo, atual => empresas.cadastro.definirParametrosDp(atual, mudar, por, new Date()));
    },
  };
}

export type ClienteDoDpNaTela = ReturnType<typeof useClientesDoDp>['clientes'][number];
