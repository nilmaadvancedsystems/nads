// Os extratos e razões das empresas (o Extrator), usados pelas etapas da Tarefa (Bancos, Importação…). No site ligado
// ao banco, o Firestore da Conferência, coleção `extrator` (extrator.firestore.ts); nos exemplos, neste navegador; a
// empresa de teste (Personaly Company), sempre neste navegador. Um repositório só para o site inteiro.
import { demo, empresas, extrator } from '@nads/core';
import { useCallback, useSyncExternalStore } from 'react';
import { criarRepoExtratorFirestore, nomesNoExtrator, type RepoExtratorFirestore } from './extrator.firestore';
import { ligadoAoBanco } from '../../../comum/modoDesenvolvedor';

const noBanco = ligadoAoBanco();
let repo: extrator.RepoExtrator | null = null;

export function repoDoExtrator(): extrator.RepoExtrator {
  if (!repo) repo = demo.extratorComDemo(noBanco ? criarRepoExtratorFirestore(empresas.EMPRESAS) : extrator.criarRepoExtratorMemoria({ exemplos: true }));
  return repo;
}

/** As empresas com extrato guardado: no banco, as da coleção `extrator`; nos exemplos, as que este navegador tem. */
export async function empresasComExtrato(): Promise<string[]> {
  if (noBanco) return nomesNoExtrator();
  const r = repoDoExtrator();
  return r.listarEmpresas().map(e => e.nome).filter(n => !!r.obter(n));
}

/** Espera a empresa chegar do banco (antes disso, nada é gravado); desiste depois de `ms`. */
export function esperarExtratorDaEmpresa(nome: string, ms = 30_000): Promise<void> {
  const r = repoDoExtrator();
  return new Promise((ok, falha) => {
    if (r.carregada(nome)) { ok(); return; }
    const prazo = setTimeout(() => { parar(); falha(new Error('a empresa não chegou do banco em ' + Math.round(ms / 1000) + ' s')); }, ms);
    const parar = r.assinar(() => { if (r.carregada(nome)) { clearTimeout(prazo); parar(); ok(); } });
    r.obter(nome);
  });
}

/** Os erros do banco (salvar/ler) vão para o aviso da tela. */
export function avisarErrosDoExtrator(r: extrator.RepoExtrator, aviso: (mensagem: string) => void): void {
  if (noBanco) (r as RepoExtratorFirestore).definirAviso(aviso);
}

/** Os extratos e razões da empresa (ou vazio, antes de chegar), sempre a versão mais nova. */
export function useExtratorDaEmpresa(nome: string): extrator.EmpresaExtrator {
  const r = repoDoExtrator();
  useSyncExternalStore(r.assinar, r.versao, r.versao);
  return r.obter(nome) || extrator.empresaNova(nome);
}

/** Aplica uma ação (função pura do core: empresa → empresa nova) e guarda; antes de a empresa chegar, nunca grava. */
export function useAplicarNoExtrator(nome: string) {
  return useCallback((acao: (e: extrator.EmpresaExtrator) => extrator.EmpresaExtrator): extrator.EmpresaExtrator => {
    const r = repoDoExtrator();
    const e = r.obter(nome) || extrator.empresaNova(nome);
    if (!r.carregada(nome)) return e;
    const nova = acao(e);
    if (nova !== e) r.salvar(nova);
    return nova;
  }, [nome]);
}
