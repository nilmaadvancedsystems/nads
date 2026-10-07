// ViewModel das linhas Salários a pagar e FGTS a recolher na etapa da folha (Vitor, 07/10/2026: "em FGTS e Salários deixe só
// um razão para upar; se tiver tudo zerado e saldos credores, show"). A pessoa importa o razão da conta (XLS da conciliação
// do Alterdata) e vê o saldo do fim de cada mês: a conta é do passivo, fica credor ou zera; o mês devedor é o errado.
// Fica só na tela (em memória): trocou de etapa, empresa ou período, some.
import { formatos, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';

const NOME: Record<t.ContaDaFolha, string> = { salarios: 'Salários a pagar', fgts: 'FGTS a recolher', prolabore: 'Pró-labore a pagar' };

export function useRazaoDaFolha(conta: t.ContaDaFolha, chave: string, meses: readonly string[]) {
  const { aviso } = useRetorno();
  const [razao, setRazao] = useState<{ chave: string; arquivo: string; razao: t.RazaoDaConta } | null>(null);
  const r = razao && razao.chave === chave ? razao : null;

  async function importar(f: File | null) {
    if (!f) return;
    try {
      setRazao({ chave, arquivo: f.name, razao: t.lerRazaoDoArquivo(await f.arrayBuffer()) });
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não consegui ler o razão de ' + NOME[conta], texto: e instanceof Error ? e.message : String(e) });
    }
  }

  const doPeriodo = r ? t.mesesDoRazao(r.razao, meses) : [];
  // o passivo fica credor ou zera: o errado é o devedor (a mesma regra do Adiantamento de clientes)
  const devedores = t.mesesErrados(doPeriodo, 'clientes');
  // Salários tem que zerar (Vitor, 07/10/2026): a folha de antes paga no mês; a sobra trava
  const sobras = t.CONTAS_QUE_ZERAM.includes(conta) ? t.sobrasDaFolha(doPeriodo) : [];
  return {
    conta, nome: NOME[conta],
    temRazao: !!r, arquivo: r?.arquivo || '',
    importar, remover: () => setRazao(null),
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
    ok: !!r && !devedores.length && !sobras.length,
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
