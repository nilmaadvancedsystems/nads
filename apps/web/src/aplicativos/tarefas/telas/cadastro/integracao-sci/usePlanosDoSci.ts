// ViewModel dos planos de contas do SCI em Cadastro › Integração SCI (26/11/2026: "Coloca uma opcao de adicionar um plano de
// contas, ou atualizar o plano"): a lista (os que vêm no nads e os gravados pelo escritório) e o "Adicionar ou atualizar", que
// lê a exportação do SCI, mostra o que muda e só grava no "Gravar".
import { sci } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { usePlanosSci } from '../../../dados/repo';

const dataBr = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');

export interface PreviaDoPlano {
  id: string;
  arquivo: string;
  linhas: sci.LinhaDoPlanoSci[];
  /** o plano já existe no nads (atualizar) ou é novo (adicionar) */
  existe: boolean;
  novas: sci.LinhaDoPlanoSci[];
  mudaram: sci.LinhaDoPlanoSci[];
  sairam: sci.LinhaDoPlanoSci[];
}

export function usePlanosDoSci() {
  const repo = usePlanosSci();
  const { toast } = useRetorno();
  const { carregada, planos: gravados } = repo.atual();
  const [previa, setPrevia] = useState<PreviaDoPlano | null>(null);
  const [erro, setErro] = useState('');
  const [gravando, setGravando] = useState(false);
  const porId = new Map(gravados.map(p => [p.id, p]));
  return {
    carregando: !carregada,
    planos: sci.planosDoSci().map(p => {
      const g = porId.get(p.id);
      return { id: p.id, contas: sci.linhasDoPlanoSci(p.id).length, origem: g ? 'Atualizado em ' + dataBr(g.em) + (g.por ? ' por ' + g.por : '') : 'O que vem no nads' };
    }),
    erro,
    previa,
    gravando,
    /** lê a exportação do SCI e monta a prévia (nada é gravado ainda) */
    async ler(arquivo: File) {
      setErro(''); setPrevia(null);
      const r = sci.planoDaExportacaoDoSci(new Uint8Array(await arquivo.arrayBuffer()));
      if (r.erro) { setErro(r.erro); return; }
      const antes = sci.linhasDoPlanoSci(r.id);
      setPrevia({ id: r.id, arquivo: arquivo.name, linhas: r.linhas, existe: antes.length > 0, ...sci.diferencasDoPlanoSci(antes, r.linhas) });
    },
    cancelar: () => { setPrevia(null); setErro(''); },
    async gravar() {
      if (!previa || gravando) return;
      setGravando(true);
      try {
        await repo.salvar(previa.id, previa.linhas, previa.arquivo);
        toast('Plano ' + previa.id + (previa.existe ? ' atualizado' : ' adicionado') + ': ' + previa.linhas.length + ' contas.');
        setPrevia(null);
      } catch (e) {
        toast('Não deu para gravar o plano' + (e instanceof Error && e.message ? ': ' + e.message : '.'));
      } finally { setGravando(false); }
    },
  };
}
