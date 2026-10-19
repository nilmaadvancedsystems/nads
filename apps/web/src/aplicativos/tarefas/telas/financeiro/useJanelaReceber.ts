// ViewModel da janela Receber (19/10/2026, Honorários): o valor (do contrato), a data (hoje), a forma e as observações.
// Ao gravar escreve o recebimento; se a forma é dinheiro, cria também o lançamento de entrada no Caixa ("HC NOME MM/AAAA", na
// conta 4.1.01 se existir) e guarda o id dele no recebimento. Se o recebimento falhar, tira o lançamento que acabou de criar.
import { financeiro } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useOperador } from '../../casca/operador';
import { useCaixa, useHonorarios } from '../../dados/repo';
import { dataBr, hoje, isoDaData, valorDigitado, valorNoCampo } from './formatosDaNota';

/** a conta do plano onde entram os honorários recebidos em dinheiro */
export const CONTA_DOS_HONORARIOS = '4.1.01';

export function useJanelaReceber(contratoId: string, competencia: string, fechar: () => void) {
  const repo = useHonorarios();
  const caixa = useCaixa();
  const { toast } = useRetorno();
  const operador = useOperador().operador?.nome || '';
  const contrato = repo.contratos().lista.find(c => c.id === contratoId);
  const [valor, setValor] = useState(valorNoCampo(contrato?.valor ?? 0));
  const [data, setData] = useState(dataBr(hoje()));
  const [forma, setForma] = useState<financeiro.FormaDeRecebimento>('pix');
  const [observacoes, setObservacoes] = useState('');
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const conta = caixa.plano().lista.find(c => c.codigo === CONTA_DOS_HONORARIOS);

  return {
    contrato, valor, setValor, data, setData, forma, setForma, observacoes, setObservacoes, erros, salvando,
    /** o aviso de que vai entrar no Caixa */
    vaiParaOCaixa: forma === 'dinheiro',
    async salvar() {
      if (!contrato) return;
      const r = { competencia, valor: valorDigitado(valor), recebidoEm: isoDaData(data), forma };
      const problemas = financeiro.conferirRecebimento(r);
      setErros(problemas);
      if (problemas.length) return;
      setSalvando(true);
      let lancamentoId: string | undefined;
      try {
        if (forma === 'dinheiro') {
          lancamentoId = await caixa.salvarLancamento({
            data: r.recebidoEm, descricao: financeiro.descricaoDoRecebimento(contrato.nome, competencia), valor: r.valor, tipo: 'E',
            conta: conta?.id, observacoes: observacoes.trim() || undefined,
          }, operador);
        }
        await repo.receber({ contratoId, ...r, lancamentoId, observacoes }, operador);
        toast('Recebimento registrado' + (lancamentoId ? ' e lançado no Caixa.' : '.'));
        fechar();
      } catch (e) {
        if (lancamentoId) await caixa.excluirLancamento(lancamentoId).catch(() => undefined);
        setErros([e instanceof Error ? e.message : 'Não consegui gravar.']);
      } finally {
        setSalvando(false);
      }
    },
  };
}
