// A integração com as APIs da SCI (24/11/2026; o dono: "monta o nads para suportar completamente a integracao do sci mesmo
// que nao vamos usar por agora"): config/sci do Entregas, que o admin liga em Configurações › Integração SCI e o robô e a
// função da Área do Cliente leem. Tudo desligado até alguém ligar. Interface + a versão de exemplo; a do banco é
// configSci.firestore.ts.
import { sci } from '@nads/core';

export interface RepoConfigSci {
  exemplos: boolean;
  /** a configuração (pedir já começa a ouvir) */
  atual(): { carregada: boolean; config: sci.integracao.ConfigDoSci };
  salvar(config: sci.integracao.ConfigDoSci): Promise<void>;
  /** (26/11/2026) os tokens de cliente cadastrados pela tela (só o embaralhado) e o teste do robô de cada um */
  tokens(): { tokens: Record<string, sci.integracao.TokenGuardado>; testes: Record<string, sci.integracao.TesteDoToken> };
  /** embaralha o token com a chave pública e grava; null tira o da empresa */
  gravarToken(codigo: number, token: string | null): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

export function criarConfigSciMemoria(): RepoConfigSci {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  let config = sci.integracao.CONFIG_DO_SCI_DESLIGADA;
  let tokens: Record<string, sci.integracao.TokenGuardado> = {};
  const testes: Record<string, sci.integracao.TesteDoToken> = {};
  return {
    exemplos: true,
    atual: () => ({ carregada: true, config }),
    tokens: () => ({ tokens, testes }),
    async gravarToken(codigo, token) {
      const agora = new Date();
      // nos exemplos não embaralha (nem há robô): o "teste" já vem aprovado
      tokens = sci.integracao.documentoDosTokens(tokens, codigo, token ? 'exemplo' : null, 'exemplo', agora).empresas;
      if (token) testes[String(codigo)] = { ok: true, texto: 'exemplo', em: agora.toISOString(), doToken: agora.toISOString() };
      ver++; for (const f of ouvintes) f();
    },
    async salvar(nova) { config = sci.integracao.configDoSci(sci.integracao.documentoDaConfigDoSci(nova, 'exemplo', new Date())); ver++; for (const f of ouvintes) f(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
