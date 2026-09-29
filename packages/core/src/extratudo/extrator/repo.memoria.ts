// Repositório do Extrator EM MEMÓRIA, guardado neste navegador (localStorage) quando dá.
// Modo exemplos: começa com as empresas de exemplo. Modo escritório: começa vazio, com a lista de
// empresas do escritório. Nada vai para o banco.
import type { EmpresaDoEscritorio } from '../../empresas';
import { empresasDeExemplo, EMPRESAS_EXEMPLO } from './__exemplos__/empresas';
import { normalizarEmpresa } from './regras/importacao';
import type { RepoExtrator } from './repo';
import type { EmpresaExtrator } from './tipos';

export interface Guarda {
  ler(): string | null;
  gravar(v: string): void;
  apagar(): void;
}

function guardaDoNavegador(chave: string): Guarda | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    return {
      ler: () => { try { return ls.getItem(chave); } catch { return null; } },
      gravar: v => { try { ls.setItem(chave, v); } catch { /* cheio ou bloqueado: segue em memória */ } },
      apagar: () => { try { ls.removeItem(chave); } catch { /* idem */ } },
    };
  } catch {
    return null;
  }
}

export function criarRepoExtratorMemoria(opcoes: { exemplos: boolean; lista?: readonly EmpresaDoEscritorio[]; guarda?: Guarda | null }): RepoExtrator {
  const guarda = opcoes.guarda === undefined ? guardaDoNavegador(opcoes.exemplos ? 'nads-extrator-exemplos-v1' : 'nads-extrator-v1') : opcoes.guarda;
  const lista = opcoes.lista || (opcoes.exemplos ? EMPRESAS_EXEMPLO : []);
  let dados: Record<string, EmpresaExtrator> = {};
  let ver = 0;
  const ouvintes = new Set<() => void>();

  function carregarExemplos() {
    dados = {};
    if (opcoes.exemplos) for (const e of empresasDeExemplo()) dados[e.nome] = e;
  }

  const salvo = guarda?.ler();
  if (salvo) {
    try {
      const bruto = JSON.parse(salvo) as Record<string, EmpresaExtrator>;
      for (const nome of Object.keys(bruto)) dados[nome] = normalizarEmpresa({ ...bruto[nome], nome });
    } catch {
      carregarExemplos();
    }
  } else carregarExemplos();

  function avisar() {
    ver++;
    guarda?.gravar(JSON.stringify(dados));
    for (const f of ouvintes) f();
  }

  return {
    exemplos: opcoes.exemplos,
    listarEmpresas: () => lista,
    obter: nome => dados[nome] || null,
    salvar(e) {
      dados = { ...dados, [e.nome]: e };
      avisar();
    },
    assinar(f) {
      ouvintes.add(f);
      return () => { ouvintes.delete(f); };
    },
    versao: () => ver,
    restaurarExemplos() {
      if (!opcoes.exemplos) return;
      guarda?.apagar();
      carregarExemplos();
      avisar();
    },
  };
}
