// O Lançatudo (17/11/2026: "um Mister dentro do nads"): as regras e as contas aprendidas de cada empresa, e as decisões e as
// exportações de cada mês. No banco, ao lado do Extrator e do Creditor (lancatudo.firestore.ts); nos exemplos, na memória.
// Interface + a versão de exemplo.
import { lancatudo } from '@nads/core';

export interface ConfigNoBanco { carregada: boolean; config: lancatudo.ConfigDoLancatudo; erro: string }
export interface MesNoBanco { carregado: boolean; mes: lancatudo.MesDoLancatudo; erro: string }

export interface RepoLancatudo {
  readonly exemplos: boolean;
  /** as regras e as contas aprendidas da empresa (pelo nome dela), ao vivo */
  config(empresa: string): ConfigNoBanco;
  salvarConfig(empresa: string, c: lancatudo.ConfigDoLancatudo): Promise<void>;
  /** as decisões e as exportações do mês ('aaaa-mm'), ao vivo */
  mes(empresa: string, competencia: string): MesNoBanco;
  salvarMes(empresa: string, m: lancatudo.MesDoLancatudo): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/**
 * Os exemplos da empresa 901 (a do extrato de exemplo de agosto/2026), para a tela mostrar o automático funcionando (18/11/2026:
 * "parece que tá faltando algo"): três regras (as tarifas, o DARF do Simples e o fornecedor Delta) e a conta aprendida do
 * cliente Beta. O depósito em dinheiro fica para revisar.
 */
function exemplos(): Map<string, lancatudo.ConfigDoLancatudo> {
  const em = '2026-09-01T12:00:00.000Z';
  const regra = (id: string, r: Omit<lancatudo.RegraDoLancatudo, 'id' | 'criadaEm' | 'por'>): lancatudo.RegraDoLancatudo => ({ ...r, id, criadaEm: em, por: 'Vitor' });
  const beta = lancatudo.chaveLembrada('TED RECEBIDA BETA LTDA', 1) as string;
  return new Map([['EXEMPLO COMERCIO DE ALIMENTOS LTDA', {
    regras: [
      regra('ex-tarifa', { descricao: 'Tarifas do banco', tipo: 'historico', expressao: 'TARIFA', sentido: 'saida', banco: 'sicoob-3001-123456', conta: '81012', historico: 'Tarifa bancária', comHistoricoDoExtrato: true, codHistorico: '92060' }),
      regra('ex-simples', { descricao: 'DARF do Simples', tipo: 'historico', expressao: 'DARF*SIMPLES', sentido: 'saida', banco: 'sicoob-3001-123456', conta: '20501', historico: 'Pagto. Simples Nacional', comHistoricoDoExtrato: false, codHistorico: '10050' }),
      regra('ex-delta', { descricao: 'Fornecedor Delta', tipo: 'favorecido', expressao: 'DELTA', sentido: 'saida', banco: 'sicoob-3001-123456', conta: '21101', historico: 'Pagto. Fornecedor Delta', comHistoricoDoExtrato: false, codHistorico: '10111' }),
    ],
    lembradas: { [beta]: { conta: '11202', exemplo: 'TED RECEBIDA BETA LTDA', em, por: 'Vitor' } },
  }]]);
}

/** Nos exemplos: a 901 com as regras de exemplo; as outras começam vazias. Fica só na memória. */
export function criarLancatudoMemoria(): RepoLancatudo {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const configs = new Map<string, ConfigNoBanco>([...exemplos()].map(([nome, config]) => [nome, { carregada: true, config, erro: '' }]));
  const meses = new Map<string, MesNoBanco>();
  return {
    exemplos: true,
    config(empresa) {
      if (!configs.has(empresa)) configs.set(empresa, { carregada: true, config: lancatudo.configVazia(), erro: '' });
      return configs.get(empresa)!;
    },
    async salvarConfig(empresa, c) { configs.set(empresa, { carregada: true, config: c, erro: '' }); mudou(); },
    mes(empresa, competencia) {
      const k = empresa + '|' + competencia;
      if (!meses.has(k)) meses.set(k, { carregado: true, mes: lancatudo.mesVazio(competencia), erro: '' });
      return meses.get(k)!;
    },
    async salvarMes(empresa, m) { meses.set(empresa + '|' + m.competencia, { carregado: true, mes: m, erro: '' }); mudou(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
