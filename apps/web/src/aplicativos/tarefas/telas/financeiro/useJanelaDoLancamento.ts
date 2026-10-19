// ViewModel da janela do lançamento do caixa (19/10/2026): os campos (data, entrada ou saída, descrição, valor, conta,
// observações), a conferência (financeiro.conferirLancamento), gravar e excluir (com a pergunta).
import { financeiro } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useOperador } from '../../casca/operador';
import { useCaixa } from '../../dados/repo';
import { dataBr, hoje, isoDaData, valorDigitado, valorNoCampo } from './formatosDaNota';

export function useJanelaDoLancamento(id: string | undefined, valorInicial: number | undefined, fechar: () => void) {
  const repo = useCaixa();
  const { toast, modal } = useRetorno();
  const por = useOperador().operador?.nome || '';
  const existente = id ? repo.lancamentos().lista.find(l => l.id === id) : undefined;
  const [data, setData] = useState(dataBr(existente?.data || hoje()));
  const [tipo, setTipo] = useState<financeiro.TipoDeLancamento>(existente?.tipo ?? 'E');
  const [descricao, setDescricao] = useState(existente?.descricao ?? '');
  const [valor, setValor] = useState(valorNoCampo(existente?.valor ?? valorInicial ?? 0));
  const [conta, setConta] = useState(existente?.conta ?? '');
  const [observacoes, setObservacoes] = useState(existente?.observacoes ?? '');
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  // só as contas que recebem lançamento e estão ativas (e a que o lançamento já tem, mesmo se saiu de uso)
  const contas = repo.plano().lista.filter(c => (c.movimentavel && c.ativo) || c.id === existente?.conta);

  return {
    novo: !id, existente, contas,
    data, setData, tipo, setTipo, descricao, setDescricao, valor, setValor, conta, setConta, observacoes, setObservacoes,
    erros, salvando,
    async salvar() {
      const r = { id, data: isoDaData(data), descricao, valor: valorDigitado(valor), tipo, observacoes, conta: conta || undefined };
      const problemas = financeiro.conferirLancamento(r);
      setErros(problemas);
      if (problemas.length) return;
      setSalvando(true);
      try {
        await repo.salvarLancamento(r, por);
        toast(id ? 'Lançamento alterado.' : 'Lançamento incluído.');
        fechar();
      } catch (e) {
        setErros([e instanceof Error ? e.message : 'Não consegui gravar.']);
      } finally {
        setSalvando(false);
      }
    },
    async excluir() {
      if (!id) return;
      const ok = await modal<boolean>({
        icone: 'alert', titulo: 'Excluir este lançamento?',
        texto: (existente ? existente.descricao + ' · ' : '') + 'Excluir tira o lançamento do caixa e muda os saldos.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Excluir', valor: true, variante: 'btn-danger' }],
      });
      if (!ok) return;
      setSalvando(true);
      try {
        await repo.excluirLancamento(id);
        toast('Lançamento excluído.');
        fechar();
      } catch (e) {
        setErros([e instanceof Error ? e.message : 'Não consegui excluir.']);
      } finally {
        setSalvando(false);
      }
    },
  };
}
