// ViewModel de Financeiro › Honorários (19/10/2026, fase 2): a competência (começa no mês anterior: o de setembro se paga em
// outubro), o filtro (Todos, Em aberto, Pagos) e a busca, os números do mês (Previsto, Recebido, Em aberto, Clientes
// pagos), as linhas, o valor editado na linha, o Desfazer (com a pergunta) e a planilha do mês.
import { financeiro } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { useCaixa, useHonorarios } from '../../dados/repo';
import { useOperador } from '../../casca/operador';
import { hoje, valorDigitado } from './formatosDaNota';

export const FILTROS_DE_HONORARIOS: { valor: financeiro.FiltroDeHonorarios; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'abertos', rotulo: 'Em aberto' },
  { valor: 'pagos', rotulo: 'Pagos' },
];

export function useHonorariosDaCompetencia() {
  const repo = useHonorarios();
  const caixa = useCaixa();
  const { toast, modal } = useRetorno();
  const operador = useOperador().operador?.nome || '';
  const contratos = repo.contratos();
  const recebimentos = repo.recebimentos();
  const [competencia, setCompetencia] = useState(() => financeiro.competenciaAnterior(hoje()));
  const [filtro, setFiltro] = useState<financeiro.FiltroDeHonorarios>('todos');
  const [busca, setBusca] = useState('');
  /** o contrato que está sendo recebido (a janela Receber) */
  const [recebendo, setRecebendo] = useState<string | null>(null);
  const [gerenciando, setGerenciando] = useState(false);

  const valida = financeiro.competenciaValida(competencia);
  const situacao = useMemo(
    () => financeiro.situacaoDaCompetencia(contratos.lista, recebimentos.lista, valida ? competencia : '', filtro, busca),
    [contratos.lista, recebimentos.lista, competencia, valida, filtro, busca],
  );

  const falhou = (e: unknown, o: string) => toast(o + ' ' + (e instanceof Error ? e.message : ''));

  return {
    carregando: !contratos.carregada || !recebimentos.carregada,
    erro: contratos.erro || recebimentos.erro,
    exemplos: repo.exemplos,
    competencia, setCompetencia, valida, filtro, setFiltro, busca, setBusca,
    situacao,
    recebendo, receber: (id: string) => setRecebendo(id), fecharReceber: () => setRecebendo(null),
    gerenciando, setGerenciando,
    /** o valor digitado na linha: grava (0 = ainda não definido) */
    async definirValor(id: string, texto: string) {
      const v = valorDigitado(texto);
      if (!financeiro.valorDeHonorarioValido(v)) return;
      try { await repo.definirValor(id, v, operador); } catch (e) { falhou(e, 'Não consegui gravar o valor.'); }
    },
    /** Desfazer: pergunta, apaga o recebimento e, se ele criou um lançamento no Caixa, pergunta se apaga esse também */
    async desfazer(l: financeiro.LinhaDeHonorario) {
      const r = l.recebimento;
      if (!r) return;
      const ok = await modal<boolean>({
        icone: 'alert', titulo: 'Desfazer este recebimento?',
        texto: `${l.contrato.nome} · ${financeiro.competenciaBr(r.competencia)}. O honorário volta a ficar em aberto.`,
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Desfazer', valor: true, variante: 'btn-danger' }],
      });
      if (!ok) return;
      try {
        await repo.desfazer(r.contratoId, r.competencia);
        toast('Recebimento desfeito.');
      } catch (e) { falhou(e, 'Não consegui desfazer.'); return; }
      if (r.lancamentoId && caixa.lancamentos().lista.some(x => x.id === r.lancamentoId)) {
        const tambem = await modal<boolean>({
          icone: 'alert', titulo: 'Apagar o lançamento do Caixa também?',
          texto: 'Esse recebimento em dinheiro entrou no Caixa. Apagar o lançamento também muda os saldos do Caixa.',
          botoes: [{ rotulo: 'Manter no Caixa', valor: false, variante: 'btn-outline' }, { rotulo: 'Apagar do Caixa', valor: true, variante: 'btn-danger' }],
        });
        if (tambem) {
          try { await caixa.excluirLancamento(r.lancamentoId); toast('Lançamento apagado do Caixa.'); } catch (e) { falhou(e, 'Não consegui apagar do Caixa.'); }
        }
      }
    },
    /** o .xlsx do mês com o que está na tela (filtro e busca) */
    exportar() {
      baixarBytes(financeiro.planilhaDosHonorarios(competencia, situacao.linhas), financeiro.nomeDaPlanilhaDeHonorarios(competencia), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    },
  };
}
