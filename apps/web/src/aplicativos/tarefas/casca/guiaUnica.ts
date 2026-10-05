// Uma guia só por empresa (Vitor, 05/10/2026: "mesmo usuário, na mesma empresa, no mesmo app de tarefas"). A guia nova
// pergunta às outras do navegador (BroadcastChannel) se alguma já está com a mesma pessoa, empresa e departamento;
// se está, aparece a janela na nova: "Manter essa" desconecta a anterior (ela volta para a tela inicial, com um aviso)
// e o × (Cancelar) devolve a nova para a tela inicial. Só neste navegador: nada vai para o banco.
import { useRetorno } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { BASE } from './navegacao';

type Mensagem =
  | { t: 'quem'; chave: string; id: string }
  | { t: 'aqui'; chave: string; id: string; para: string }
  | { t: 'assumir'; chave: string; id: string };

const ID_DA_GUIA = Math.random().toString(36).slice(2) + Date.now().toString(36);
const CANAL = 'nads-guia-unica';

/**
 * chave: pessoa|departamento|empresa (null = não vale nesta tela). Devolve `saindo`: verdadeiro quando a guia está
 * sendo mandada para a tela inicial por isso (quem chama libera a trava de saída da etapa).
 */
export function useGuiaUnica(chave: string | null) {
  const navegar = useNavigate();
  const { modal, aviso } = useRetorno();
  const saindo = useRef(false);
  useEffect(() => {
    if (!chave || typeof BroadcastChannel === 'undefined') return;
    const canal = new BroadcastChannel(CANAL);
    let perguntando = false;
    let vivo = true;
    const sair = (texto?: string) => {
      saindo.current = true;
      navegar(BASE);
      if (texto) aviso({ tom: 'info', titulo: 'Empresa aberta em outra guia', texto });
    };
    canal.onmessage = async (e: MessageEvent<Mensagem>) => {
      const m = e.data;
      if (!m || m.chave !== chave || m.id === ID_DA_GUIA) return;
      // outra guia abriu a mesma empresa: esta avisa que está aqui
      if (m.t === 'quem') canal.postMessage({ t: 'aqui', chave, id: ID_DA_GUIA, para: m.id } satisfies Mensagem);
      // esta é a nova e já tem outra: pergunta (uma vez)
      if (m.t === 'aqui' && m.para === ID_DA_GUIA && !perguntando) {
        perguntando = true;
        const manter = await modal<boolean>({
          titulo: 'Esta empresa já está aberta em outra guia',
          texto: 'Para manter esta, a outra guia é desconectada e volta para a tela inicial.',
          botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Manter essa', valor: true, variante: 'btn-primary' }],
        });
        if (!vivo) return;
        if (manter) canal.postMessage({ t: 'assumir', chave, id: ID_DA_GUIA } satisfies Mensagem);
        else sair();
        perguntando = false;
      }
      // a outra guia ficou com a empresa: esta volta para a tela inicial
      if (m.t === 'assumir') sair('Ela foi aberta em outra guia; esta voltou para a tela inicial.');
    };
    canal.postMessage({ t: 'quem', chave, id: ID_DA_GUIA } satisfies Mensagem);
    return () => { vivo = false; canal.close(); };
  }, [chave, navegar, modal, aviso]);
  return { saindo };
}
