// ViewModel da etapa Salários e INSS como tela própria (Vitor, 07/10/2026: "faz o devedor travar o Próximo
// também"): a conferência do INSS (razão × guias, obrigatória desde 15/10/2026) e a linha de Salários a pagar, com o razão. O
// passivo fica credor ou zera: mês devedor em Salários trava o Próximo da Tarefa. O FGTS saiu daqui (10/11/2026).
import { useMemo } from 'react';
import { useContasDoBalancete } from '../../../../etapas/conferencia/importadosNaEtapa';
import { useDadosDeTesteDaEtapa, useEtapaAberta, useRequisitosDaEtapa } from '../contexto';
import { useInssDaEtapa } from '../../useInssDaEtapa';
import { useRazaoDaFolha } from '../../useRazaoDaFolha';

export function useSalarios() {
  const s = useEtapaAberta();
  const chave = s.nome + '|salarios|' + s.meses.join(',');
  // o balancete importado na Conferência: a conta do INSS a recolher e as contas para a contrapartida (só as analíticas)
  const contas = useContasDoBalancete(s.nome);
  const plano = useMemo(() => (contas || []).filter(x => !x.sintetica).map(x => ({ codigo: x.codigo, nome: x.nome })), [contas]);
  const inss = useInssDaEtapa(chave, s.meses, plano, s.nome, s.codigo);
  const salarios = useRazaoDaFolha('salarios', chave, s.meses, s.nome);
  const fgts = useRazaoDaFolha('fgts', chave, s.meses, s.nome);
  // o ⚡ de cima: o INSS (razão e guias juntos); cada linha tem o ⚡ dela
  const teste = useDadosDeTesteDaEtapa(s.dev ? [{ id: 'inss', rotulo: 'Razão e guias do INSS de teste' }] : [], () => inss.implantarTeste());
  const faltam = [
    // Salários é obrigatório e tem que zerar (Vitor, 07/10/2026)
    ...(!salarios.temRazao ? ['Importar o razão de Salários a pagar'] : []),
    // o INSS também (Vitor, 15/10/2026: "já liberou sem eu ter alimentado o INSS"): o razão e as guias pagas
    ...(!inss.temRazao ? ['Importar o razão do INSS a recolher'] : []),
    ...(!inss.temGuias ? ['Importar o PDF das guias do INSS pagas'] : []),
    ...salarios.sobras.map(x => 'A folha de antes não zerou em Salários a pagar em ' + x.mes + ' (sobrou ' + x.valor + ')'),
    ...[salarios].filter(v => v.devedores.length).map(v => 'Corrigir o saldo devedor de ' + v.nome + ' em ' + v.devedores.join(', ')),
  ];
  useRequisitosDaEtapa({ pronto: !faltam.length, faltam });
  return { inss, folha: { salarios, fgts }, teste };
}
