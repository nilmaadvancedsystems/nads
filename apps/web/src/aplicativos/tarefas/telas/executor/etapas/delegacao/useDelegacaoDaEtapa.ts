// Delegar a etapa Clientes ou Fornecedores (Vitor, 10/11/2026: "vai aparecer em tarefas para a pessoa delegada, o resto da
// empresa fica bloqueada"; "que abra um popup para selecionar quais vão ser delegadas, tenha a opção todos e específica"). O
// Delegar cria uma tarefa ligada à etapa, à empresa e ao período. Quem recebe abre pela tarefa (?delegada=id), vê só as contas
// pedidas e marca o check de cada uma; quem pediu vê as marcadas ofuscadas. A Contabilização da Folha também (11/11/2026: "coloca
// um botão de delegar aqui, e adicionar o que eu quero delegar da página com as observações"): os itens do checklist.
import { tarefas as t, usuarios } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { ehDiretor } from '../../../../casca/navegacao';
import { useOperador } from '../../../../casca/operador';
import { useAcesso, useTarefasDelegadas } from '../../../../dados/repo';
import { useEtapaAberta } from '../contexto';

const d = t.delegadas;
const ROTULO: Record<t.delegadas.EtapaQueDelega, string> = { clientes: 'Clientes', fornecedores: 'Fornecedores', dp: 'Contabilização da Folha' };
const TODOS: Record<t.delegadas.EtapaQueDelega, string> = { clientes: 'Todos os clientes', fornecedores: 'Todos os fornecedores', dp: 'Todos os itens' };
/** o item da folha tem código de texto (o id): na lista vai só o nome */
const nomeDaConta = (c: t.delegadas.ContaDelegada) => (/^\d/.test(c.codigo) ? c.codigo + ' ' + c.nome : c.nome);

/** A empresa e os meses da etapa aberta (as telas das etapas). */
export function useDelegacaoDaEtapa(etapa: t.delegadas.EtapaQueDelega, contas: readonly t.delegadas.ContaDelegada[]) {
  return useDelegacao(etapa, contas, useEtapaAberta());
}

