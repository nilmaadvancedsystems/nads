// ViewModel dos pagamentos do pró-labore no checklist da Contabilização da Folha (Vitor, 14/10/2026): a pessoa importa o
// razão do Pró-labore a pagar (XLS da conciliação do Alterdata) e o nads monta os pagamentos que faltam para ele zerar —
// D Pró-labore a pagar, C a conta escolhida, H "Pagamento de pro-labore mm/aaaa SÓCIO" — e baixa o .xls de importação do
// Alterdata (o padrão de 10 colunas do Alterdata). Fica só na tela.
import { creditor, formatos, tarefas as t } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { useContasDoBalancete } from '../../../concilia-ai/importadosNaEtapa';

/** contaDoItem: a conta do item do checklist ("60005 — Pro-labore a Pagar"), a do débito. */
export function usePagamentosDoProLabore(empresa: string, contaDoItem: string) {
  const { aviso } = useRetorno();
  const [razao, setRazao] = useState<{ arquivo: string; razao: t.RazaoDaConta } | null>(null);
  // só a conta do crédito e o dia útil do pagamento (Vitor, 14/10/2026: "não precisa apresentar, só pedir a conta e se vai
  // ser no 1, 2, 3, 4 ou 5 dia útil de cada mês"); a lista do razão não aparece
  const [conta, setConta] = useState('');
  const [diaUtil, setDiaUtil] = useState(5);
  const contas = useContasDoBalancete(empresa);
  const plano = useMemo(() => (contas || []).filter(c => !c.sintetica).map(c => ({ codigo: c.codigo, nome: c.nome })), [contas]);
  const debito = contaDoItem.split(' — ')[0].trim();
  const pagamentos = useMemo(() => (razao ? t.pagamentosDoProLabore(razao.razao) : []), [razao]);

  async function importar(f: File | null) {
    if (!f) return;
    try {
      setRazao({ arquivo: f.name, razao: t.lerRazaoDoArquivo(await f.arrayBuffer()) });
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não consegui ler o razão do pró-labore', texto: e instanceof Error ? e.message : String(e) });
    }
  }

  return {
    temRazao: !!razao, arquivo: razao?.arquivo || '',
    importar, remover: () => setRazao(null),
    contas: plano, conta, escolherConta: setConta,
    diaUtil, escolherDiaUtil: setDiaUtil,
    /** quantos pagamentos faltam para o razão zerar e o total (só no título do botão) */
    qtd: pagamentos.length, total: formatos.reais(pagamentos.reduce((s, p) => s + p.valor, 0)),
    podeExportar: pagamentos.length > 0 && !!conta && !!debito,
    /** o .xls de importação do Alterdata: D Pró-labore a pagar, C a conta escolhida, no dia útil escolhido do mês seguinte */
    baixarXls: () => {
      const bytes = creditor.planilhaDeImportacao(pagamentos.map(p => ({
        automatico: '', data: t.dataDoPagamentoDoProLabore(p.competencia, diaUtil), debito, credito: conta, codHistorico: '', historico: p.historico, valor: p.valor,
        documento: '', tipo: 'principal' as const, tituloId: 0,
      })));
      baixarBytes(bytes, 'pagamentos-pro-labore-' + empresa.split(' ')[0] + '.xls', creditor.TIPO_XLS);
    },
  };
}

export type PagamentosDoProLabore = ReturnType<typeof usePagamentosDoProLabore>;
