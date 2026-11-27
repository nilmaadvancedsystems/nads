// O botão Vitor do SCI na Contabilização do minimum (27/11/2026: "cria um botao chamado vitor com o icone da sci, ao inves do
// alterdata, puxando o razao, puxa as colunas e coisas da sci"): pede ao robô do PC do dono os lançamentos da empresa na
// competência do SCI (MM/AAAA; 00 = o ano todo) e, quando a planilha volta, ela entra na tela como se a pessoa tivesse importado a
// "Impressão de campos da consulta". Só para o dono do robô (robosDePc), pela conta.
import { useEffect, useRef, useState } from 'react';
import { marcarPedidoFeito, semConectar, useConexaoDoRobo } from '../../dados/useConexaoDoRobo';
import { cancelarPedidoDoFiscal, ouvirLancamentosDoSci, pedirLancamentosDoSci, planilhaDoFiscal, roboDePcDoUsuario, type PedidoDoFiscal } from '../../dados/notasDoFiscal.firestore';

const ANDANDO = ['pendente', 'pendentePc', 'trabalhando'];
// os pedidos vistos andando nesta aba: só eles entram sozinhos na tela quando ficam prontos (o de ontem não entra ao abrir)
const VISTOS = new Set<string>();
const IMPORTADOS = new Set<string>();

/** "00/2026" → "2026 inteiro"; "02/2026" → "02/2026"; "00/0000" → "tudo" */
export const rotuloDaCompetenciaDoSci = (c: string) => (c === '00/0000' ? 'tudo' : c.startsWith('00/') ? c.slice(3) + ' inteiro' : c);

export function useLancamentosDoSciPeloRobo(o: { codigo: number | null; empresa: string; chegou: (f: File, competencia: string) => unknown }) {
  const doPc = roboDePcDoUsuario();
  const disponivel = !!doPc && o.codigo != null;
  const [pedidos, setPedidos] = useState<PedidoDoFiscal[]>([]);
  const [falha, setFalha] = useState('');
  // o clique: a barra já no primeiro segundo, antes de o pedido chegar ao banco
  const [pedindo, setPedindo] = useState(false);
  const [lendo, setLendo] = useState(false);
  const chegou = useRef(o.chegou);
  chegou.current = o.chegou;
  useEffect(() => {
    if (!disponivel || o.codigo == null) return;
    return ouvirLancamentosDoSci(o.codigo, setPedidos, e => setFalha(e.message));
  }, [disponivel, o.codigo]);
  const atual = pedidos.find(p => p.status !== 'cancelado') || null;
  useEffect(() => {
    if (!atual) return;
    if (ANDANDO.includes(atual.status)) { VISTOS.add(atual.id); return; }
    if (atual.status !== 'pronto' || !atual.arquivo || !VISTOS.has(atual.id) || IMPORTADOS.has(atual.id)) return;
    IMPORTADOS.add(atual.id);
    setLendo(true);
    planilhaDoFiscal(atual).then(f => Promise.resolve(chegou.current(f, atual.competencia)), e => setFalha('Não consegui baixar a planilha do robô: ' + (e instanceof Error ? e.message : String(e))))
      .finally(() => setLendo(false));
  }, [atual]);
  const andando = pedindo || (!!atual && ANDANDO.includes(atual.status));
  // 3 s sem o robô do PC conectar: cancela e o botão volta, com o erro
  const conexao = useConexaoDoRobo(atual, '');
  const erro = falha || conexao.erro || (atual?.status === 'erro' && VISTOS.has(atual.id) ? 'O robô não conseguiu puxar do SCI: ' + atual.erro : '');
  return {
    disponivel,
    rotulo: doPc?.rotulo || '',
    andando,
    lendo,
    pct: atual?.pct || 0,
    etapa: andando ? atual?.etapa || '' : '',
    conectando: pedindo || semConectar(atual),
    erro,
    /** a competência do pedido andando ou do último */
    competencia: atual?.competencia || '',
    cancelar: () => { if (atual && ANDANDO.includes(atual.status)) void cancelarPedidoDoFiscal(atual.id).catch((e: unknown) => setFalha(e instanceof Error ? e.message : String(e))); },
    pedir: async (competencia: string) => {
      if (!disponivel || o.codigo == null || andando) return;
      setFalha(''); conexao.limpar(); setPedindo(true);
      try { const id = await pedirLancamentosDoSci({ codigo: o.codigo, empresa: o.empresa, competencia }); VISTOS.add(id); marcarPedidoFeito(id); } catch (e) { setFalha(e instanceof Error ? e.message : String(e)); } finally { setPedindo(false); }
    },
  };
}

export type RoboDoSci = ReturnType<typeof useLancamentosDoSciPeloRobo>;
