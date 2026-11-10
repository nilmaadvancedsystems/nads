// O ViewModel da Central dos robôs: a situação das máquinas e dos robôs, os widgets do topo, o relógio, a saudação, a
// busca, e os pedidos de ação (com a confirmação das destrutivas). As telas só desenham o que sai daqui.
import { entregas, robos as r } from '@nads/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOperador } from '../../tarefas/casca/operador';
import { useDocsDaCentral } from '../dados/repo';
import { usePermissao } from './useAcesso';

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** O relógio da tela inicial: anda a cada 15 s (a tela mostra minutos). */
export function useAgora(aCadaMs = 15000): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), aCadaMs);
    return () => clearInterval(t);
  }, [aCadaMs]);
  return agora;
}

export function useCentral() {
  const d = useDocsDaCentral();
  const { operador, escolher, comLogin } = useOperador();
  const permissao = usePermissao();
  const agora = useAgora();
  const data = new Date(agora);

  const maquinas = useMemo(() => r.MAQUINAS.map(m => {
    const b = m.id === 'servidor' ? d.batimentos.servidor : m.id === 'nuvem' ? d.batimentos.nuvem : null;
    return r.situacaoDaMaquina(m, b, d.maquinas[m.id], agora);
  }), [d.batimentos, d.maquinas, agora]);

  const situacoes = useMemo(() => r.ROBOS.map(robo => {
    const m = maquinas.find(x => x.maquina.id === robo.maquina)!;
    const b = robo.maquina === 'servidor' ? d.batimentos.servidor : robo.maquina === 'nuvem' ? d.batimentos.nuvem : null;
    return r.situacaoDoRoboNaCentral(robo, m, b, d.maquinas[robo.maquina], d.atividades, agora);
  }), [maquinas, d.batimentos, d.maquinas, d.atividades, agora]);

  const filas = useMemo(() => r.resumoDasFilas(situacoes), [situacoes]);
  const erros = useMemo(() => r.errosDeHoje(d.atividades, agora), [d.atividades, agora]);
  const geral = useMemo(() => r.pausaGeral(situacoes), [situacoes]);

  return {
    permissao,
    administra: r.administra(permissao),
    /** Só para desenhar a tela; quem confere de verdade é o banco e o robô. */
    pode: (acao: string, robo?: string) => r.podeNaCentral(permissao, acao, robo),
    exemplos: d.exemplos,
    carregado: d.carregado,
    semPermissao: d.semPermissao,
    agora,
    hora: String(data.getHours()).padStart(2, '0') + ':' + String(data.getMinutes()).padStart(2, '0'),
    data: DIAS[data.getDay()] + ', ' + data.getDate() + ' de ' + MESES[data.getMonth()],
    saudacao: r.saudacao(data.getHours()) + (operador ? ', ' + r.primeiroNome(operador.nome) : ''),
    nome: operador?.nome || '',
    sair: () => escolher(null),
    rotuloSair: comLogin ? 'Sair da conta' : 'Trocar de pessoa',
    maquinas,
    situacoes,
    filas,
    erros,
    geral,
    atividades: d.atividades,
    comandos: d.comandos,
    pedir: d.pedir,
  };
}

export type Central = ReturnType<typeof useCentral>;

/** A busca da tela inicial (os ícones que ficam). */
export function useBusca(situacoes: readonly r.SituacaoDoRoboNaCentral[]) {
  const [termo, setTermo] = useState('');
  const ids = useMemo(() => new Set(r.buscarRobos(termo).map(x => x.id)), [termo]);
  return { termo, setTermo, visiveis: situacoes.filter(s => ids.has(s.robo.id)) };
}

/** Uma ação esperando a confirmação na tela. */
export interface AcaoPendente {
  acao: r.AcaoDaCentral; robo: r.RoboDaCentral | null; maquina: r.MaquinaDaCentral; tarefa: r.TarefaDoRobo | null;
  /** o pedido da fila, o cliente e a competência */
  extras?: r.ExtrasDaAcao;
  /** o "Parar tudo" e o "Retomar tudo" vão para mais de uma máquina (um comando em cada) */
  maquinas?: r.MaquinaDaCentral[];
}

