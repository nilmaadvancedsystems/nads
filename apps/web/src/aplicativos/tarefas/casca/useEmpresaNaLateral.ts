// ViewModel da escolha da empresa no alto do menu ☰ (27/10/2026: "encima onde está vazio vai ser pra selecionar uma
// empresa para mecher nela, ao fazer isso vai ser escolhido uma empresa e entrar no setor vai confirmar vai abrir ela,
// variando de cada setor (tirando dp)"; "faça no estilo do nads"): a busca curta (código ou nome) com a lista embaixo,
// como a das ferramentas do Fiscal, só com as empresas da pessoa ("só é para aparecer as empresas que a pessoa tem");
// escolhida a empresa, a lista vira o "Abrir no …" de cada setor da pessoa ("e só o setor que ele participa"), que abre a
// Visão geral dela naquele setor. A empresa escolhida fica no campo o tempo todo ("a empresa tem que ficar selecionada
// aqui o tempo todo"), em qualquer tela, até a pessoa trocar (guardada neste navegador).
import { empresas } from '@nads/core';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useRepo } from '../dados/repo';
import { useEmpresasDaPessoa } from '../telas/empresas/andamento';
import { caminhoDaPaginaDaEmpresa, setoresDe, type SetorDaEmpresa } from './navegacao';
import { useOperador, type Operador } from './operador';

/** Quantas empresas a busca mostra. */
const ACHADAS = 8;
const CHAVE = 'nads-tarefas-empresa';

interface EmpresaNoMenu { rota: string; codigo: number | null; nome: string }

function lerGuardada(): EmpresaNoMenu | null {
  try { const v = JSON.parse(localStorage.getItem(CHAVE) || 'null'); return v && typeof v.rota === 'string' && typeof v.nome === 'string' ? v : null; } catch { return null; }
}
function guardar(e: EmpresaNoMenu | null) {
  try { if (e) localStorage.setItem(CHAVE, JSON.stringify(e)); else localStorage.removeItem(CHAVE); } catch { /* sem armazenamento: vale só nesta tela */ }
}

export function useEmpresaNaLateral(aberta: { codigo: number | null; nome: string; rota: string } | null, aoAbrir?: () => void) {
  const repo = useRepo();
  const navegar = useNavigate();
  const op = useOperador().operador as Operador;
  const daPessoa = useEmpresasDaPessoa();
  const setores = setoresDe(op);
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState(0);
  /** a empresa do campo: a aberta na tela ou a última escolhida */
  const [atual, setAtual] = useState<EmpresaNoMenu | null>(() => (aberta ? { rota: aberta.rota, codigo: aberta.codigo, nome: aberta.nome } : lerGuardada()));
  /** os setores dela à mostra (depois de escolher, ou clicando no campo) */
  const [mostrarSetores, setMostrarSetores] = useState(false);
  /** buscando outra (o campo de busca no lugar da empresa) */
  const [buscando, setBuscando] = useState(!atual);

  // abriu uma empresa por outro caminho (a lista de Minhas empresas, um link): ela passa a ser a do campo
  useEffect(() => {
    if (aberta && aberta.rota !== atual?.rota) { const e = { rota: aberta.rota, codigo: aberta.codigo, nome: aberta.nome }; setAtual(e); guardar(e); setBuscando(false); }
  }, [aberta, atual?.rota]);

  // só as da pessoa, nos setores dela (o admin e o diretor, todas)
  const minhas = (e: empresas.EmpresaDoEscritorio) => daPessoa.podeVerTodas || setores.some(s => daPessoa.e(e, s.valor));
  const achadas = busca.trim() ? empresas.buscarEmpresas(repo.listarEmpresas().filter(minhas), busca).slice(0, ACHADAS) : [];
  const escolher = (e: empresas.EmpresaDoEscritorio) => {
    const nova = { rota: empresas.rotaDaEmpresa(e), codigo: e.codigo, nome: e.nome };
    setAtual(nova); guardar(nova); setBusca(''); setAtivo(0); setBuscando(false); setMostrarSetores(true);
  };

  return {
    atual, buscando, mostrarSetores,
    busca, setBusca: (s: string) => { setBusca(s); setAtivo(0); },
    achadas, ativo, setAtivo,
    mover: (d: number) => setAtivo(i => (achadas.length ? (i + d + achadas.length) % achadas.length : 0)),
    escolher,
    escolherDestacado: () => { if (achadas[ativo]) escolher(achadas[ativo]); },
    /** clicar na empresa do campo: mostra ou esconde os setores dela */
    alternarSetores: () => setMostrarSetores(m => !m),
    /** o "Trocar empresa" da lista: volta para a busca */
    trocar: () => { setBuscando(true); setMostrarSetores(false); setBusca(''); },
    /** Esc na busca: desiste de trocar (volta a empresa de antes, se tinha) */
    desistir: () => { setBusca(''); setMostrarSetores(false); if (atual) setBuscando(false); },
    /** só os setores da pessoa (o admin, os dois); sem nenhum (o DP), a busca não aparece */
    setores,
    /** abre a empresa no setor: a Visão geral dela (o setor vai no endereço quando não é o da pessoa); fecha o menu */
    abrir: (setor: SetorDaEmpresa) => {
      if (!atual) return;
      setMostrarSetores(false);
      aoAbrir?.();
      navegar(caminhoDaPaginaDaEmpresa(atual.rota, 'visao') + (setor !== op.departamento ? '?dep=' + setor : ''));
    },
  };
}
