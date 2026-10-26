// ViewModel da etapa Adiantamento salarial (Vitor, 16/10/2026: "vai ter as provisões que ficam credoras e o lançamento para
// fazer a baixa é todo dia 15, se for útil; caso não seja, é pago antes ainda"). A pessoa importa o razão da conta; a grade
// mostra, mês a mês, o descontado na folha, o pagamento (e o dia dele), o dia certo e o saldo, que tem de zerar. O que falta
// vira o .xls de importação do Alterdata (10 colunas): D Adiantamento salarial, C o banco, no dia 15 (ou no útil antes).
// O razão e as contas ficam guardados neste navegador.
import { clientes as cl, creditor, formatos, tarefas as t } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useMemo } from 'react';
import { useGuardado } from '../../../../../../comum/guardado';
import { useContabilDaEmpresa } from '../../../../../../comum/contabilDaEmpresa';
import { useChaveDaEtapa, useDadosDeTesteDaEtapa, useEtapaAberta, useRequisitosDaEtapa } from '../contexto';

const dataBR = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);

export function useAdiantamentoSalarial() {
  const s = useEtapaAberta();
  const { aviso } = useRetorno();
  const chave = useChaveDaEtapa('adiantamento-salarial');
  const [proprio, setRazao] = useGuardado<{ arquivo: string; razao: t.RazaoDaConta } | null>(chave + '|razao', null);
  // "Não houve mais movimento" (Vitor, 26/10/2026): marcado, a etapa não cobra o razão nem o zerar; clicar de novo desfaz
  const [semMovimento, setSemMovimento] = useGuardado<boolean>(chave + '|sem-mais-movimento', false);
  // o da Importação (o upload único dos razões; 16/10/2026), quando a etapa não tem o próprio
  const contabil = useContabilDaEmpresa(s.nome, s.codigo);
  const daImportacao = contabil.razaoDoTipo('adiantamento-salarial');
  const razao = useMemo(() => proprio || (daImportacao ? { arquivo: daImportacao.arquivo + ' (da Importação)', razao: daImportacao.razao } : null), [proprio, daImportacao]);
  // as contas do lançamento, da empresa (a do adiantamento vem do dinâmico do Clientes, se tiver)
  const empresa = String(s.codigo ?? s.nome);
  const [contas, setContas] = useGuardado<{ adiantamento?: string; banco?: string }>('adiantamento-salarial-contas|' + empresa, {});
  const doDinamico = useMemo(() => (contabil.dinamico ? cl.contasDeAdiantamentoSalarial(contabil.dinamico.d)[0]?.codigo || '' : ''), [contabil.dinamico]);
  const contaAdiantamento = contas.adiantamento ?? doDinamico;
  // o razão contra o balancete da empresa (Vitor, 26/10/2026: "exportou uns lançamentos nada a ver" — o razão era de outra
  // empresa, com a mesma conta): não bateu, avisa. Só avisa, não trava (26/10/2026: "não tá deixando eu importar" — o
  // balancete de antes de mexer no Alterdata também não bate com o razão novo)
  const linhaDoBalancete = useMemo(() => {
    const d = contabil.dinamico?.d;
    const conta = razao?.razao.conta || contaAdiantamento;
    return d && conta ? d.linhas.find(l => l.codigo === conta) || null : null;
  }, [contabil.dinamico, razao, contaAdiantamento]);
  const naoBate = useMemo(() => (razao && linhaDoBalancete ? t.razaoContraOBalancete(razao.razao, linhaDoBalancete.saldos, s.meses) : []), [razao, linhaDoBalancete, s.meses]);
  const saldoBR = (v: number) => formatos.brl(Math.abs(v)) + (v > 0.005 ? ' C' : v < -0.005 ? ' D' : '');
  // curto, na linha do resumo (26/10/2026: o comprido passava por cima do nome); os saldos ficam no title
  const avisoNaoBate = naoBate.length ? 'Não bate com o balancete em ' + naoBate.map(x => t.rotuloNumericoCompetencia(x.mes)).join(', ') : '';
  const detalheNaoBate = naoBate.map(x => t.rotuloNumericoCompetencia(x.mes) + ': razão ' + saldoBR(x.razao) + ', balancete ' + saldoBR(x.balancete)).join('\n');
  const contaBanco = contas.banco ?? '';
  // o ⚡ do modo desenvolvedor: o razão de teste (16/10/2026)
  useDadosDeTesteDaEtapa(s.dev ? [{ id: 'certo', rotulo: 'Razão de teste (zerando)' }, { id: 'falta', rotulo: 'Razão de teste (sem o pagamento do último mês)' }] : [],
    id => setRazao({ arquivo: 'TESTE razão do adiantamento salarial.xls', razao: t.adiantamentoSalarialDeTeste(s.meses, id === 'falta') }));

  async function importar(f: File | null) {
    if (!f) return;
    try {
      setRazao({ arquivo: f.name, razao: t.lerRazaoDoArquivo(await f.arrayBuffer(), f.name) });
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não consegui ler o razão do Adiantamento salarial', texto: e instanceof Error ? e.message : String(e) });
    }
  }

  const meses = useMemo(() => (razao ? t.conferirAdiantamentoSalarial(razao.razao, s.meses) : []), [razao, s.meses]);
  const naoZerou = meses.filter(m => Math.abs(m.saldoFinal) > 0.005);
  // o que falta pagar, também dos meses antes dos da etapa, que é de onde vem o saldo que não zera (Vitor, 26/10/2026)
  const faltando = useMemo(() => (razao && s.meses.length ? t.pagamentosQueFaltam(razao.razao, s.meses[s.meses.length - 1]) : []), [razao, s.meses]);
  const faltam = semMovimento ? [] : [
    ...(!razao ? ['Importar o razão do Adiantamento salarial'] : []),
    ...(naoZerou.length ? ['O Adiantamento salarial não zerou em ' + naoZerou.map(m => t.rotuloNumericoCompetencia(m.mes)).join(', ')] : []),
  ];
  useRequisitosDaEtapa({ pronto: !faltam.length, faltam });

  const reais = formatos.reais;
  return {
    semMovimento, alternarSemMovimento: () => setSemMovimento(x => !x),
    /** o botão aparece quando a etapa ainda cobra algo (ou já foi marcado, para desfazer) */
    mostrarSemMovimento: semMovimento || !razao || naoZerou.length > 0,
    temRazao: !!razao, arquivo: razao?.arquivo || '',
    importar, remover: () => { setRazao(null); if (!proprio && daImportacao) contabil.tirarRazao(daImportacao.conta); },
    resumo: razao ? [
      ...(avisoNaoBate ? [avisoNaoBate] : []),
      naoZerou.length ? 'Não zerou em ' + naoZerou.map(m => t.rotuloNumericoCompetencia(m.mes)).join(', ') : 'Ok',
      ...(faltando.length ? ['Falta pagar ' + reais(faltando.reduce((x, p) => x + p.valor, 0)) + ' (' + faltando.map(p => t.rotuloNumericoCompetencia(p.mes)).join(', ') + ')'] : []),
    ] : [],
    ok: !!razao && !naoZerou.length,
    meses: meses.map(m => ({
      mes: m.mes, rotulo: t.rotuloNumericoCompetencia(m.mes),
      provisao: reais(m.provisao),
      pagamento: m.pagamentos.length ? reais(m.pagamentos.reduce((x, p) => x + p.valor, 0)) : '',
      diaDoPagamento: m.pagamentos.map(p => dataBR(p.data)).join(', '),
      foraDoDia: m.pagamentos.some(p => p.data !== m.dataEsperada),
      dataEsperada: dataBR(m.dataEsperada),
      saldo: formatos.brl(Math.abs(m.saldoFinal)) + (m.saldoFinal > 0.005 ? ' C' : m.saldoFinal < -0.005 ? ' D' : ''),
      zerou: Math.abs(m.saldoFinal) <= 0.005,
      falta: m.falta > 0.005 ? reais(m.falta) : '',
    })),
    contaAdiantamento, contaBanco,
    digitarContaAdiantamento: (v: string) => setContas(c => ({ ...c, adiantamento: v.replace(/\D/g, '') })),
    digitarContaBanco: (v: string) => setContas(c => ({ ...c, banco: v.replace(/\D/g, '') })),
    qtd: faltando.length,
    podeExportar: faltando.length > 0 && !!contaAdiantamento && !!contaBanco,
    /** o resumo em vermelho: a 1ª linha é o "Não bate com o balancete" */
    resumoRuim: naoBate.length > 0,
    /** os saldos de cada mês que não bate, no title do aviso */
    detalheNaoBate: detalheNaoBate ? detalheNaoBate + '\nConfira se é o razão desta empresa (ou importe o balancete de novo, se já lançou no Alterdata).' : '',
    /** o .xls de importação do Alterdata: D Adiantamento salarial, C o banco, no dia 15 (ou no útil antes) */
    baixarXls: () => {
      const bytes = creditor.planilhaDeImportacao(faltando.map(p => ({
        automatico: '', data: dataBR(p.data), debito: contaAdiantamento, credito: contaBanco, codHistorico: '',
        historico: p.historico, valor: p.valor, documento: '', tipo: 'principal' as const, tituloId: 0,
      })));
      baixarBytes(bytes, 'adiantamento-salarial-' + s.nome.split(' ')[0] + '.xls', creditor.TIPO_XLS);
    },
  };
}
