// ViewModel da etapa Salários, INSS e FGTS como tela própria (Vitor, 07/10/2026: "faz o devedor travar o Próximo
// também"): a conferência do INSS (razão × guias, opcional) e as linhas de Salários a pagar e FGTS a recolher, cada uma
// com o razão. O passivo fica credor ou zera: mês devedor em Salários ou no FGTS trava o Próximo da Tarefa.
import { useMemo } from 'react';
import { useContasDoBalancete } from '../../../../../concilia-ai/importadosNaEtapa';
import { useDadosDeTesteDaEtapa, useEtapaAberta, useRequisitosDaEtapa } from '../contexto';
import { useInssDaEtapa } from '../../useInssDaEtapa';
import { useRazaoDaFolha } from '../../useRazaoDaFolha';

export function useSalarios() {
  const s = useEtapaAberta();
  const chave = s.nome + '|salarios|' + s.meses.join(',');
  // o balancete importado na Conferência: a conta do INSS a recolher e as contas para a contrapartida (só as analíticas)
  const contas = useContasDoBalancete(s.nome);
  const plano = useMemo(() => (contas || []).filter(x => !x.sintetica).map(x => ({ codigo: x.codigo, nome: x.nome })), [contas]);
  const inss = useInssDaEtapa(chave, s.meses, plano);
  const salarios = useRazaoDaFolha('salarios', chave, s.meses);
  const fgts = useRazaoDaFolha('fgts', chave, s.meses);
  // o ⚡ de cima: o INSS (razão e guias juntos); cada linha tem o ⚡ dela
  const teste = useDadosDeTesteDaEtapa(s.dev ? [{ id: 'inss', rotulo: 'Razão e guias do INSS de teste' }] : [], () => inss.implantarTeste());
  const faltam = [
    // Salários é obrigatório e tem que zerar (Vitor, 07/10/2026)
    ...(!salarios.temRazao ? ['Importar o razão de Salários a pagar'] : []),
    ...salarios.sobras.map(x => 'A folha de antes não zerou em Salários a pagar em ' + x.mes + ' (sobrou ' + x.valor + ')'),
    ...[salarios, fgts].filter(v => v.devedores.length).map(v => 'Corrigir o saldo devedor de ' + v.nome + ' em ' + v.devedores.join(', ')),
  ];
  useRequisitosDaEtapa({ pronto: !faltam.length, faltam });
  return { inss, folha: { salarios, fgts }, teste };
}
