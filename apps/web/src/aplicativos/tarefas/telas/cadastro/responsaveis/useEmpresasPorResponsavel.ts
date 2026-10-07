// ViewModel das empresas por responsável (Vitor, 06–07/10/2026: "o cadastro por responsável"; "a empresa seria transferida
// com a permissão do emitente e do destinatário"; "essa aba podia entrar em Usuários… dentro de cada usuário vai ter as
// empresas dele"): cada empresa com quem cuida dela no Fiscal e no Contábil (no Fiscal, sem escolha vale o da planilha
// do Checklist Folha) e a transferência pedida. Usado pela janela Empresas por responsável (Cadastro › Usuários), pelo
// tópico Empresas da janela do usuário e pelo Minhas empresas da Minha página. Grava no cadastro da empresa.
import { empresas, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useOperador } from '../../../casca/operador';
import { useAcesso, useGravarCadastro, useTodosOsCadastros } from '../../../dados/repo';

export type Dep = empresas.cadastro.DepartamentoDoResponsavel;
const cad = empresas.cadastro;
const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function useEmpresasPorResponsavel() {
  const todos = useTodosOsCadastros();
  const gravar = useGravarCadastro();
  const equipe = useAcesso().equipe();
  const op = useOperador().operador;
  const por = op?.nome || '';
  const { toast } = useRetorno();

  const ativos = equipe.lista.filter(p => p.ativo);
  /** quem pode ser responsável em cada departamento: quem é dele (ou tem o papel dele) */
  const opcoes = Object.fromEntries(cad.DEPARTAMENTOS_DO_RESPONSAVEL.map(d => [d.id,
    ativos.filter(p => p.departamento === d.id || (p.papeis as string[]).includes(d.id)).map(p => p.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'))])) as Record<Dep, string[]>;
  const nomeDaEquipe = (bruto: string) => ativos.find(p => igual(p.nome, bruto))?.nome || '';

  const linhas = empresas.EMPRESAS_COM_DP.map(e => {
    const c = todos.porId.get(formatos.slug(e.nome)) || null;
    const daPlanilhaBruto = empresas.clienteDoDp(e.codigo)?.responsavel || '';
    const daPlanilha = daPlanilhaBruto ? nomeDaEquipe(daPlanilhaBruto) || daPlanilhaBruto.split('.').map(x => x.charAt(0) + x.slice(1).toLowerCase()).join('.') : '';
    const responsaveis = { fiscal: c?.responsaveis?.fiscal || '', contabil: c?.responsaveis?.contabil || '' } as Record<Dep, string>;
    return {
      chave: (e.codigo ?? '') + e.nome, codigo: e.codigo, nome: e.nome, regime: e.regime, responsaveis,
      transferencias: (c?.transferencias || {}) as Partial<Record<Dep, empresas.cadastro.TransferenciaDeResponsavel>>,
      /** o responsável que vale hoje (o escolhido; no Fiscal, sem escolha, o da planilha) e se veio da planilha */
      atual: { fiscal: responsaveis.fiscal || daPlanilha, contabil: responsaveis.contabil } as Record<Dep, string>,
      daPlanilha: { fiscal: !responsaveis.fiscal && !!daPlanilha, contabil: false } as Record<Dep, boolean>,
    };
  });
  type Linha = (typeof linhas)[number];

  /** as empresas de uma pessoa (de que ela cuida, ou com transferência que a envolve), por departamento */
  function empresasDe(pessoa: string) {
    const lista: { linha: Linha; dep: Dep; rotulo: string }[] = [];
    for (const l of linhas) for (const d of cad.DEPARTAMENTOS_DO_RESPONSAVEL) {
      const t = l.transferencias[d.id];
      if (igual(l.atual[d.id], pessoa) || (t && (igual(t.de, pessoa) || igual(t.para, pessoa)))) lista.push({ linha: l, dep: d.id, rotulo: d.rotulo });
    }
    return lista.sort((a, b) => a.linha.nome.localeCompare(b.linha.nome, 'pt-BR'));
  }

  // cada pessoa com quantas empresas tem em cada departamento
  const contagem = new Map<string, Record<Dep, number>>();
  for (const l of linhas) for (const d of cad.DEPARTAMENTOS_DO_RESPONSAVEL) {
    const n = l.atual[d.id];
    if (!n) continue;
    const r = contagem.get(n) || { fiscal: 0, contabil: 0 };
    r[d.id]++;
    contagem.set(n, r);
  }

  return {
    carregando: !todos.carregada || !equipe.carregada,
    departamentos: cad.DEPARTAMENTOS_DO_RESPONSAVEL,
    opcoes,
    eu: por,
    admin: !!op?.admin,
    pessoas: [...contagem.entries()].map(([nome, r]) => ({ nome, ...r, total: r.fiscal + r.contabil }))
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR')),
    empresasDe,
    /** as empresas sem responsável num departamento (para escolher direto) */
    semResponsavel: (dep: Dep) => linhas.filter(l => !l.atual[dep] && !l.transferencias[dep]),
    faltam: (t: empresas.cadastro.TransferenciaDeResponsavel) => cad.faltamAceitar(t),
    igual,
    /** pede a transferência: só vale com o aceite do emitente (quem é hoje) e do destinatário; quem pede sendo um dos dois já aceita */
    transferir(nome: string, codigo: number | null, dep: Dep, de: string, para: string) {
      if (!todos.carregada) return;
      const previa = cad.pedirTransferencia(todos.porId.get(formatos.slug(nome)) || cad.cadastroVazio(nome, codigo), dep, de, para, por, new Date());
      if (previa.erro) { toast(previa.erro); return; }
      void gravar(nome, codigo, atual => { const r = cad.pedirTransferencia(atual, dep, de, para, por, new Date()); return r.erro ? atual : r.cadastro; });
      const falta = cad.faltamAceitar(previa.cadastro.transferencias![dep]!);
      toast('Transferência pedida: ' + de + ' → ' + para + '. Falta o aceite de ' + falta.join(' e ') + '.');
    },
    responder(nome: string, codigo: number | null, dep: Dep, aceita: boolean) {
      void gravar(nome, codigo, atual => cad.responderTransferencia(atual, dep, por, aceita, new Date()));
    },
    cancelar(nome: string, codigo: number | null, dep: Dep) {
      void gravar(nome, codigo, atual => cad.cancelarTransferencia(atual, dep, por, new Date()));
    },
    /** escolhe direto quem cuida de uma empresa sem responsável */
    definir(nome: string, codigo: number | null, dep: Dep, quem: string) {
      if (!todos.carregada) return;
      void gravar(nome, codigo, atual => cad.definirResponsavel(atual, dep, quem, por, new Date()));
    },
  };
}

export type VmEmpresasPorResponsavel = ReturnType<typeof useEmpresasPorResponsavel>;
