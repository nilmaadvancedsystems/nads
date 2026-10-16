// ViewModel da etapa Honorários (Vitor, 07/10/2026: "a pessoa vai importar o razão e ver se está zerando… se a empresa emite
// nota de honorário, fica no Cadastro; caso não, o usuário tem que lançar um relatoriozinho — lançamos na data de emissão e
// exporta no formato Alterdata"). O razão do Honorários a pagar (obrigatório, tem que zerar, como o Pró-labore). Sem nota
// de honorário, o Extrato por cobrança (PDF do Alterdata) vira os lançamentos das cobranças do período, no .xls do padrão de 10 colunas do Alterdata.
// O extrato fica só na tela (em memória), como os razões.
import { creditor, empresas, extrator, formatos, tarefas as t } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useMemo, useState } from 'react';
import { useContasDoBalancete } from '../../../../../concilia-ai/importadosNaEtapa';
import { useExtratorDaEmpresa } from '../../../../dados/extrator';
import { useCadastro } from '../../../../dados/repo';
import { useOperador } from '../../../../casca/operador';
import { useDadosDeTesteDaEtapa, useEtapaAberta, useRequisitosDaEtapa } from '../contexto';
import { useGuardado } from '../../../../../../comum/guardado';
import { useRazaoDaFolha } from '../../useRazaoDaFolha';

extrator.definirWorkerDoPdf(workerDoPdf);

const dataBR = (iso: string) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');

