// ViewModel da página Chamados da Área do Cliente (Vitor, 16/10/2026): os chamados que os clientes abriram, o filtro por
// situação, a busca, abrir a conversa, responder (a situação vai para "respondido") e mudar a situação.
import { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { SITUACOES_DO_CHAMADO } from '../../dados/areaCliente';
import { useAreaCliente } from '../../dados/repo';

export type FiltroDosChamados = 'todos' | ac.SituacaoDoChamado;
export const FILTROS_DOS_CHAMADOS: readonly FiltroDosChamados[] = ['todos', ...SITUACOES_DO_CHAMADO];
export const rotuloDoFiltro = (f: FiltroDosChamados) => (f === 'todos' ? 'Todos' : ac.ROTULO_DA_SITUACAO_DO_CHAMADO[f]);
export const rotuloDoTipo = (t: string) => ac.TIPOS_DE_CHAMADO.find(x => x.valor === t)?.rotulo || t;

const simples = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const motivo = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useChamadosDoCliente() {
  const repo = useAreaCliente();
  const { toast } = useRetorno();
  const [filtro, setFiltro] = useState<FiltroDosChamados>('todos');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const todos = repo.chamados();

  const linhas = useMemo(() => {
    const q = simples(busca.trim());
    return todos.lista.filter(c => (filtro === 'todos' || c.situacao === filtro)
      && (!q || simples(c.empresa + ' ' + c.titulo + ' ' + c.codigos.join(' ')).includes(q)));
  }, [todos.lista, filtro, busca]);
  const contagem = (f: FiltroDosChamados) => (f === 'todos' ? todos.lista.length : todos.lista.filter(c => c.situacao === f).length);

  return {
    exemplos: repo.exemplos,
    carregando: !todos.carregada,
    erro: todos.erro,
    linhas, filtro, setFiltro, busca, setBusca, contagem,
    detalhe: aberto ? todos.lista.find(c => c.id === aberto) || null : null,
    abrir(id: string) { setAberto(a => (a === id ? null : id)); setResposta(''); },
    resposta, setResposta, enviando,
    async responder() {
      const c = aberto ? todos.lista.find(x => x.id === aberto) : null;
      const texto = resposta.trim();
      if (!c || !texto || enviando) return;
      if (texto.length > ac.MAIOR_TEXTO_DO_CHAMADO) { toast('A resposta passa de ' + ac.MAIOR_TEXTO_DO_CHAMADO + ' caracteres.'); return; }
      setEnviando(true);
      try { await repo.responder(c.id, texto); setResposta(''); toast('Resposta enviada ao cliente.'); }
      catch (e) { toast('Não deu para responder: ' + motivo(e)); } finally { setEnviando(false); }
    },
    async mudarSituacao(id: string, situacao: ac.SituacaoDoChamado) {
      try { await repo.mudarSituacao(id, situacao); toast('Chamado: ' + ac.ROTULO_DA_SITUACAO_DO_CHAMADO[situacao].toLowerCase() + '.'); }
      catch (e) { toast('Não deu para mudar a situação: ' + motivo(e)); }
    },
    data: (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''),
  };
}
