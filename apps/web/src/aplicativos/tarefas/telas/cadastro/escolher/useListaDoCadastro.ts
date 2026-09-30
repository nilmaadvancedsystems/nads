// ViewModel da lista de empresas do Cadastro (a página sem empresa aberta): todas as empresas do escritório,
// com os bancos do cadastro (ou, sem cadastro, os que o robô do Entregas já sabe) e o plano de contas. Busca
// por nome ou código, filtro por situação, e clicar abre a empresa na página pedida.
import { empresas, formatos } from '@nads/core';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDoCadastro } from '../../../casca/navegacao';
import { useBancosDoEntregas, useTodosOsCadastros } from '../../../dados/repo';

const cad = empresas.cadastro;

export type Situacao = '' | 'cadastradas' | 'so-robo' | 'sem-bancos';
export const SITUACOES: readonly { valor: Situacao; rotulo: string }[] = [
  { valor: 'cadastradas', rotulo: 'Com bancos cadastrados' },
  { valor: 'so-robo', rotulo: 'Só o que o robô sabe' },
  { valor: 'sem-bancos', rotulo: 'Sem banco nenhum' },
];

export interface BancoNaLista { marca: string; nome: string; rotulo: string }

export interface LinhaEmpresa {
  chave: string;
  rota: string;
  codigo: number | null;
  nome: string;
  regime: string;
  /** de onde vêm os bancos da linha */
  origem: 'cadastro' | 'robo' | 'nenhum';
  bancos: BancoNaLista[];
  /** quantas contas no plano (null = sem plano) */
  plano: number | null;
  /** "30/09/2026" */
  atualizado: string;
}

export function useListaDoCadastro(pagina: string) {
  const navegar = useNavigate();
  const todos = useTodosOsCadastros();
  const entregas = useBancosDoEntregas();
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<Situacao>('');

  const linhas = useMemo<LinhaEmpresa[]>(() => empresas.EMPRESAS.map(x => {
    const c = todos.porId.get(formatos.slug(x.nome)) || null;
    const doRobo = x.codigo != null ? entregas.porCodigo.get(x.codigo) : undefined;
    const contas = c?.bancos ? c.bancos.filter(b => !b.ate) : cad.contasDoEntregas(doRobo);
    const origem: LinhaEmpresa['origem'] = c?.bancos ? 'cadastro' : contas.length ? 'robo' : 'nenhum';
    return {
      chave: (x.codigo ?? '') + x.nome,
      rota: empresas.rotaDaEmpresa(x),
      codigo: x.codigo,
      nome: x.nome,
      regime: x.regime,
      origem,
      bancos: contas.map(b => ({ marca: b.marca, nome: b.nome, rotulo: empresas.rotuloDaConta(b) })),
      plano: c?.plano?.contas ?? null,
      atualizado: c?.atualizadoEm ? new Date(c.atualizadoEm).toLocaleDateString('pt-BR') : '',
    };
  }), [todos.porId, entregas.porCodigo]);

  const achadas = useMemo(() => {
    const q = busca.trim();
    const base = q ? empresas.buscarEmpresas(linhas, q) : linhas;
    return base.filter(l => !situacao
      || (situacao === 'cadastradas' && l.origem === 'cadastro')
      || (situacao === 'so-robo' && l.origem === 'robo')
      || (situacao === 'sem-bancos' && l.origem === 'nenhum'));
  }, [linhas, busca, situacao]);

  return {
    carregando: !todos.carregada || !entregas.carregado,
    linhas: achadas,
    total: linhas.length,
    cadastradas: linhas.filter(l => l.origem === 'cadastro').length,
    busca, setBusca,
    situacao, setSituacao,
    rotuloSituacao: SITUACOES.find(s => s.valor === situacao)?.rotulo || 'Situação',
    abrir: (rota: string) => navegar(caminhoDoCadastro(rota, pagina)),
  };
}
