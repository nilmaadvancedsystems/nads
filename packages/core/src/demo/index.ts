// @nads/core/demo — a empresa de teste "PERSONALY COMPANY" (Vitor, 01/10/2026: "cria uma empresa Personaly Company,
// com ícones de implantação de dados fictícios para teste; não precisa ficar no banco, só para testar a Tarefas do
// Contábil"). Ela aparece em toda lista de empresas (código 9999), mas nada dela vai para o banco: cada fonte de dados
// (as execuções da Tarefa, o Extrator, a Conferência e o Cadastro) passa por um "desvio" que guarda o que é dela só
// neste navegador, e o resto segue para o banco como sempre. Os dados fictícios: o extrato de cada mês (com um dia
// negativo no primeiro), o razão (batendo, com o cheque especial ou com erros) e a Conferência de exemplo (as notas e o
// balancete, com as contas da folha no Passivo).
import { cadastroVazio, documentoDoCadastro } from '../empresas/cadastro/regras';
import type { PortaCadastro } from '../empresas/cadastro/repo';
import type { ContaBancaria } from '../empresas/cadastro/tipos';
import type { EmpresaDoEscritorio } from '../empresas/tipos';
import { slug } from '../formatos';
import { empresasDeExemplo } from '../conferencia/__exemplos__/empresas';
import type { RepoConferencia } from '../conferencia/repo';
import type { Conta, Empresa as EmpresaConferencia, EmpresaDaLista } from '../conferencia/tipos';
import type { RepoExtrator } from '../extratudo/extrator/repo';
import type { ArquivoLido, EmpresaExtrator, Lancamento } from '../extratudo/extrator/tipos';
import { idDaExecucao, type RepoTarefas } from '../tarefas/repo';
import type { Execucao } from '../tarefas/tipos';

export const EMPRESA_DEMO: EmpresaDoEscritorio = { codigo: 9999, nome: 'PERSONALY COMPANY', regime: 'Simples' };
const ID_DEMO = slug(EMPRESA_DEMO.nome);

/** É a empresa de teste? (pelo nome ou pelo pedaço da URL) */
export function ehEmpresaDemo(nomeOuRota: string | null | undefined): boolean {
  const t = String(nomeOuRota || '');
  return t === String(EMPRESA_DEMO.codigo) || slug(t) === ID_DEMO;
}

/** A lista do escritório com a empresa de teste no fim (sem repetir). */
export function comEmpresaDemo<T extends { nome: string }>(lista: readonly T[], demo: T): T[] {
  return lista.some(x => ehEmpresaDemo(x.nome)) ? lista.slice() : [...lista, demo];
}

export const BANCO_DEMO: ContaBancaria = { id: 'sicoob-0001-123456', marca: 'sicoob', nome: 'Sicoob', agencia: '0001', conta: '12.345-6', tipo: 'corrente' };

// ---------------------------------------------------------------------------------------------------------------------
// guardado neste navegador (nunca no banco)
// ---------------------------------------------------------------------------------------------------------------------
const CHAVES = { tarefas: 'nads-demo-tarefas-v1', extrator: 'nads-demo-extrator-v1', conferencia: 'nads-demo-conferencia-v1', cadastro: 'nads-demo-cadastro-v1' };

