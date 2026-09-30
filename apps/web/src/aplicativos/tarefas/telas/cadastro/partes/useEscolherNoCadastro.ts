// ViewModel da escolha de empresa no Cadastro (a página sem empresa e o "empresa ▾" da barra de cima):
// a busca comum (nome ou código), as últimas empresas abertas (preferência de quem usa: fica no navegador)
// e entrar na mesma página da outra empresa.
import { empresas } from '@nads/core';
import { useNavigate } from 'react-router';
import { useEscolherEmpresa } from '../../../../../comum/useEscolherEmpresa';
import { caminhoDoCadastro } from '../../../casca/navegacao';

const CHAVE = 'nads-tarefas-cadastro-recentes';
const QUANTAS = 6;

function lerRecentes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}

/** Guarda a empresa como a mais recente (chamado quando uma empresa abre no Cadastro). */
export function lembrarEmpresa(rota: string): void {
  try { localStorage.setItem(CHAVE, JSON.stringify([rota, ...lerRecentes().filter(r => r !== rota)].slice(0, QUANTAS))); } catch { /* vale só agora */ }
}

export function useEscolherNoCadastro(pagina: string, atual?: string) {
  const navegar = useNavigate();
  const entrar = (x: empresas.EmpresaDoEscritorio) => navegar(caminhoDoCadastro(empresas.rotaDaEmpresa(x), pagina));
  const busca = useEscolherEmpresa(empresas.EMPRESAS, entrar);
  const recentes = lerRecentes()
    .filter(r => r !== atual)
    .map(r => empresas.empresaPelaRota(empresas.EMPRESAS, r))
    .filter((x): x is empresas.EmpresaDoEscritorio => !!x);
  return { ...busca, recentes, entrar };
}
