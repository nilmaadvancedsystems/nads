// O cofre de senhas gov.br e certificados (07/10/2026): o que as telas pedem e gravam. A criptografia é toda no navegador
// (core cofre): aqui só passam os documentos já embaralhados. Interface + a versão de exemplo; a do banco é cofre.firestore.ts.
import type { cofre } from '@nads/core';

export interface RepoCofre {
  exemplos: boolean;
  /** quem está usando (o uid do login; nos exemplos, o nome) */
  eu(): { uid: string; nome: string } | null;
  carregado(): boolean;
  /** a falha ao ler (ex.: as regras do banco ainda não deixam) */
  erro(): string;
  config(): cofre.ConfigDoCofre | null;
  pessoas(): cofre.ChaveDaPessoa[];
  itens(): ReadonlyMap<string, cofre.DocDoCofre>;
  /** cria o cofre: a configuração (com a recuperação) e a primeira chave, já liberada */
  criar(config: cofre.ConfigDoCofre, primeira: cofre.ChaveDaPessoa): Promise<void>;
  /** grava a chave de uma pessoa (o pedido de acesso, ou a liberação pelo código de recuperação) */
  registrarChave(c: cofre.ChaveDaPessoa): Promise<void>;
  liberar(id: string, trancada: string, versao: number, por: string): Promise<void>;
  /** apaga a chave de uma pessoa (recusar o pedido ou tirar o acesso) */
  apagarChave(id: string): Promise<void>;
  salvar(id: string, d: cofre.DocDoCofre): Promise<void>;
  /** grava vários de uma vez (a importação da planilha) */
  salvarVarios(itens: { id: string; doc: cofre.DocDoCofre }[]): Promise<void>;
  salvarConfig(config: cofre.ConfigDoCofre): Promise<void>;
  /** troca a chave do cofre: a configuração nova, as cópias de quem fica e os documentos embaralhados de novo */
  trocarChave(config: cofre.ConfigDoCofre, chaves: { id: string; trancada: string }[], itens: { id: string; doc: cofre.DocDoCofre }[]): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** Nos exemplos: o cofre começa vazio (para criar) e fica só na memória desta aba. */
export function criarCofreMemoria(eu: () => { uid: string; nome: string } | null): RepoCofre {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let config: cofre.ConfigDoCofre | null = null;
  const pessoas = new Map<string, cofre.ChaveDaPessoa>();
  const itens = new Map<string, cofre.DocDoCofre>();
  return {
    exemplos: true,
    eu,
    carregado: () => true,
    erro: () => '',
    config: () => config,
    pessoas: () => [...pessoas.values()],
    itens: () => itens,
    async criar(c, primeira) { config = c; pessoas.set(primeira.id, primeira); mudou(); },
    async registrarChave(c) { pessoas.set(c.id, c); mudou(); },
    async liberar(id, trancada, versao, por) {
      const p = pessoas.get(id);
      if (p) { pessoas.set(id, { ...p, trancada, versao, liberadoPor: por, liberadoEm: new Date().toISOString() }); mudou(); }
    },
    async apagarChave(id) { pessoas.delete(id); mudou(); },
    async salvar(id, d) { itens.set(id, d); mudou(); },
    async salvarVarios(lista) { for (const i of lista) itens.set(i.id, i.doc); mudou(); },
    async salvarConfig(c) { config = c; mudou(); },
    async trocarChave(c, chaves, novos) {
      config = c;
      for (const k of chaves) { const p = pessoas.get(k.id); if (p) pessoas.set(k.id, { ...p, trancada: k.trancada, versao: c.versao }); }
      for (const i of novos) itens.set(i.id, i.doc);
      mudou();
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
