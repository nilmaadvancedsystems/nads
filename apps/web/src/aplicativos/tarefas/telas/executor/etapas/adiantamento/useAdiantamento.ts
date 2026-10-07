// ViewModel da etapa Adiantamento a fornecedores (Vitor, 07/10/2026): a pessoa importa o razão da conta (XLS da
// conciliação do Alterdata) e vê o saldo mês a mês, na grade dos meses como em Clientes. A conta é do ativo: "ou fica
// devedor ou zera" — mês fechando credor trava o Próximo até corrigir no Alterdata e reimportar. O razão fica só na tela.
// A mesma tela serve ao Adiantamento de clientes (Vitor, 07/10/2026: "ao contrário"): a conta é do passivo, fica credor ou
// zera, e o mês devedor é que trava.
import { demo, formatos, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useDadosDeTesteDaEtapa, useEtapaAberta, useRequisitosDaEtapa } from '../contexto';

const dataBr = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);

export function useAdiantamento(lado: t.LadoDoAdiantamento = 'fornecedores') {
  const s = useEtapaAberta();
  const { aviso } = useRetorno();
  const meses = s.meses;
  const [razao, setRazao] = useState<{ nome: string; r: t.RazaoDaConta } | null>(null);

  async function importar(f: File | undefined) {
    if (!f) return;
    try {
      const r = t.lerRazaoDoArquivo(await f.arrayBuffer());
      setRazao({ nome: f.name, r });
      aviso({ tom: 'ok', titulo: 'Razão importado', texto: f.name });
    } catch (e) { aviso({ tom: 'erro', titulo: 'Não deu para ler ' + f.name, texto: e instanceof Error ? e.message : String(e) }); }
  }

  // o ⚡ do modo desenvolvedor: um razão fictício do período (devedor/zerado, ou com um mês credor)
  const teste = useDadosDeTesteDaEtapa(meses.length && (s.dev || demo.ehEmpresaDemo(s.nome)) && !razao ? [
    { id: 'ok', rotulo: 'Razão de teste (' + (lado === 'fornecedores' ? 'devedor' : 'credor') + ' e zerando)' },
    { id: 'credor', rotulo: 'Razão de teste (com mês ' + (lado === 'fornecedores' ? 'credor' : 'devedor') + ')' },
  ] : [], id => {
    setRazao({ nome: 'razao-adiantamento-de-teste.xls', r: t.razaoDeTeste(meses, id === 'credor', lado) });
    aviso({ tom: 'ok', titulo: 'Razão de teste', texto: 'Só nesta tela: nada vai para o banco.' });
  });

  const doPeriodo = razao ? t.mesesDoRazao(razao.r, meses) : [];
  // os meses do lado errado (credor no a fornecedores, devedor no de clientes)
  const credores = t.mesesErrados(doPeriodo, lado);
  const nome = lado === 'fornecedores' ? 'adiantamento a fornecedores' : 'adiantamento de clientes';
  const errado = lado === 'fornecedores' ? 'credor' : 'devedor';
  const cobertura = razao ? t.coberturaDoRazao(razao.r, meses) : null;
  const rotulo = (m: string) => t.rotuloNumericoCompetencia(m);
  // na Tarefa: o razão importado e nenhum mês credor
  const faltam = !razao ? ['Importar o razão do ' + nome]
    : credores.length ? ['Corrigir o saldo ' + errado + ' do adiantamento em ' + credores.map(rotulo).join(', ')] : [];
  useRequisitosDaEtapa({ pronto: !faltam.length, faltam });

  return {
    lado, nome, errado,
    periodo: t.rotuloDoPeriodo([...meses]),
    razao: razao ? { nome: razao.nome, resumo: doPeriodo.reduce((n, m) => n + m.lancamentos.length, 0) + ' lançamentos · ' + t.rotuloDoPeriodo([...meses]) } : null,
    importar: (f: File | undefined) => { void importar(f); },
    tirar: () => setRazao(null),
    teste,
    /** a grade: um mês por coluna — saldo do fim (credor em vermelho) e quantos lançamentos */
    meses: doPeriodo.map(m => ({
      mes: m.mes, rotulo: rotulo(m.mes), qtd: m.lancamentos.length,
      saldo: t.valorComLado(m.saldoFinal), credor: t.saldoErrado(m.saldoFinal, lado), zerado: Math.abs(m.saldoFinal) < 0.005,
    })),
    credores: credores.map(rotulo),
    /** meses do razão fora do período: avisa (ficam de fora) */
    aMais: (cobertura?.aMais || []).map(rotulo),
    saldoAnterior: doPeriodo.length ? t.valorComLado(doPeriodo[0].saldoInicial) : '',
    lancamentos: doPeriodo.flatMap(m => m.lancamentos).map((l, i) => ({
      id: i, data: dataBr(l.data), contrapartida: l.contrapartida + (l.nomeContrapartida ? ' — ' + l.nomeContrapartida : ''), historico: l.historico,
      // negativo = débito no Alterdata; saldo positivo = credor
      debito: l.valor < 0 ? formatos.brl(-l.valor) : '', credito: l.valor > 0 ? formatos.brl(l.valor) : '',
      saldo: t.valorComLado(l.saldo), credor: t.saldoErrado(l.saldo, lado),
    })),
  };
}

export type VmAdiantamento = ReturnType<typeof useAdiantamento>;
