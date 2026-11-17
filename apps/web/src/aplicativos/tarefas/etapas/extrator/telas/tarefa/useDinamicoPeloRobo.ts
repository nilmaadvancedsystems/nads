// O botão Vitor do Balancete dinâmico em "Balancete e razões" (17/11/2026): pede ao robô do PC dele o Balancete Dinâmico do período
// da Tarefa numa consulta só e, quando a planilha volta, ela entra como o balancete dinâmico, como se a pessoa tivesse subido.
// Só para o dono do robô (robosDePc).
import { useEffect, useRef, useState } from 'react';
import { cancelarPedidoDoFiscal, ouvirDinamicos, pedirDinamico, planilhaDoFiscal, roboDePcDoUsuario, type PedidoDoFiscal } from '../../../../dados/notasDoFiscal.firestore';

const ANDANDO = ['pendente', 'pendentePc', 'trabalhando'];
const VISTOS = new Set<string>();
const IMPORTADOS = new Set<string>();

export function useDinamicoPeloRobo(o: { codigo: number | null; empresa: string; meses: readonly string[]; importar: (f: File) => unknown }) {
  const doPc = roboDePcDoUsuario();
  const ordenados = [...o.meses].sort();
  const competencia = ordenados[0] || '', ate = ordenados[ordenados.length - 1] || '';
  const disponivel = !!doPc && !!o.codigo && !!competencia;
  const [pedidos, setPedidos] = useState<PedidoDoFiscal[]>([]);
  const [falha, setFalha] = useState('');
  const importar = useRef(o.importar);
  importar.current = o.importar;
  useEffect(() => {
    if (!disponivel || !o.codigo) return;
    return ouvirDinamicos(o.codigo, setPedidos, e => setFalha(e.message));
  }, [disponivel, o.codigo]);
  const atual = pedidos.find(p => p.competencia === competencia && p.ate === ate && p.status !== 'cancelado') || null;
  useEffect(() => {
    if (!atual) return;
    if (ANDANDO.includes(atual.status)) { VISTOS.add(atual.id); return; }
    if (atual.status !== 'pronto' || !atual.arquivo || !VISTOS.has(atual.id) || IMPORTADOS.has(atual.id)) return;
    IMPORTADOS.add(atual.id);
    planilhaDoFiscal(atual).then(f => { void importar.current(f); }, e => setFalha('Não consegui baixar o balancete do robô: ' + (e instanceof Error ? e.message : String(e))));
  }, [atual]);
  const andando = !!atual && ANDANDO.includes(atual.status);
  return {
    disponivel, rotulo: doPc?.rotulo || '', andando, pct: atual?.pct || 0,
    // o Cancelar (17/11/2026): o robô para na hora e volta o Alterdata ao ponto de antes
    cancelar: () => { if (atual && andando) void cancelarPedidoDoFiscal(atual.id).catch((e: unknown) => setFalha(e instanceof Error ? e.message : String(e))); },
    erro: falha || (atual?.status === 'erro' ? 'O robô não conseguiu puxar o balancete: ' + atual.erro.replace(/\s*\(tela \d+x\d+;[\s\S]*$/, '') : ''),
    pedir: async () => {
      if (!disponivel || !o.codigo || andando) return;
      setFalha('');
      try { VISTOS.add(await pedirDinamico({ codigo: o.codigo, empresa: o.empresa, competencia, ate })); } catch (e) { setFalha(e instanceof Error ? e.message : String(e)); }
    },
  };
}
