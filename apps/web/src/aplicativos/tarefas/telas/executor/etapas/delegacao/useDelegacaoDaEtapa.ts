// Delegar a etapa Clientes ou Fornecedores (Vitor, 10/11/2026: "vai aparecer em tarefas para a pessoa delegada, o resto da
// empresa fica bloqueada"; "que abra um popup para selecionar quais vão ser delegadas, tenha a opção todos e específica"). O
// Delegar cria uma tarefa ligada à etapa, à empresa e ao período. Quem recebe abre pela tarefa (?delegada=id), vê só as contas
// pedidas e marca o check de cada uma; quem pediu vê as marcadas ofuscadas.
import { tarefas as t, usuarios } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { ehDiretor } from '../../../../casca/navegacao';
import { useOperador } from '../../../../casca/operador';
import { useAcesso, useTarefasDelegadas } from '../../../../dados/repo';
import { useEtapaAberta } from '../contexto';

const d = t.delegadas;
const ROTULO: Record<t.delegadas.EtapaQueDelega, string> = { clientes: 'Clientes', fornecedores: 'Fornecedores' };

export function useDelegacaoDaEtapa(etapa: t.delegadas.EtapaQueDelega, contas: readonly t.delegadas.ContaDelegada[]) {
  const s = useEtapaAberta();
  const { empresa: rota = '', competencia: periodo = '' } = useParams();
  const [params] = useSearchParams();
  const repo = useTarefasDelegadas();
  const acesso = useAcesso();
  const operador = useOperador().operador;
  const { toast } = useRetorno();
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
    const lista = modo === 'todos' ? 'Todos os ' + ROTULO[etapa].toLowerCase() + '.' : contasEscolhidas.map(c => c.codigo + ' ' + c.nome).join('\n');
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
    podeDelegar: !recebida && contas.length > 0,
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
