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
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

export function criarConfigSciMemoria(): RepoConfigSci {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  let config = sci.integracao.CONFIG_DO_SCI_DESLIGADA;
  return {
    exemplos: true,
    atual: () => ({ carregada: true, config }),
    async salvar(nova) { config = sci.integracao.configDoSci(sci.integracao.documentoDaConfigDoSci(nova, 'exemplo', new Date())); ver++; for (const f of ouvintes) f(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
