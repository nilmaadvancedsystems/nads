// A conta aberta no balancete da Contabilização (27/11/2026, o Vitor: "quero o relatorio de todos os lancamentos de cada conta em um
// dropdown, onde eu consigo ver as provisoes e pedir para o sistema identificar quais meses tao com pagamento e quais estao sem, e
// diretamente de la, com um botao ele ja gerar os lancamentos e pagar sem esforco"): os lançamentos da conta (os que a aba Lançamentos
// puxou do SCI), as provisões mês a mês e o botão que gera os pagamentos que faltam, pelo banco quando o extrato (a aba Extratos)
// mostra o valor, senão pelo caixa, e baixa a planilha do SCI com o lote do nads.
import { sci } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { loteParaAPlanilha } from './loteDaPlanilha';
import { lancamentosDaContabilizacao } from './RazaoDoSci';
import { extratoDaEmpresa } from './useExtratoParaSci';
import type { VmShadersCi } from './useShadersCi';

// a conta do caixa e a do banco, o histórico: escolhidos uma vez por empresa, neste navegador
const CHAVE = 'nads-minimum-pagamentos-v1|';
interface Escolhas { caixa: string; banco: string; historico: string; /** o histórico do recebimento (clientes) no fechamento */ historicoRecebimento: string }
function lerEscolhas(codigo: number | null): Partial<Escolhas> {
  try { return codigo == null ? {} : (JSON.parse(localStorage.getItem(CHAVE + codigo) || '{}') as Partial<Escolhas>); } catch { return {}; }
}

/** a analítica do disponível (01.1.1) com o nome que bate */
const doDisponivel = (b: sci.BalanceteSci, nome: RegExp) => b.contas.filter(c => c.analitica && /^0?1\.0?1\.0?1\./.test(c.classificacao) && nome.test(sci.semAcento(c.nome)));

export function useContaDoBalancete(vm: VmShadersCi, b: sci.BalanceteSci, conta: sci.ContaDoBalanceteSci) {
  const codigo = vm.empresa?.codigo ?? null;
  const { aviso, toast } = useRetorno();
  const todos = useMemo(() => lancamentosDaContabilizacao(codigo), [codigo]);
  const provisoes = useMemo(() => sci.provisoesDaConta(todos, conta.codigo, conta.classificacao), [todos, conta]);
  const lancamentos = useMemo(() => todos.filter(l => l.debito === conta.codigo || l.credito === conta.codigo).sort((x, y) => x.data.localeCompare(y.data)), [todos, conta]);
  const extrato = useMemo(() => extratoDaEmpresa(codigo), [codigo]);
  // o caixa e o banco pelo próprio balancete do SCI: a analítica "Caixa" e, se houver uma só, a do banco
  const guardadas = lerEscolhas(codigo);
  const caixaDoBalancete = doDisponivel(b, /^caixa/)[0]?.codigo || '';
  const bancosDoBalancete = doDisponivel(b, /^(?!caixa)/);
  const [caixa, setCaixa] = useState(guardadas.caixa || caixaDoBalancete);
  const [banco, setBanco] = useState(guardadas.banco || extrato?.contaDoBanco || (bancosDoBalancete.length === 1 ? bancosDoBalancete[0].codigo : ''));
  const [historico, setHistorico] = useState(guardadas.historico || '');
  const guardar = (e: Partial<Escolhas>) => {
    if (codigo == null) return;
    try { localStorage.setItem(CHAVE + codigo, JSON.stringify({ caixa, banco, historico, ...e })); } catch { /* sem espaço */ }
  };
  const nomeDa = (c: string) => (c ? b.contas.find(x => x.codigo === c && !x.participante)?.nome || '' : '');

  const abertas = useMemo(() => provisoes?.meses.flatMap(m => m.provisoes.filter(x => x.aberto > 0)) || [], [provisoes]);
  const previa = useMemo(() => (provisoes && caixa ? sci.pagamentosDasProvisoes(abertas, {
    conta: conta.codigo, lado: provisoes.lado, caixa, banco: banco || undefined, extrato: extrato?.linhas, historico,
  }) : []), [provisoes, abertas, conta, caixa, banco, extrato, historico]);
  const [gerando, setGerando] = useState(false);

  async function gerar() {
    if (!provisoes || !previa.length || codigo == null) return;
    if (!caixa) { aviso({ tom: 'info', titulo: 'Falta a conta do caixa', texto: 'Escolha o código da conta do caixa no SCI.' }); return; }
    if (!historico) { aviso({ tom: 'info', titulo: 'Falta o histórico', texto: 'Digite o número do histórico padrão do SCI do pagamento.' }); return; }
    setGerando(true);
    try {
      const plano = sci.planoComOBalancete(sci.planoDoSci(sci.planoDaConsulta(todos, vm.plano)), b);
      const lsci = sci.lancamentosDoShaderParaOSci(previa.map(p => p.lancamento), plano, vm.cnpj);
      const lote = await loteParaAPlanilha({ codigo, empresa: vm.empresa?.nome || '', lancamentos: lsci, origem: 'pagamentos da conta ' + conta.codigo, aviso });
      if (lote == null) return;
      const bytes = sci.planilhaDoSci(lsci, lote);
      baixarBytes(bytes, sci.nomeDaPlanilhaSci(vm.cnpj, sci.mesPrincipal(lsci), 'pagamentos ' + conta.codigo, lote), sci.TIPO_XLSX_SCI);
      const fora = lsci.filter(l => l.problemas.length).length;
      const pelo = (q: 'banco' | 'caixa') => previa.filter(p => p.pelo === q).length;
      if (fora) aviso({ tom: 'info', titulo: 'Planilha baixada, com ' + fora + (fora === 1 ? ' pagamento' : ' pagamentos') + ' para conferir', texto: (lote ? 'Lote ' + lote + '. ' : '') + 'Os que têm problema ficaram na aba Conferir, com o motivo.' });
      else toast('Pagamentos de ' + conta.nome + ': ' + pelo('banco') + ' pelo banco, ' + pelo('caixa') + ' pelo caixa' + (lote ? ', lote ' + lote : '') + '.');
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não consegui gerar a planilha', texto: e instanceof Error ? e.message : String(e) });
    } finally { setGerando(false); }
  }

  return {
    semLancamentos: !todos.length,
    lancamentos, provisoes,
    caixa, setCaixa: (v: string) => { setCaixa(v); guardar({ caixa: v }); }, nomeDoCaixa: nomeDa(caixa),
    banco, setBanco: (v: string) => { setBanco(v); guardar({ banco: v }); }, nomeDoBanco: nomeDa(banco),
    historico, setHistorico: (v: string) => { setHistorico(v); guardar({ historico: v }); },
    extrato, previa, gerando, gerar: () => { void gerar(); },
    /** o nome da contrapartida (pelo balancete) */
    nomeDa,
  };
}

