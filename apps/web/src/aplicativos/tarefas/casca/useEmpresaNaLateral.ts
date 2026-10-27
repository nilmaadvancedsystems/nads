// ViewModel do topo da barra lateral de Minhas empresas (27/10/2026: "encima onde está vazio vai ser pra selecionar uma
// empresa para mecher nela, ao fazer isso vai ser escolhido uma empresa e entrar no setor vai confirmar vai abrir ela,
// variando de cada setor (tirando dp)"): a busca da empresa (código ou nome), o setor (Contábil ou Fiscal, os que a
// pessoa abre) e o Abrir, que leva às Tarefas da empresa naquele setor. Embaixo, os avisos do escritório (o Início).
import { empresas } from '@nads/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAvisos, useRepo } from '../dados/repo';
import { useDepartamentoDaTela } from './departamento';
import { caminhoDaPagina, caminhoDaPaginaDaEmpresa, setoresDe, SETORES_DA_EMPRESA, type SetorDaEmpresa } from './navegacao';
import { useOperador, type Operador } from './operador';

/** Quantas empresas a busca mostra. */
const ACHADAS = 8;

export function useEmpresaNaLateral(aberta: { codigo: number | null; nome: string } | null) {
  const repo = useRepo();
  const navegar = useNavigate();
  const op = useOperador().operador as Operador;
  const { dep } = useDepartamentoDaTela();
  const avisos = useAvisos().lista();
  const setores = setoresDe(op);
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState(0);
  const [escolhida, setEscolhida] = useState<empresas.EmpresaDoEscritorio | null>(null);
  const [setor, setSetor] = useState<SetorDaEmpresa>(() => (setores.includes(dep as SetorDaEmpresa) ? (dep as SetorDaEmpresa) : setores[0] || 'contabil'));

  const lista = repo.listarEmpresas();
  const achadas = busca.trim() ? empresas.buscarEmpresas(lista, busca).slice(0, ACHADAS) : [];
  const escolher = (e: empresas.EmpresaDoEscritorio) => { setEscolhida(e); setBusca(''); setAtivo(0); };
  const limpar = () => { setEscolhida(null); setBusca(''); setAtivo(0); };

  return {
    /** quem é do DP não abre a empresa por aqui (só o Contábil e o Fiscal) */
    podeEscolher: setores.length > 0,
    aberta,
    rotulo: aberta ? (aberta.codigo != null ? aberta.codigo + ' · ' : '') + aberta.nome : 'Escolher empresa',
    busca, setBusca: (s: string) => { setBusca(s); setAtivo(0); },
    achadas, ativo, setAtivo,
    mover: (d: number) => setAtivo(i => (achadas.length ? (i + d + achadas.length) % achadas.length : 0)),
    escolher,
    escolherDestacado: () => { if (achadas[ativo]) escolher(achadas[ativo]); },
    escolhida, trocar: limpar,
    /** o setor só aparece para quem abre os dois (o admin) */
    setores: setores.length > 1 ? SETORES_DA_EMPRESA.filter(s => setores.includes(s.valor)) : [],
    setor, setSetor,
    /** abre a empresa no setor: as Tarefas dela (o setor vai no endereço quando não é o da pessoa) */
    abrir: (fechar: () => void) => {
      if (!escolhida) return;
      const url = caminhoDaPaginaDaEmpresa(empresas.rotaDaEmpresa(escolhida), 'tarefas') + (setor !== op.departamento ? '?dep=' + setor : '');
      limpar();
      fechar();
      navegar(url);
    },
    avisos: avisos.avisos.length,
    verAvisos: () => navegar(caminhoDaPagina('minhas-empresas', 'inicio')),
  };
}