/** Estas perguntam a hora de voltar na confirmação. */
const COM_HORA = new Set<string>(['pausar', 'parar-tudo']);
export const aceitaHora = (a: r.AcaoDaCentral) => COM_HORA.has(a.id);

/**
 * Os pedidos de ação: as destrutivas (pausar, limpar a fila, reiniciar, atualizar) esperam o "sim" na tela; as outras vão
 * direto. Depois de gravado, o id do comando fica em `enviado` (a tela acompanha a resposta do robô no histórico).
 */
export function useAcoes(central: Pick<Central, 'pedir' | 'nome'>) {
  const [pendente, setPendente] = useState<AcaoPendente | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState('');
  const [hora, setHora] = useState('');

  const enviar = useCallback(async (p: AcaoPendente, horaDeVoltar = '') => {
    setEnviando(true);
    setErro('');
    try {
      const ate = horaDeVoltar ? r.ateDaHora(horaDeVoltar) : '';
      if (horaDeVoltar && !ate) throw new Error('Essa hora não existe.');
      let id = '';
      for (const m of p.maquinas || [p.maquina]) {
        id = await central.pedir({ acao: p.acao.id, robo: p.robo?.id || '', maquina: m.id, tarefa: p.tarefa?.id, porNome: central.nome, ...p.extras, ...(ate ? { ate } : {}) });
      }
      setEnviado(id);
      setPendente(null);
      setHora('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErro(/permission|insufficient/i.test(msg) ? 'O banco não deixou: você não tem permissão para essa ação (ou as regras novas ainda não foram publicadas).' : msg);
    } finally {
      setEnviando(false);
    }
  }, [central]);

  const pedir = (acao: r.AcaoDaCentral, maquina: r.MaquinaDaCentral, robo: r.RoboDaCentral | null, tarefa: r.TarefaDoRobo | null = null, extras?: r.ExtrasDaAcao) => {
    const p = { acao, maquina, robo, tarefa, extras };
    setErro('');
    setHora('');
    if (acao.destrutiva) setPendente(p);
    else void enviar(p);
  };

  return {
    pendente, enviando, erro, enviado, hora, setHora,
    pedir,
    /** "Parar tudo" / "Retomar tudo": um comando por máquina, com a confirmação (se for destrutiva) antes de todos. */
    pedirEmTodas(acao: r.AcaoDaCentral, maquinas: r.MaquinaDaCentral[]) {
      if (!maquinas.length) return;
      const p = { acao, maquina: maquinas[0], robo: null, tarefa: null, maquinas };
      setErro('');
      setHora('');
      if (acao.destrutiva) setPendente(p);
      else void enviar(p);
    },
    /** Pede de novo só o pedido que deu erro (o texto do erro vai para o histórico). */
    refazer(a: entregas.AtividadeDoRobo) {
      const robo = r.roboDaAtividade(a);
      const acao = r.acaoPorId('refazer');
      const maquina = robo && r.maquinaPorId(robo.maquina);
      if (robo && acao && maquina && a.pedido) pedir(acao, maquina, robo, null, { item: a.pedido, rotulo: a.texto });
    },
    confirmar() { if (pendente) void enviar(pendente, aceitaHora(pendente.acao) ? hora : ''); },
    cancelar() { setPendente(null); setErro(''); setHora(''); },
  };
}

/** Os comandos que tocam um robô (os dele e os da máquina dele). */
export function comandosDoRobo(comandos: readonly r.Comando[], robo: r.RoboDaCentral): r.Comando[] {
  return comandos.filter(c => c.robo === robo.id || (c.maquina === robo.maquina && r.acaoPorId(c.acao)?.alvo === 'maquina'));
}

/** As atividades de um robô, a mais nova primeiro. */
export function atividadesDoRobo(atividades: readonly entregas.AtividadeDoRobo[], robo: r.RoboDaCentral): entregas.AtividadeDoRobo[] {
  return atividades.filter(a => r.roboDaAtividade(a)?.id === robo.id);
}
