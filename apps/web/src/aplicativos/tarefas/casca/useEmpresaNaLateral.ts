// ViewModel da escolha da empresa no alto do menu ☰ (27/10/2026: "encima onde está vazio vai ser pra selecionar uma
// empresa para mecher nela, ao fazer isso vai ser escolhido uma empresa e entrar no setor vai confirmar vai abrir ela,
// variando de cada setor (tirando dp)"; "faça no estilo do nads"): a busca curta (código ou nome) com a lista embaixo,
// como a das ferramentas do Fiscal; escolhida a empresa, a lista vira o "Abrir no …" de cada setor da pessoa ("e só o setor que ele
// participa"), que abre a Visão geral dela naquele setor.
import { empresas } from '@nads/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useRepo } from '../dados/repo';
import { caminhoDaPaginaDaEmpresa, setoresDe, type SetorDaEmpresa } from './navegacao';
import { useOperador, type Operador } from './operador';

/** Quantas empresas a busca mostra. */
const ACHADAS = 8;

export function useEmpresaNaLateral(aoAbrir?: () => void) {
  const repo = useRepo();
  const navegar = useNavigate();
  const op = useOperador().operador as Operador;
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState(0);
  const [escolhida, setEscolhida] = useState<empresas.EmpresaDoEscritorio | null>(null);

  const achadas = busca.trim() ? empresas.buscarEmpresas(repo.listarEmpresas(), busca).slice(0, ACHADAS) : [];
  const escolher = (e: empresas.EmpresaDoEscritorio) => { setEscolhida(e); setBusca(''); setAtivo(0); };
  const limpar = () => { setEscolhida(null); setBusca(''); setAtivo(0); };

  return {
    busca, setBusca: (s: string) => { setBusca(s); setAtivo(0); setEscolhida(null); },
    achadas, ativo, setAtivo,
    mover: (d: number) => setAtivo(i => (achadas.length ? (i + d + achadas.length) % achadas.length : 0)),
    escolher,
    escolherDestacado: () => { if (achadas[ativo]) escolher(achadas[ativo]); },
    escolhida, limpar,
    /** só os setores da pessoa (o admin, os dois); sem nenhum (o DP), a busca não aparece */
    setores: setoresDe(op),
    /** abre a empresa no setor: a Visão geral dela (o setor vai no endereço quando não é o da pessoa); fecha o menu */
    abrir: (setor: SetorDaEmpresa) => {
      if (!escolhida) return;
      const url = caminhoDaPaginaDaEmpresa(empresas.rotaDaEmpresa(escolhida), 'visao') + (setor !== op.departamento ? '?dep=' + setor : '');
      limpar();
      aoAbrir?.();
      navegar(url);
    },
  };
}
