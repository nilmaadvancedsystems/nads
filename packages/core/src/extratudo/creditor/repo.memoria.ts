// Repositório do Creditor EM MEMÓRIA (modo exemplos): os balancetes de exemplo e as contas salvas,
// guardadas neste navegador (localStorage) quando dá. Nada vai para o banco.
import { BALANCETES_EXEMPLO } from './exemplos';
import { CONFIG_VAZIA, SEM_BALANCETE, configDoDocumento, type BalanceteDaEmpresa, type ConfigCreditor } from './regras/balancete';
import type { RepoCreditor } from './repo';

const CHAVE = 'nads-creditor-exemplos-v1';

function ler(): Record<string, ConfigCreditor> {
  try {
    const bruto = JSON.parse(globalThis.localStorage?.getItem(CHAVE) || '{}') as Record<string, Record<string, unknown>>;
    return Object.fromEntries(Object.entries(bruto).map(([k, v]) => [k, configDoDocumento(v)]));
  } catch {
    return {};
  }
}

export function criarRepoCreditorMemoria(balancetes: Record<string, BalanceteDaEmpresa> = BALANCETES_EXEMPLO): RepoCreditor {
  let configs = ler();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  return {
    exemplos: true,
    balancete: nome => balancetes[nome] || SEM_BALANCETE,
    config: nome => configs[nome] || CONFIG_VAZIA,
    carregada: () => true,
    salvarConfig(nome, c) {
      configs = { ...configs, [nome]: { ...c, atualizadoEm: new Date().toISOString() } };
      try { globalThis.localStorage?.setItem(CHAVE, JSON.stringify(configs)); } catch { /* segue em memória */ }
      ver++;
      for (const f of ouvintes) f();
    },
    assinar(f) {
      ouvintes.add(f);
      return () => { ouvintes.delete(f); };
    },
    versao: () => ver,
  };
}
