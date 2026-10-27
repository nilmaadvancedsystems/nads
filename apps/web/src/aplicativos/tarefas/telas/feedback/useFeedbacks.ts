// ViewModel dos Feedbacks (o pé da gaveta ☰, só o admin): os feedbacks da equipe (o print, o texto, quem, quando, de qual
// tela e a prioridade), com o filtro Novos / Vistos / Feitos / Todos e o Visto / Feito. A prioridade (Vitor, 19/10/2026):
// filtrar por Alta, Média ou Baixa e ordenar pelos mais novos ou pela prioridade.
import { suporte, tarefas } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
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
  const { toast } = useRetorno();
  const comQuando = (f: (typeof todos.lista)[number]) => ({
    ...f, veredito: f.tipo === 'bug' ? suporte.vereditoDoReport(f.relatorio) : null, pedido: f.tipo === 'bug' ? suporte.codigoDoPedido(f.id) : '', quando: f.criadoEm ? new Date(f.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '',
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
      { valor: 'resolvendo' as const, rotulo: 'Resolvendo', qtd: conta('resolvendo') },
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
    baixarArquivoDoBug: async (id: string, i = 0) => { const a = await repo.arquivoDoBug(id, i); if (a) baixarBytes(a.bytes, a.nome, 'application/octet-stream'); },
    /**
     * Tudo o que a pessoa mandou num .zip (Vitor, 27/10/2026: "com o nome da pasta como nome do ticket e nome da pessoa"):
     * a pasta e o .zip "#COOK7D - Felipe Souza", com o print e os arquivos.
     */
    /**
     * A solicitação inteira, como texto, para colar (Vitor, 27/10/2026: "um botão de copiar solicitação para colar o texto"):
     * o número, quem, quando, a empresa e o caminho, o texto, os arquivos e a tela.
     */
    copiarSolicitacao: (id: string) => {
      const x = todos.lista.find(y => y.id === id);
      if (!x) return;
      const f = comQuando(x);
      const texto = [
        [f.pedido, f.nome || f.email, f.quando].filter(Boolean).join(' · '),
        ...(f.tipo === 'bug' ? [[f.empresa, f.caminho].filter(Boolean).join(' · ')] : []),
        '',
        f.texto,
        ...(f.arquivos.length ? ['', 'Arquivos: ' + f.arquivos.map(a => a.nome).join(', ')] : []),
        ...(f.relatorio ? ['', f.relatorio] : []),
        '',
        [f.tela, f.versao].filter(Boolean).join(' · '),
      ].join('\n').replace(/\n{3,}/g, '\n\n').trim();
      void navigator.clipboard?.writeText(texto).then(() => toast('Solicitação copiada.'), () => toast('Não consegui copiar (o navegador não deixou).'));
    },
    baixarTudo: async (id: string) => {
      const f = todos.lista.find(x => x.id === id);
      if (!f) return;
      const limpo = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim();
      const pasta = limpo(suporte.codigoDoPedido(f.id) + ' - ' + (f.nome || f.email || 'sem nome'));
      const arquivos: { nome: string; bytes: Uint8Array }[] = [];
      const usados = new Set<string>();
      const nomeLivre = (nome: string) => {
        let n = limpo(nome) || 'arquivo', k = 2;
        // dois arquivos com o mesmo nome: o segundo ganha " (2)" antes da extensão
        while (usados.has(n.toLowerCase())) { const numero = k++; n = limpo(nome).replace(/(\.[^.]*)?$/, m => ' (' + numero + ')' + m); }
        usados.add(n.toLowerCase());
        return n;
      };
      if (f.imagem.startsWith('data:image/')) {
        const bin = atob(f.imagem.split(',')[1] || '');
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        arquivos.push({ nome: pasta + '/' + nomeLivre('print.jpg'), bytes });
      }
      for (let i = 0; i < f.arquivos.length; i++) {
        const a = await repo.arquivoDoBug(id, i);
        if (a) arquivos.push({ nome: pasta + '/' + nomeLivre(a.nome), bytes: a.bytes });
      }
      if (arquivos.length) baixarBytes(tarefas.zipSemCompressao(arquivos), pasta + '.zip', 'application/zip');
    },
  };
}
