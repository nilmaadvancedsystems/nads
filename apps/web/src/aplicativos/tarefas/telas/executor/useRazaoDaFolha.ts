// ViewModel das linhas Salários a pagar e FGTS a recolher na etapa da folha (Vitor, 07/10/2026: "em FGTS e Salários deixe só
// um razão para upar; se tiver tudo zerado e saldos credores, show"). A pessoa importa o razão da conta (XLS da conciliação
// do Alterdata) e vê o saldo do fim de cada mês: a conta é do passivo, fica credor ou zera; o mês devedor é o errado.
// O que foi importado fica guardado neste navegador (Vitor, 15/10/2026: voltou, está onde parou; comum/guardado.ts).
import { formatos, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useGuardado } from '../../../../comum/guardado';
import { useContabilDaEmpresa } from '../../../../comum/contabilDaEmpresa';

const NOME: Record<t.ContaDaFolha, string> = { salarios: 'Salários a pagar', fgts: 'FGTS a recolher', prolabore: 'Pró-labore a pagar', honorarios: 'Honorários a pagar', simples: 'Simples Nacional a recolher' };

/** empresa: o nome (o razão importado na Importação, quando a etapa não tem o próprio; 16/10/2026) */
/** soImportar: o razão importado basta, sem cobrar o zerar nem o devedor (Vitor, 26/10/2026, Honorários: "deixa só importado,
 * às vezes o cliente não paga") */
export function useRazaoDaFolha(conta: t.ContaDaFolha, chave: string, meses: readonly string[], empresa = '', soImportar = false) {
  const { aviso } = useRetorno();
  const [razao, setRazao] = useGuardado<{ chave: string; arquivo: string; razao: t.RazaoDaConta } | null>('folha|' + conta + '|' + chave, null);
  // o da Importação (o upload único dos razões), pela conta reconhecida no dinâmico
  const contabil = useContabilDaEmpresa(empresa);
  const daImportacao = empresa ? contabil.razaoDoTipo(conta) : null;
  const proprio = razao && razao.chave === chave ? razao : null;
  const r = proprio || (daImportacao ? { chave, arquivo: daImportacao.arquivo + ' (da Importação)', razao: daImportacao.razao } : null);

  async function importar(f: File | null) {
    if (!f) return;
    try {
      setRazao({ chave, arquivo: f.name, razao: t.lerRazaoDoArquivo(await f.arrayBuffer(), f.name) });
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não consegui ler o razão de ' + NOME[conta], texto: e instanceof Error ? e.message : String(e) });
    }
  }

  const doPeriodo = r ? t.mesesDoRazao(r.razao, meses) : [];
  // o passivo fica credor ou zera: o errado é o devedor (a mesma regra do Adiantamento de clientes)
  const devedores = t.mesesErrados(doPeriodo, 'clientes');
  // Salários tem que zerar (Vitor, 07/10/2026): a folha de antes paga no mês; a sobra trava
  const sobras = t.CONTAS_QUE_ZERAM.includes(conta) && !soImportar ? t.sobrasDaFolha(doPeriodo) : [];
  return {
    conta, nome: NOME[conta],
    temRazao: !!r, arquivo: r?.arquivo || '',
    /** o razão importado (o Honorários tira dele a conta de despesa das provisões de antes) */
    razao: r?.razao ?? null,
    importar, remover: () => { setRazao(null); if (!proprio && daImportacao) contabil.tirarRazao(daImportacao.conta); },
    /** o ⚡: um razão de teste do período, certo ou com um mês devedor */
    teste: [
      { rotulo: NOME[conta] + ' de teste (credor e zerando)', onClick: () => setRazao({ chave, arquivo: 'TESTE razão de ' + NOME[conta] + '.xls', razao: t.razaoDaFolhaDeTeste(meses, conta, false) }) },
      { rotulo: NOME[conta] + ' de teste (com mês devedor)', onClick: () => setRazao({ chave, arquivo: 'TESTE razão de ' + NOME[conta] + '.xls', razao: t.razaoDaFolhaDeTeste(meses, conta, 'devedor') }) },
      ...(t.CONTAS_QUE_ZERAM.includes(conta) ? [{ rotulo: NOME[conta] + ' de teste (não zerou)', onClick: () => setRazao({ chave, arquivo: 'TESTE razão de ' + NOME[conta] + '.xls', razao: t.razaoDaFolhaDeTeste(meses, conta, 'sobra') }) }] : []),
    ],
    resumo: r ? [
      doPeriodo.reduce((n, m) => n + m.lancamentos.length, 0) + ' lançamentos',
      ...(devedores.length ? ['Devedor em ' + devedores.map(t.rotuloNumericoCompetencia).join(', ')] : []),
      ...(sobras.length ? ['Não zerou em ' + sobras.map(x => t.rotuloNumericoCompetencia(x.mes)).join(', ')] : []),
      ...(!devedores.length && !sobras.length ? ['Ok'] : []),
    ] : [],
    ok: !!r && (soImportar || (!devedores.length && !sobras.length)),
    /** o razão é obrigatório (Salários) */
    obrigatorio: t.CONTAS_QUE_ZERAM.includes(conta),
    devedores: devedores.map(t.rotuloNumericoCompetencia),
    /** os meses em que a folha de antes não foi paga toda: o mês e quanto sobrou */
    sobras: sobras.map(x => ({ mes: t.rotuloNumericoCompetencia(x.mes), valor: formatos.reais(x.sobra) })),
    /** a grade: o saldo do fim de cada mês, sem D/C — o certo (credor ou zero) em branco, o devedor em azul */
    meses: doPeriodo.map(m => ({
      mes: m.mes, rotulo: t.rotuloNumericoCompetencia(m.mes), qtd: m.lancamentos.length,
      saldo: formatos.brl(Math.abs(m.saldoFinal)), errado: t.saldoErrado(m.saldoFinal, 'clientes'),
      sobra: sobras.some(x => x.mes === m.mes),
    })),
  };
}

export type RazaoDaFolha = ReturnType<typeof useRazaoDaFolha>;
