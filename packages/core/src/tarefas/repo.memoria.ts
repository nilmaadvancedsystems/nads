// Repositório da Tarefas EM MEMÓRIA (dados de exemplo), guardado neste navegador quando dá. Começa
// com as empresas de exemplo do Extrator (901, 902, 903) e algumas etapas já andadas no mês passado,
// para a visão do Contábil não nascer vazia. Nada vai para o banco.
import { EMPRESAS_EXEMPLO } from '../extratudo/extrator/__exemplos__/empresas';
import { competenciasRecentes } from './regras/competencias';
import { dispensar, execucaoNova, fazer, interromper } from './regras/execucao';
import { idDaExecucao, type RepoTarefas } from './repo';
import type { Evento, Execucao } from './tipos';

export interface GuardaTarefas { ler(): string | null; gravar(v: string): void; apagar(): void }

function guardaDoNavegador(chave: string): GuardaTarefas | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    return {
      ler: () => { try { return ls.getItem(chave); } catch { return null; } },
      gravar: v => { try { ls.setItem(chave, v); } catch { /* cheio ou bloqueado: segue em memória */ } },
      apagar: () => { try { ls.removeItem(chave); } catch { /* idem */ } },
    };
  } catch {
    return null;
  }
}

/** Algumas etapas andadas no mês passado, feitas por gente da equipe de exemplo. */
export function execucoesDeExemplo(agora: Date): Execucao[] {
  const c = competenciasRecentes(agora, 1)[0];
  const [e1, e2] = EMPRESAS_EXEMPLO;
  const t = (h: number) => new Date(agora.getTime() - h * 3600000);
  let a = execucaoNova(e1.nome, e1.codigo, c, 'contabil');
  a = fazer(a, 'extratos', 'Clara', t(30)).execucao;
  a = interromper(a, 'conferencia', 'sem-razao', '', 'Clara', t(29)).execucao;
  let b = execucaoNova(e2.nome, e2.codigo, c, 'contabil');
  b = fazer(b, 'extratos', 'Felipe', t(20)).execucao;
  b = fazer(b, 'conferencia', 'Felipe', t(19)).execucao;
  b = dispensar(b, 'cheque-especial', 'sem-negativo', '', 'Felipe', t(18)).execucao;
  return [a, b];
}

export function criarRepoTarefasMemoria(opcoes: { agora?: Date; guarda?: GuardaTarefas | null } = {}): RepoTarefas {
  const guarda = opcoes.guarda === undefined ? guardaDoNavegador('nads-tarefas-exemplos-v1') : opcoes.guarda;
  let dados: Record<string, Execucao> = {};
  let eventos: Evento[] = [];
  let ver = 0;
  const ouvintes = new Set<() => void>();

  function carregarExemplos() {
    dados = {};
    eventos = [];
    for (const ex of execucoesDeExemplo(opcoes.agora || new Date())) dados[idDaExecucao(ex.empresa, ex.competencia, ex.departamento)] = ex;
  }
  const salvo = guarda?.ler();
  if (salvo) {
    try {
      const b = JSON.parse(salvo) as { dados: Record<string, Execucao>; eventos: Evento[] };
      dados = b.dados || {};
      eventos = b.eventos || [];
    } catch { carregarExemplos(); }
  } else carregarExemplos();

  function avisar() {
    ver++;
    guarda?.gravar(JSON.stringify({ dados, eventos }));
    for (const f of ouvintes) f();
  }

  return {
    exemplos: true,
    listarEmpresas: () => EMPRESAS_EXEMPLO,
    execucoes: (competencia, departamento) => Object.values(dados).filter(e => e.competencia === competencia && e.departamento === departamento),
    carregada: () => true,
    gravar(ex, ev) {
      dados = { ...dados, [idDaExecucao(ex.empresa, ex.competencia, ex.departamento)]: ex };
      eventos = [...eventos, ev];
      avisar();
    },
    registrar(_ex, ev) {
      eventos = [...eventos, ev];
      avisar();
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
    restaurarExemplos() { guarda?.apagar(); carregarExemplos(); avisar(); },
  };
}
