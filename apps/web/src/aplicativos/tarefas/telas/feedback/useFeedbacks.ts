// ViewModel de Cadastro › Feedbacks: os feedbacks da equipe (o print, o texto, quem, quando e de qual tela), com o
// filtro Novos / Vistos / Feitos / Todos e o Visto / Feito.
import { useState } from 'react';
import type { SituacaoDoFeedback } from '../../dados/feedback';
import { useFeedback } from '../../dados/repo';

export function useFeedbacks() {
  const repo = useFeedback();
  const todos = repo.todos();
  const [filtro, setFiltro] = useState<SituacaoDoFeedback | ''>('novo');
  const [aberta, setAberta] = useState('');
  // o feedback aberto na janela dele (Vitor, 07/10/2026: "quando eu clique no feedback abra outra janela flutuante")
  const [aberto, setAberto] = useState('');
  const comQuando = (f: (typeof todos.lista)[number]) => ({
    ...f, quando: f.criadoEm ? new Date(f.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '',
  });
  const doAberto = todos.lista.find(f => f.id === aberto);
  const conta = (s: SituacaoDoFeedback) => todos.lista.filter(f => f.status === s).length;
  return {
    carregando: !todos.carregados,
    filtro, setFiltro,
    filtros: [
      { valor: 'novo' as const, rotulo: 'Novos', qtd: conta('novo') },
      { valor: 'visto' as const, rotulo: 'Vistos', qtd: conta('visto') },
      { valor: 'feito' as const, rotulo: 'Feitos', qtd: conta('feito') },
      { valor: '' as const, rotulo: 'Todos', qtd: todos.lista.length },
    ],
    lista: todos.lista.filter(f => !filtro || f.status === filtro).map(comQuando),
    /** o feedback aberto na janela dele (segue o banco: muda o selo ao marcar) */
    aberto: doAberto ? comQuando(doAberto) : null,
    abrir: setAberto,
    fecharAberto: () => setAberto(''),
    /** a imagem aberta em tamanho grande */
    aberta, setAberta,
    marcar: (id: string, status: SituacaoDoFeedback) => void repo.marcar(id, status),
  };
}
