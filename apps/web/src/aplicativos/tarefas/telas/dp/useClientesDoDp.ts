// Os clientes do DP como valem hoje (06/10/2026): a planilha do DP (core empresas/dp.ts) com o que foi mudado no
// Cadastro (o responsável do DP, em Cadastro › Responsáveis) e nas Configurações do DP (os parâmetros). Usado pelo Painel
// e pelas Configurações do DP; grava no cadastro da empresa (cadastro/{slug}).
import { empresas, formatos } from '@nads/core';
import { useRef, useState } from 'react';
import { useOperador } from '../../casca/operador';
import { useGravarCadastro, useRepo, useTodosOsCadastros } from '../../dados/repo';

/** competencia (AAAA-MM): os parâmetros que valem nela; mudar grava a partir dela (Vitor, 07/10/2026) */
export function useClientesDoDp(competencia?: string) {
  const repo = useRepo();
  const todos = useTodosOsCadastros();
  const gravar = useGravarCadastro();
  const por = useOperador().operador?.nome || '';
  // a mudança aparece na hora (Vitor, 07/10/2026: "todos os botões estão bugados"): o cadastro mudado fica aqui até o
  // banco devolver; as gravações da mesma empresa vão em fila (o segundo clique não desfaz o primeiro)
  const [pendentes, setPendentes] = useState<ReadonlyMap<number, empresas.cadastro.CadastroDaEmpresa>>(new Map());
  const fila = useRef(new Map<number, Promise<void>>());
  const daLista = new Map(repo.listarEmpresas().filter(e => e.codigo != null).map(e => [e.codigo as number, e]));
  const clientes = empresas.CLIENTES_DO_DP.map(base => {
    const emp = daLista.get(base.codigo) || { codigo: base.codigo, nome: base.nome, regime: base.enquadramento };
    const cadastro = pendentes.get(base.codigo) || todos.porId.get(formatos.slug(emp.nome)) || null;
    const mudadoNoMes = !!competencia && !!cadastro?.dp?.porCompetencia?.[competencia];
    return { ...empresas.clienteDoDpNoCadastro(base, cadastro, competencia), base, nomeNaTela: emp.nome, cadastro, mudado: !!cadastro?.dp && Object.keys(cadastro.dp).length > 0, mudadoNoMes };
  });
  /** muda na tela na hora e grava em fila (o segundo clique não desfaz o primeiro) */
  function aplicar(codigo: number, mudar: (c: empresas.cadastro.CadastroDaEmpresa) => empresas.cadastro.CadastroDaEmpresa) {
    if (!todos.carregada) return;
    const c = clientes.find(x => x.codigo === codigo);
    if (!c) return;
    const novo = mudar(c.cadastro || empresas.cadastro.cadastroVazio(c.nomeNaTela, c.codigo));
    setPendentes(m => new Map(m).set(codigo, novo));
    const anterior = fila.current.get(codigo) || Promise.resolve();
    const esta = anterior.then(() => gravar(c.nomeNaTela, c.codigo, mudar));
    fila.current.set(codigo, esta);
    void esta.finally(() => {
      if (fila.current.get(codigo) !== esta) return;
      fila.current.delete(codigo);
      // o banco já devolveu (a lista ao vivo): solta o que estava só na tela
      setTimeout(() => setPendentes(m => { if (!m.has(codigo)) return m; const n = new Map(m); n.delete(codigo); return n; }), 1500);
    });
  }
  return {
    carregado: todos.carregada,
    clientes,
    /** muda parâmetros do DP de um cliente (null = volta o da planilha) */
    mudarDp(codigo: number, mudar: Parameters<typeof empresas.cadastro.definirParametrosDp>[1]) {
      aplicar(codigo, cad => empresas.cadastro.definirParametrosDp(cad, mudar, por, new Date(), competencia));
    },
    /** tira o que foi mudado: só o desta competência, ou tudo (volta à planilha) */
    voltar(codigo: number, soEsta: boolean) {
      aplicar(codigo, cad => empresas.cadastro.voltarDpAPlanilha(cad, por, new Date(), soEsta ? competencia : undefined));
    },
  };
}

export type ClienteDoDpNaTela = ReturnType<typeof useClientesDoDp>['clientes'][number];
