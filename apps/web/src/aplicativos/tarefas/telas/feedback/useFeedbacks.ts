// ViewModel dos Feedbacks (o pé da gaveta ☰, só o admin): os feedbacks da equipe (o print, o texto, quem, quando, de qual
// tela e a prioridade), com o filtro Novos / Vistos / Feitos / Todos e o Visto / Feito. A prioridade (Vitor, 19/10/2026):
// filtrar por Alta, Média ou Baixa e ordenar pelos mais novos ou pela prioridade.
import { suporte } from '@nads/core';
import { baixarBytes } from '@nads/ui';
import { useState } from 'react';
import { ordenarPorPrioridade, PRIORIDADES, type PrioridadeDoFeedback, type SituacaoDoFeedback } from '../../dados/feedback';
import { useFeedback } from '../../dados/repo';

export function useFeedbacks() {
  const repo = useFeedback();
  const todos = repo.todos();
  // 'bug': os do suporte de leitura (o balão), com o report do robô (Vitor, 20/10/2026: "uma aba chamada Bugs")
  const [filtro, setFiltro] = useState<SituacaoDoFeedback | '' | 'bug'>('novo');
  const [aberta, setAberta] = useState('');
  const [prioridade, setPrioridade] = useState<PrioridadeDoFeedback | ''>('');
  const [ordem, setOrdem] = useState<'recentes' | 'prioridade'>('recentes');
  // o feedback aberto na janela dele (Vitor, 07/10/2026: "quando eu clique no feedback abra outra janela flutuante")
  const [aberto, setAberto] = useState('');
  const comQuando = (f: (typeof todos.lista)[number]) => ({
    ...f, veredito: f.tipo === 'bug' ? suporte.vereditoDoReport(f.relatorio) : null, quando: f.criadoEm ? new Date(f.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '',
  });
  const doAberto = todos.lista.find(f => f.id === aberto);
  const conta = (s: SituacaoDoFeedback) => todos.lista.filter(f => f.status === s).length;
  const daSituacao = todos.lista.filter(f => (filtro === 'bug' ? f.tipo === 'bug' : !filtro || f.status === filtro));
  const filtrados = daSituacao.filter(f => !prioridade || f.prioridade === prioridade);
  return {
    carregando: !todos.carregados,
    filtro, setFiltro,
    filtros: [
      { valor: 'novo' as const, rotulo: 'Novos', qtd: conta('novo') },
      { valor: 'visto' as const, rotulo: 'Vistos', qtd: conta('visto') },
      { valor: 'feito' as const, rotulo: 'Feitos', qtd: conta('feito') },
      { valor: '' as const, rotulo: 'Todos', qtd: todos.lista.length },
      { valor: 'bug' as const, rotulo: 'Bugs', qtd: todos.lista.filter(f => f.tipo === 'bug' && f.status !== 'feito').length },
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
    /** o arquivo do bug, para baixar (o que a pessoa mandou pelo balão) */
    baixarArquivoDoBug: async (id: string) => { const a = await repo.arquivoDoBug(id); if (a) baixarBytes(a.bytes, a.nome, 'application/octet-stream'); },
  };
}
