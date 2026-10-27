// ViewModel do topo da barra lateral de Minhas empresas (27/10/2026: "encima onde está vazio vai ser pra selecionar uma
// empresa para mecher nela, ao fazer isso vai ser escolhido uma empresa e entrar no setor vai confirmar vai abrir ela,
// variando de cada setor (tirando dp)"): a busca da empresa (código ou nome), o setor (Contábil ou Fiscal, sempre à vista)
// e o Abrir, que leva à Visão geral da empresa naquele setor (o painel dela).
import { empresas } from '@nads/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useRepo } from '../dados/repo';
import { useDepartamentoDaTela } from './departamento';
import { caminhoDaPaginaDaEmpresa, SETORES_DA_EMPRESA, type SetorDaEmpresa } from './navegacao';
import { useOperador, type Operador } from './operador';

/** Quantas empresas a busca mostra. */
const ACHADAS = 8;

export function useEmpresaNaLateral(aberta: { codigo: number | null; nome: string } | null) {
  const repo = useRepo();
  const navegar = useNavigate();
  const op = useOperador().operador as Operador;
  const { dep } = useDepartamentoDaTela();
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState(0);
  const [escolhida, setEscolhida] = useState<empresas.EmpresaDoEscritorio | null>(null);
  // o setor começa no da tela (no módulo Fiscal, o Fiscal) ou no da pessoa; o DP começa no Contábil
  const [setor, setSetor] = useState<SetorDaEmpresa>(() => (dep === 'fiscal' ? 'fiscal' : 'contabil'));

  const lista = repo.listarEmpresas();
  const achadas = busca.trim() ? empresas.buscarEmpresas(lista, busca).slice(0, ACHADAS) : [];
  const escolher = (e: empresas.EmpresaDoEscritorio) => { setEscolhida(e); setBusca(''); setAtivo(0); };
  const limpar = () => { setEscolhida(null); setBusca(''); setAtivo(0); };

  return {
    aberta,
    rotulo: aberta ? aberta.nome : 'Escolher empresa',
    /** a linha de cima do seletor: o código e o setor da empresa aberta */
    detalhe: aberta ? [aberta.codigo != null ? String(aberta.codigo) : '', SETORES_DA_EMPRESA.find(x => x.valor === dep)?.rotulo || ''].filter(Boolean).join(' · ') : 'Empresa',
    busca, setBusca: (s: string) => { setBusca(s); setAtivo(0); },
    achadas, ativo, setAtivo,
    mover: (d: number) => setAtivo(i => (achadas.length ? (i + d + achadas.length) % achadas.length : 0)),
    escolher,
    escolherDestacado: () => { if (achadas[ativo]) escolher(achadas[ativo]); },
    escolhida, trocar: limpar,
    setores: SETORES_DA_EMPRESA,
    setor, setSetor,
    /** abre a empresa no setor: a Visão geral dela (o setor vai no endereço quando não é o da pessoa) */
    abrir: (fechar: () => void) => {
      if (!escolhida) return;
      const url = caminhoDaPaginaDaEmpresa(empresas.rotaDaEmpresa(escolhida), 'visao') + (setor !== op.departamento ? '?dep=' + setor : '');
      limpar();
      fechar();
      navegar(url);
    },
  };
}
