// ViewModel da etapa Despesas e receitas (Vitor, 16/10/2026: "despesas/receitas na mesma tela, o sistema só vai conferir no
// balancete dinâmico se tem despesas credoras e receitas devedoras"). O dinâmico é o importado em Clientes (guardado neste
// navegador); a pessoa pode importar um mais novo aqui (o corrigido). A regra é do @nads/core
// (clientes.resultadoErradoNoDinamico); a conta do lado errado trava o Próximo.
import { clientes as cl, conferencia as c, formatos, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo } from 'react';
import { useGuardado } from '../../../../../../comum/guardado';
import { useContabilDaEmpresa } from '../../../../../../comum/contabilDaEmpresa';
import { useChaveDaEtapa, useDadosDeTesteDaEtapa, useEtapaAberta, useRequisitosDaEtapa } from '../contexto';

type Dinamico = { nome: string; d: cl.BalanceteDinamico };

export function useResultado() {
  const s = useEtapaAberta();
  const { aviso } = useRetorno();
  const chave = useChaveDaEtapa('resultado');
  // o importado aqui (o corrigido) vale mais que o do Clientes
  const [proprio, setProprio] = useGuardado<Dinamico | null>(chave + '|dinamico', null);
  // o da Importação (o primeiro passo), ou o que o Clientes importou antes
  const doClientes = useContabilDaEmpresa(s.nome, s.codigo).dinamico;
  const din = proprio || doClientes;
  // o ⚡ do modo desenvolvedor: o dinâmico de teste da empresa toda (16/10/2026)
  useDadosDeTesteDaEtapa(s.dev ? [{ id: 'certo', rotulo: 'Dinâmico de teste (tudo certo)' }, { id: 'erros', rotulo: 'Dinâmico de teste (despesa credora e receita devedora)' }] : [],
    id => setProprio({ nome: 'TESTE balancete dinâmico.xls', d: cl.dinamicoCompletoDeTeste(s.meses, id === 'erros') }));

  async function importar(f: File | null) {
    if (!f) return;
    try {
      const d = cl.lerBalanceteDinamico(c.lerPlanilha(await f.arrayBuffer()));
      setProprio({ nome: f.name, d });
      aviso({ tom: 'ok', titulo: 'Balancete dinâmico importado', texto: f.name });
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não deu para ler ' + f.name, texto: e instanceof Error ? e.message : String(e) });
    }
  }

  const errados = useMemo(() => (din ? cl.resultadoErradoNoDinamico(din.d, s.meses) : []), [din, s.meses]);
  const despesas = errados.filter(x => x.tipo === 'despesa');
  const receitas = errados.filter(x => x.tipo === 'receita');
  const faltam = [
    ...(!din ? ['Importar o balancete dinâmico (em Clientes ou aqui)'] : []),
    ...(despesas.length ? ['Corrigir ' + (despesas.length === 1 ? 'a despesa credora' : 'as ' + despesas.length + ' despesas credoras')] : []),
    ...(receitas.length ? ['Corrigir ' + (receitas.length === 1 ? 'a receita devedora' : 'as ' + receitas.length + ' receitas devedoras')] : []),
  ];
  useRequisitosDaEtapa({ pronto: !faltam.length, faltam });

  return {
    temDinamico: !!din, arquivo: din?.nome || '', doClientes: !proprio && !!din,
    importar, tirar: () => setProprio(null), proprio: !!proprio,
    resumo: din ? [errados.length ? [despesas.length && despesas.length + ' despesa(s) credora(s)', receitas.length && receitas.length + ' receita(s) devedora(s)'].filter(Boolean).join(' · ') : 'Ok'] : [],
    contas: errados.map(x => ({
      id: x.tipo + x.codigo + x.classificacao, codigo: x.codigo, classificacao: x.classificacao, nome: x.nome,
      tipo: x.tipo === 'despesa' ? 'Despesa credora' : 'Receita devedora',
      meses: x.meses.map(m => t.rotuloNumericoCompetencia(m.mes) + ': ' + formatos.reais(m.saldo) + (x.tipo === 'despesa' ? ' C' : ' D')).join(' · '),
    })),
  };
}
