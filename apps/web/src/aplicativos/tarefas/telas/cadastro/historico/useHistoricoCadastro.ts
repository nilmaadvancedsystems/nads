// ViewModel do histórico do cadastro da empresa: o que mudou, quem mudou e quando (os mais novos primeiro).
import { formatos } from '@nads/core';
import { useCadastroAberto } from '../useCadastroAberto';

export function useHistoricoCadastro(rota: string) {
  const c = useCadastroAberto(rota);
  return {
    empresa: c.empresa,
    carregando: c.carregando,
    linhas: c.cadastro.historico.map((h, i) => ({ chave: h.ts + i, quando: formatos.dataHora(h.ts), por: h.por, acao: h.acao, detalhe: h.detalhe })),
  };
}
