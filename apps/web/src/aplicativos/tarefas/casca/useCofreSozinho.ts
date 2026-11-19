// Liga, em toda tela do nads, a liberação sozinha do cofre para a equipe (Vitor, 19/11/2026: "Liberar sozinho"): quem já tem o
// cofre libera na hora o pedido de quem é da equipe e está ativo (dados/cofreSozinho.firestore.ts). Fora do banco e no modo
// desenvolvedor, nada.
import { useEffect, useRef } from 'react';
import { ligadoAoBanco, modoDesenvolvedor } from '../../../comum/modoDesenvolvedor';
import { liberarPedidosSozinho } from '../dados/cofreSozinho.firestore';
import { useAcesso } from '../dados/repo';
import { useSessao } from '../dados/sessao';

export function useCofreSozinho(): void {
  const sessao = useSessao();
  const equipe = useAcesso().equipe();
  const uid = sessao?.usuario?.uid || '';
  const nome = sessao?.usuario?.nome || '';
  const lista = useRef(equipe.lista);
  lista.current = equipe.lista;
  useEffect(() => {
    if (!uid || !equipe.carregada || !ligadoAoBanco() || modoDesenvolvedor()) return;
    return liberarPedidosSozinho({ uid, nome }, u => lista.current.some(p => p.uid === u && p.ativo));
  }, [uid, nome, equipe.carregada, equipe.lista.length]);
}
