// Repositório da Conferência EM MEMÓRIA — a única implementação da cópia (nads).
//
// Como o original faz (só registro, nada disto é executado aqui):
// - conferencia.html grava tudo em Firestore empresas/{slug(nome)} com save() (~L1494):
//   set() do documento inteiro, depois de tirar os campos undefined;
// - lê com onSnapshot na coleção inteira (~L4757) e passa cada documento pelo norm() (~L1513);
// - a lista da entrada é CLIENTES (≈230 empresas escritas no código, ~L1515) + as do banco.
//
// Na cópia: as empresas de exemplo (__exemplos__) + o que a pessoa fizer, guardado só no
// navegador dela (localStorage). O nads não conecta a banco nenhum.
import { empresasDeExemplo, EMPRESAS_EXEMPLO } from './__exemplos__/empresas';
import { normalizarEmpresa } from './regras/empresa';
import { empresaPelaRota, montarListaEmpresas, type RepoConferencia } from './repo';
import type { Empresa, EmpresaDaLista } from './tipos';

interface Guarda {
  ler(): string | null;
  gravar(v: string): void;
  apagar(): void;
}

const CHAVE = 'nads-conferencia-copia-v1';

/** localStorage quando existe e funciona; senão, só memória. */
function guardaDoNavegador(): Guarda | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    return {
      ler: () => { try { return ls.getItem(CHAVE); } catch { return null; } },
      gravar: v => { try { ls.setItem(CHAVE, v); } catch { /* cheio ou bloqueado: segue em memória */ } },
      apagar: () => { try { ls.removeItem(CHAVE); } catch { /* idem */ } },
    };
  } catch {
    return null;
  }
}

export function criarRepoConferenciaMemoria(opcoes: { guarda?: Guarda | null; lista?: EmpresaDaLista[]; exemplos?: () => Empresa[] } = {}): RepoConferencia {
  const guarda = opcoes.guarda === undefined ? guardaDoNavegador() : opcoes.guarda;
  const lista = opcoes.lista || EMPRESAS_EXEMPLO;
  const exemplos = opcoes.exemplos || empresasDeExemplo;
  let dados: Record<string, Empresa> = {};
  let ver = 0;
  const ouvintes = new Set<() => void>();

  function carregarExemplos() {
    dados = {};
    for (const e of exemplos()) dados[e.nome] = normalizarEmpresa(e);
  }

  const salvo = guarda?.ler();
  if (salvo) {
    try {
      const bruto = JSON.parse(salvo) as Record<string, Empresa>;
      for (const nome of Object.keys(bruto)) dados[nome] = normalizarEmpresa({ ...bruto[nome], nome });
    } catch {
      carregarExemplos();
    }
  } else {
    carregarExemplos();
  }

  function avisar() {
    ver++;
    guarda?.gravar(JSON.stringify(dados));
    for (const f of ouvintes) f();
  }

  return {
    exemplos: true,
    pronto() {
      return true;
    },
    listarEmpresas() {
      return montarListaEmpresas(lista, Object.keys(dados));
    },
    obter(nome) {
      return dados[nome] || null;
    },
    empresaPelaRota(rota) {
      return empresaPelaRota(lista, Object.keys(dados), rota);
    },
    salvar(e) {
      dados[e.nome] = e;
      avisar();
    },
    assinar(aoMudar) {
      ouvintes.add(aoMudar);
      return () => { ouvintes.delete(aoMudar); };
    },
    versao() {
      return ver;
    },
    restaurarExemplos() {
      guarda?.apagar();
      carregarExemplos();
      avisar();
    },
  };
}
