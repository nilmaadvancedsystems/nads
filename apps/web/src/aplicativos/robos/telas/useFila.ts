// O ViewModel da aba Fila: a fila do robô, ao vivo, e os clientes para o "Pedir para um cliente" (lidos só se o robô aceita).
import { useState } from 'react';
import { useClientesDaCentral, useFilaDoRobo, useResponderCaptcha } from '../dados/repo';

export function useFila(robo: string, comClientes: boolean) {
  const responder = useResponderCaptcha();
  // o captcha das certidões (27/11/2026): o que a pessoa digitou em cada pedido, e o envio
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState('');
  const [erroDoCaptcha, setErroDoCaptcha] = useState('');
  return {
    fila: useFilaDoRobo(robo), clientes: useClientesDaCentral(comClientes),
    captcha: {
      resposta: (id: string) => respostas[id] || '',
      digitar: (id: string, v: string) => setRespostas(r => ({ ...r, [id]: v })),
      enviando, erro: erroDoCaptcha,
      async enviar(id: string) {
        const v = (respostas[id] || '').trim();
        if (!v) return;
        setEnviando(id); setErroDoCaptcha('');
        try { await responder(robo, id, v); setRespostas(r => ({ ...r, [id]: '' })); }
        catch (err) { setErroDoCaptcha('Não deu para mandar a resposta: ' + (err instanceof Error ? err.message : String(err))); }
        finally { setEnviando(''); }
      },
    },
  };
}
