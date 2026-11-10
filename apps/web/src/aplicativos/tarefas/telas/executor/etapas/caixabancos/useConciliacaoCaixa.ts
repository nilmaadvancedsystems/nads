// ViewModel da etapa Conciliação caixa (Vitor, 10/11/2026): o que saiu do caixa e também do banco, com o razão que a etapa Caixa
// usa (o importado nela ou o da Importação). Só sugere: não trava o Próximo.
import type { tarefas as t } from '@nads/core';
import { useParams } from 'react-router';
import { useContabilDaEmpresa } from '../../../../../../comum/contabilDaEmpresa';
import { useGuardado } from '../../../../../../comum/guardado';
import { useEtapaAberta, useRequisitosDaEtapa } from '../contexto';
import { useCaixaNoBancoDoRazao } from './useCaixaNoBanco';

export function useConciliacaoCaixa() {
  const s = useEtapaAberta();
  const contabil = useContabilDaEmpresa(s.nome, s.codigo);
  const { empresa: rota = '', competencia: periodo = '' } = useParams();
  const chaveDoCaixa = rota + '|caixa|' + periodo;
  const [doCaixa] = useGuardado<{ chave: string; razao: t.RazaoDaConta } | null>('razao|' + chaveDoCaixa, null);
  const razao = doCaixa && doCaixa.chave === chaveDoCaixa ? doCaixa.razao : contabil.razaoDoTipo('caixa')?.razao ?? null;
  useRequisitosDaEtapa({ pronto: true, faltam: [] });
  return useCaixaNoBancoDoRazao(s.nome, s.codigo, s.meses, razao);
}
