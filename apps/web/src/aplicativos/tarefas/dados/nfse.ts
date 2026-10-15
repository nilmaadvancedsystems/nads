// O emissor de NFS-e do financeiro (15/10/2026: "vamos criar um emissor de notas fiscais para o financeiro"): as notas de
// honorários da Nilma em Taiobeiras (E&L, padrão DPS Nacional), emitidas pelo robô da nuvem com o certificado do
// escritório. O nads pede (nfseEmissoes), guarda a configuração (config/nfse) e o token da prefeitura (segredos/nfse: o
// admin grava e não lê de volta) e mostra o andamento que o robô escreve (robo/nfse e o próprio pedido).
// Interface + a versão de exemplo; a do banco é nfse.firestore.ts.
import { nfse } from '@nads/core';
import type { ListaAoVivo } from './agentes';

export interface RoboNfse { carregado: boolean; ligado: boolean; motivo: string; certificado: { titular: string; validade: string } | null }
export interface ConfigCarregada { carregada: boolean; config: nfse.ConfigNfse | null; tokenGravadoEm: string }
export interface PedidoDeNota { tomador: nfse.TomadorNfse; servico: nfse.ServicoNfse; empresaCodigo: number | null }

export interface RepoNfse {
  readonly exemplos: boolean;
  robo(): RoboNfse;
  /** as notas, a mais nova primeiro (ao vivo) */
  notas(): ListaAoVivo<nfse.NotaFiscal>;
  config(): ConfigCarregada;
  pedir(p: PedidoDeNota, quem: string): Promise<string>;
  /** a recusada volta para a fila (com as correções), com o mesmo número de DPS */
  reenviar(id: string, p: PedidoDeNota): Promise<void>;
  cancelar(id: string, cMotivo: string, motivo: string, quem: string): Promise<void>;
  salvarConfig(c: nfse.ConfigNfse): Promise<void>;
  /** grava o token da prefeitura (não dá para ler de volta) */
  salvarToken(token: string, quem: string): Promise<void>;
  /** o XML da nota autorizada */
  xml(id: string): Promise<string>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** Nos exemplos: o robô ligado, a configuração pronta e três notas (uma autorizada, uma na prefeitura, uma recusada). */
export function criarNfseMemoria(): RepoNfse {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const agora = Date.now();
  const iso = (s: number) => new Date(agora - s * 1000).toISOString();
  let config: nfse.ConfigNfse = {
    ...nfse.CONFIG_PADRAO,
    prestador: { ...nfse.CONFIG_PADRAO.prestador, cnpj: '11222333000181', im: '0001234', fone: '3838451234' },
    servico: { ...nfse.CONFIG_PADRAO.servico, cIntContrib: '1718', cNBS: '118010000' },
    proximoNumero: { homologacao: 4, producao: 1 },
  };
  let tokenGravadoEm = iso(86400);
  const base = (id: string, status: nfse.StatusNfse, nome: string, doc: string, valor: number, s: number): nfse.NotaFiscal => ({
    id, status, ambiente: 'homologacao', tomador: { documento: doc, nome }, servico: { descricao: 'Honorários contábeis de setembro/2026 (EXEMPLO)', valor, competencia: '2026-09-30' },
    empresaCodigo: null, pedidoPor: 'Vitor', pedidoEm: iso(s), dps: null, chaveAcesso: '', numeroNfse: '', erros: [], atualizadoEm: iso(s - 30), cancelamento: null, enviadaEm: iso(s - 5), consultas: 0, autorizadaEm: '',
  });
  let notas: nfse.NotaFiscal[] = [
    { ...base('ex-1', 'autorizada', 'EXEMPLO COMERCIO DE ALIMENTOS LTDA', '11222333000181', 850, 7200), dps: { serie: '1', numero: 1, id: 'DPS316800221122233300018100001000000000000001' }, chaveAcesso: '31680022112223330001810000000000000126100000000001', numeroNfse: '1', empresaCodigo: 292 },
    { ...base('ex-2', 'processando', 'MARIA EXEMPLO DA SILVA', '52998224725', 320, 120), consultas: 3, atualizadoEm: iso(10), dps: { serie: '1', numero: 2, id: 'DPS316800221122233300018100001000000000000002' } },
    { ...base('ex-3', 'erro', 'CLIENTE EXEMPLO LTDA', '11444777000161', 1200, 3600), dps: { serie: '1', numero: 3, id: 'DPS316800221122233300018100001000000000000003' }, erros: [{ codigo: 'E0312', descricao: 'O código de serviço informado não está habilitado para o prestador (EXEMPLO).' }] },
  ];
  return {
    exemplos: true,
    robo: () => ({ carregado: true, ligado: true, motivo: '', certificado: { titular: 'NILMA CONTABILIDADE (EXEMPLO)', validade: '2027-03-10' } }),
    notas: () => ({ carregada: true, lista: [...notas].sort((a, b) => b.pedidoEm.localeCompare(a.pedidoEm)), erro: '' }),
    config: () => ({ carregada: true, config, tokenGravadoEm }),
    async pedir(p, quem) {
      const id = 'ex-' + Date.now();
      notas = [{ ...base(id, 'pedida', p.tomador.nome, p.tomador.documento, p.servico.valor, 0), tomador: p.tomador, servico: p.servico, empresaCodigo: p.empresaCodigo, pedidoPor: quem, ambiente: config.ambiente }, ...notas];
      mudou();
      return id;
    },
    async reenviar(id, p) { notas = notas.map(n => (n.id === id ? { ...n, ...p, status: 'pedida', erros: [] } : n)); mudou(); },
    async cancelar(id, cMotivo, motivo, quem) { notas = notas.map(n => (n.id === id ? { ...n, status: 'cancelamento-pedido', cancelamento: { cMotivo, motivo, pedidoPor: quem, pedidoEm: new Date().toISOString() } } : n)); mudou(); },
    async salvarConfig(c) { config = c; mudou(); },
    async salvarToken() { tokenGravadoEm = new Date().toISOString(); mudou(); },
    async xml(id) { return '<NFSe><!-- exemplo da nota ' + id + ' --></NFSe>'; },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
