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
  const resolvendo = repo.meus().filter(f => f.status === 'resolvendo');
  const marca = resolvendo.map(f => f.id).join(',');
  useEffect(() => {
    const ja = avisados();
    const novos = resolvendo.filter(f => !ja.includes(f.id));
    if (!novos.length) return;
    for (const f of novos) {
      aviso({ tom: 'info', titulo: 'Seu feedback está sendo resolvido', texto: '"' + (f.texto.length > 90 ? f.texto.slice(0, 90) + '…' : f.texto) + '"' });
    }
    try { localStorage.setItem(CHAVE, JSON.stringify([...ja, ...novos.map(f => f.id)].slice(-200))); } catch { /* avisa de novo na próxima */ }
  // os ids em resolvendo dizem tudo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marca]);

  // o andamento do Resolver (26/10/2026): cada passo novo que o Claude do PC do Vitor escreve aparece uma vez no topo
  const comAndamento = repo.meus().filter(f => f.andamento.length);
  const passos = comAndamento.map(f => f.id + ':' + f.andamento.length).join(',');
  useEffect(() => {
    const ja = avisados();
    const novos = comAndamento.filter(f => !ja.includes(f.id + ':' + f.andamento.length));
    if (!novos.length) return;
    for (const f of novos) aviso({ tom: f.estado === 'pronto' ? 'ok' : 'info', titulo: 'Andamento do seu pedido', texto: f.andamento[f.andamento.length - 1].texto });
    try { localStorage.setItem(CHAVE, JSON.stringify([...ja, ...novos.map(f => f.id + ':' + f.andamento.length)].slice(-300))); } catch { /* avisa de novo na próxima */ }
  // a contagem de passos de cada um diz tudo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passos]);
}
