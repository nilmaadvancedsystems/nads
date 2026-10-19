// ViewModel da lista de empresas do Cadastro (a página sem empresa aberta): todas as empresas do escritório,
// com os bancos do cadastro (ou, sem cadastro, os que o robô do Entregas já sabe) e o plano de contas. Busca
// por nome ou código, filtro por situação (e pelo que falta no cadastro), e clicar abre a janela da empresa (por cima
// da lista). O interruptor do robô que lê a agência e a conta foi para Cadastro › Robôs e agentes (13/10/2026).
import { demo, empresas, formatos } from '@nads/core';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDoCadastro } from '../../../casca/navegacao';
import { useBancosDoEntregas, useRegimesDoEntregas, useTodosOsCadastros } from '../../../dados/repo';

const cad = empresas.cadastro;

export type Situacao = '' | 'incompletos' | 'completos' | 'cadastradas' | 'so-robo' | 'sem-bancos';
export const SITUACOES: readonly { valor: Situacao; rotulo: string }[] = [
  // o que falta no cadastro (13/10/2026: "reveja a estrutura inteira do cadastro")
  { valor: 'incompletos', rotulo: 'Cadastro incompleto' },
  { valor: 'completos', rotulo: 'Cadastro completo' },
  { valor: 'cadastradas', rotulo: 'Com bancos cadastrados' },
  { valor: 'so-robo', rotulo: 'Só o que o robô sabe' },
  { valor: 'sem-bancos', rotulo: 'Sem banco nenhum' },
];

export interface BancoNaLista { marca: string; nome: string; rotulo: string }

/** O que o cadastro da empresa já tem (a coluna Cadastro: uma bolinha por item). */
export interface ItemDoCadastro { id: string; rotulo: string; tem: boolean }

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
  /** regime, contato, bancos, plano e sócios: o que já tem */
  itens: ItemDoCadastro[];
  completos: number;
}

const completude = (itens: ItemDoCadastro[]) => ({ itens, completos: itens.filter(i => i.tem).length });

export function useListaDoCadastro() {
  useRegimesDoEntregas(); // o regime do Entregas, quando chega
  const navegar = useNavigate();
  const todos = useTodosOsCadastros();
  const entregas = useBancosDoEntregas();
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<Situacao>('');

  // a lista do escritório com as empresas cadastradas pelo nads (Nova empresa)
  const linhas = useMemo<LinhaEmpresa[]>(() => [...demo.comEmpresaDemo(empresas.EMPRESAS, demo.EMPRESA_DEMO), ...cad.empresasCadastradasNoNads(todos.porId.values())
    .filter(n => !empresas.EMPRESAS.some(e => e.nome === n.nome))].map(x => {
    const c = todos.porId.get(formatos.slug(x.nome)) || null;
    const doRobo = x.codigo != null ? entregas.porCodigo.get(x.codigo) : undefined;
    const contas = c?.bancos ? c.bancos.filter(b => !b.ate) : cad.contasDoEntregas(doRobo);
    const origem: LinhaEmpresa['origem'] = c?.bancos ? 'cadastro' : contas.length ? 'robo' : 'nenhum';
    return {
      chave: (x.codigo ?? '') + x.nome,
      rota: empresas.rotaDaEmpresa(x),
      codigo: x.codigo,
      nome: x.nome,
      // o do cadastro, quando escolhido (13/10/2026); senão, o da lista
      regime: (c && cad.regimeDoCadastro(c)) || x.regime,
      origem,
      bancos: contas.map(b => ({ marca: b.marca, nome: b.nome, rotulo: empresas.rotuloDaConta(b) })),
      plano: c?.plano?.contas ?? null,
      atualizado: c?.atualizadoEm ? new Date(c.atualizadoEm).toLocaleDateString('pt-BR') : '',
      ...completude([
        { id: 'regime', rotulo: 'Regime', tem: !!((c && cad.regimeDoCadastro(c)) || x.regime) },
        { id: 'contato', rotulo: 'E-mail ou WhatsApp', tem: !!(c?.contato?.email || c?.contato?.whatsapp) },
        { id: 'bancos', rotulo: 'Contas bancárias', tem: origem === 'cadastro' },
        { id: 'plano', rotulo: 'Plano de contas', tem: c?.plano?.contas != null },
        { id: 'socios', rotulo: 'Sócios', tem: !!c?.socios?.length },
      ]),
    };
  }), [todos.porId, entregas.porCodigo]);

  const achadas = useMemo(() => {
    const q = busca.trim();
    const base = q ? empresas.buscarEmpresas(linhas, q) : linhas;
    return base.filter(l => !situacao
      || (situacao === 'incompletos' && l.completos < l.itens.length)
      || (situacao === 'completos' && l.completos === l.itens.length)
      || (situacao === 'cadastradas' && l.origem === 'cadastro')
      || (situacao === 'so-robo' && l.origem === 'robo')
      || (situacao === 'sem-bancos' && l.origem === 'nenhum'));
  }, [linhas, busca, situacao]);

  return {
    carregando: !todos.carregada || !entregas.carregado,
    linhas: achadas,
    total: linhas.length,
    cadastradas: linhas.filter(l => l.origem === 'cadastro').length,
    incompletas: linhas.filter(l => l.completos < l.itens.length).length,
    busca, setBusca,
    situacao, setSituacao,
    rotuloSituacao: SITUACOES.find(s => s.valor === situacao)?.rotulo || 'Situação',
    abrir: (rota: string) => navegar(caminhoDoCadastro(rota)),
  };
}
