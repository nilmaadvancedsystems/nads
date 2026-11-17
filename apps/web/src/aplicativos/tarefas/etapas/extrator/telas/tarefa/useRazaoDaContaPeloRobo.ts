// O botão Vitor do razão de cada banco na Importação (Vitor, 17/11/2026: gravou "o verdadeiro razão correto", Consultas ›
// Lançamentos do Contábil, conta a conta): pede ao robô do PC dele o razão da conta contábil do banco no período da Tarefa e,
// quando a planilha volta, ela entra na linha "Razão" como se a pessoa tivesse subido. Só para o dono do robô (robosDePc).
import { useEffect, useRef, useState } from 'react';
import { cancelarPedidoDoFiscal, ouvirRazoesDaConta, pedirRazaoDaConta, planilhaDoFiscal, roboDePcDoUsuario, type PedidoDoRazaoDaConta } from '../../../../dados/notasDoFiscal.firestore';

const ANDANDO = ['pendente', 'pendentePc', 'trabalhando'];
const VISTOS = new Set<string>();
const IMPORTADOS = new Set<string>();

export function useRazaoDaContaPeloRobo(o: { codigo: number | null; empresa: string; conta: string; meses: readonly string[]; importar: (f: File) => unknown }) {
  const doPc = roboDePcDoUsuario();
  const ordenados = [...o.meses].sort();
  const competencia = ordenados[0] || '', ate = ordenados[ordenados.length - 1] || '';
  const conta = o.conta.trim();
  const disponivel = !!doPc && !!o.codigo && !!conta && !!competencia;
  const [pedidos, setPedidos] = useState<PedidoDoRazaoDaConta[]>([]);
  const [falha, setFalha] = useState('');
  const importar = useRef(o.importar);
  importar.current = o.importar;
  useEffect(() => {
    if (!disponivel || !o.codigo) return;
    return ouvirRazoesDaConta(o.codigo, setPedidos, e => setFalha(e.message));
  }, [disponivel, o.codigo]);
  const atual = pedidos.find(p => p.conta === conta && p.competencia === competencia && p.ate === ate && p.status !== 'cancelado') || null;
  useEffect(() => {
    if (!atual) return;
    if (ANDANDO.includes(atual.status)) { VISTOS.add(atual.id); return; }
    if (atual.status !== 'pronto' || !atual.arquivo || !VISTOS.has(atual.id) || IMPORTADOS.has(atual.id)) return;
    IMPORTADOS.add(atual.id);
    planilhaDoFiscal(atual).then(f => { void importar.current(f); }, e => setFalha('Não consegui baixar o razão do robô: ' + (e instanceof Error ? e.message : String(e))));
  }, [atual]);
  const andando = !!atual && ANDANDO.includes(atual.status);
  return {
    disponivel, rotulo: doPc?.rotulo || '', andando, pct: atual?.pct || 0,
    // o Cancelar (17/11/2026): o robô para na hora e volta o Alterdata ao ponto de antes
    cancelar: () => { if (atual && andando) void cancelarPedidoDoFiscal(atual.id).catch((e: unknown) => setFalha(e instanceof Error ? e.message : String(e))); },
    // sem movimento na conta (o aviso do Alterdata): "Movimento 09/2026 não importado" (Vitor, 17/11/2026), do jeito que veio
    erro: falha || (atual?.status === 'erro' ? (/^Movimento /.test(atual.erro) ? atual.erro : 'O robô não conseguiu puxar o razão: ' + atual.erro.replace(/\s*\(tela \d+x\d+;[\s\S]*$/, '')) : ''),
    pedir: async () => {
      if (!disponivel || !o.codigo || andando) return;
      setFalha('');
      try { VISTOS.add(await pedirRazaoDaConta({ codigo: o.codigo, empresa: o.empresa, conta, competencia, ate })); } catch (e) { setFalha(e instanceof Error ? e.message : String(e)); }
    },
  };
}
