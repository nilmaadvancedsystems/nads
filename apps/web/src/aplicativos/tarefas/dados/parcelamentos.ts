// Os parcelamentos dos clientes (Heverton, 20/10/2026: "Parcelamento (inserir dados)"), no banco do Entregas: a coleção
// parcelamentos, a mesma da página Parcelamentos de lá (o robô marca a parcela paga pelo comprovante). A interface e a
// versão de exemplo; a do banco é parcelamentos.firestore.ts.
import type { entregas } from '@nads/core';

export interface RepoParcelamentos {
  exemplos: boolean;
  /** os parcelamentos de um cliente do Entregas (ao vivo; pedir já começa a ouvir) */
  doCliente(clienteId: string): { carregados: boolean; lista: entregas.Parcelamento[]; erro: string };
  /** cadastra (campos: os de entregas.camposDoParcelamento) */
  criar(clienteId: string, clienteNome: string, campos: Record<string, unknown>): Promise<void>;
  /** salva o que mudou (os mesmos campos; o cliente não muda) */
  salvar(id: string, campos: Record<string, unknown>): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

export function criarParcelamentosMemoria(quem: () => string): RepoParcelamentos {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const lista: entregas.Parcelamento[] = [];
  let n = 0;
  const agora = () => new Date().toISOString();
  return {
    exemplos: true,
    doCliente(clienteId) {
      // um de exemplo em cada cliente aberto, para a tela ter o que mostrar
      if (!lista.some(p => p.clienteId === clienteId)) {
        const d = new Date();
        const primeira = d.getFullYear() + '-' + String(Math.max(1, d.getMonth() - 2)).padStart(2, '0');
        lista.push({ id: 'ex-' + ++n, clienteId, clienteNome: '', orgao: 'simples', modalidade: 'Parcelamento simplificado', numero: '0000' + n + '2026', parcelas: 60, primeira, valorParcela: 412.37, dia: 'util', status: 'ativo', aberto: true, pagas: [primeira], obs: '', atualizadoEm: agora(), atualizadoPor: 'exemplo' });
      }
      return { carregados: true, lista: lista.filter(p => p.clienteId === clienteId), erro: '' };
    },
    async criar(clienteId, clienteNome, campos) {
      lista.push({ id: 'ex-' + ++n, clienteId, clienteNome, pagas: [], atualizadoEm: agora(), atualizadoPor: quem(), ...(campos as Partial<entregas.Parcelamento>) } as entregas.Parcelamento);
      mudou();
    },
    async salvar(id, campos) {
      const i = lista.findIndex(p => p.id === id);
      if (i >= 0) lista[i] = { ...lista[i], ...(campos as Partial<entregas.Parcelamento>), atualizadoEm: agora(), atualizadoPor: quem() };
      mudou();
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
