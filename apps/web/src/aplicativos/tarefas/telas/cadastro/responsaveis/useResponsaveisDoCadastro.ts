// ViewModel de Cadastro › Responsáveis (Vitor, 06/10/2026: "na parte de cadastro tem que haver o cadastro por
// responsável"): cada empresa com quem cuida dela no Fiscal e no Contábil, escolhido entre as pessoas da equipe daquele
// departamento. Grava no cadastro da empresa. No Fiscal, sem escolha vale o da planilha do Checklist Folha (os responsáveis
// dela são do Fiscal, Vitor 06/10/2026), mostrado como tal.
// Em cima, cada pessoa com quantas empresas tem (clicar filtra).
import { empresas, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useOperador } from '../../../casca/operador';
import { useAcesso, useGravarCadastro, useTodosOsCadastros } from '../../../dados/repo';

type Dep = empresas.cadastro.DepartamentoDoResponsavel;
const cad = empresas.cadastro;

export function useResponsaveisDoCadastro() {
  const todos = useTodosOsCadastros();
  const gravar = useGravarCadastro();
  const equipe = useAcesso().equipe();
  const op = useOperador().operador;
  const por = op?.nome || '';
  const { toast } = useRetorno();
  const [busca, setBusca] = useState('');
  const [pessoa, setPessoa] = useState('');
  const [semEm, setSemEm] = useState<'' | Dep>('');

  const ativos = equipe.lista.filter(p => p.ativo);
  /** quem pode ser responsável em cada departamento: quem é dele (ou tem o papel dele) */
  const opcoes = Object.fromEntries(cad.DEPARTAMENTOS_DO_RESPONSAVEL.map(d => [d.id,
    ativos.filter(p => p.departamento === d.id || (p.papeis as string[]).includes(d.id)).map(p => p.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'))])) as Record<Dep, string[]>;
  const nomeDaEquipe = (bruto: string) => ativos.find(p => p.nome.toLowerCase() === bruto.toLowerCase())?.nome || '';

  const linhas = empresas.EMPRESAS_COM_DP.map(e => {
    const c = todos.porId.get(formatos.slug(e.nome)) || null;
    const daPlanilha = empresas.clienteDoDp(e.codigo)?.responsavel || '';
    const valor = (d: Dep) => c?.responsaveis?.[d] || '';
    return {
      chave: (e.codigo ?? '') + e.nome, codigo: e.codigo, nome: e.nome, regime: e.regime,
      responsaveis: { fiscal: valor('fiscal'), contabil: valor('contabil') } as Record<Dep, string>,
      /** a transferência pedida e ainda não aceita pelos dois, por departamento */
      transferencias: (c?.transferencias || {}) as Partial<Record<Dep, empresas.cadastro.TransferenciaDeResponsavel>>,
      /** o do Fiscal que vem da planilha (quando ninguém foi escolhido no Cadastro) */
      daPlanilha: !valor('fiscal') && daPlanilha ? nomeDaEquipe(daPlanilha) || daPlanilha.split('.').map(x => x.charAt(0) + x.slice(1).toLowerCase()).join('.') : '',
    };
  });
  const efetivo = (l: (typeof linhas)[number], d: Dep) => l.responsaveis[d] || (d === 'fiscal' ? l.daPlanilha : '');

  const achadas = busca.trim() ? new Set(empresas.buscarEmpresas(linhas.map(l => ({ codigo: l.codigo, nome: l.nome, regime: l.regime })), busca).map(e => e.nome)) : null;
  const filtradas = linhas.filter(l => (!achadas || achadas.has(l.nome))
    && (!pessoa || cad.DEPARTAMENTOS_DO_RESPONSAVEL.some(d => efetivo(l, d.id) === pessoa))
    && (!semEm || !efetivo(l, semEm)));

  // cada pessoa com quantas empresas tem em cada departamento
  const contagem = new Map<string, Record<Dep, number>>();
  for (const l of linhas) for (const d of cad.DEPARTAMENTOS_DO_RESPONSAVEL) {
    const n = efetivo(l, d.id);
    if (!n) continue;
    const r = contagem.get(n) || { fiscal: 0, contabil: 0 };
    r[d.id]++;
    contagem.set(n, r);
  }
  const pessoas = [...contagem.entries()].map(([nome, r]) => ({ nome, ...r, total: r.fiscal + r.contabil }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));

  return {
    carregando: !todos.carregada || !equipe.carregada,
    departamentos: cad.DEPARTAMENTOS_DO_RESPONSAVEL,
    opcoes,
    linhas: filtradas,
    total: linhas.length,
    semResponsavel: Object.fromEntries(cad.DEPARTAMENTOS_DO_RESPONSAVEL.map(d => [d.id, linhas.filter(l => !efetivo(l, d.id)).length])) as Record<Dep, number>,
    pessoas,
    busca, setBusca, pessoa, setPessoa, semEm, setSemEm,
    eu: por,
    admin: !!op?.admin,
    /** o responsável que vale hoje (o escolhido, ou o da planilha no Fiscal) */
    atual: (l: (typeof linhas)[number], d: Dep) => efetivo(l, d),
    faltam: (t: empresas.cadastro.TransferenciaDeResponsavel) => cad.faltamAceitar(t),
    /**
     * Pede a transferência (Vitor, 07/10/2026): só vale com o aceite do emitente (quem é hoje) e do destinatário; quem
     * pede sendo um dos dois já aceita junto.
     */
    transferir(nome: string, codigo: number | null, dep: Dep, de: string, para: string) {
      if (!todos.carregada) return;
      const previa = cad.pedirTransferencia(todos.porId.get(formatos.slug(nome)) || cad.cadastroVazio(nome, codigo), dep, de, para, por, new Date());
      if (previa.erro) { toast(previa.erro); return; }
      void gravar(nome, codigo, atual => {
        const r = cad.pedirTransferencia(atual, dep, de, para, por, new Date());
        return r.erro ? atual : r.cadastro;
      });
      const falta = cad.faltamAceitar(previa.cadastro.transferencias![dep]!);
      toast('Transferência pedida: ' + de + ' → ' + para + '. Falta o aceite de ' + falta.join(' e ') + '.');
    },
    responder(nome: string, codigo: number | null, dep: Dep, aceita: boolean) {
      void gravar(nome, codigo, atual => cad.responderTransferencia(atual, dep, por, aceita, new Date()));
    },
    cancelar(nome: string, codigo: number | null, dep: Dep) {
      void gravar(nome, codigo, atual => cad.cancelarTransferencia(atual, dep, por, new Date()));
    },
    /** escolhe quem cuida da empresa no departamento ('' = ninguém) */
    definir(nome: string, codigo: number | null, dep: Dep, quem: string) {
      if (!todos.carregada) return;
      void gravar(nome, codigo, atual => cad.definirResponsavel(atual, dep, quem, por, new Date()));
    },
  };
}
