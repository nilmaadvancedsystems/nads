// ViewModel da conversa de um feedback (Vitor, 16/11/2026: "preciso de um chat onde eu possa responder os feedbacks, para
// entender mais, fazendo perguntas"): as mensagens (ouvidas só enquanto a conversa está aberta), o campo e o enviar. O mesmo
// para os dois lados: o admin, na janela do feedback; quem mandou, na janela grande da conversa. As regras são do core
// (suporte: quem pode escrever, o tamanho, o resumo).
import { suporte } from '@nads/core';
import { useEffect, useState } from 'react';
import { useFeedback } from '../../dados/repo';

const hora = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export function useConversaDoFeedback(id: string, lado: suporte.LadoDaConversa, status: string, conversa: suporte.ResumoDaConversa | null) {
  const repo = useFeedback();
  const [lidas, setLidas] = useState<{ carregadas: boolean; lista: suporte.MensagemDoFeedback[] }>({ carregadas: false, lista: [] });
  // só a conversa aberta é ouvida; fechou (ou trocou de feedback), para de ouvir
  useEffect(() => (id ? repo.ouvirMensagens(id, setLidas) : undefined), [repo, id]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  // trocou de feedback: o rascunho e o erro eram do outro
  useEffect(() => { setTexto(''); setErro(''); }, [id]);
  const pode = suporte.podeEscrever(lado, status, conversa);

  async function enviar() {
    const problema = suporte.problemaDaMensagem(texto);
    if (problema) { setErro(problema); return; }
    setEnviando(true); setErro('');
    try {
      await repo.escrever(id, lado, texto);
      setTexto('');
    } catch (e) {
      setErro('Não consegui enviar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setEnviando(false);
    }
  }

  return {
    carregando: !lidas.carregadas,
    /** da mais velha para a mais nova; minha = do lado de quem está vendo (fica à direita) */
    mensagens: lidas.lista.map(m => ({ id: m.id, minha: m.de === lado, nome: m.nome || (m.de === 'admin' ? 'Suporte' : 'Quem mandou'), texto: m.texto, quando: hora(m.em) })),
    texto, setTexto: (t: string) => { setTexto(t); if (erro) setErro(''); },
    enviando, erro,
    /** dá para escrever agora (resolvido, a conversa fica só para ler; quem mandou espera o admin começar) */
    podeEscrever: pode,
    fechada: status === 'feito',
    limite: suporte.TEXTO_MAXIMO,
    enviar: () => { void enviar(); },
  };
}

export type ConversaDoFeedbackVM = ReturnType<typeof useConversaDoFeedback>;
