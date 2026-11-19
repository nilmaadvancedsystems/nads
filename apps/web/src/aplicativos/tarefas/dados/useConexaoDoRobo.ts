// O prazo de o robô do PC atender o botão Vitor (Vitor, 19/11/2026: "no primeiro segundo, que o robo comecar a fazer a rotina, ai
// voce coloca a barra de progresso carregando, se o robo nao conectar depois de 3 segundos, ja cancela ele no nads e aparece o
// erro, deixa ele pronto para eu clicar novamente, faca isso em todos os botoes vitor"). O robô do PC marca recebidoEm no pedido
// assim que o vê (robo/alterdata.js); o pedido que esta aba acabou de fazer e que em 3 s nem foi recebido nem começou é cancelado
// aqui (numa transação: o robô que pegou no último instante segue) e o botão volta, com o erro.
import { useEffect, useRef, useState } from 'react';
import { cancelarSeNaoConectou, roboDePcDoUsuario } from './notasDoFiscal.firestore';

export const CONECTAR_MS = 3000;

// os pedidos que esta aba acabou de fazer (id → quando): só eles têm o prazo (abrir a tela depois não cancela pedido antigo)
const FEITOS = new Map<string, number>();

/** Chamar com o id do pedido que o botão Vitor acabou de criar. */
export function marcarPedidoFeito(id: string): void {
  if (roboDePcDoUsuario()) FEITOS.set(id, Date.now());
}

/** O pedido na fila e ainda sem o robô ter visto. */
export const semConectar = (p: { status: string; recebido: boolean } | null | undefined): boolean =>
  !!p && (p.status === 'pendente' || p.status === 'pendentePc') && !p.recebido;

/**
 * pedido: o atual do botão. motivo: o porquê de o robô não pegar, se já se sabe (useEsperaDoPc). Devolve o erro ('' sem erro) e o
 * limpar (o clique de novo).
 */
export function useConexaoDoRobo(pedido: { id: string; status: string; recebido: boolean } | null, motivo = '') {
  const [erro, setErro] = useState('');
  const motivoRef = useRef(motivo);
  motivoRef.current = motivo;
  const id = pedido?.id || '';
  const esperando = semConectar(pedido);
  useEffect(() => {
    if (!id) return;
    const feito = FEITOS.get(id);
    if (feito == null) return;
    if (!esperando) { FEITOS.delete(id); return; }
    const t = setTimeout(() => {
      if (!FEITOS.has(id)) return;
      FEITOS.delete(id);
      void cancelarSeNaoConectou(id).then(cancelou => {
        if (!cancelou) return;
        const rotulo = roboDePcDoUsuario()?.rotulo || '';
        const porque = motivoRef.current.replace(/[.:]\s*$/, '');
        setErro('O robô' + (rotulo ? ' do PC de ' + rotulo : '') + ' não conectou em 3 segundos' + (porque ? ' (' + porque + ')' : '') + '. Cancelei: clique de novo.');
      }, (e: unknown) => setErro('Não consegui cancelar o pedido: ' + (e instanceof Error ? e.message : String(e))));
    }, Math.max(0, CONECTAR_MS - (Date.now() - feito)));
    return () => clearTimeout(t);
  }, [id, esperando]);
  return { erro, limpar: () => setErro('') };
}
