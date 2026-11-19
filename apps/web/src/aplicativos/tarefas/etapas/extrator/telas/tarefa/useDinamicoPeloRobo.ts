// O botão Vitor do Balancete dinâmico em "Balancete e razões" (17/11/2026): pede ao robô do PC dele o Balancete Dinâmico do período
// da Tarefa numa consulta só e, quando a planilha volta, ela entra como o balancete dinâmico, como se a pessoa tivesse subido.
// Só para o dono do robô (robosDePc).
import { useEffect, useRef, useState } from 'react';
import { useEsperaDoPc } from '../../../../dados/useEsperaDoPc';
import { marcarPedidoFeito, semConectar, useConexaoDoRobo } from '../../../../dados/useConexaoDoRobo';
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
  // o clique: a barra já no primeiro segundo, antes de o pedido chegar ao banco (19/11/2026)
  const [pedindo, setPedindo] = useState(false);
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
  const andando = pedindo || (!!atual && ANDANDO.includes(atual.status));
  const espera = useEsperaDoPc(atual);
  // 3 s sem o robô do PC conectar: cancela e o botão volta, com o erro (19/11/2026)
  const conexao = useConexaoDoRobo(atual, espera);
  return {
    disponivel, rotulo: doPc?.rotulo || '', andando, pct: atual?.pct || 0, conectando: pedindo || semConectar(atual),
    // o Cancelar (17/11/2026): o robô para na hora e volta o Alterdata ao ponto de antes
    cancelar: () => { if (atual && ANDANDO.includes(atual.status)) void cancelarPedidoDoFiscal(atual.id).catch((e: unknown) => setFalha(e instanceof Error ? e.message : String(e))); },
    erro: falha || conexao.erro || espera || (atual?.status === 'erro' ? 'O robô não conseguiu puxar o balancete: ' + atual.erro.replace(/\s*\(tela \d+x\d+;[\s\S]*$/, '') : ''),
    pedir: async () => {
      if (!disponivel || !o.codigo || andando) return;
      setFalha(''); conexao.limpar(); setPedindo(true);
      try { const id = await pedirDinamico({ codigo: o.codigo, empresa: o.empresa, competencia, ate }); VISTOS.add(id); marcarPedidoFeito(id); } catch (e) { setFalha(e instanceof Error ? e.message : String(e)); } finally { setPedindo(false); }
    },
  };
}
