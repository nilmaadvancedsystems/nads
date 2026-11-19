// O código da conta de um tipo de razão (Caixa, INSS, Salários…), para o botão Vitor pedir o razão dela (19/11/2026): a informada
// na etapa (gravada no Cadastro da empresa, "razao-<tipo>"); senão, a do balancete dinâmico; senão, pelo nome no balancete da
// Conferência. Sem nenhuma, a etapa pede para informar (Vitor, 19/11/2026: "sempre que o nads ver que nao tem a conta, pede
// para informar e grave na etapa, para o robo conseguir puxar").
import { empresas } from '@nads/core';
import { useMemo } from 'react';
import { useContabilDaEmpresa } from '../../../../comum/contabilDaEmpresa';
import { useContasDoBalancete } from '../../etapas/conferencia/importadosNaEtapa';
import { useCadastro } from '../../dados/repo';
import { useOperador } from '../../casca/operador';
import { roboDePcDoUsuario } from '../../dados/notasDoFiscal.firestore';

// pelo nome no plano (Vitor, 19/11/2026: "essas contas do razao, tenta pegar do balancete, para eu nao ficar imputando,
// normalmente sao nomes obvios"): o nome sem acento; só a conta analítica, e só quando uma conta só casa
const PELO_NOME: Record<string, RegExp> = {
  caixa: /^caixa( geral)?\b/i,
  inss: /\binss\b.*\b(recolher|pagar)\b/i,
  salarios: /\b(salarios?|ordenados)\b.*\bpagar\b/i,
  fgts: /\bfgts\b.*\b(recolher|pagar)\b/i,
  prolabore: /\bpro.?labore\b.*\bpagar\b/i,
  simples: /\bsimples( nacional)?\b.*\b(recolher|pagar)\b|\bdas\b.*\brecolher\b/i,
  honorarios: /\bhonorarios\b.*\bpagar\b/i,
  'adiantamento-salarial': /\badiantamentos?\b.*\b(salari|empregad|funcionari)/i,
  'adiantamento-fornecedores': /\badiantamentos?\b.*\bfornecedor/i,
  'adiantamento-clientes': /\badiantamentos?\b.*\bclientes?\b/i,
  emprestimos: /\b(emprestimos?|financiamentos?)\b/i,
};
// o parcelamento e o longo prazo não são a conta do dia a dia (o Simples a recolher × o parcelamento do Simples)
const FORA = /parcelamento|longo prazo|\blp\b|juros|encargos|despesa/i;
const sem = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/** As contas analíticas do plano: as do balancete da Conferência e as do balancete dinâmico da tarefa (sem repetir o código). */
function analiticas(conferencia: readonly { codigo: string; nome: string; sintetica?: boolean }[] | null, dinamico: readonly { codigo: string; classificacao: string; descricao: string }[] | null) {
  const todas = new Map<string, string>();
  for (const c of conferencia || []) if (!c.sintetica && c.codigo) todas.set(c.codigo, c.nome);
  if (dinamico?.length) {
    // a sintética é a classificação que tem outra debaixo
    const comFilhas = new Set<string>();
    for (const l of dinamico) { const p = l.classificacao.split('.'); for (let i = 1; i < p.length; i++) comFilhas.add(p.slice(0, i).join('.')); }
    for (const l of dinamico) if (l.codigo && !comFilhas.has(l.classificacao) && !todas.has(l.codigo)) todas.set(l.codigo, l.descricao);
  }
  return [...todas].map(([codigo, nome]) => ({ codigo, nome }));
}

/** As contas que casam com o tipo pelo nome (as do empréstimo podem ser várias; as outras, só uma). */
export function contasPeloNome(tipo: string, plano: readonly { codigo: string; nome: string }[]): { codigo: string; nome: string }[] {
  const re = PELO_NOME[tipo];
  if (!re) return [];
  return plano.filter(c => re.test(sem(c.nome)) && (tipo === 'emprestimos' ? !/juros|despesa/i.test(sem(c.nome)) : !FORA.test(sem(c.nome))));
}