/** O mesmo, com a empresa e os meses passados (o checklist da folha, que não fica dentro do EtapaProvider). */
export function useDelegacao(etapa: t.delegadas.EtapaQueDelega, contas: readonly t.delegadas.ContaDelegada[], s: { codigo: number | null; nome: string; meses: readonly string[] }) {
  const { empresa: rota = '', competencia: periodo = '' } = useParams();
  const [params] = useSearchParams();
  const repo = useTarefasDelegadas();
  const acesso = useAcesso();
  const operador = useOperador().operador;
  const { toast, modal } = useRetorno();
  const uid = repo.eu()?.uid || '';
  // as tarefas desta etapa, nesta empresa e período
  const daEtapa = repo.lista().tarefas.filter(x => x.etapaDelegada?.etapa === etapa && x.etapaDelegada.rota === rota && x.etapaDelegada.periodo === periodo && x.status !== 'cancelada');
  const idRecebida = params.get('delegada');
  const recebida = (idRecebida && daEtapa.find(x => x.id === idRecebida && x.responsavel.uid === uid)) || null;
  const enviadas = daEtapa.filter(x => x.criadaPor.uid === uid);
  const enviadaDe = (codigo: string) => enviadas.find(x => d.contaNaDelegacao(x.etapaDelegada as t.delegadas.EtapaDelegada, codigo)) || null;
  const feitaEm = (x: t.delegadas.TarefaDelegada, codigo: string) => !!x.etapaDelegada?.feitas.includes(codigo);

  // o popup
  const [aberta, setAberta] = useState(false);
  const [para, setPara] = useState('');
  const [modo, setModo] = useState<'todos' | 'especificos'>('todos');
  const [escolhidas, setEscolhidas] = useState<ReadonlySet<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [observacao, setObservacao] = useState('');
  const [comObservacao, setComObservacao] = useState(false);
  const [gravando, setGravando] = useState(false);

  const docs = acesso.equipe().docs;
  // só quem é do Contábil recebe (a etapa é do Contábil); as contas reservadas, só para o Diretor e o admin
  const equipe = acesso.equipe().lista
    .filter(u => u.ativo && u.uid !== uid && (u.departamento === 'contabil' || u.papeis.includes('contabil')) && (ehDiretor(operador) || !usuarios.ehContaReservada(u.email)))
    .map(u => ({ uid: u.uid, nome: u.nome, foto: String(docs[u.uid]?.fotoPerfil || '') || null, iniciais: usuarios.iniciais(u.nome) }));
  const q = busca.trim().toLowerCase();
  const pessoa = equipe.find(p => p.uid === para) || null;
  const pode = !!pessoa && !gravando && (modo === 'todos' ? contas.length > 0 : escolhidas.size > 0);

  async function delegar() {
    if (!pessoa || !pode) return;
    setGravando(true);
    const contasEscolhidas = modo === 'todos' ? [] : contas.filter(c => escolhidas.has(c.codigo)).map(c => ({ codigo: c.codigo, nome: c.nome }));
    const periodoTexto = t.rotuloDoPeriodo([...s.meses]);
    const lista = modo === 'todos' ? TODOS[etapa] + '.' : contasEscolhidas.map(nomeDaConta).join('\n');
    try {
      await repo.criar({
        ...d.rascunhoVazio({ uid: pessoa.uid, nome: pessoa.nome }),
        titulo: (ROTULO[etapa] + ' · ' + (s.codigo != null ? s.codigo + ' · ' : '') + s.nome + ' · ' + periodoTexto).slice(0, d.MAIOR_TITULO),
        descricao: [observacao.trim(), lista].filter(Boolean).join('\n\n').slice(0, d.MAIOR_DESCRICAO),
        clientes: [{ codigo: s.codigo, nome: s.nome }],
        etapaDelegada: { etapa, rota, periodo, todas: modo === 'todos', contas: contasEscolhidas, feitas: [] },
      }, []);
      toast('Delegado para ' + pessoa.nome + '.');
      setAberta(false);
    } catch (e) {
      toast('Não deleguei: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setGravando(false); }
  }

  return {
    /** a tarefa, se esta tela foi aberta pela delegação */
    recebida,
    // tudo já delegado: só depois de remover
    podeDelegar: !recebida && contas.length > 0 && !enviadas.some(x => x.etapaDelegada?.todas),
    /** o que quem pediu já delegou nesta etapa: para quem e quantas a pessoa marcou */
    delegadas: recebida ? [] : enviadas.map(x => {
      const e = x.etapaDelegada as t.delegadas.EtapaDelegada;
      const total = e.todas ? contas.length : e.contas.length;
      return { id: x.id, para: x.responsavel.nome, resumo: (e.todas ? TODOS[etapa] : total + (etapa === 'dp' ? (total === 1 ? ' item' : ' itens') : total === 1 ? ' conta' : ' contas')) + ' · ' + Math.min(e.feitas.length, total) + ' de ' + total + ' feitas' };
    }),
    /** cancela a tarefa: a pessoa deixa de ter a etapa e as contas voltam ao normal (o histórico da tarefa fica) */
    async remover(id: string, nome: string) {
      const ok = await modal<boolean>({
        icone: 'alert', titulo: 'Remover a delegação?', texto: nome + ' deixa de ter esta etapa. A tarefa fica como cancelada.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Remover', valor: true, variante: 'btn-primary' }],
      });
      if (!ok) return;
      try { await repo.salvar(id, { status: 'cancelada' }); toast('Delegação removida.'); } catch (e) { toast('Não removi: ' + (e instanceof Error ? e.message : String(e))); }
    },
    /** quem recebeu só vê o que foi pedido */
    visivel: (codigo: string) => !recebida?.etapaDelegada || d.contaNaDelegacao(recebida.etapaDelegada, codigo),
    /** o check de quem recebeu */
    feita: (codigo: string) => !!recebida && feitaEm(recebida, codigo),
    alternar: (c: t.delegadas.ContaDelegada) => {
      if (!recebida) return;
      repo.marcarContaFeita(recebida.id, { codigo: c.codigo, nome: c.nome }, !feitaEm(recebida, c.codigo)).catch((e: unknown) => toast('Não gravei: ' + (e instanceof Error ? e.message : String(e))));
    },
    /** para quem pediu: a conta que a pessoa já fez fica ofuscada */
    ofuscada: (codigo: string) => { const x = enviadaDe(codigo); return !!x && feitaEm(x, codigo); },
    /** para quem pediu: com quem a conta está ('' = não delegada) */
    para: (codigo: string) => { const x = enviadaDe(codigo); return x ? (feitaEm(x, codigo) ? 'Feito por ' : 'Com ') + x.responsavel.nome : ''; },

    rotulo: ROTULO[etapa],
    /** as contas têm código (Clientes e Fornecedores); os itens da folha, não */
    comCodigo: etapa !== 'dp',
    aberta,
    abrir: () => { setPara(''); setModo('todos'); setEscolhidas(new Set()); setBusca(''); setObservacao(''); setComObservacao(false); setAberta(true); },
    fechar: () => setAberta(false),
    equipe, pessoa, escolher: setPara,
    modo, setModo,
    total: contas.length,
    qtdEscolhidas: escolhidas.size,
    busca, setBusca,
    contas: contas.filter(c => !q || (c.codigo + ' ' + c.nome).toLowerCase().includes(q)).map(c => ({ ...c, marcada: escolhidas.has(c.codigo) })),
    marcar: (codigo: string) => setEscolhidas(x => { const n = new Set(x); if (n.has(codigo)) n.delete(codigo); else n.add(codigo); return n; }),
    observacao, setObservacao, comObservacao, alternarObservacao: () => setComObservacao(x => !x),
    pode, gravando, delegar,
  };
}

export type VmDelegacao = ReturnType<typeof useDelegacaoDaEtapa>;
