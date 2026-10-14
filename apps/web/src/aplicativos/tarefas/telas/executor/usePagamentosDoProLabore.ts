// ViewModel dos pagamentos do pró-labore no checklist da Contabilização da Folha (Vitor, 14/10/2026): a pessoa importa o
// razão do Pró-labore a pagar (XLS da conciliação do Alterdata) e o nads monta os pagamentos que faltam para ele zerar —
// D Pró-labore a pagar, C a conta escolhida, H "Pagamento de pro-labore mm/aaaa SÓCIO" — e baixa o .xls de importação do
// Alterdata (as 8 colunas, as do Creditor). Fica só na tela.
import { creditor, formatos, tarefas as t } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { useContasDoBalancete } from '../../../concilia-ai/importadosNaEtapa';

/** contaDoItem: a conta do item do checklist ("60005 — Pro-labore a Pagar"), a do débito. */
export function usePagamentosDoProLabore(empresa: string, contaDoItem: string) {
  const { aviso } = useRetorno();
  const [razao, setRazao] = useState<{ arquivo: string; razao: t.RazaoDaConta } | null>(null);
  // a conta do crédito de todos e a de cada pagamento que a pessoa trocou
  const [contaGeral, setContaGeral] = useState('');
  const [porLinha, setPorLinha] = useState<Record<string, string>>({});
  // o dia do pagamento no mês da competência (Vitor, 14/10/2026); 0 = o último dia (no mês mais curto, cai no último)
  const [dia, setDia] = useState(0);
  const dataDo = (competencia: string) => {
    const ultimo = new Date(+competencia.slice(0, 4), +competencia.slice(5, 7), 0).getDate();
    return String(dia ? Math.min(dia, ultimo) : ultimo).padStart(2, '0') + '/' + competencia.slice(5, 7) + '/' + competencia.slice(0, 4);
  };
  const contas = useContasDoBalancete(empresa);
  const plano = useMemo(() => (contas || []).filter(c => !c.sintetica).map(c => ({ codigo: c.codigo, nome: c.nome })), [contas]);
  const debito = contaDoItem.split(' — ')[0].trim();
  const pagamentos = useMemo(() => (razao ? t.pagamentosDoProLabore(razao.razao) : []), [razao]);
  const contaDe = (p: t.PagamentoDoProLabore) => porLinha[p.historico] || contaGeral;
  const nomeDa = (codigo: string) => plano.find(c => c.codigo === codigo)?.nome || '';

  async function importar(f: File | null) {
    if (!f) return;
    try {
      setRazao({ arquivo: f.name, razao: t.lerRazaoDoArquivo(await f.arrayBuffer()) });
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não consegui ler o razão do pró-labore', texto: e instanceof Error ? e.message : String(e) });
    }
  }

  const faltaConta = pagamentos.filter(p => !contaDe(p)).length;
  return {
    debito, nomeDoDebito: nomeDa(debito),
    temRazao: !!razao, arquivo: razao?.arquivo || '',
    importar, remover: () => { setRazao(null); setPorLinha({}); },
    contas: plano,
    dia, escolherDia: setDia,
    contaGeral, nomeDaContaGeral: nomeDa(contaGeral), escolherContaGeral: setContaGeral,
    escolherConta: (historico: string, codigo: string) => setPorLinha(x => ({ ...x, [historico]: codigo })),
    total: formatos.reais(pagamentos.reduce((s, p) => s + p.valor, 0)),
    saldoFinal: razao ? formatos.reais(razao.razao.saldoFinal) : '',
    pagamentos: pagamentos.map(p => ({
      chave: p.historico, data: dataDo(p.competencia), competencia: p.competencia.slice(5) + '/' + p.competencia.slice(0, 4), socio: p.socio,
      valor: formatos.reais(p.valor), historico: p.historico, conta: contaDe(p), nomeDaConta: nomeDa(contaDe(p)), doSaldoAnterior: !!p.doSaldoAnterior,
    })),
    faltaConta,
    podeExportar: pagamentos.length > 0 && !faltaConta && !!debito,
    /** o .xls de importação do Alterdata: D Pró-labore a pagar, C a conta escolhida */
    baixarXls: () => {
      const bytes = creditor.planilhaDeImportacao(pagamentos.map(p => ({
        automatico: '', data: dataDo(p.competencia), debito, credito: contaDe(p), codHistorico: '', historico: p.historico, valor: p.valor,
        documento: '', tipo: 'principal' as const, tituloId: 0,
      })));
      baixarBytes(bytes, 'pagamentos-pro-labore-' + empresa.split(' ')[0] + '.xls', creditor.TIPO_XLS);
    },
  };
}

export type PagamentosDoProLabore = ReturnType<typeof usePagamentosDoProLabore>;