const campo = (tipo: string) => ('razao-' + tipo) as empresas.cadastro.CampoContaDoRazao;

/** O plano da empresa (as analíticas): o balancete da Conferência e o dinâmico da tarefa. */
function usePlanoDaEmpresa(empresa: string, codigo: number | null) {
  const contas = useContasDoBalancete(empresa);
  const linhas = useContabilDaEmpresa(empresa, codigo).dinamico?.d?.linhas || null;
  return useMemo(() => (empresa ? analiticas(contas, linhas) : []), [empresa, contas, linhas]);
}

/** informar: só para o dono do robô de PC (o botão Vitor é só dele) */
export interface ContaDoRazao { conta: string; informada: boolean; informar?: (codigo: string) => void }

/** soInformada: o nads não adivinha (a conta tem de vir da pessoa) */
export function useContaDoTipo(empresa: string, codigo: number | null, tipo: string | null, doDinamico: string, soInformada = false): ContaDoRazao {
  const vivo = useCadastro(empresa, codigo);
  const op = useOperador().operador;
  const cadastro = vivo.carregada ? vivo.cadastro : null;
  const informada = tipo ? cadastro?.contasPadrao?.contas[campo(tipo)] || '' : '';
  const procurar = !!empresa && !!tipo && !informada && !doDinamico && !soInformada;
  const plano = usePlanoDaEmpresa(procurar ? empresa : '', codigo);
  let conta = informada || (soInformada ? '' : doDinamico);
  if (!conta && tipo && procurar) {
    const achadas = contasPeloNome(tipo, plano);
    if (achadas.length === 1) conta = achadas[0].codigo;
  }
  return {
    conta, informada: !!informada,
    informar: !roboDePcDoUsuario() ? undefined : (cod: string) => {
      if (!cadastro || !tipo) return;
      const novo = empresas.cadastro.definirContaPadrao(cadastro, campo(tipo), cod.replace(/\D/g, ''), null, op?.nome || 'Tarefa', new Date());
      if (novo !== cadastro) vivo.salvar(novo);
    },
  };
}

/**
 * As contas de uma lista (os empréstimos: o robô não sabe quais são; Vitor, 19/11/2026): as informadas na etapa, gravadas no
 * Cadastro da empresa ("razao-emprestimos", separadas por vírgula). Informar e tirar só para o dono do robô de PC.
 */
export function useContasInformadas(empresa: string, codigo: number | null, tipo: string) {
  const vivo = useCadastro(empresa, codigo);
  const op = useOperador().operador;
  const cadastro = vivo.carregada ? vivo.cadastro : null;
  const informadas = (cadastro?.contasPadrao?.contas[campo(tipo)] || '').split(',').map(x => x.trim()).filter(Boolean);
  // sem nenhuma informada, as do plano pelo nome (Vitor, 19/11/2026: "tenta pegar do balancete"); informar uma passa a valer só as informadas
  const plano = usePlanoDaEmpresa(informadas.length ? '' : empresa, codigo);
  const peloNome = useMemo(() => contasPeloNome(tipo, plano).map(c => c.codigo), [tipo, plano]);
  const lista = informadas.length ? informadas : peloNome;
  const gravar = (novas: string[]) => {
    if (!cadastro) return;
    const novo = empresas.cadastro.definirContaPadrao(cadastro, campo(tipo), [...new Set(novas)].join(','), null, op?.nome || 'Tarefa', new Date());
    if (novo !== cadastro) vivo.salvar(novo);
  };
  const dono = !!roboDePcDoUsuario();
  return {
    lista, dono,
    adicionar: dono ? (cod: string) => gravar([...lista, cod.replace(/\D/g, '')]) : undefined,
    tirar: dono ? (cod: string) => gravar(lista.filter(x => x !== cod)) : undefined,
  };
}
