// ViewModel da etapa Honorários (Vitor, 07/10/2026: "a pessoa vai importar o razão e ver se está zerando… se a empresa emite
// nota de honorário, fica no Cadastro; caso não, o usuário tem que lançar um relatoriozinho — lançamos na data de emissão e
// exporta no formato Alterdata"). O razão do Honorários a pagar (obrigatório, tem que zerar, como o Pró-labore). Sem nota
// de honorário, o Extrato por cobrança (PDF do Alterdata) vira os lançamentos das cobranças do período, no .xls de 8 colunas.
// O extrato fica só na tela (em memória), como os razões.
import { creditor, empresas, extrator, formatos, tarefas as t } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useState } from 'react';
import { useCadastro } from '../../../../dados/repo';
import { useOperador } from '../../../../casca/operador';
import { useDadosDeTesteDaEtapa, useEtapaAberta, useRequisitosDaEtapa } from '../contexto';
import { useRazaoDaFolha } from '../../useRazaoDaFolha';

extrator.definirWorkerDoPdf(workerDoPdf);

const dataBR = (iso: string) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');

export function useHonorarios() {
  const s = useEtapaAberta();
  const { aviso } = useRetorno();
  const op = useOperador().operador;
  const vivo = useCadastro(s.nome, s.codigo);
  const razao = useRazaoDaFolha('honorarios', s.nome + '|honorarios|' + s.meses.join(','), s.meses);
  const chave = s.nome + '|' + s.meses.join(',');
  const [extrato, setExtrato] = useState<{ chave: string; arquivo: string; cobrancas: t.CobrancaDeHonorario[] } | null>(null);
  const e = extrato && extrato.chave === chave ? extrato : null;
  const [lendo, setLendo] = useState(false);
  // as contas do arquivo (o que a pessoa digitou; vazio = a sugestão)
  const [contas, setContas] = useState<{ despesa?: string; aPagar?: string }>({});

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
  // as sugestões: a despesa, a contrapartida das provisões de antes no razão (ou a do plano); o a pagar, a do plano
  const plano = vivo.plano?.contas || [];
  const doPlano = (q: string) => empresas.cadastro.buscarNoPlano(plano, q, true)[0]?.codigo || '';
  const sugestaoDespesa = t.despesaDoRazao(razao.razao) || doPlano('honorarios contabeis');
  const sugestaoAPagar = doPlano('honorarios a pagar');
  const contaDespesa = contas.despesa ?? sugestaoDespesa;
  const contaAPagar = contas.aPagar ?? sugestaoAPagar;
  const contasOk = /^\d+$/.test(contaDespesa.trim()) && /^\d+$/.test(contaAPagar.trim());
  const nomeNoPlano = (codigo: string) => empresas.cadastro.contaNoPlano(vivo.plano, codigo)?.nome || '';

  const implantarExtratoDeTeste = () => setExtrato({ chave, arquivo: 'TESTE extrato por cobrança.pdf', cobrancas: t.cobrancasDeTeste(s.meses, s.codigo) });
  // o ⚡: o razão de teste (da linha) e um extrato de teste
  useDadosDeTesteDaEtapa(s.dev ? [
    ...razao.teste.map((x, i) => ({ id: 'r' + i, rotulo: x.rotulo })),
    ...(emiteNota === false ? [{ id: 'extrato', rotulo: 'Extrato por cobrança de teste' }] : []),
  ] : [], id => {
    if (id === 'extrato') implantarExtratoDeTeste();
    else razao.teste[+id.slice(1)]?.onClick();
  });

  const faltam = [
    ...(!razao.temRazao ? ['Importar o razão do Honorários a pagar'] : []),
    ...razao.sobras.map(x => 'O honorário de antes não zerou em ' + x.mes + ' (sobrou ' + x.valor + ')'),
    ...(razao.devedores.length ? ['Corrigir o saldo devedor do Honorários a pagar em ' + razao.devedores.join(', ')] : []),
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
        valor: formatos.reais(c.valor), paga: !!c.pagamento,
      })),
    } : null,
    lendo, importarExtrato, removerExtrato: () => setExtrato(null),
    /** o ⚡ da linha do extrato (modo desenvolvedor) */
    testeExtrato: s.dev ? [{ rotulo: 'Extrato por cobrança de teste', onClick: implantarExtratoDeTeste }] : [],
    contaDespesa, contaAPagar, nomeDespesa: nomeNoPlano(contaDespesa.trim()), nomeAPagar: nomeNoPlano(contaAPagar.trim()),
    mudarConta: (campo: 'despesa' | 'aPagar', v: string) => setContas(x => ({ ...x, [campo]: v })),
    podeBaixar: !!e && doPeriodo.length > 0 && contasOk,
    /** o .xls de importação do Alterdata (as 8 colunas, o mesmo do Creditor): uma provisão por cobrança, na data de emissão */
    baixar: () => {
      const linhas = t.lancamentosDosHonorarios(doPeriodo, contaDespesa, contaAPagar).map(l => ({ automatico: '', codHistorico: '', ...l }));
      const nome = 'honorarios' + (s.codigo != null ? '_' + s.codigo : '') + '_' + s.meses[0] + (s.meses.length > 1 ? '-a-' + s.meses[s.meses.length - 1] : '') + '.xls';
      baixarBytes(creditor.planilhaDeImportacao(linhas), nome, creditor.TIPO_XLS);
    },
  };
}
