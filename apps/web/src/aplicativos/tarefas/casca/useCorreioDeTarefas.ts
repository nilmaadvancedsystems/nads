// O correio do delegador de tarefas (28/10/2026: "vai aparecer um correio ao lado da engrenagem que vai mostrar que tem uma
// tarefa para ela"): quantas tarefas da pessoa estão em aberto (pendente ou em andamento) e o aviso, uma vez por tarefa,
// quando chega uma nova delegada por outra pessoa. As já avisadas ficam lembradas neste navegador, por pessoa; na primeira
// vez neste navegador, as que já estavam ficam como vistas (sem uma enxurrada de avisos).
import { tarefas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect } from 'react';
import { useTarefasDelegadas } from '../dados/repo';

const d = tarefas.delegadas;
const CHAVE = 'nads-tarefas-delegadas-avisadas:';

/** As já avisadas desta pessoa (null = nunca guardou neste navegador). */
function avisadas(uid: string): string[] | null {
  try {
    const v = localStorage.getItem(CHAVE + uid);
    if (v == null) return null;
    const lista: unknown = JSON.parse(v);
    return Array.isArray(lista) ? lista.map(String) : [];
  } catch { return []; }
}
function guardar(uid: string, ids: string[]) {
  try { localStorage.setItem(CHAVE + uid, JSON.stringify(ids.slice(-300))); } catch { /* avisa de novo na próxima */ }
}

const curto = (s: string) => (s.length > 80 ? s.slice(0, 80) + '…' : s);

export function useCorreioDeTarefas() {
  const repo = useTarefasDelegadas();
  const { aviso } = useRetorno();
  const uid = repo.eu()?.uid || '';
  const { carregadas, tarefas: lista } = repo.lista();
  const minhas = uid ? d.daAba(lista, 'minhas', uid) : [];
  // as que outra pessoa delegou para mim (a que eu criei para mim mesmo não precisa de aviso)
  const recebidas = minhas.filter(t => t.criadaPor.uid !== uid);
  const marca = carregadas && uid ? uid + ':' + recebidas.map(t => t.id).join(',') : '';
  useEffect(() => {
    if (!marca) return;
    const ja = avisadas(uid);
    if (ja === null) { guardar(uid, recebidas.map(t => t.id)); return; }
    const novas = recebidas.filter(t => !ja.includes(t.id));
    if (!novas.length) return;
    if (novas.length === 1) aviso({ tom: 'info', icone: 'caixaEntrada', titulo: 'Tarefa nova para você', texto: novas[0].criadaPor.nome + ' delegou: "' + curto(novas[0].titulo) + '"' });
    else aviso({ tom: 'info', icone: 'caixaEntrada', titulo: novas.length + ' tarefas novas para você', texto: 'De ' + [...new Set(novas.map(t => t.criadaPor.nome))].join(', ') + '. Abra Minhas tarefas (no Escritório) para ver.' });
    guardar(uid, [...ja, ...novas.map(t => t.id)]);
  // os ids das recebidas (e quem está) dizem tudo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marca]);
  const emAberto = minhas.length;
  return {
    emAberto,
    titulo: 'Minhas tarefas (' + emAberto + ' em aberto)',
  };
}
