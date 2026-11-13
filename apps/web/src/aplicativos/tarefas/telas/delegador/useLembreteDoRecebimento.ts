// O lembrete do envio de documentos (Vitor, 13/11/2026: "o sistema de 10 em 10 min caso a pessoa visualize e nao confirme,
// vai ficar pedindo para confirmar recebimento"): enquanto a pessoa tem um envio que já abriu e não confirmou, a cada 10
// minutos a janela pergunta. O ⚡ da janela dos documentos chama lembrarAgora() para testar sem esperar.
import { tarefas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { useTarefasDelegadas } from '../../dados/repo';

const d = tarefas.delegadas;
const AGORA = 'nads-lembrete-do-recebimento';

/** Mostra o lembrete já (o ⚡ Dados de teste). */
export function lembrarAgora() { window.dispatchEvent(new Event(AGORA)); }

/** abrir: abre a tarefa na janela (o botão Abrir do lembrete). */
export function useLembreteDoRecebimento(abrir: (id: string) => void) {
  const repo = useTarefasDelegadas();
  const { modal, toast } = useRetorno();
  const uid = repo.eu()?.uid || '';
  const ids = repo.lista().tarefas.filter(t => d.lembraDeConfirmar(t, uid)).map(t => t.id).join(',');
  const perguntando = useRef(false);
  const abrirAgora = useRef(abrir);
  abrirAgora.current = abrir;

  useEffect(() => {
    async function lembrar() {
      if (perguntando.current) return;
      const t = repo.lista().tarefas.find(x => d.lembraDeConfirmar(x, uid));
      if (!t) return;
      perguntando.current = true;
      const cliente = t.clientes.map(c => (c.codigo != null ? c.codigo + ' · ' : '') + c.nome).join(', ');
      const r = await modal<'' | 'abrir' | 'confirmar'>({ icone: 'clipe', titulo: 'Confirme o recebimento',
        texto: t.criadaPor.nome + ' enviou documentos' + (cliente ? ' de ' + cliente : '') + '. Você já visualizou: confirme que recebeu.',
        botoes: [{ rotulo: 'Depois', valor: '', variante: 'btn-outline' }, { rotulo: 'Abrir', valor: 'abrir', variante: 'btn-outline' },
          { rotulo: 'Confirmar recebimento', valor: 'confirmar', variante: 'btn-primary' }] });
      perguntando.current = false;
      if (r === 'abrir') abrirAgora.current(t.id);
      if (r === 'confirmar') {
        try { await repo.salvar(t.id, { status: 'concluida' }); toast('Recebimento confirmado.'); } catch (e) { toast('Não confirmei: ' + (e instanceof Error ? e.message : String(e))); }
      }
    }
    const agora = () => { void lembrar(); };
    window.addEventListener(AGORA, agora);
    const relogio = ids ? setInterval(agora, d.LEMBRETE_DE_RECEBIMENTO_MS) : null;
    return () => { window.removeEventListener(AGORA, agora); if (relogio) clearInterval(relogio); };
  }, [ids, uid]); // eslint-disable-line react-hooks/exhaustive-deps
}
