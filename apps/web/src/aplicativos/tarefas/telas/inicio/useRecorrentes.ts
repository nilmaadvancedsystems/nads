// A próxima de cada tarefa recorrente concluída (Vitor, 18/11/2026: "ao criar a tarefa, colocar ela recorrente"): quem criou a
// tarefa, com o Início aberto, cria a próxima (a regra do banco só deixa criar em nome de quem está logado). Sem campo a mais na
// tarefa: a próxima já existe quando há, das que a pessoa criou, uma com o mesmo título e a âncora seguinte. Uma vez por chave.
// Para todos desde 18/11/2026.
import { tarefas } from '@nads/core';
import { useEffect, useRef } from 'react';
import { useTarefasDelegadas } from '../../dados/repo';

export function useRecorrentes() {
  const repo = useTarefasDelegadas();
  const uid = repo.eu()?.uid || '';
  const { carregadas, tarefas: lista } = repo.lista();
  const feitas = useRef(new Set<string>());
  useEffect(() => {
    if (!carregadas || !uid) return;
    const minhas = lista.filter(t => t.criadaPor.uid === uid);
    for (const t of minhas) {
      if (t.status !== 'concluida' || !t.recorrencia) continue;
      const r = tarefas.delegadas.rascunhoDaProxima(t);
      if (!r || !r.recorrencia) continue;
      const chave = t.titulo + '|' + r.recorrencia.ancora;
      if (feitas.current.has(chave)) continue;
      const jaTem = minhas.some(x => x.titulo === t.titulo && x.recorrencia?.ancora === r.recorrencia!.ancora);
      feitas.current.add(chave);
      if (jaTem) continue;
      repo.criar(r, []).catch((e: unknown) => { console.warn('[nads] não criei a próxima da recorrente', t.titulo, e instanceof Error ? e.message : e); });
    }
  }, [carregadas, uid, lista, repo]);
}
