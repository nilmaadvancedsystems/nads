// "Mais algo que eu deva saber?" ao concluir (Vitor, 18/11/2026): a pergunta e a observação para quem criou (o campo em
// perguntaAoConcluir.tsx). Por enquanto só no modo desenvolvedor.
import { tarefas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { createElement } from 'react';
import { useModoDesenvolvedor } from '../../../../comum/modoDesenvolvedor';
import { useTarefasDelegadas } from '../../dados/repo';
import { CampoDaObservacao } from './perguntaAoConcluir';

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
        icone: 'mensagem', titulo: 'O que ' + quem + ' deve saber?', texto: 'Vai para ' + t.criadaPor.nome + ' junto com a conclusão.', corpo: createElement(CampoDaObservacao, { onMudar: (v: string) => { texto = v; } }),
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Concluir e enviar', valor: true, variante: 'btn-primary' }],
      });
      if (!ok) return false;
      if (texto.trim()) await repo.comentar(t.id, texto.trim());
    }
    await salvar();
    return true;
  };
}
