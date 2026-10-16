// ViewModel da etapa Salários, INSS e FGTS como tela própria (Vitor, 07/10/2026: "faz o devedor travar o Próximo
// também"): a conferência do INSS (razão × guias, obrigatória desde 15/10/2026) e as linhas de Salários a pagar e FGTS a recolher, cada uma
// com o razão. O passivo fica credor ou zera: mês devedor em Salários ou no FGTS trava o Próximo da Tarefa.
import { extrator as x } from '@nads/core';
import { useMemo } from 'react';
import { useCadastro } from '../../../../dados/repo';
import { useExtratorDaEmpresa } from '../../../../dados/extrator';
import { useFgtsDaEtapa } from '../../useFgtsDaEtapa';
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
  // a conferência do FGTS (Vitor, 16/10/2026): o razão da linha do FGTS × as guias do FGTS Digital; o pagamento que não está
  // no razão vem do extrato dos bancos importados (o débito com o valor da guia perto do vencimento)
  const ext = useExtratorDaEmpresa(s.nome);
  const vivo = useCadastro(s.nome, s.codigo);
  const cadastroVivo = vivo.carregada ? vivo.cadastro : null;
  const extrato = useMemo(() => {
    const { bancos, primeiro } = x.bancosDaEmpresaNa(ext, cadastroVivo, s.codigo, s.meses[s.meses.length - 1] || s.competencia);
    const nomeDe = new Map(bancos.map(b => [b.id, b.nome]));
    return ext.arquivos.filter(a => a.lado === 'banco').flatMap(a => {
      const b = x.bancoDoArquivo(a, primeiro);
      return a.lancamentos.map(l => ({ data: l.data, valor: l.valor, historico: l.historico, banco: nomeDe.get(b) || b }));
    });
  }, [ext, cadastroVivo, s.codigo, s.meses, s.competencia]);
  const conferenciaFgts = useFgtsDaEtapa(chave, s.meses, fgts.razao, extrato, plano);
  // o ⚡ de cima: o INSS (razão e guias juntos); cada linha tem o ⚡ dela
  const teste = useDadosDeTesteDaEtapa(s.dev ? [{ id: 'inss', rotulo: 'Razão e guias do INSS de teste' }] : [], () => inss.implantarTeste());
  const faltam = [
    // Salários é obrigatório e tem que zerar (Vitor, 07/10/2026)
    ...(!salarios.temRazao ? ['Importar o razão de Salários a pagar'] : []),
    // o INSS também (Vitor, 15/10/2026: "já liberou sem eu ter alimentado o INSS"): o razão e as guias pagas
    ...(!inss.temRazao ? ['Importar o razão do INSS a recolher'] : []),
    ...(!inss.temGuias ? ['Importar o PDF das guias do INSS pagas'] : []),
    ...salarios.sobras.map(x => 'A folha de antes não zerou em Salários a pagar em ' + x.mes + ' (sobrou ' + x.valor + ')'),
    ...[salarios, fgts].filter(v => v.devedores.length).map(v => 'Corrigir o saldo devedor de ' + v.nome + ' em ' + v.devedores.join(', ')),
  ];
  useRequisitosDaEtapa({ pronto: !faltam.length, faltam });
  return { inss, folha: { salarios, fgts }, teste, conferenciaFgts };
}
