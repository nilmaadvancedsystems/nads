// O botão Vitor do razão de cada banco na Importação (Vitor, 17/11/2026: gravou "o verdadeiro razão correto", Consultas ›
// Lançamentos do Contábil, conta a conta): pede ao robô do PC dele o razão da conta contábil do banco no período da Tarefa e,
// quando a planilha volta, ela entra na linha "Razão" como se a pessoa tivesse subido. Só para o dono do robô (robosDePc).
import { useEffect, useRef, useState } from 'react';
import { useEsperaDoPc } from '../../../../dados/useEsperaDoPc';
import { marcarPedidoFeito, semConectar, useConexaoDoRobo } from '../../../../dados/useConexaoDoRobo';
import { cancelarPedidoDoFiscal, ouvirRazoesDaConta, pedirRazaoDaConta, planilhaDoFiscal, roboDePcDoUsuario, type PedidoDoRazaoDaConta } from '../../../../dados/notasDoFiscal.firestore';

const ANDANDO = ['pendente', 'pendentePc', 'trabalhando'];
const VISTOS = new Set<string>();
const IMPORTADOS = new Set<string>();

/** retomar: a tela que não guarda o razão (o Pró-labore) usa o último que o robô puxou, ao abrir sem nenhum (uma vez) */
export function useRazaoDaContaPeloRobo(o: { codigo: number | null; empresa: string; conta: string; meses: readonly string[]; importar: (f: File) => unknown; retomar?: boolean }) {
  const doPc = roboDePcDoUsuario();
  const ordenados = [...o.meses].sort();
  const competencia = ordenados[0] || '', ate = ordenados[ordenados.length - 1] || '';
  const conta = o.conta.trim();
  const disponivel = !!doPc && !!o.codigo && !!conta && !!competencia;
  const [pedidos, setPedidos] = useState<PedidoDoRazaoDaConta[]>([]);
  const [falha, setFalha] = useState('');
  // o clique: a barra já no primeiro segundo, antes de o pedido chegar ao banco (19/11/2026)
  const [pedindo, setPedindo] = useState(false);
  const importar = useRef(o.importar);
  importar.current = o.importar;
  const retomar = useRef(!!o.retomar);
  retomar.current = !!o.retomar;
  useEffect(() => {
    if (!disponivel || !o.codigo) return;
    return ouvirRazoesDaConta(o.codigo, setPedidos, e => setFalha(e.message));
  }, [disponivel, o.codigo]);
  const atual = pedidos.find(p => p.conta === conta && p.competencia === competencia && p.ate === ate && p.status !== 'cancelado') || null;
  useEffect(() => {
    if (!atual) return;
    if (ANDANDO.includes(atual.status)) { VISTOS.add(atual.id); return; }
    if (atual.status !== 'pronto' || !atual.arquivo || !(VISTOS.has(atual.id) || retomar.current) || IMPORTADOS.has(atual.id)) return;
    IMPORTADOS.add(atual.id);
    planilhaDoFiscal(atual).then(f => { void importar.current(f); }, e => setFalha('Não consegui baixar o razão do robô: ' + (e instanceof Error ? e.message : String(e))));
  }, [atual]);
  const andando = pedindo || (!!atual && ANDANDO.includes(atual.status));
  const espera = useEsperaDoPc(atual);
  // 3 s sem o robô do PC conectar: cancela e o botão volta, com o erro (19/11/2026)
  const conexao = useConexaoDoRobo(atual, espera);
  return {
    disponivel, rotulo: doPc?.rotulo || '', andando, pct: atual?.pct || 0, conectando: pedindo || semConectar(atual),
    // o Cancelar (17/11/2026): o robô para na hora e volta o Alterdata ao ponto de antes
    cancelar: () => { if (atual && ANDANDO.includes(atual.status)) void cancelarPedidoDoFiscal(atual.id).catch((e: unknown) => setFalha(e instanceof Error ? e.message : String(e))); },
    // sem movimento na conta (o aviso do Alterdata): "Movimento 09/2026 não importado" (Vitor, 17/11/2026), do jeito que veio
    erro: falha || conexao.erro || espera || (atual?.status === 'erro' ? (/^Movimento /.test(atual.erro) ? atual.erro : 'O robô não conseguiu puxar o razão: ' + atual.erro.replace(/\s*\(tela \d+x\d+;[\s\S]*$/, '')) : ''),
    pedir: async () => {
      if (!disponivel || !o.codigo || andando) return;
      setFalha(''); conexao.limpar(); setPedindo(true);
      try { const id = await pedirRazaoDaConta({ codigo: o.codigo, empresa: o.empresa, conta, competencia, ate }); VISTOS.add(id); marcarPedidoFeito(id); } catch (e) { setFalha(e instanceof Error ? e.message : String(e)); } finally { setPedindo(false); }
    },
  };
}
