// O aviso do Resolvendo (Vitor, 26/10/2026: "coloque um botão Resolvendo e notifique o usuário que mandou o feedback"): quem
// mandou ouve os seus (a regra deixa ler os próprios); o que passou a Resolvendo aparece uma vez na barrinha de aviso do topo
// (os já avisados ficam lembrados neste navegador).
import { useRetorno } from '@nads/ui';
import { useEffect } from 'react';
import { useFeedback } from '../dados/repo';

const CHAVE = 'nads-feedbacks-avisados';

function avisados(): string[] {
  try { const v: unknown = JSON.parse(localStorage.getItem(CHAVE) || '[]'); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
}

export function useAvisoDosMeusFeedbacks() {
  const repo = useFeedback();
  const { aviso } = useRetorno();
  // a chave do Testando é outra: o mesmo pedido avisa nas duas etapas (a do Resolvendo fica como era, no id)
  const chaveDe = (f: { id: string; status: string }) => (f.status === 'testando' ? f.id + ':testando' : f.id);
  const paraAvisar = repo.meus().filter(f => f.status === 'resolvendo' || f.status === 'testando');
  const marca = paraAvisar.map(chaveDe).join(',');
  useEffect(() => {
    const ja = avisados();
    const novos = paraAvisar.filter(f => !ja.includes(chaveDe(f)));
    if (!novos.length) return;
    for (const f of novos) {
      aviso(f.status === 'testando'
        ? { tom: 'info', titulo: 'Seu pedido está pronto para testar', texto: 'Teste e confirme no suporte, no balão do canto da tela.' }
        : { tom: 'info', titulo: 'Seu feedback está sendo resolvido', texto: '"' + (f.texto.length > 90 ? f.texto.slice(0, 90) + '…' : f.texto) + '"' });
    }
    try { localStorage.setItem(CHAVE, JSON.stringify([...ja, ...novos.map(chaveDe)].slice(-200))); } catch { /* avisa de novo na próxima */ }
  // as chaves dizem tudo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marca]);
}
