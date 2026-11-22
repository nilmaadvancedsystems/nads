// O registro de alterações (22/11/2026, ficha E20; o dono: "pode fazer tudo"): as últimas linhas da auditoria (o nads, os
// robôs e o Entregas gravam lá), lidas ao abrir a página (não ao vivo). O exemplo fica na memória.
import { usuarios as u } from '@nads/core';

export interface RepoDoRegistro {
  /** as últimas linhas, a mais nova primeiro. Erro em português */
  ultimas(): Promise<u.LinhaDaAuditoria[]>;
}

export function criarRegistroMemoria(): RepoDoRegistro {
  const agora = Date.now();
  const linha = (min: number, acao: string, detalhe: string, por: string, origem = 'nads') => u.linhaDaAuditoria('ex' + min, { acao, detalhe, feitoPorNome: por, quando: new Date(agora - min * 60000).toISOString(), origem })!;
  return {
    async ultimas() {
      return [
        linha(5, 'acesso-liberado', 'Clara · Notebook da recepção', 'Vitor'),
        linha(40, 'usuario-cargo', 'Felipe: contabil · pleno', 'Vitor'),
        linha(90, 'recusa_de_documento', 'PADARIA BOA · extrato.pdf · É de outro mês', 'Clara (pelo robô)', 'area-cliente'),
        linha(300, 'usuario-desativado', 'Contábil Curioso', 'Gustavo.S'),
        linha(1440, 'cobranca_lote', '12 clientes · 2026-10', 'Fabiana', 'vigia-robo'),
      ];
    },
  };
}
