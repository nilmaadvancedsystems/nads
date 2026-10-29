// ViewModel de Financeiro › Contas a pagar (28/10/2026: "o Contas a Pagar do Toriba, no nads"): o relatório com os filtros
// (o período pelo vencimento, o fornecedor, a conta contábil, a situação e a busca), os totais do que está na lista, as
// linhas (a situação Em aberto, Vencida ou Paga sai das datas), a janela da conta (nova ou aberta, no tópico pedido) e o
// Exportar Excel com exatamente o que está na tela. O Painel abre com ?situacao=vencida: as vencidas de todas as datas.
import { financeiro } from '@nads/core';
import { baixarBytes } from '@nads/ui';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useCaixa, useContasPagar } from '../../dados/repo';
import { dataBr, hoje, isoDaData } from './formatosDaNota';
import type { TopicoDaContaAPagar } from './useJanelaDaContaAPagar';

export type PeriodoEscolhido = financeiro.PeriodoDasContas | 'outro';

export const FILTROS_DE_SITUACAO: { valor: financeiro.FiltroDeSituacao; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'aberta', rotulo: 'Em aberto' },
  { valor: 'vencida', rotulo: 'Vencidas' },
  { valor: 'paga', rotulo: 'Pagas' },
];

/** a janela da conta: sem id é nova; `topico` abre direto num tópico (o Pagar da linha abre o Pagamento) */
export interface ContaAberta { id?: string; topico?: TopicoDaContaAPagar }

export function useContasAPagar() {
  const repo = useContasPagar();
  const caixa = useCaixa();
  const contas = repo.contas();
  const fornecedores = repo.fornecedores();
  const plano = caixa.plano();
  const [params, setParams] = useSearchParams();
  const dia = hoje();
  // o link do Painel (as vencidas): todas as datas, só as vencidas; lido na abertura e tirado do endereço (senão ia junto
  // para as outras páginas)
  const doPainel = params.get('situacao') === 'vencida';
  useEffect(() => { if (params.has('situacao')) setParams({}, { replace: true }); }, [params, setParams]);
  const inicio = financeiro.periodoDasContas(doPainel ? 'tudo' : 'este-mes', dia);
  const [periodo, setPeriodo] = useState<PeriodoEscolhido>(doPainel ? 'tudo' : 'este-mes');
  const [de, setDe] = useState(dataBr(inicio.de));
  const [ate, setAte] = useState(dataBr(inicio.ate));
  const [fornecedor, setFornecedor] = useState('');
  const [conta, setConta] = useState('');
  const [situacao, setSituacao] = useState<financeiro.FiltroDeSituacao>(doPainel ? 'vencida' : 'todas');
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<ContaAberta | null>(null);

  const porId = useMemo(() => new Map(fornecedores.lista.map(f => [f.id, f])), [fornecedores.lista]);
  const contasDoPlano = useMemo(() => new Map(plano.lista.map(c => [c.id, c])), [plano.lista]);
  const nomeDe = (id: string) => financeiro.nomeDoFornecedor(porId.get(id)) || 'Fornecedor apagado';

  // 'tudo' não tem datas; nas outras, as duas precisam existir e a primeira não pode vir depois da segunda
  const deIso = periodo === 'tudo' ? '' : isoDaData(de), ateIso = periodo === 'tudo' ? '' : isoDaData(ate);
  const periodoValido = periodo === 'tudo' || (!!deIso && !!ateIso && deIso <= ateIso);
  const filtro: financeiro.FiltroDasContas = { de: deIso, ate: ateIso, fornecedor, conta, situacao, busca };
  const lista = periodoValido ? financeiro.filtrarContas(contas.lista, filtro, dia, nomeDe) : [];
  const linhas = lista.map(c => ({
    conta: c, fornecedor: nomeDe(c.fornecedorId), contaDoPlano: c.conta ? contasDoPlano.get(c.conta) : undefined, situacao: financeiro.situacaoDaConta(c, dia),
  }));
  const totais = financeiro.totaisDasContas(lista, dia);
  // as contas do plano que alguma conta a pagar usa (o menu do filtro fica curto)
  const contasUsadas = [...new Set(contas.lista.map(c => c.conta).filter((x): x is string => !!x))]
    .map(id => contasDoPlano.get(id)).filter((c): c is financeiro.ContaDoPlano => !!c).sort((a, b) => financeiro.compararCodigos(a.codigo, b.codigo));

  /** o que está filtrando, em palavras (a segunda linha da planilha) */
  const descricaoDosFiltros = () => [
    periodo === 'tudo' ? 'Vencimento: todas as datas' : `Vencimento: ${de} a ${ate}`,
    fornecedor ? 'Fornecedor: ' + nomeDe(fornecedor) : '',
    conta ? 'Conta: ' + (contasDoPlano.get(conta)?.codigo ?? '') + ' ' + (contasDoPlano.get(conta)?.descricao ?? '') : '',
    situacao !== 'todas' ? 'Situação: ' + financeiro.rotuloDaSituacao(situacao) : '',
    busca.trim() ? 'Busca: ' + busca.trim() : '',
  ].filter(Boolean).join(' · ');

  return {
    carregando: !contas.carregada || !fornecedores.carregada || !plano.carregada,
    erro: contas.erro || fornecedores.erro,
    exemplos: repo.exemplos,
    total: contas.lista.length,
    semFornecedor: fornecedores.carregada && !fornecedores.lista.length,
    periodo, de, setDe, ate, setAte, periodoValido,
    escolherPeriodo(p: PeriodoEscolhido) {
      setPeriodo(p);
      if (p === 'outro') return;
      const x = financeiro.periodoDasContas(p, dia);
      setDe(dataBr(x.de)); setAte(dataBr(x.ate));
    },
    rotuloDoPeriodo: periodo === 'outro' ? 'Período' : financeiro.PERIODOS_DAS_CONTAS.find(p => p.valor === periodo)?.rotulo ?? 'Período',
    fornecedor, setFornecedor, rotuloDoFornecedor: fornecedor ? nomeDe(fornecedor) : 'Fornecedor',
    fornecedores: fornecedores.lista,
    conta, setConta, contasUsadas, rotuloDaConta: conta ? contasDoPlano.get(conta)?.codigo + ' · ' + contasDoPlano.get(conta)?.descricao : 'Conta contábil',
    situacao, setSituacao, busca, setBusca,
    filtrando: !!fornecedor || !!conta || situacao !== 'todas' || !!busca.trim(),
    limparFiltros() { setFornecedor(''); setConta(''); setSituacao('todas'); setBusca(''); },
    linhas, totais,
    aberta, abrir: (a: ContaAberta) => setAberta(a), fechar: () => setAberta(null),
    /** o .xlsx com exatamente o que está na tela (os filtros e a busca) */
    exportar() {
      baixarBytes(financeiro.planilhaDasContas(linhas, dia, descricaoDosFiltros()), financeiro.nomeDaPlanilhaDasContas(deIso, ateIso), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    },
  };
}
