// O balancete dinâmico e os razões da empresa num lugar só (Vitor, 16/10/2026: "aplique todas as suas sugestões" — o
// dinâmico como o primeiro passo, na Importação, e um upload só de razões, distribuído por conta). A Importação importa;
// as etapas leem daqui (o razão do tipo delas) quando não têm o próprio. O código da conta vem do nome da aba do XLS do
// Alterdata; de que é a conta, pelo dinâmico (clientes.tipoDoRazao). Fica no guardado da empresa (o "onde parou": neste
// navegador e, com a empresa aberta, no banco).
// O razão de todas as contas pelo robô do Alterdata (Vitor, 06/11/2026: "não vai ter mais a função de diário, apenas razões
// do lançamento"; antes era o PDF do Diário): fica no mesmo lugar do guardado (o campo diario, no formato do Diário); o razão
// de uma conta sai dele (razaoDoDiario). Mais recente vence: o que se importa ou se preenche pelo robô troca o razão de antes.
import { clientes as cl, conferencia as c, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo } from 'react';
import { guardadosQueCasam, useGuardado } from './guardado';

export interface RazaoGuardado { arquivo: string; razao: t.RazaoDaConta }
/** O nome do razão que veio da Importação (do robô ou do upload), com o número da conta (Vitor, 10/11/2026: "para ajudar"). */
export const rotuloDaImportacao = (x: { conta: string; arquivo: string }) => 'Conta ' + x.conta + ' · ' + x.arquivo + ' (da Importação)';
export interface DinamicoGuardado { nome: string; d: cl.BalanceteDinamico; /** veio do robô: os pedidos lidos */ pedidos?: string[] }
/** O Diário do Alterdata (um PDF com todas as contas do período): os lançamentos lidos, por conta. */
export interface DiarioGuardado { arquivo: string; lido: t.DiarioLido }
interface Contabil { dinamico?: DinamicoGuardado; razoes?: Record<string, RazaoGuardado>; diario?: DiarioGuardado }

/**
 * O robô do Alterdata nas etapas do Contábil (Vitor, 10/11/2026: "precisamos trabalhar mais nele antes de implementar
 * diretamente para o usuário"): false = sem os botões, sem os blocos e sem pedido novo à fila. O que ele já importou fica no
 * guardado e continua valendo. Para voltar, é só pôr true.
 */
export const ROBO_NAS_ETAPAS: boolean = false;

const SEM_RAZAO_DO_ROBO = 'Na Importação, aba Balancete e razões, puxe os razões do Alterdata pelo robô.';

/** A chave do guardado da empresa (o nome: a Importação e as etapas têm o mesmo). */
export const chaveDoContabil = (empresa: string) => 'contabil|' + empresa;

/** O dinâmico da empresa sem o hook (o executor): o daqui, ou o que o Clientes importou antes (codigo|nome na chave). */
export function dinamicoDaEmpresa(nome: string, codigo: number | null): DinamicoGuardado | null {
  const daqui = guardadosQueCasam(k => k === chaveDoContabil(nome))[0] as Contabil | undefined;
  if (daqui?.dinamico?.d) return daqui.dinamico;
  const quem = 'clientes|' + String(codigo ?? nome) + '|';
  const doClientes = guardadosQueCasam(k => k.startsWith(quem) && k.endsWith('|dinamico'))[0] as DinamicoGuardado | undefined;
  return doClientes?.d ? doClientes : null;
}

