// A saúde do robô do Entregas (Cadastro › Configurações). No banco: saude.firestore.ts (lê a cada 30 s enquanto a
// tela está aberta); nos exemplos: aqui, com um robô de mentira ligado.
import { entregas } from '@nads/core';

export interface RepoSaude {
  readonly exemplos: boolean;
  /** os documentos do robô (null enquanto não chegaram) */
  docs(): entregas.DocsDaSaude | null;
  /** começa a ler (e lê de novo a cada 30 s); devolve como parar */
  acompanhar(): () => void;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

export function criarSaudeMemoria(): RepoSaude {
  const ha = (min: number) => new Date(Date.now() - min * 60000).toISOString();
  const docs: entregas.DocsDaSaude = {
    estado: {
      vigia: { em: ha(0.3), pc: 'nuvem-google' }, status: 'ok', ultimaExecucao: ha(42), ultimaExecucaoResumo: '12 e-mails lidos, 4 anexos salvos',
      caixas: { robo: { autorizada: true, email: 'nilmacontabilidade@gmail.com' }, contabil: { autorizada: false }, fiscal: { autorizada: false } },
      backup: { ok: true, em: ha(600), resumo: '38 coleções' }, reguaUltima: { em: ha(3000), enviados: 7 },
    },
    arquivador: { em: ha(1), situacao: 'livre' },
    uso: { em: ha(10), leituras: 18450, gravacoes: 1320 },
    raiz: { atualizadoEm: ha(3), varreduraEm: ha(700) },
    erros: [],
  };
  return { exemplos: true, docs: () => docs, acompanhar: () => () => {}, assinar: () => () => {}, versao: () => 0 };
}
