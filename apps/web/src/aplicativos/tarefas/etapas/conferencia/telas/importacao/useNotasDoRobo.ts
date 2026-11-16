// O "Pedir ao robô" das notas na Importação (Vitor, 16/11/2026: "ensinar o robo do servidor a pegar entradas, saidas e
// tomados e prestados"): pede ao robô do servidor a planilha do Alterdata Fiscal do período da Tarefa, mostra a barra dele e,
// quando a planilha volta, entrega o arquivo para a mesma importação de quem sobe à mão. Só o pedido feito ou visto andando
// nesta tela é importado sozinho (abrir a tela outro dia não reimporta o pedido antigo).
// Enquanto o robô aprende as telas do Fiscal, só no modo desenvolvedor.
import { conferencia as c } from '@nads/core';
import { useEffect, useRef, useState } from 'react';
import { modoDesenvolvedor } from '../../../../../../comum/modoDesenvolvedor';
import { cancelarPedidoDoFiscal, ouvirPedidosDoFiscal, pedirNotasDoFiscal, planilhaDoFiscal, type PedidoDoFiscal, type RelatorioDoFiscal } from '../../../../dados/notasDoFiscal.firestore';

const ANDANDO = ['pendente', 'trabalhando'];

export function useNotasDoRobo(o: { tipo: c.PaginaImportacao; codigo: number | null; empresa: string; meses?: readonly string[]; importar: (f: File) => Promise<void> }) {
  const relatorio = o.tipo === 'balancete' ? null : (o.tipo as RelatorioDoFiscal);
  const ordenados = [...(o.meses || [])].sort();
  const competencia = ordenados[0] || '';
  const ate = ordenados[ordenados.length - 1] || '';
  const disponivel = modoDesenvolvedor() && !!relatorio && !!o.codigo && !!competencia;
  const [pedidos, setPedidos] = useState<PedidoDoFiscal[] | null>(null);
  const [falha, setFalha] = useState('');
  const [pedindo, setPedindo] = useState(false);
  const [lendo, setLendo] = useState(false);
  // os pedidos que esta tela fez ou viu andando: só eles são importados quando ficam prontos (uma vez cada)
  const vistos = useRef(new Set<string>());
  const importados = useRef(new Set<string>());
  const importar = useRef(o.importar);
  importar.current = o.importar;

  useEffect(() => {
    if (!disponivel || !relatorio || !o.codigo) return;
    setPedidos(null);
    return ouvirPedidosDoFiscal(o.codigo, relatorio, l => { setPedidos(l); setFalha(''); }, e => setFalha(e.message));
  }, [disponivel, relatorio, o.codigo]);

  // o pedido deste período (o mais novo)
  const doPeriodo = (pedidos || []).filter(p => p.competencia === competencia && p.ate === ate && p.status !== 'cancelado');
  const atual = doPeriodo[0] || null;

  useEffect(() => {
    if (!atual) return;
    if (ANDANDO.includes(atual.status)) { vistos.current.add(atual.id); return; }
    if (atual.status !== 'pronto' || !atual.arquivo || !vistos.current.has(atual.id) || importados.current.has(atual.id)) return;
    importados.current.add(atual.id);
    setLendo(true);
    planilhaDoFiscal(atual).then(f => importar.current(f), e => setFalha('Não consegui baixar a planilha do robô: ' + (e instanceof Error ? e.message : String(e))))
      .finally(() => setLendo(false));
  }, [atual]);

  async function pedir() {
    if (!disponivel || !relatorio || !o.codigo || pedindo) return;
    setPedindo(true); setFalha('');
    try {
      const id = await pedirNotasDoFiscal({ codigo: o.codigo, empresa: o.empresa, relatorio, competencia, ate });
      vistos.current.add(id);
    } catch (e) {
      setFalha(e instanceof Error ? e.message : String(e));
    } finally { setPedindo(false); }
  }

  async function cancelar() {
    if (!atual || !ANDANDO.includes(atual.status)) return;
    try { await cancelarPedidoDoFiscal(atual.id); } catch (e) { setFalha(e instanceof Error ? e.message : String(e)); }
  }

  const andando = !!atual && ANDANDO.includes(atual.status);
  const situacao = !atual ? '' : atual.status === 'pendente' ? 'Na fila do robô' : atual.status === 'trabalhando' ? (atual.etapa || 'O robô está no Alterdata Fiscal')
    : atual.status === 'erro' ? 'O robô não conseguiu: ' + (atual.erro || 'sem detalhe') : '';
  return {
    disponivel, pedindo, andando, lendo, pct: atual?.pct || 0, situacao, clique: andando ? atual?.clique || '' : '',
    erro: atual?.status === 'erro' && !andando, falha, pedir, cancelar,
  };
}

export type NotasDoRobo = ReturnType<typeof useNotasDoRobo>;
