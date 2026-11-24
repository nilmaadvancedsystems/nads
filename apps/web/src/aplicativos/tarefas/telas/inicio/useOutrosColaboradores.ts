// ViewModel de Outros colaboradores (Vitor, 24/11/2026: "os seniores, diretores e donos, conseguem ver as tarefas dos juniores e
// plenos … apenas visualizar, nada de alterar ou coisa do tipo, so saber se foi concluida ou o que está acontecendo"): as tarefas
// delegadas para os Juniores e Plenos ativos, por pessoa, em aberto ou concluídas. Só leitura: nenhuma ação, nem abrir a tarefa
// para mexer; clicar na linha mostra a descrição e o histórico. A novidade 'outros-colaboradores' (só no modo desenvolvedor).
import { tarefas } from '@nads/core';
import { useState } from 'react';
import { useAcesso, useTarefasDelegadas } from '../../dados/repo';
import { useAgoraDoExpediente } from '../delegador/useAgoraDoExpediente';
import { useNivelDoInicio } from './useReunioesDoInicio';

const d = tarefas.delegadas;
export type SituacaoDosColaboradores = 'abertas' | 'concluidas';
const encerrada = (t: tarefas.delegadas.TarefaDelegada) => t.status === 'concluida' || t.status === 'cancelada';
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** O que aconteceu por último: quem fez o quê e quando; sem movimento, ainda não começou. */
function movimentoDe(t: tarefas.delegadas.TarefaDelegada): string {
  const m = d.ultimoMovimento(t);
  return m ? m.por + ' · ' + m.texto.replace(/ a tarefa$/, '').toLowerCase() + ' · ' + quando(m.em) : 'Ainda não iniciou';
}

export function useOutrosColaboradores(busca: string) {
  const repo = useTarefasDelegadas();
  const acesso = useAcesso();
  const nivel = useNivelDoInicio();
  const ve = d.veOutrosColaboradores(nivel);
  const eu = repo.eu()?.uid || '';
  const uids = acesso.equipe().lista.filter(u => u.ativo && u.uid !== eu && d.colaboradorObservado(u.nivel)).map(u => u.uid);
  const lidas = ve ? repo.daEquipe(uids) : { carregadas: true, tarefas: [] as tarefas.delegadas.TarefaDelegada[], erro: '' };
  const [situacao, setSituacao] = useState<SituacaoDosColaboradores>('abertas');
  const [quem, setQuem] = useState('');
  const [aberta, setAberta] = useState<string | null>(null);
  const relogio = useAgoraDoExpediente();
  const hoje = d.hojeIso();
  const agora = new Date().toTimeString().slice(0, 5);
  // os documentos delegados ficam de fora, como na aba Tarefas
  const semDocumentos = lidas.tarefas.filter(t => !d.pedeDocumentos(t));
  const daSituacao = semDocumentos.filter(t => (situacao === 'abertas' ? !encerrada(t) : encerrada(t)));
  const filtradas = d.buscar(daSituacao, busca).filter(t => !quem || t.responsavel.nome === quem);
  const linha = (t: tarefas.delegadas.TarefaDelegada) => ({
    id: t.id, titulo: t.titulo, partes: d.partesDoTitulo(t),
    cliente: t.clientes[0] ? (t.clientes[0].codigo != null ? t.clientes[0].codigo + ' · ' : '') + t.clientes[0].nome : '',
    maisClientes: t.clientes.length - 1,
    prazo: d.prazoComHora(t) || '—', atrasada: d.atrasada(t, hoje, agora),
    status: { valor: d.situacaoNoHorario(t, relogio).status, rotulo: d.rotuloNoHorario(t, relogio) },
    prioridade: { valor: t.prioridade, rotulo: d.rotuloDaPrioridade(t.prioridade) },
    delegadaPor: t.criadaPor.nome, movimento: movimentoDe(t),
    descricao: t.descricao,
    /** o histórico, do mais novo para o mais velho (até 8) */
    historico: [...t.historico].reverse().slice(0, 8).map(n => ({ quando: quando(n.em), por: n.por, texto: n.texto })),
  });
  return {
    ve, carregando: !lidas.carregadas, erro: lidas.erro || '',
    situacao, setSituacao: (s: SituacaoDosColaboradores) => { setSituacao(s); setAberta(null); },
    quem, setQuem,
    pessoas: [...new Set(semDocumentos.map(t => t.responsavel.nome))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    /** nenhuma tarefa na situação escolhida (sem contar a busca e a pessoa) */
    vazio: !daSituacao.length,
    grupos: d.porColaborador(filtradas, hoje, agora).map(g => ({ pessoa: g.pessoa, abertas: g.abertas, atrasadas: g.atrasadas, linhas: g.tarefas.map(linha) })),
    /** a linha aberta mostra a descrição e o histórico (só para ver) */
    aberta, alternar: (id: string) => setAberta(a => (a === id ? null : id)),
  };
}
