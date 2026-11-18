// A pergunta ao concluir (Vitor, 18/11/2026: "na hora que a pessoa clica em concluir, ela pode colocar uma observacao opcional...
// 'Mais algo que eu deva saber?', se a pessoa marcar nao, da concluido direto, se sim, ela pode enviar uma observacao para quem
// criou a tarefa apos clicar em concluir"). Só quando a tarefa foi criada por outra pessoa (a própria não pergunta). A
// observação vai como parecer na tarefa (quem criou vê), antes de concluir. Por enquanto só no modo desenvolvedor.
import { tarefas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useModoDesenvolvedor } from '../../../../comum/modoDesenvolvedor';
import { useTarefasDelegadas } from '../../dados/repo';

const d = tarefas.delegadas;

function CampoDaObservacao({ onMudar }: { onMudar: (v: string) => void }) {
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

/**
 * Devolve o concluir com a pergunta: true = concluiu (com ou sem observação); false = a pessoa desistiu (fica como estava).
 * salvar: o que marca a tarefa concluída (cada tela tem o seu jeito de gravar e de avisar).
 */
export function useConcluirComPergunta() {
  const { modal } = useRetorno();
  const [dev] = useModoDesenvolvedor();
  const repo = useTarefasDelegadas();
  const uid = repo.eu()?.uid || '';
  return async (t: Pick<tarefas.delegadas.TarefaDelegada, 'id' | 'criadaPor'>, salvar: () => Promise<unknown>): Promise<boolean> => {
    if (!dev || !uid || t.criadaPor.uid === uid) { await salvar(); return true; }
    const quem = t.criadaPor.nome.split(' ')[0];
    const r = await modal<'nao' | 'sim' | null>({
      icone: 'mensagem', titulo: 'Mais algo que ' + quem + ' deva saber?', texto: 'Se tiver, mande uma observação junto com a conclusão.',
      botoes: [{ rotulo: 'Cancelar', valor: null, variante: 'btn-outline' }, { rotulo: 'Não, concluir', valor: 'nao', variante: 'btn-outline' }, { rotulo: 'Sim', valor: 'sim', variante: 'btn-primary' }],
    });
    if (!r) return false;
    if (r === 'sim') {
      let texto = '';
      const ok = await modal<boolean>({
        icone: 'mensagem', titulo: 'O que ' + quem + ' deve saber?', texto: 'Vai para ' + t.criadaPor.nome + ' junto com a conclusão.', corpo: <CampoDaObservacao onMudar={v => { texto = v; }} />,
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Concluir e enviar', valor: true, variante: 'btn-primary' }],
      });
      if (!ok) return false;
      if (texto.trim()) await repo.comentar(t.id, texto.trim());
    }
    await salvar();
    return true;
  };
}
