// Repositório da Tarefas EM MEMÓRIA (dados de exemplo), guardado neste navegador quando dá. Começa
// com as empresas de exemplo do Extrator (901, 902, 903) e algumas etapas já andadas no mês passado,
// para a visão do Contábil não nascer vazia. Nada vai para o banco.
import type { EmpresaDoEscritorio } from '../empresas';
import { EMPRESAS_EXEMPLO } from '../extratudo/extrator/__exemplos__/empresas';
import { ROTINA_CONTABIL } from './rotinas/contabil';
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

/** O motivo usado quando a etapa para, nos exemplos. */
const MOTIVO_EXEMPLO: Record<string, string> = {
  extratos: 'sem-extrato', conferencia: 'diferenca', 'cheque-especial': 'sem-saldo-diario', cartoes: 'sem-extrato-cartao',
  liquidacoes: 'sem-relatorio', balancete: 'fiscal-pendente', fechamento: 'revisao',
};
const PESSOAS_EXEMPLO = ['Clara', 'Felipe', 'Vitor'];

/**
 * Exemplos variados para ver a lista cheia: nas primeiras 40 empresas, no mês passado, há concluídas,
 * em andamento, paradas e não iniciadas, mexidas em horas e dias diferentes; nos dois meses antes,
 * quase todas concluídas (com algumas paradas), para o histórico de cada empresa.
 */
export function execucoesVariadas(empresas: readonly EmpresaDoEscritorio[], agora: Date): Execucao[] {
  const etapas = ROTINA_CONTABIL.etapas.map(e => e.id);
  const [c0, c1, c2] = competenciasRecentes(agora, 3);
  const t = (h: number) => new Date(agora.getTime() - h * 3600000);
  const saida: Execucao[] = [];
  /** faz as primeiras n etapas e, se pedir, para a seguinte */
  function andar(emp: EmpresaDoEscritorio, comp: string, n: number, parar: boolean, horas: number, quem: string): Execucao {
    let ex = execucaoNova(emp.nome, emp.codigo, comp, 'contabil');
    for (let j = 0; j < n; j++) {
      const quando = t(horas + (n - j) * 0.5);
      ex = etapas[j] === 'cartoes' && (emp.codigo ?? 0) % 2 === 0
        ? dispensar(ex, 'cartoes', 'sem-cartao', '', quem, quando).execucao
        : fazer(ex, etapas[j], quem, quando).execucao;
    }
    if (parar && n < etapas.length) ex = interromper(ex, etapas[n], MOTIVO_EXEMPLO[etapas[n]], '', quem, t(horas)).execucao;
    return ex;
  }
  empresas.slice(0, 40).forEach((emp, i) => {
    const quem = PESSOAS_EXEMPLO[i % PESSOAS_EXEMPLO.length];
    const horas = 1 + i * 4; // de "há 1 hora" até uns 6 dias
    const tipo = i % 8;
    if (tipo <= 1) saida.push(andar(emp, c0, etapas.length, false, horas, quem));
    else if (tipo <= 3 || tipo === 5) saida.push(andar(emp, c0, 1 + (i % 5), false, horas, quem));
    else if (tipo === 4) saida.push(andar(emp, c0, i % 6, true, horas, quem));
    // 6 e 7: não iniciadas
    saida.push(andar(emp, c1, i % 9 === 0 ? 3 : etapas.length, i % 9 === 0, 24 * 30 + i, quem));
    saida.push(andar(emp, c2, i % 11 === 0 ? 5 : etapas.length, i % 11 === 0, 24 * 60 + i, quem));
  });
  return saida;
}

export function criarRepoTarefasMemoria(opcoes: { agora?: Date; guarda?: GuardaTarefas | null; empresas?: readonly EmpresaDoEscritorio[] } = {}): RepoTarefas {
  // com a lista do escritório, os exemplos são os variados (outra chave no navegador)
  const guarda = opcoes.guarda === undefined ? guardaDoNavegador(opcoes.empresas ? 'nads-tarefas-exemplos-v2' : 'nads-tarefas-exemplos-v1') : opcoes.guarda;
  const lista = opcoes.empresas || EMPRESAS_EXEMPLO;
  let dados: Record<string, Execucao> = {};
  let eventos: Evento[] = [];
  let ver = 0;
  const ouvintes = new Set<() => void>();

  function carregarExemplos() {
    dados = {};
    eventos = [];
    const exemplos = opcoes.empresas ? execucoesVariadas(opcoes.empresas, opcoes.agora || new Date()) : execucoesDeExemplo(opcoes.agora || new Date());
    for (const ex of exemplos) dados[idDaExecucao(ex.empresa, ex.competencia, ex.departamento)] = ex;
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
    listarEmpresas: () => lista,
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
