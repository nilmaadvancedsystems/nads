// O balancete dinâmico e os razões da empresa num lugar só (Vitor, 16/10/2026: "aplique todas as suas sugestões" — o
// dinâmico como o primeiro passo, na Importação, e um upload só de razões, distribuído por conta). A Importação importa;
// as etapas leem daqui (o razão do tipo delas) quando não têm o próprio. O código da conta vem do nome da aba do XLS do
// Alterdata; de que é a conta, pelo dinâmico (clientes.tipoDoRazao). Fica no guardado da empresa (o "onde parou": neste
// navegador e, com a empresa aberta, no banco).
import { clientes as cl, conferencia as c, tarefas as t } from '@nads/core';
import { useMemo } from 'react';
import { guardadosQueCasam, useGuardado } from './guardado';

export interface RazaoGuardado { arquivo: string; razao: t.RazaoDaConta }
export interface DinamicoGuardado { nome: string; d: cl.BalanceteDinamico }
interface Contabil { dinamico?: DinamicoGuardado; razoes?: Record<string, RazaoGuardado> }

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
  const [g, setG] = useGuardado<Contabil>(nome ? chaveDoContabil(nome) : null, {});
  const dinamico = useMemo(() => g.dinamico?.d ? g.dinamico : (nome ? dinamicoDaEmpresa(nome, codigo) : null), [g, nome, codigo]);
  const razoes = useMemo(() => g.razoes || {}, [g]);

  /** De que é cada razão importado (pelo dinâmico; sem ele, null). */
  const tipos = useMemo(() => {
    const out: Record<string, cl.TipoDoRazao | null> = {};
    for (const k of Object.keys(razoes)) out[k] = dinamico ? cl.tipoDoRazao(dinamico.d, k) : null;
    return out;
  }, [razoes, dinamico]);

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
    usarDinamico: (arquivo: string, d: cl.BalanceteDinamico) => setG(x => ({ ...x, dinamico: { nome: arquivo, d } })),
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
  };
}

export type ContabilDaEmpresa = ReturnType<typeof useContabilDaEmpresa>;