export function useContabilDaEmpresa(nome: string, codigo: number | null = null) {
  const { aviso } = useRetorno();
  const [g, setG] = useGuardado<Contabil>(nome ? chaveDoContabil(nome) : null, {});
  const dinamico = useMemo(() => g.dinamico?.d ? g.dinamico : (nome ? dinamicoDaEmpresa(nome, codigo) : null), [g, nome, codigo]);
  const razoes = useMemo(() => g.razoes || {}, [g]);
  const diario = g.diario ?? null;

  /** De que é cada razão importado (pelo dinâmico; sem ele, null). */
  const tipos = useMemo(() => {
    const out: Record<string, cl.TipoDoRazao | null> = {};
    for (const k of Object.keys(razoes)) out[k] = dinamico ? cl.tipoDoRazao(dinamico.d, k) : null;
    return out;
  }, [razoes, dinamico]);

  // o saldo inicial do razão do Diário: o do razão do robô (ele traz), ou o saldo anterior do dinâmico, no sinal do razão
  // (devedor negativo). O PDF do Diário não traz o saldo anterior; sem o dinâmico da conta, 0.
  const razaoDoDiarioDaConta = (codigo: string): t.RazaoDaConta | null => {
    if (!diario) return null;
    const doRobo = diario.lido.saldosIniciais?.[codigo];
    const linha = dinamico?.d.linhas.find(l => l.codigo === codigo);
    return t.razaoDoDiario(diario.lido.lancamentos, codigo, doRobo ?? (linha ? -linha.saldoAnterior : 0));
  };

  // preenche o razão de cada conta pelo Diário; a mais recente vence (troca o razão .xls que estava)
  const preencherDoDiario = (codigos: readonly string[]): { contas: string[]; semLancamento: string[] } => {
    if (!diario) return { contas: [], semLancamento: [...codigos] };
    const lidos: Record<string, RazaoGuardado> = {};
    const semLancamento: string[] = [];
    for (const k of codigos) {
      const r = razaoDoDiarioDaConta(k);
      if (r) lidos[k] = { arquivo: 'Diário · ' + diario.arquivo, razao: r };
      else semLancamento.push(k);
    }
    if (Object.keys(lidos).length) setG(x => ({ ...x, razoes: { ...(x.razoes || {}), ...lidos } }));
    return { contas: Object.keys(lidos), semLancamento };
  };

  return {
    dinamico, temDinamicoProprio: !!g.dinamico?.d,
    razoes, tipos,
    /** o balancete dinâmico (XLS do Alterdata) */
    async importarDinamico(f: File) {
      const d = cl.lerBalanceteDinamico(c.lerPlanilha(await f.arrayBuffer()));
      setG(x => ({ ...x, dinamico: { nome: f.name, d } }));
      return d;
    },
    /** o dinâmico já lido (o Clientes e o Fornecedores importam também; vale para todos) */
    usarDinamico: (arquivo: string, d: cl.BalanceteDinamico, pedidos?: string[]) => setG(x => ({ ...x, dinamico: { nome: arquivo, d, ...(pedidos ? { pedidos } : {}) } })),
    tirarDinamico: () => setG(x => { const n = { ...x }; delete n.dinamico; return n; }),
    /** os razões (vários de uma vez): cada um pelo código da aba; o sem código fica de fora (devolve os nomes) */
    async importarRazoes(fs: readonly File[]) {
      const lidos: Record<string, RazaoGuardado> = {};
      const semConta: string[] = [];
      const erros: string[] = [];
      for (const f of fs) {
        try {
          const r = t.lerRazaoDoArquivo(await f.arrayBuffer(), f.name);
          if (r.conta) lidos[r.conta] = { arquivo: f.name, razao: r };
          else semConta.push(f.name);
        } catch (e) { erros.push(f.name + ': ' + (e instanceof Error ? e.message : String(e))); }
      }
      if (Object.keys(lidos).length) setG(x => ({ ...x, razoes: { ...(x.razoes || {}), ...lidos } }));
      return { contas: Object.keys(lidos), semConta, erros };
    },
    tirarRazao: (conta: string) => setG(x => { const r = { ...(x.razoes || {}) }; delete r[conta]; return { ...x, razoes: r }; }),
    /** o razão da conta (o código) */
    razaoDaConta: (conta: string): RazaoGuardado | null => razoes[conta] || null,
    /** os razões de um tipo (o de Clientes, os de Empréstimos: vários) */
    razoesDoTipo: (tipo: cl.TipoDoRazao): (RazaoGuardado & { conta: string })[] =>
      Object.entries(razoes).filter(([k]) => tipos[k] === tipo).map(([conta, r]) => ({ ...r, conta })),
    /** o primeiro razão de um tipo (Caixa, INSS, Salários…) */
    razaoDoTipo: (tipo: cl.TipoDoRazao): (RazaoGuardado & { conta: string }) | null => {
      const k = Object.keys(razoes).find(x => tipos[x] === tipo);
      return k ? { ...razoes[k], conta: k } : null;
    },

    // ─── o Diário (um PDF com todas as contas do período) ───
    /** o Diário guardado (null = não importou) */
    diario,
    tirarDiario: () => setG(x => { const n = { ...x }; delete n.diario; return n; }),
    /** o razão de todas as contas que o robô do Alterdata gerou, já lido: no lugar do Diário (o de antes sai) */
    usarDiarioLido: (arquivo: string, lido: t.DiarioLido) => setG(x => ({ ...x, diario: { arquivo, lido } })),
    /** as contas de um tipo que o razão alimenta (Caixa, Salários…), pelo dinâmico; vazio sem o dinâmico */
    contasDoTipo: (tipo: cl.TipoDoRazao): string[] =>
      dinamico ? cl.razoesPedidos(dinamico.d).filter(p => p.tipo === tipo).map(p => p.codigo) : [],
    razaoDoDiarioDaConta,
    preencherDoDiario,
    /**
     * O botão Diário de um razão do tipo (Caixa, Salários…): preenche as contas do tipo pelo Diário, na Importação (a
     * etapa lê dali quando não tem o próprio). true = preencheu. Sem o Diário, avisa e não faz nada.
     */
    usarDiarioDoTipo(tipo: cl.TipoDoRazao, rotulo: string): boolean {
      if (!diario) { aviso({ tom: 'erro', titulo: 'Sem o razão do robô', texto: SEM_RAZAO_DO_ROBO }); return false; }
      const codigos = dinamico ? cl.razoesPedidos(dinamico.d).filter(p => p.tipo === tipo).map(p => p.codigo) : [];
      if (!codigos.length) { aviso({ tom: 'erro', titulo: 'Sem a conta de ' + rotulo, texto: 'O balancete dinâmico não tem a conta de ' + rotulo + ' com saldo ou movimento no período.' }); return false; }
      const r = preencherDoDiario(codigos);
      if (!r.contas.length) { aviso({ tom: 'erro', titulo: 'O razão do robô não tem ' + rotulo, texto: 'Nenhum lançamento das contas ' + codigos.join(', ') + ' no período.' }); return false; }
      aviso({ tom: 'ok', titulo: 'Razão de ' + rotulo + ' pelo robô', texto: r.semLancamento.length ? 'Sem lançamento no período: ' + r.semLancamento.join(', ') : diario.arquivo });
      return true;
    },
    /** o botão do robô numa conta (Clientes, Fornecedores…): o razão dela, ou null (com aviso). */
    razaoDoDiarioDeConta(codigo: string, rotulo: string): t.RazaoDaConta | null {
      if (!diario) { aviso({ tom: 'erro', titulo: 'Sem o razão do robô', texto: SEM_RAZAO_DO_ROBO }); return null; }
      const r = razaoDoDiarioDaConta(codigo);
      if (!r) aviso({ tom: 'erro', titulo: 'O razão do robô não tem ' + rotulo, texto: 'Nenhum lançamento da conta ' + codigo + ' no período.' });
      return r;
    },
  };
}

export type ContabilDaEmpresa = ReturnType<typeof useContabilDaEmpresa>;
