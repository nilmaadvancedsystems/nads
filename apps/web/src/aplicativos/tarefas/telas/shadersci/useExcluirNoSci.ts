// Excluir no SCI pela Contabilização do minimum (27/11/2026, o Vitor: um lançamento excluído no nads sai do SCI pela chave; o lote
// inteiro também): pede ao robô do PC do dono e, quando o robô termina, tira da tela o que saiu do SCI. Um lançamento vai pela chave
// (a lixeira verde do SCI, sem senha); o lote, pela base (a lixeira vermelha: a senha de segurança quem digita é a pessoa, no SCI do
// PC). Só para o dono do robô (robosDePc), pela conta.
import { useEffect, useRef, useState } from 'react';
import { marcarPedidoFeito, semConectar, useConexaoDoRobo } from '../../dados/useConexaoDoRobo';
import { cancelarPedidoDoFiscal, ouvirExclusoesNoSci, pedirExclusaoNoSci, roboDePcDoUsuario, type PedidoDeExcluirNoSci } from '../../dados/notasDoFiscal.firestore';

const ANDANDO = ['pendente', 'pendentePc', 'trabalhando'];
// os pedidos feitos ou vistos andando nesta aba: só eles tiram lançamentos da tela quando ficam prontos
const VISTOS = new Set<string>();
const FEITOS = new Set<string>();

export function useExcluirNoSci(o: { codigo: number | null; empresa: string; saiu: (p: { lote: string; chave: string; ano: string }) => unknown }) {
  const doPc = roboDePcDoUsuario();
  const disponivel = !!doPc && o.codigo != null;
  const [pedidos, setPedidos] = useState<PedidoDeExcluirNoSci[]>([]);
  const [falha, setFalha] = useState('');
  const [pedindo, setPedindo] = useState(false);
  const saiu = useRef(o.saiu);
  saiu.current = o.saiu;
  useEffect(() => {
    if (!disponivel || o.codigo == null) return;
    return ouvirExclusoesNoSci(o.codigo, setPedidos, e => setFalha(e.message));
  }, [disponivel, o.codigo]);
  const atual = pedidos.find(p => p.status !== 'cancelado') || null;
  useEffect(() => {
    if (!atual) return;
    if (ANDANDO.includes(atual.status)) { VISTOS.add(atual.id); return; }
    if (atual.status !== 'pronto' || !VISTOS.has(atual.id) || FEITOS.has(atual.id)) return;
    FEITOS.add(atual.id);
    saiu.current({ lote: atual.lote, chave: atual.chave, ano: atual.ano });
  }, [atual]);
  const andando = pedindo || (!!atual && ANDANDO.includes(atual.status));
  const conexao = useConexaoDoRobo(atual, '');
  const erro = falha || conexao.erro || (atual?.status === 'erro' && VISTOS.has(atual.id) ? 'O robô não conseguiu excluir no SCI: ' + atual.erro : '');
  return {
    disponivel,
    rotulo: doPc?.rotulo || '',
    andando,
    pct: atual?.pct || 0,
    etapa: andando ? atual?.etapa || '' : '',
    conectando: pedindo || semConectar(atual),
    erro,
    /** o que está sendo excluído (o do pedido andando ou do último) */
    alvo: atual ? (atual.chave ? 'o lançamento ' + atual.chave : 'o lote ' + atual.lote) + (atual.ano ? ' de ' + atual.ano : '') : '',
    /** o lote inteiro: o SCI pede a senha de segurança no PC */
    doLote: !!atual && !atual.chave,
    cancelar: () => { if (atual && ANDANDO.includes(atual.status)) void cancelarPedidoDoFiscal(atual.id).catch((e: unknown) => setFalha(e instanceof Error ? e.message : String(e))); },
    /** ano: o do lote (empresa + lote + ano); '' = todos os anos */
    excluir: async (lote: string, chave: string, ano: string) => {
      if (!disponivel || o.codigo == null || andando) return;
      setFalha(''); conexao.limpar(); setPedindo(true);
      try { const id = await pedirExclusaoNoSci({ codigo: o.codigo, empresa: o.empresa, lote, chave, ano }); VISTOS.add(id); marcarPedidoFeito(id); } catch (e) { setFalha(e instanceof Error ? e.message : String(e)); } finally { setPedindo(false); }
    },
  };
}

export type ExcluirNoSci = ReturnType<typeof useExcluirNoSci>;