function ler<T>(chave: string): T | null {
  try { const v = globalThis.localStorage?.getItem(chave); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}
function gravar(chave: string, v: unknown) {
  try { globalThis.localStorage?.setItem(chave, JSON.stringify(v)); } catch { /* cheio ou bloqueado: fica só na memória */ }
}

// quem recarrega quando os dados de teste são apagados
const recarregar = new Set<() => void>();

/** Apaga tudo o que a empresa de teste tem neste navegador (volta ao começo: a Conferência de exemplo, sem extratos). */
export function apagarDadosDeTeste(): void {
  for (const k of Object.values(CHAVES)) { try { globalThis.localStorage?.removeItem(k); } catch { /* nada */ } }
  for (const f of recarregar) f();
}

// ---------------------------------------------------------------------------------------------------------------------
// dados fictícios
// ---------------------------------------------------------------------------------------------------------------------
/** O saldo antes do primeiro extrato (centavos). */
export const SALDO_INICIAL_DEMO = 250000;

/** [dia, centavos (+ entrou, − saiu), histórico] — o mesmo movimento todo mês, com uns centavos de diferença. */
const MOVIMENTO: readonly [number, number, string][] = [
  [2, 850000, 'PIX RECEBIDO CLIENTE ALFA LTDA'],
  [4, 620000, 'PIX RECEBIDO CLIENTE GAMA LTDA'],
  [5, -480000, 'PAGTO FOLHA DE SALARIOS'],
  [7, -200000, 'PAGTO PRO LABORE SOCIOS'],
  [10, 315040, 'CRED.LIQ.COBRANCA DOC.: 7701'],
  [12, -8990, 'TARIFA PACOTE DE SERVICOS'],
  [15, 543000, 'PIX RECEBIDO CLIENTE DELTA ME'],
  [20, -125030, 'PAGTO GUIA INSS'],
  [20, -38400, 'PAGTO GUIA FGTS'],
  [22, -64218, 'DEBITO ENERGIA ELETRICA CEMIG'],
  [25, -112000, 'PAGTO DARF SIMPLES NACIONAL'],
  [28, 290000, 'PIX RECEBIDO CLIENTE EPSILON'],
];
/** No primeiro mês, um pagamento grande no dia 3 deixa o banco negativo (para o cheque especial). */
const NEGATIVO: [number, number, string] = [3, -1230000, 'PAGTO FORNECEDOR BETA MAQUINAS'];

const dia = (mes: string, d: number) => mes + '-' + String(d).padStart(2, '0');

function lancamentosDoMes(mes: string, i: number): Lancamento[] {
  const linhas = i === 0 ? [...MOVIMENTO.slice(0, 1), NEGATIVO, ...MOVIMENTO.slice(1)] : MOVIMENTO;
  return linhas.map(([d, v, h]) => ({ data: dia(mes, d), valor: v + (v > 0 ? 1 : -1) * i * 1317, historico: h }));
}

/** O extrato de cada mês (o primeiro traz o saldo anterior). */
export function extratosDeTeste(meses: readonly string[]): ArquivoLido[] {
  return meses.slice().sort().map((mes, i) => ({
    nome: 'TESTE extrato Sicoob ' + mes + '.ofx', lancamentos: lancamentosDoMes(mes, i), erro: null,
    ...(i === 0 ? { saldoAnterior: SALDO_INICIAL_DEMO } : {}),
  }));
}

export type RazaoDeTeste = 'bate' | 'cheque' | 'erros';

/**
 * O razão da conta do banco: "bate" (igual ao extrato, com o histórico do sistema), "cheque" (e mais o ajuste e o
 * estorno do cheque especial em cada dia negativo) ou "erros" (falta a tarifa, a energia 2 dias depois, o DARF com
 * 10,00 a mais e a cobrança do dia 10 quebrada em dois clientes — para ver as pendências).
 */
export function razaoDeTeste(meses: readonly string[], tipo: RazaoDeTeste): ArquivoLido[] {
  const ms = meses.slice().sort();
  let saldo = SALDO_INICIAL_DEMO;
  return ms.map((mes, i) => {
    const ext = lancamentosDoMes(mes, i);
    const r: Lancamento[] = [];
    // o saldo de fim de cada dia (para o cheque especial)
    const fim = new Map<string, number>();
    for (const l of ext) { saldo += l.valor; fim.set(l.data, saldo); }
    const dias = [...fim.keys()];
    for (const l of ext) {
      const h = 'Vlr ref. ' + l.historico.toLowerCase();
      if (tipo === 'erros') {
        if (l.historico.startsWith('TARIFA')) continue;
        if (l.historico.includes('CEMIG')) { r.push({ data: dia(mes, 24), valor: l.valor, historico: h }); continue; }
        if (l.historico.includes('DARF')) { r.push({ data: l.data, valor: l.valor - 1000, historico: h }); continue; }
        if (l.historico.includes('COBRANCA')) {
          const a = Math.round(l.valor * 0.6);
          r.push({ data: l.data, valor: a, historico: 'Recebimento cliente ZETA COMERCIO' }, { data: l.data, valor: l.valor - a, historico: 'Recebimento cliente OMEGA LTDA' });
          continue;
        }
      }
      r.push({ data: l.data, valor: l.valor, historico: h });
    }
    if (tipo === 'cheque') {
      dias.forEach((d, k) => {
        const s = fim.get(d) as number;
        if (s >= 0) return;
        r.push({ data: d, valor: -s, historico: 'Ajuste saldo negativo - cheque especial' });
        const seguinte = dias[k + 1];
        if (seguinte) r.push({ data: seguinte, valor: s, historico: 'Estorno do ajuste - cheque especial' });
      });
    }
    return { nome: 'TESTE razão Sicoob ' + mes + (tipo === 'bate' ? '' : tipo === 'cheque' ? ' (com cheque especial)' : ' (com erros)') + '.xls', lancamentos: r, erro: null };
  });
}

/** A Conferência de teste: a de exemplo (notas de 07 e 08/2026, balancete, Ok, diferença e conferido) com as contas da folha. */
export function conferenciaDeTeste(): EmpresaConferencia {
  const base = structuredClone(empresasDeExemplo()[0]);
  const folha: Conta[] = [
    ['40001', 'Salários a Pagar'], ['40002', 'Férias a Pagar'], ['40004', 'INSS a Recolher'], ['40005', 'FGTS a Recolher'],
    ['40007', 'Rescisões a Pagar'], ['40008', 'Multa Rescisória do FGTS a Recolher'], ['36006', 'Pró-labore a Pagar'],
  ].map(([codigo, nome], i): Conta => ({ codigo, nome, grupo: 'Passivo', dc: 'C', valor: i === 2 ? 1250.3 : 0, ordem: 900 + i }));
  return { ...base, nome: EMPRESA_DEMO.nome, contas: [...base.contas, ...folha] };
}

// ---------------------------------------------------------------------------------------------------------------------
// os desvios: a empresa de teste na memória, o resto no repositório de sempre
// ---------------------------------------------------------------------------------------------------------------------
type ComAviso = { definirAviso?: (f: (m: string) => void) => void };
const aviso = (real: object) => {
  const d = (real as ComAviso).definirAviso;
  return d ? { definirAviso: d.bind(real) } : {};
};

/** As execuções da Tarefa: as da empresa de teste neste navegador. */
export function tarefasComDemo<R extends RepoTarefas>(real: R): R {
  let dados: Record<string, Execucao> = ler<Record<string, Execucao>>(CHAVES.tarefas) || {};
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const avisar = () => { ver++; for (const f of ouvintes) f(); };
  recarregar.add(() => { dados = {}; avisar(); });
  let listaReal: readonly EmpresaDoEscritorio[] | null = null, lista: EmpresaDoEscritorio[] = [];
  const w: RepoTarefas = {
    exemplos: real.exemplos,
    listarEmpresas() {
      const l = real.listarEmpresas();
      if (l !== listaReal) { listaReal = l; lista = comEmpresaDemo(l, EMPRESA_DEMO); }
      return lista;
    },
    execucoes: (competencia, departamento) => [...real.execucoes(competencia, departamento),
      ...Object.values(dados).filter(e => e.competencia === competencia && e.departamento === departamento)],
    carregada: (competencia, departamento) => real.carregada(competencia, departamento),
    gravar(ex, ev) {
      if (!ehEmpresaDemo(ex.empresa)) { real.gravar(ex, ev); return; }
      dados = { ...dados, [idDaExecucao(ex.empresa, ex.competencia, ex.departamento)]: ex };
      gravar(CHAVES.tarefas, dados);
      avisar();
    },
    registrar(ex, ev) { if (!ehEmpresaDemo(ex.empresa)) real.registrar(ex, ev); },
    assinar(f) { const parar = real.assinar(f); ouvintes.add(f); return () => { parar(); ouvintes.delete(f); }; },
    versao: () => real.versao() + ver,
    restaurarExemplos: () => real.restaurarExemplos(),
  };
  return Object.assign(w, aviso(real)) as unknown as R;
}

/** O que o Extrator guardou da empresa de teste (para quem lê fora do Extrator, como o check da Tarefas). */
export function extratorDaDemo(): EmpresaExtrator {
  return ler<EmpresaExtrator>(CHAVES.extrator) || { nome: EMPRESA_DEMO.nome, arquivos: [], auditoria: [] };
}

/** O Extrator: a empresa de teste neste navegador. */
export function extratorComDemo<R extends RepoExtrator>(real: R): R {
  let dados: EmpresaExtrator = extratorDaDemo();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const avisar = () => { ver++; for (const f of ouvintes) f(); };
  recarregar.add(() => { dados = extratorDaDemo(); avisar(); });
  let listaReal: readonly EmpresaDoEscritorio[] | null = null, lista: EmpresaDoEscritorio[] = [];
  const w: RepoExtrator = {
    exemplos: real.exemplos,
    listarEmpresas() {
      const l = real.listarEmpresas();
      if (l !== listaReal) { listaReal = l; lista = comEmpresaDemo(l, EMPRESA_DEMO); }
      return lista;
    },
    obter: nome => (ehEmpresaDemo(nome) ? dados : real.obter(nome)),
    carregada: nome => (ehEmpresaDemo(nome) ? true : real.carregada(nome)),
    salvar(e) {
      if (!ehEmpresaDemo(e.nome)) { real.salvar(e); return; }
      dados = e;
      gravar(CHAVES.extrator, e);
      avisar();
    },
    assinar(f) { const parar = real.assinar(f); ouvintes.add(f); return () => { parar(); ouvintes.delete(f); }; },
    versao: () => real.versao() + ver,
    restaurarExemplos: () => real.restaurarExemplos(),
  };
  return Object.assign(w, aviso(real)) as unknown as R;
}

/** A Conferência: a empresa de teste neste navegador (começa com a Conferência de exemplo). */
export function conferenciaComDemo<R extends RepoConferencia>(real: R): R {
  let dados: EmpresaConferencia = ler<EmpresaConferencia>(CHAVES.conferencia) || conferenciaDeTeste();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const avisar = () => { ver++; for (const f of ouvintes) f(); };
  recarregar.add(() => { dados = conferenciaDeTeste(); avisar(); });
  const daLista: EmpresaDaLista = { codigo: EMPRESA_DEMO.codigo, nome: EMPRESA_DEMO.nome, regime: EMPRESA_DEMO.regime };
  const w: RepoConferencia = {
    exemplos: real.exemplos,
    pronto: () => real.pronto(),
    listarEmpresas: () => comEmpresaDemo(real.listarEmpresas(), daLista),
    obter: nome => (ehEmpresaDemo(nome) ? dados : real.obter(nome)),
    empresaPelaRota: rota => (ehEmpresaDemo(rota) ? { nome: EMPRESA_DEMO.nome, codigo: EMPRESA_DEMO.codigo, rota: String(EMPRESA_DEMO.codigo) } : real.empresaPelaRota(rota)),
    salvar(e) {
      if (!ehEmpresaDemo(e.nome)) { real.salvar(e); return; }
      dados = e;
      gravar(CHAVES.conferencia, e);
      avisar();
    },
    assinar(f) { const parar = real.assinar(f); ouvintes.add(f); return () => { parar(); ouvintes.delete(f); }; },
    versao: () => real.versao() + ver,
    restaurarExemplos: () => real.restaurarExemplos(),
  };
  return Object.assign(w, aviso(real)) as unknown as R;
}

type DocCadastro = Record<string, unknown>;
const cadastroDeTeste = (): { cadastro: DocCadastro; plano: DocCadastro | null } => ({
  cadastro: documentoDoCadastro({ ...cadastroVazio(EMPRESA_DEMO.nome, EMPRESA_DEMO.codigo), bancos: [BANCO_DEMO], prestaServico: false }),
  plano: null,
});

/** O Cadastro (a porta que fala com o banco): o cadastro da empresa de teste neste navegador (com o Sicoob). */
export function portaCadastroComDemo(real: PortaCadastro): PortaCadastro {
  let dados = ler<{ cadastro: DocCadastro; plano: DocCadastro | null }>(CHAVES.cadastro) || cadastroDeTeste();
  const ouvintes = new Set<() => void>();
  const avisar = () => { for (const f of ouvintes) f(); };
  recarregar.add(() => { dados = cadastroDeTeste(); avisar(); });
  const ouvir = (entregar: () => void) => { ouvintes.add(entregar); queueMicrotask(entregar); return () => { ouvintes.delete(entregar); }; };
  return {
    ouvirCadastro: (id, chegou, falhou) => (id === ID_DEMO ? ouvir(() => chegou(dados.cadastro)) : real.ouvirCadastro(id, chegou, falhou)),
    ouvirPlano: (id, chegou, falhou) => (id === ID_DEMO ? ouvir(() => chegou(dados.plano)) : real.ouvirPlano(id, chegou, falhou)),
    ouvirTodos(chegou, falhou) {
      let reais: { id: string; doc: DocCadastro }[] = [];
      const entregar = () => chegou([...reais.filter(x => x.id !== ID_DEMO), { id: ID_DEMO, doc: dados.cadastro }]);
      const pararReal = real.ouvirTodos(docs => { reais = docs; entregar(); }, falhou);
      const pararDemo = ouvir(entregar);
      return () => { pararReal(); pararDemo(); };
    },
    async gravar(id, cadastro, plano) {
      if (id !== ID_DEMO) return real.gravar(id, cadastro, plano);
      dados = { cadastro, plano: plano ?? dados.plano };
      gravar(CHAVES.cadastro, dados);
      avisar();
    },
  };
}
