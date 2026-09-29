// Repositório do Creditor EM MEMÓRIA (modo exemplos): os balancetes de exemplo, as contas salvas e os clientes aprendidos,
// guardadas neste navegador (localStorage) quando dá. Nada vai para o banco.
import { BALANCETES_EXEMPLO } from './exemplos';
import { clientesDoDocumento, type ClientesAprendidos } from './regras/aprendizado';
import { CONFIG_VAZIA, SEM_BALANCETE, configDoDocumento, type BalanceteDaEmpresa } from './regras/balancete';
import type { RepoCreditor } from './repo';

const NENHUM: ClientesAprendidos = {};
const CHAVE = 'nads-creditor-exemplos-v1';
const CHAVE_CLIENTES = 'nads-creditor-clientes-exemplos-v1';

function ler<T>(chave: string, conferir: (v: Record<string, unknown>) => T): Record<string, T> {
  try {
    const bruto = JSON.parse(globalThis.localStorage?.getItem(chave) || '{}') as Record<string, Record<string, unknown>>;
    return Object.fromEntries(Object.entries(bruto).map(([k, v]) => [k, conferir(v)]));
  } catch {
    return {};
  }
}

function gravar(chave: string, v: unknown) {
  try { globalThis.localStorage?.setItem(chave, JSON.stringify(v)); } catch { /* segue em memória */ }
}

export function criarRepoCreditorMemoria(balancetes: Record<string, BalanceteDaEmpresa> = BALANCETES_EXEMPLO): RepoCreditor {
  let configs = ler(CHAVE, configDoDocumento);
  let clientes = ler(CHAVE_CLIENTES, v => clientesDoDocumento({ clientes: v }));
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const avisar = () => { ver++; for (const f of ouvintes) f(); };
  return {
    exemplos: true,
    balancete: nome => balancetes[nome] || SEM_BALANCETE,
    config: nome => configs[nome] || CONFIG_VAZIA,
    clientes: nome => clientes[nome] || NENHUM,
    carregada: () => true,
    salvarConfig(nome, c) {
      configs = { ...configs, [nome]: { ...c, atualizadoEm: new Date().toISOString() } };
      gravar(CHAVE, configs);
      avisar();
    },
    salvarClientes(nome, c: ClientesAprendidos) {
      clientes = { ...clientes, [nome]: c };
      gravar(CHAVE_CLIENTES, clientes);
      avisar();
    },
    assinar(f) {
      ouvintes.add(f);
      return () => { ouvintes.delete(f); };
    },
    versao: () => ver,
  };
}
