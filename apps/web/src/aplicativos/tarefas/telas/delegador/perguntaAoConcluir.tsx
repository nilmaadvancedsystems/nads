// A pergunta ao concluir (Vitor, 18/11/2026: "na hora que a pessoa clica em concluir, ela pode colocar uma observacao opcional...
// 'Mais algo que eu deva saber?', se a pessoa marcar nao, da concluido direto, se sim, ela pode enviar uma observacao para quem
// criou a tarefa apos clicar em concluir"). Só quando a tarefa foi criada por outra pessoa (a própria não pergunta). A
// observação vai como parecer na tarefa (quem criou vê), antes de concluir. Aqui, o campo; a pergunta, em useConcluirComPergunta.ts.
import { tarefas } from '@nads/core';
import { useState } from 'react';

const d = tarefas.delegadas;

export function CampoDaObservacao({ onMudar }: { onMudar: (v: string) => void }) {
  const [v, setV] = useState('');
  return (
    <div className="concluir-obs-caixa">
      <textarea className="concluir-obs" rows={5} autoFocus maxLength={d.MAIOR_PARECER} value={v} aria-label="A observação"
        placeholder="Ex.: faltou a nota 1234; o arquivo está na pasta do Drive; conferir o mês que vem…"
        onChange={e => { setV(e.target.value); onMudar(e.target.value); }} />
      <span className="concluir-obs-conta">{v.length}/{d.MAIOR_PARECER}</span>
    </div>
  );
}
