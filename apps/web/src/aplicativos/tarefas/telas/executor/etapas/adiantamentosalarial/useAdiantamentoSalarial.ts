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
  const faltando = meses.filter(m => m.falta > 0.005);
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
    resumo: razao ? [naoZerou.length ? 'Não zerou em ' + naoZerou.map(m => t.rotuloNumericoCompetencia(m.mes)).join(', ') : 'Ok'] : [],
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
    /** o .xls de importação do Alterdata: D Adiantamento salarial, C o banco, no dia 15 (ou no útil antes) */
    baixarXls: () => {
      const bytes = creditor.planilhaDeImportacao(faltando.map(m => ({
        automatico: '', data: dataBR(m.dataEsperada), debito: contaAdiantamento, credito: contaBanco, codHistorico: '',
        historico: t.historicoDoAdiantamentoSalarial(m.mes), valor: m.falta, documento: '', tipo: 'principal' as const, tituloId: 0,
      })));
      baixarBytes(bytes, 'adiantamento-salarial-' + s.nome.split(' ')[0] + '.xls', creditor.TIPO_XLS);
    },
  };
}