export function useHonorarios() {
  const s = useEtapaAberta();
  const { aviso } = useRetorno();
  const op = useOperador().operador;
  const vivo = useCadastro(s.nome, s.codigo);
  const razao = useRazaoDaFolha('honorarios', s.nome + '|honorarios|' + s.meses.join(','), s.meses, s.nome);
  const chave = s.nome + '|' + s.meses.join(',');
  // o extrato por cobrança e as contas ficam guardados (Vitor, 15/10/2026: voltou, está onde parou)
  const [extrato, setExtrato] = useGuardado<{ chave: string; arquivo: string; cobrancas: t.CobrancaDeHonorario[] } | null>('honorarios-extrato|' + chave, null);
  const e = extrato && extrato.chave === chave ? extrato : null;
  const [lendo, setLendo] = useState(false);
  // as contas do arquivo (o que a pessoa escolheu; sem = a sugestão)
  const [contas, setContas] = useGuardado<{ despesa?: string; aPagar?: string }>('honorarios-contas|' + chave, {});
  // a conta do banco de cada pagamento (pelo número da cobrança; sem = a sugestão) e se a planilha já foi baixada
  const [bancos, setBancos] = useGuardado<Record<string, string>>('honorarios-bancos|' + chave, {});
  const [baixado, setBaixado] = useGuardado('honorarios-baixado|' + chave, false);
  // o balancete importado na Conferência (as contas para escolher, com o nome) e os extratos dos bancos (o pagamento)
  const balancete = useContasDoBalancete(s.nome);
  const ext = useExtratorDaEmpresa(s.nome);
  const cadastroVivo = vivo.carregada ? vivo.cadastro : null;
  const doBanco = useMemo(() => {
    const { bancos: bs, primeiro } = extrator.bancosDaEmpresaNa(ext, cadastroVivo, s.codigo, s.meses[s.meses.length - 1] || s.competencia);
    return {
      bancos: bs,
      lancamentos: ext.arquivos.filter(a => a.lado === 'banco').flatMap(a => {
        const b = extrator.bancoDoArquivo(a, primeiro);
        return a.lancamentos.map(l => ({ data: l.data, valor: l.valor, historico: l.historico, banco: b }));
      }),
    };
  }, [ext, cadastroVivo, s.codigo, s.meses, s.competencia]);

  /** true, false ou null (não informado); só depois de o cadastro chegar */
  const emiteNota = vivo.carregada ? vivo.cadastro.emiteNotaHonorario ?? null : undefined;
  function definirEmiteNota(sim: boolean) {
    if (!vivo.carregada) return;
    const novo = empresas.cadastro.definirNotaDeHonorario(vivo.cadastro, sim, op?.nome || '', new Date());
    if (novo !== vivo.cadastro) vivo.salvar(novo);
  }

  async function importarExtrato(f: File | null) {
    if (!f) return;
    setLendo(true);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (!extrator.ehPdf(bytes)) throw new Error(f.name + ' não é PDF.');
      const todas = t.cobrancasDasLinhas(t.linhasDasPaginas(await extrator.itensDoPdf(bytes)));
      if (!todas.length) throw new Error('Nenhuma cobrança no arquivo (tem que ser o "Extrato por cobrança" do Alterdata, em PDF).');
      // de outro cliente: fica de fora, com o aviso
      const outras = todas.filter(c => c.codigoCliente != null && s.codigo != null && c.codigoCliente !== s.codigo);
      if (outras.length) aviso({ tom: 'info', titulo: 'Cobranças de outro cliente ficaram de fora', texto: outras.length + ' cobrança(s) de ' + [...new Set(outras.map(c => c.codigoCliente))].join(', ') + '.' });
      setExtrato({ chave, arquivo: f.name, cobrancas: todas.filter(c => !outras.includes(c)) });
    } catch (err) {
      aviso({ tom: 'erro', titulo: 'Não consegui ler o Extrato por cobrança', texto: err instanceof Error ? err.message : String(err) });
    } finally {
      setLendo(false);
    }
  }

  const doPeriodo = e ? t.cobrancasDoPeriodo(e.cobrancas, s.meses) : [];
  const foraDoPeriodo = e ? e.cobrancas.length - doPeriodo.length : 0;
  const semCobranca = e ? s.meses.filter(m => !doPeriodo.some(c => c.emissao.startsWith(m))) : [];
  // as contas automáticas (Vitor, 16/10/2026: "coloque as contas automaticamente"): a despesa, a contrapartida das provisões de
  // antes no razão, ou a do plano/balancete pelo nome; o a pagar, a do plano/balancete pelo nome, ou o código no nome do
  // arquivo do razão ("60006.xls")
  const plano = vivo.plano?.contas || [];
  const doBalancete = (balancete || []).filter(x => !x.sintetica).map(x => ({ codigo: x.codigo, nome: x.nome }));
  const doPlano = (q: string) => empresas.cadastro.buscarNoPlano(plano, q, true)[0]?.codigo || '';
  const peloNome = (re: RegExp) => doBalancete.find(x => re.test(formatos.normalizarTexto(x.nome)))?.codigo || '';
  const sugestaoDespesa = t.despesaDoRazao(razao.razao) || doPlano('honorarios contabeis') || peloNome(/honorarios(?! a pagar)/);
  const sugestaoAPagar = doPlano('honorarios a pagar') || peloNome(/honorarios a pagar/) || (/^(\d{3,})\b/.exec(razao.arquivo)?.[1] ?? '');
  const contaDespesa = contas.despesa ?? sugestaoDespesa;
  const contaAPagar = contas.aPagar ?? sugestaoAPagar;
  const contasOk = /^\d+$/.test(contaDespesa.trim()) && /^\d+$/.test(contaAPagar.trim());
  // as contas para escolher: as do razão, as do balancete e as do plano (o código e o nome)
  const opcoes = [...new Map([
    ...(razao.razao ? razao.razao.lancamentos.filter(l => l.contrapartida).map(l => [l.contrapartida, { codigo: l.contrapartida, nome: l.nomeContrapartida }] as const) : []),
    ...doBalancete.map(x => [x.codigo, x] as const),
    ...plano.filter(x => !x.sintetica).map(x => [x.codigo, { codigo: x.codigo, nome: x.nome }] as const),
  ]).values()];
  const nomeNoPlano = (codigo: string) => empresas.cadastro.contaNoPlano(vivo.plano, codigo)?.nome || opcoes.find(x => x.codigo === codigo)?.nome || '';

  // os pagamentos (Vitor, 16/10/2026: "se tiver pago, faça o pagamento e peça o usuário para escolher a conta"): a conta do
  // banco sugerida é a do banco em que o débito apareceu no extrato (a conta contábil dele no Cadastro); senão, a que o razão
  // já usa nos pagamentos
  const pagas = e ? t.cobrancasPagasNoPeriodo(e.cobrancas, s.meses) : [];
  const bancoDoRazao = (() => {
    const c = new Map<string, number>();
    for (const l of razao.razao?.lancamentos || []) if (l.valor < 0 && l.contrapartida) c.set(l.contrapartida, (c.get(l.contrapartida) || 0) + 1);
    return [...c].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  })();
  const sugestaoDoBanco = (c: t.CobrancaDeHonorario) => {
    const achado = t.pagamentoNoExtrato(c, doBanco.lancamentos);
    const daConta = achado ? (cadastroVivo?.bancos || []).find(b => b.id === achado.banco)?.contaContabil || '' : '';
    return { conta: daConta || bancoDoRazao, banco: achado ? doBanco.bancos.find(b => b.id === achado.banco)?.nome || achado.banco : '' };
  };
  const bancoDe = (c: t.CobrancaDeHonorario) => bancos[c.numero] ?? sugestaoDoBanco(c).conta;
  const faltaBanco = pagas.filter(c => !/^\d+$/.test(bancoDe(c).trim())).length;

  const implantarExtratoDeTeste = () => setExtrato({ chave, arquivo: 'TESTE extrato por cobrança.pdf', cobrancas: t.cobrancasDeTeste(s.meses, s.codigo) });
  // o ⚡: o razão de teste (da linha) e um extrato de teste
  useDadosDeTesteDaEtapa(s.dev ? [
    ...razao.teste.map((x, i) => ({ id: 'r' + i, rotulo: x.rotulo })),
    ...(emiteNota === false ? [{ id: 'extrato', rotulo: 'Extrato por cobrança de teste' }] : []),
  ] : [], id => {
    if (id === 'extrato') implantarExtratoDeTeste();
    else razao.teste[+id.slice(1)]?.onClick();
  });

  // baixou a planilha (Vitor, 16/10/2026: "o cara baixou a planilha, pode prosseguir"): o saldo do razão se corrige com ela
  const corrigidoPelaPlanilha = baixado && !!e;
  const faltam = [
    ...(!razao.temRazao ? ['Importar o razão do Honorários a pagar'] : []),
    ...(corrigidoPelaPlanilha ? [] : razao.sobras.map(x => 'O honorário de antes não zerou em ' + x.mes + ' (sobrou ' + x.valor + ')')),
    ...(!corrigidoPelaPlanilha && razao.devedores.length ? ['Corrigir o saldo devedor do Honorários a pagar em ' + razao.devedores.join(', ')] : []),
    ...(emiteNota === null ? ['Informar se o escritório emite nota de honorário para a empresa'] : []),
    ...(emiteNota === false && !e ? ['Importar o Extrato por cobrança (PDF do Alterdata)'] : []),
  ];
  useRequisitosDaEtapa({ pronto: emiteNota !== undefined && !faltam.length, faltam });

  return {
    dev: s.dev, razao,
    emiteNota, definirEmiteNota,
    extrato: e ? {
      arquivo: e.arquivo,
      resumo: [
        doPeriodo.length + (doPeriodo.length === 1 ? ' cobrança' : ' cobranças') + ' · ' + formatos.reais(doPeriodo.reduce((n, c) => n + c.valor, 0)),
        ...(foraDoPeriodo ? [foraDoPeriodo + ' fora do período'] : []),
        ...(semCobranca.length ? ['Sem cobrança em ' + semCobranca.map(t.rotuloNumericoCompetencia).join(', ')] : []),
      ],
      cobrancas: doPeriodo.map(c => ({
        numero: c.numero, emissao: dataBR(c.emissao), vencimento: dataBR(c.vencimento), pagamento: dataBR(c.pagamento) || 'A receber',
        valor: formatos.reais(c.valor), paga: !!c.pagamento, historico: t.historicoDaProvisaoDeHonorario(c),
      })),
      /** as pagas no período: o pagamento com a conta do banco (a pessoa escolhe) */
      pagamentos: pagas.map(c => {
        const sug = sugestaoDoBanco(c);
        return {
          numero: c.numero, data: dataBR(c.pagamento), valor: formatos.reais(c.recebido > 0 ? c.recebido : c.valor), historico: t.historicoDoPagamentoDeHonorario(c),
          conta: bancoDe(c), nomeDaConta: nomeNoPlano(bancoDe(c).trim()), noExtrato: sug.banco,
        };
      }),
    } : null,
    lendo, importarExtrato, removerExtrato: () => { setExtrato(null); setBaixado(false); },
    /** o ⚡ da linha do extrato (modo desenvolvedor) */
    testeExtrato: s.dev ? [{ rotulo: 'Extrato por cobrança de teste', onClick: implantarExtratoDeTeste }] : [],
    contaDespesa, contaAPagar, nomeDespesa: nomeNoPlano(contaDespesa.trim()), nomeAPagar: nomeNoPlano(contaAPagar.trim()),
    mudarConta: (campo: 'despesa' | 'aPagar', v: string) => setContas(x => ({ ...x, [campo]: v })),
    opcoes,
    escolherBanco: (numero: string, conta: string) => setBancos(x => ({ ...x, [numero]: conta })),
    faltaBanco,
    baixado,
    podeBaixar: !!e && (doPeriodo.length > 0 || pagas.length > 0) && contasOk && !faltaBanco,
    /** o .xls de importação do Alterdata (o padrão de 10 colunas): a provisão de cada cobrança na emissão e o pagamento das pagas */
    baixar: () => {
      const linhas = [...t.lancamentosDosHonorarios(doPeriodo, contaDespesa, contaAPagar), ...t.pagamentosDosHonorarios(pagas, contaAPagar, contaDespesa, bancoDe)]
        .sort((a, b) => a.data.split('/').reverse().join('').localeCompare(b.data.split('/').reverse().join('')))
        .map(l => ({ automatico: '', codHistorico: '', ...l }));
      const nome = 'honorarios' + (s.codigo != null ? '_' + s.codigo : '') + '_' + s.meses[0] + (s.meses.length > 1 ? '-a-' + s.meses[s.meses.length - 1] : '') + '.xls';
      baixarBytes(creditor.planilhaDeImportacao(linhas), nome, creditor.TIPO_XLS);
      setBaixado(true);
    },
  };
}
