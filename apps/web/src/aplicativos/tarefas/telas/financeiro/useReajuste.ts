// ViewModel da janela Reajustar honorários (22/10/2026, o item 5 da lista do Painel: "aplicar um índice em todos os
// contratos de uma vez, vendo antes como fica"): o índice em %, o arredondamento, a prévia (financeiro.previaDoReajuste)
// com os totais por mês, e o Aplicar (pergunta antes; grava o valor novo de cada contrato).
import { financeiro, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { useOperador } from '../../casca/operador';
import { useHonorarios } from '../../dados/repo';
import { valorDigitado } from './formatosDaNota';

export function useReajuste(fechar: () => void) {
  const repo = useHonorarios();
  const contratos = repo.contratos();
  const { toast, modal } = useRetorno();
  const operador = useOperador().operador?.nome || '';
  const [indice, setIndice] = useState('');
  const [arredondar, setArredondar] = useState<financeiro.ArredondamentoDoReajuste>('centavo');
  const [aplicando, setAplicando] = useState(false);
  const pct = valorDigitado(indice);
  const valido = Number.isFinite(pct) && pct > 0 && pct <= 100;
  const previa = useMemo(() => financeiro.previaDoReajuste(contratos.lista, valido ? pct : 0, arredondar), [contratos.lista, pct, valido, arredondar]);
  const somar = (k: 'atual' | 'novo') => previa.reduce((s, l) => s + Math.round(l[k] * 100), 0) / 100;
  const antes = somar('atual'), depois = somar('novo');
  return {
    indice, setIndice, valido,
    arredondar, setArredondar, arredondamentos: financeiro.ARREDONDAMENTOS,
    previa, antes, depois,
    aplicando,
    async aplicar() {
      if (!valido || !previa.length) return;
      const ok = await modal<boolean>({
        icone: 'alert', titulo: 'Reajustar ' + previa.length + (previa.length === 1 ? ' contrato?' : ' contratos?'),
        texto: `${indice}%: o honorário mensal passa de ${formatos.reais(antes)} para ${formatos.reais(depois)} no total. Os meses já recebidos não mudam.`,
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Reajustar', valor: true, variante: 'btn-primary' }],
      });
      if (!ok) return;
      setAplicando(true);
      let feitos = 0;
      try {
        for (const l of previa) { if (l.novo !== l.atual) { await repo.definirValor(l.contrato.id, l.novo, operador); feitos++; } }
        toast(feitos + (feitos === 1 ? ' contrato reajustado.' : ' contratos reajustados.'));
        fechar();
      } catch (e) {
        toast('Parei no meio: ' + feitos + ' reajustados. ' + (e instanceof Error ? e.message : ''));
      } finally { setAplicando(false); }
    },
  };
}
