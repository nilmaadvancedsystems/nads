// ViewModel da Central de tarefas (28/10/2026, o "Minhas Tarefas" do Toriba): a janela aberta pelo perfil ou pelo correio do
// pé do menu. À esquerda as abas Minhas tarefas, Delegadas por mim e Concluídas (com quantas tem); no meio a barra (Nova
// tarefa, a busca "O que você procura?", o filtro de status e o Exportar) e a tabela. Clicar numa linha abre a tarefa no
// lugar da lista (useTarefaAberta). As regras (a ordem, as abas, a busca) são do core: tarefas.delegadas.
import { formatos, tarefas } from '@nads/core';
import { baixarArquivo, baixarBytes } from '@nads/ui';
import { useState } from 'react';
import { useTarefasDelegadas } from '../../dados/repo';

const d = tarefas.delegadas;
export type AbaDaCentral = tarefas.delegadas.Aba;
type Status = tarefas.delegadas.Status;

/** A coluna da pessoa muda com a aba: nas minhas, quem delegou; nas delegadas, o responsável; nas concluídas, de/para quem. */
const COLUNA_DA_PESSOA: Record<AbaDaCentral, string> = { minhas: 'Quem delegou', delegadas: 'Responsável', concluidas: 'Delegação' };
const VAZIO_DA_ABA: Record<AbaDaCentral, string> = {
  minhas: 'Nenhuma tarefa em aberto para você.',
  delegadas: 'Você não tem tarefas delegadas para outras pessoas em aberto.',
  concluidas: 'As tarefas concluídas e canceladas aparecem aqui.',
};

export function useCentralDeTarefas(abaInicial: AbaDaCentral) {
  const repo = useTarefasDelegadas();
  const [aba, setAba] = useState<AbaDaCentral>(abaInicial);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<Status | ''>('');
  // a tarefa aberta no lugar da lista: o id, 'nova' ou null (a lista)
  const [aberta, setAberta] = useState<string | null>(null);
  const uid = repo.eu()?.uid || '';
  const { carregadas, tarefas: todas, erro } = repo.lista();
  const hoje = d.hojeIso();
  const contadores = d.contarAbas(todas, uid);
  const daAba = d.daAba(todas, aba, uid);
  const lista = d.ordenar(d.buscar(daAba, busca).filter(t => !status || t.status === status), hoje);
  const pessoa = (t: tarefas.delegadas.TarefaDelegada) => {
    if (aba === 'minhas') return t.criadaPor.uid === uid ? 'Você mesmo' : t.criadaPor.nome;
    if (aba === 'delegadas') return t.responsavel.nome;
    if (t.criadaPor.uid === t.responsavel.uid) return 'Você mesmo';
    return t.responsavel.uid === uid ? 'de ' + t.criadaPor.nome : 'para ' + t.responsavel.nome;
  };
  const opcoesDeStatus = d.statusDaAba(aba);
  const nomeDoArquivo = 'tarefas-' + aba + '-' + hoje;
  return {
    carregando: !carregadas,
    erro: erro || '',
    /** as abas da lateral, com quantas tem */
    abas: d.ABAS.map(a => ({ id: a.valor, rotulo: a.rotulo, qtd: contadores[a.valor], ativa: a.valor === aba })),
    aba,
    mudarAba: (a: AbaDaCentral) => { setAba(a); setStatus(''); setAberta(null); },
    busca, setBusca,
    /** o filtro de status (só os da aba) */
    status,
    rotuloDoStatus: status ? d.rotuloDoStatus(status) : 'Todos os status',
    opcoesDeStatus: [{ valor: '' as const, rotulo: 'Todos os status' }, ...opcoesDeStatus.map(s => ({ valor: s, rotulo: d.rotuloDoStatus(s) }))],
    setStatus,
    colunaDaPessoa: COLUNA_DA_PESSOA[aba],
    vazio: busca.trim() || status ? 'Nada com esse filtro.' : VAZIO_DA_ABA[aba],
    /** as linhas da tabela, na ordem do core (atrasadas e urgentes primeiro) */
    linhas: lista.map(t => ({
      id: t.id, numero: t.numero, titulo: t.titulo,
      status: { rotulo: d.rotuloDoStatus(t.status), tom: d.tomDoStatus(t.status) },
      prioridade: { valor: t.prioridade, rotulo: d.rotuloDaPrioridade(t.prioridade) },
      prazo: d.prazoParaTela(t.prazo), atrasada: d.atrasada(t, hoje),
      cliente: t.cliente ? (t.cliente.codigo != null ? t.cliente.codigo + ' · ' : '') + t.cliente.nome : '',
      pessoa: pessoa(t), anexos: t.anexos.length, pareceres: t.pareceres.length,
    })),
    aberta,
    abrir: (id: string) => setAberta(id),
    nova: () => setAberta('nova'),
    voltar: () => setAberta(null),
    /** depois de criar, a lista da aba onde a tarefa foi parar (a minha: Minhas; para outro: Delegadas) */
    criada: (paraMim: boolean) => { setAberta(null); setAba(paraMim ? 'minhas' : 'delegadas'); setStatus(''); },
    /** a lista que está na tela (com a busca e o filtro), em planilha */
    exportar(formato: 'xlsx' | 'csv') {
      const cabecalho = [...d.CABECALHO_DA_PLANILHA];
      const linhas = d.linhasDaPlanilha(lista);
      if (formato === 'xlsx') {
        baixarBytes(tarefas.planilhaXlsx('Tarefas', cabecalho, linhas), nomeDoArquivo + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } else {
        baixarArquivo(formatos.montarCsv([cabecalho, ...linhas].map(l => l.map(d.celulaDoCsv).join(';'))), nomeDoArquivo + '.csv');
      }
    },
    podeExportar: lista.length > 0,
  };
}
