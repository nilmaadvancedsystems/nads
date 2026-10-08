// O SIEG no Fiscal (06/10/2026): as contagens de notas do mês e as saídas (a sequência), que o robô do PC do escritório
// grava (Entregas/scripts/sieg.js), e o pedido de baixar as saídas de uma empresa. Interface + a versão de exemplo; a do
// banco é sieg.firestore.ts.
import { tarefas as t } from '@nads/core';

export interface PedidoSieg {
  status: string; andamento: string; erro: string; em: string;
  /** o "Baixar XMLs" pronto: quantos arquivos, quantos novos, onde, e quantas notas */
  resultado?: { arquivos: number; novos: number; pasta: string; emitidas: number; recebidas: number; zip?: string };
  /** o .zip dos XMLs para quem pediu (08/10/2026): o robô entrega antes de ler as notas e salvar no Drive; fica 1 dia */
  zip?: { nome: string; partes: string[]; bytes: number };
  /** o id do pedido (para baixar o .zip uma vez só) */
  id?: string;
}

/** O que se pede ao robô: baixar as saídas (a sequência) ou contar as notas do mês agora (sem esperar a madrugada). */
export type TipoDePedidoSieg = 'saidas' | 'contagem' | 'xmls';

export interface RepoSieg {
  exemplos: boolean;
  /** o robô do SIEG: ligado (com as credenciais) e quando bateu o ponto */
  robo(): { carregado: boolean; ligado: boolean; motivo: string; em: string };
  contagem(codigo: string, competencia: string): { carregada: boolean; dados: t.sieg.ContagemSieg | null };
  saidas(codigo: string, competencia: string): { carregadas: boolean; dados: t.sieg.SaidasSieg | null };
  /** o último pedido desta empresa e mês, de cada tipo (sem tipo = baixar as saídas) */
  pedido(codigo: string, competencia: string, tipo?: TipoDePedidoSieg): PedidoSieg | null;
  pedirSaidas(codigo: string, competencia: string): Promise<void>;
  /** o "Contar agora" (07/10/2026: "tem como ter um botão para puxar na hora?"): o robô conta as notas desta empresa no mês */
  pedirContagem(codigo: string, competencia: string): Promise<void>;
  /** o "Baixar XMLs do SIEG" (07/10/2026): o robô baixa todos os XMLs do mês para a pasta do cliente e grava o resumo */
  pedirXmls(codigo: string, competencia: string): Promise<void>;
  /** o resumo das notas do último "Baixar XMLs" (siegNotas) */
  notas(codigo: string, competencia: string): { carregadas: boolean; dados: t.sieg.NotasSieg | null };
  /** os bytes do .zip que o robô entregou no pedido */
  baixarZip(zip: NonNullable<PedidoSieg['zip']>): Promise<Uint8Array>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** Os XMLs de exemplo (TESTE): duas NF-e emitidas com itens, uma recebida e uma NFS-e com ISS e IRRF retidos. */
function xmlsDeExemplo(competencia: string): Pick<t.sieg.NotasSieg, 'emitidas' | 'recebidas'> {
  const [a, m] = competencia.split('-');
  const dia = (d: number) => String(d).padStart(2, '0') + '/' + m + '/' + a;
  const eu = { doc: '11222333000181', nome: 'EMPRESA (TESTE)' };
  const cli = { doc: '44555666000172', nome: 'CLIENTE EXEMPLO (TESTE)' };
  const forn = { doc: '77888999000163', nome: 'FORNECEDOR EXEMPLO (TESTE)' };
  return {
    emitidas: [
      { tipo: 'NF-e', chave: 'T1', numero: 'T901', serie: '1', data: dia(3), emitente: eu, destinatario: cli, valor: 1500,
        itens: [{ ncm: '21069090', cfop: '5102', cst: '000', cest: '', valor: 1000 }, { ncm: '22021000', cfop: '5405', cst: '060', cest: '0300700', valor: 500 }] },
      { tipo: 'NF-e', chave: 'T2', numero: 'T902', serie: '1', data: dia(9), emitente: eu, destinatario: cli, valor: 800,
        itens: [{ ncm: '21069090', cfop: '5102', cst: '000', cest: '', valor: 800 }] },
      { tipo: 'NFS-e', chave: '', numero: 'T77', serie: '', data: dia(12), emitente: eu, destinatario: cli, valor: 3000, nbs: '1.1506.10.00',
        descricao: 'Consultoria em gestão (TESTE)', retencoes: [{ imposto: 'ISS', valor: 150 }, { imposto: 'IRRF', valor: 45 }] },
    ],
    recebidas: [
      { tipo: 'NF-e', chave: 'T3', numero: 'T501', serie: '1', data: dia(5), emitente: forn, destinatario: eu, valor: 2200,
        itens: [{ ncm: '39232990', cfop: '6102', cst: '090', cest: '', valor: 2200 }] },
    ],
  };
}

/** Nos exemplos: contagens inventadas e uma sequência com dois buracos e uma cancelada (o pedido "baixa" em 2 s). */
export function criarSiegMemoria(): RepoSieg {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const saidas = new Map<string, t.sieg.SaidasSieg>();
  const pedidos = new Map<string, PedidoSieg>();
  const contadasAgora = new Map<string, t.sieg.ContagemSieg>();
  const notasBaixadas = new Map<string, t.sieg.NotasSieg>();
  const agora = () => new Date().toISOString();
  return {
    exemplos: true,
    robo: () => ({ carregado: true, ligado: true, motivo: '', em: agora() }),
    contagem: (codigo, competencia) => ({
      carregada: true,
      dados: contadasAgora.get(codigo + '_' + competencia)
        || { codigo, competencia, em: agora(), emitidas: { NFe: 214, NFCe: 0, NFSe: 3, CTe: 0, CFe: 0 }, recebidas: { NFe: 87, NFCe: 0, NFSe: 5, CTe: 12, CFe: 0 } },
    }),
    saidas: (codigo, competencia) => ({ carregadas: true, dados: saidas.get(codigo + '_' + competencia) || null }),
    // como a contagem: os XMLs de exemplo já estão "baixados" (as tabelas de verificação aparecem sem pedir)
    notas(codigo, competencia) {
      const k = codigo + '_' + competencia;
      if (!notasBaixadas.has(k)) notasBaixadas.set(k, { codigo, competencia, em: agora(), pasta: 'Claudio Secretario/' + competencia + '/EMPRESA ' + codigo, arquivos: 4, novos: 4, ...xmlsDeExemplo(competencia) });
      return { carregadas: true, dados: notasBaixadas.get(k)! };
    },
    // nos exemplos o .zip vem vazio (um zip sem arquivos)
    baixarZip: async () => new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    async pedirXmls(codigo, competencia) {
      const k = codigo + '_' + competencia;
      const em = agora();
      // o .zip entra junto com o "Lendo as notas" (o robô entrega antes), e o pedido novo tem outro id (baixa de novo)
      const id = 'exemplo-' + em;
      const zip = { nome: 'SIEG ' + competencia + ' - EMPRESA ' + codigo + '.zip', partes: ['exemplo'], bytes: 22 };
      const passo = (status: string, andamento: string, ms: number) => setTimeout(() => {
        pedidos.set('xmls|' + k, { id, status, andamento, erro: '', em, ...(/^(Lendo|Salvando)/.test(andamento) ? { zip } : {}) });
        mudou();
      }, ms);
      pedidos.set('xmls|' + k, { status: 'pendente', andamento: '', erro: '', em });
      mudou();
      passo('processando', 'Emitidas · NF-e (0 XMLs até agora)', 600);
      passo('processando', 'Recebidas · NF-e (62 XMLs até agora)', 1400);
      passo('processando', 'Lendo as notas no nads', 1800);
      passo('processando', 'Salvando 104 XMLs no Drive', 2200);
      setTimeout(() => {
        const pasta = 'Claudio Secretario/' + competencia + '/EMPRESA ' + codigo;
        notasBaixadas.set(k, { codigo, competencia, em: agora(), pasta, arquivos: 104, novos: 104, ...xmlsDeExemplo(competencia) });
        pedidos.set('xmls|' + k, { id, status: 'concluido', andamento: '', erro: '', em, zip, resultado: { arquivos: 104, novos: 104, pasta, zip: zip.nome, emitidas: 62, recebidas: 38 } });
        mudou();
      }, 3000);
    },
    pedido: (codigo, competencia, tipo = 'saidas') => pedidos.get(tipo + '|' + codigo + '_' + competencia) || null,
    async pedirContagem(codigo, competencia) {
      const k = codigo + '_' + competencia;
      const em = agora();
      pedidos.set('contagem|' + k, { status: 'pendente', andamento: '', erro: '', em });
      mudou();
      setTimeout(() => { pedidos.set('contagem|' + k, { status: 'processando', andamento: 'emitidas', erro: '', em }); mudou(); }, 700);
      setTimeout(() => { pedidos.set('contagem|' + k, { status: 'processando', andamento: 'recebidas', erro: '', em }); mudou(); }, 1600);
      setTimeout(() => {
        contadasAgora.set(k, { codigo, competencia, em: agora(), emitidas: { NFe: 220, NFCe: 0, NFSe: 3, CTe: 0, CFe: 0 }, recebidas: { NFe: 90, NFCe: 0, NFSe: 5, CTe: 12, CFe: 0 } });
        pedidos.set('contagem|' + k, { status: 'concluido', andamento: '', erro: '', em });
        mudou();
      }, 2600);
    },
    async pedirSaidas(codigo, competencia) {
      const k = codigo + '_' + competencia;
      pedidos.set('saidas|' + k, { status: 'processando', andamento: 'NF-e: 50 notas', erro: '', em: agora() });
      mudou();
      setTimeout(() => {
        const numeros = Array.from({ length: 60 }, (_, i) => 1001 + i).filter(n => n !== 1017 && n !== 1042);
        saidas.set(k, { codigo, competencia, em: agora(), series: [{ modelo: '55', serie: '1', numeros, canceladas: [1033], valor: 184250.4 }] });
        pedidos.set('saidas|' + k, { status: 'concluido', andamento: '', erro: '', em: agora() });
        mudou();
      }, 2000);
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