export type ContaDoBalancete = ReturnType<typeof useContaDoBalancete>;

/**
 * O fechamento do período no balancete (27/11/2026, o Vitor: "Exportar uma planilha com tudo pago, conciliacao bancaria com o extrato
 * batendo e o que nao tem no banco jogar caixa"): as provisões abertas de todas as contas no período do balancete, pagas numa
 * planilha só; o saldo do banco depois dos pagamentos contra o saldo final do extrato; o caixa que ficaria negativo; e as linhas do
 * extrato que não pagaram nenhuma provisão.
 */
export function useFechamentoDoBalancete(vm: VmShadersCi, b: sci.BalanceteSci) {
  const codigo = vm.empresa?.codigo ?? null;
  const { aviso, toast } = useRetorno();
  const todos = useMemo(() => lancamentosDaContabilizacao(codigo), [codigo]);
  const extrato = useMemo(() => extratoDaEmpresa(codigo), [codigo]);
  const guardadas = lerEscolhas(codigo);
  const bancosDoBalancete = doDisponivel(b, /^(?!caixa)/);
  const [caixa, setCaixa] = useState(guardadas.caixa || doDisponivel(b, /^caixa/)[0]?.codigo || '');
  const [banco, setBanco] = useState(guardadas.banco || extrato?.contaDoBanco || (bancosDoBalancete.length === 1 ? bancosDoBalancete[0].codigo : ''));
  const [historicoPagamento, setHistoricoPagamento] = useState(guardadas.historico || '');
  const [historicoRecebimento, setHistoricoRecebimento] = useState(guardadas.historicoRecebimento || '');
  const guardar = (e: Partial<Escolhas>) => {
    if (codigo == null) return;
    try { localStorage.setItem(CHAVE + codigo, JSON.stringify({ caixa, banco, historico: historicoPagamento, historicoRecebimento, ...e })); } catch { /* sem espaço */ }
  };
  // o período: o do balancete, num ano só (o lote vale para a empresa num ano)
  const ate = (b.fim || '').slice(0, 7);
  const de = (b.inicio || '').slice(0, 7) < ate.slice(0, 4) + '-01' ? ate.slice(0, 4) + '-01' : (b.inicio || '').slice(0, 7);
  const contas = useMemo(() => b.contas.filter(c => c.analitica && !c.participante && c.codigo).map(c => ({ codigo: c.codigo, classificacao: c.classificacao, nome: c.nome })), [b]);
  const f = useMemo(() => (todos.length && caixa && ate ? sci.fechamentoDoPeriodo(todos, contas, {
    caixa, banco: banco || undefined, extrato: extrato?.linhas, historicoPagamento, historicoRecebimento, de, ate,
  }) : null), [todos, contas, caixa, banco, extrato, historicoPagamento, historicoRecebimento, de, ate]);
  const saldo = (cod: string) => (cod ? b.contas.find(c => c.codigo === cod && !c.participante)?.atual ?? null : null);
  const nomeDa = (c: string) => (c ? b.contas.find(x => x.codigo === c && !x.participante)?.nome || '' : '');
  const saldoDoBanco = saldo(banco);
  const saldoDoCaixa = saldo(caixa);
  const bancoDepois = saldoDoBanco != null && f ? saldoDoBanco + f.movimentoNoBanco : null;
  const caixaDepois = saldoDoCaixa != null && f ? saldoDoCaixa + f.movimentoNoCaixa : null;
  const [gerando, setGerando] = useState(false);

  async function pagarTudo() {
    if (!f || !f.pagamentos.length || codigo == null) return;
    const faltaHistorico = f.pagamentos.some(p => !p.lancamento.historico);
    if (faltaHistorico) { aviso({ tom: 'info', titulo: 'Falta o histórico', texto: 'Digite o número do histórico padrão do SCI do pagamento' + (f.pagamentos.some(p => p.provisao.debito === p.conta.codigo) ? ' e do recebimento.' : '.') }); return; }
    setGerando(true);
    try {
      const plano = sci.planoComOBalancete(sci.planoDoSci(sci.planoDaConsulta(todos, vm.plano)), b);
      const lsci = sci.lancamentosDoShaderParaOSci(f.pagamentos.map(p => p.lancamento), plano, vm.cnpj);
      const lote = await loteParaAPlanilha({ codigo, empresa: vm.empresa?.nome || '', lancamentos: lsci, origem: 'fechamento ' + de + ' a ' + ate, aviso });
      if (lote == null) return;
      baixarBytes(sci.planilhaDoSci(lsci, lote), sci.nomeDaPlanilhaSci(vm.cnpj, ate, 'fechamento', lote), sci.TIPO_XLSX_SCI);
      const fora = lsci.filter(l => l.problemas.length).length;
      const pelo = (q: 'banco' | 'caixa') => f.pagamentos.filter(p => p.pelo === q).length;
      if (fora) aviso({ tom: 'info', titulo: 'Planilha do fechamento baixada, com ' + fora + ' para conferir', texto: (lote ? 'Lote ' + lote + '. ' : '') + 'Os que têm problema ficaram na aba Conferir, com o motivo.' });
      else toast('Fechamento: ' + f.pagamentos.length + ' lançamentos (' + pelo('banco') + ' pelo banco, ' + pelo('caixa') + ' pelo caixa)' + (lote ? ', lote ' + lote : '') + '.');
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não consegui gerar a planilha', texto: e instanceof Error ? e.message : String(e) });
    } finally { setGerando(false); }
  }

  return {
    semLancamentos: !todos.length, de, ate, fechamento: f, extrato,
    caixa, setCaixa: (v: string) => { setCaixa(v); guardar({ caixa: v }); }, nomeDoCaixa: nomeDa(caixa),
    banco, setBanco: (v: string) => { setBanco(v); guardar({ banco: v }); }, nomeDoBanco: nomeDa(banco),
    historicoPagamento, setHistoricoPagamento: (v: string) => { setHistoricoPagamento(v); guardar({ historico: v }); },
    historicoRecebimento, setHistoricoRecebimento: (v: string) => { setHistoricoRecebimento(v); guardar({ historicoRecebimento: v }); },
    temRecebimento: !!f?.pagamentos.some(p => p.provisao.debito === p.conta.codigo),
    saldoDoBanco, bancoDepois, saldoDoCaixa, caixaDepois,
    /** a diferença entre o banco depois dos pagamentos e o saldo final do extrato (null = não dá para conferir) */
    diferencaNoBanco: bancoDepois != null && extrato?.saldoFinal != null ? bancoDepois - extrato.saldoFinal : null,
    gerando, pagarTudo: () => { void pagarTudo(); },
  };
}

export type FechamentoDoBalancete = ReturnType<typeof useFechamentoDoBalancete>;

