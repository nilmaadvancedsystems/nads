// ViewModel dos Feedbacks (o pé da gaveta ☰, só o admin): os feedbacks da equipe (o print, o texto, quem, quando, de qual
// tela e a prioridade), com o filtro Novos / Vistos / Feitos / Todos e o Visto / Feito. A prioridade (Vitor, 19/10/2026):
// filtrar por Alta, Média ou Baixa e ordenar pelos mais novos ou pela prioridade.
import { useState } from 'react';
import { ordenarPorPrioridade, PRIORIDADES, type PrioridadeDoFeedback, type SituacaoDoFeedback } from '../../dados/feedback';
import { useFeedback } from '../../dados/repo';

export function useFeedbacks() {
  const repo = useFeedback();
  const todos = repo.todos();
  const [filtro, setFiltro] = useState<SituacaoDoFeedback | ''>('novo');
  const [aberta, setAberta] = useState('');
  const [prioridade, setPrioridade] = useState<PrioridadeDoFeedback | ''>('');
  const [ordem, setOrdem] = useState<'recentes' | 'prioridade'>('recentes');
  // o feedback aberto na janela dele (Vitor, 07/10/2026: "quando eu clique no feedback abra outra janela flutuante")
  const [aberto, setAberto] = useState('');
  const comQuando = (f: (typeof todos.lista)[number]) => ({
    ...f, quando: f.criadoEm ? new Date(f.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '',
  });
  const doAberto = todos.lista.find(f => f.id === aberto);
  const conta = (s: SituacaoDoFeedback) => todos.lista.filter(f => f.status === s).length;
  const daSituacao = todos.lista.filter(f => !filtro || f.status === filtro);
  const filtrados = daSituacao.filter(f => !prioridade || f.prioridade === prioridade);
  return {
    carregando: !todos.carregados,
    filtro, setFiltro,
    filtros: [
      { valor: 'novo' as const, rotulo: 'Novos', qtd: conta('novo') },
      { valor: 'visto' as const, rotulo: 'Vistos', qtd: conta('visto') },
      { valor: 'feito' as const, rotulo: 'Feitos', qtd: conta('feito') },
      { valor: '' as const, rotulo: 'Todos', qtd: todos.lista.length },
    ],
    /** a prioridade (Todas, Alta, Média, Baixa), com quantos de cada na situação escolhida */
    prioridade, setPrioridade,
    prioridades: [
      { valor: '' as const, rotulo: 'Todas' },
      ...PRIORIDADES.map(p => ({ valor: p.valor, rotulo: p.rotulo + ' (' + daSituacao.filter(f => f.prioridade === p.valor).length + ')' })),
    ],
    ordem, setOrdem,
    lista: (ordem === 'prioridade' ? ordenarPorPrioridade(filtrados) : [...filtrados].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))).map(comQuando),
    /** o feedback aberto na janela dele (segue o banco: muda o selo ao marcar) */
    aberto: doAberto ? comQuando(doAberto) : null,
    abrir: setAberto,
    fecharAberto: () => setAberto(''),
    /** a imagem aberta em tamanho grande */
    aberta, setAberta,
    marcar: (id: string, status: SituacaoDoFeedback) => void repo.marcar(id, status),
  };
}
