// ViewModel da janela "Enviar feedback" (Vitor, 07/10/2026: "a pessoa pode tirar a foto e explicar o que quer
// melhorar"): o print (tirado da tela, escolhido ou colado), o texto, a prioridade (Baixa, Média, Alta; 19/10/2026) e o
// Enviar, com a tela onde a pessoa estava e a versão. Todo mundo do nads manda (o sênior também).
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useLocation } from 'react-router';
import { VERSAO_SISTEMA } from '../../../../versao';
import type { PrioridadeDoFeedback } from '../../dados/feedback';
import { useFeedback } from '../../dados/repo';

export function useEnviarFeedback(fechar: () => void) {
  const repo = useFeedback();
  const { toast } = useRetorno();
  const { pathname } = useLocation();
  const [texto, setTexto] = useState('');
  const [imagem, setImagem] = useState('');
  const [prioridade, setPrioridade] = useState<PrioridadeDoFeedback>('media');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  return {
    texto, setTexto, imagem, setImagem, prioridade, setPrioridade, enviando, erro,
    async enviar() {
      if (!texto.trim()) { setErro('Escreva o que quer melhorar.'); return; }
      setEnviando(true);
      try {
        await repo.enviar({ texto: texto.trim().slice(0, 4000), imagem, tela: pathname, versao: VERSAO_SISTEMA, prioridade });
        toast('Feedback enviado. Obrigado!');
        fechar();
      } catch (e) {
        setErro('Não consegui enviar: ' + (e as Error).message);
      } finally {
        setEnviando(false);
      }
    },
  };
}
