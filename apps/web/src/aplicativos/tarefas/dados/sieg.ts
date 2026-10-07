// O SIEG no Fiscal (06/10/2026): as contagens de notas do mês e as saídas (a sequência), que o robô do PC do escritório
// grava (Entregas/scripts/sieg.js), e o pedido de baixar as saídas de uma empresa. Interface + a versão de exemplo; a do
// banco é sieg.firestore.ts.
import { tarefas as t } from '@nads/core';

export interface PedidoSieg {
  status: string; andamento: string; erro: string; em: string;
  /** o "Baixar XMLs" pronto: quantos arquivos, quantos novos, onde, e quantas notas */
  resultado?: { arquivos: number; novos: number; pasta: string; emitidas: number; recebidas: number; zip?: string };
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
  assinar(aoMudar: () => void): () => void;
  versao(): number;
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
    notas: (codigo, competencia) => ({ carregadas: true, dados: notasBaixadas.get(codigo + '_' + competencia) || null }),
    async pedirXmls(codigo, competencia) {
      const k = codigo + '_' + competencia;
      const em = agora();
      const passo = (status: string, andamento: string, ms: number) => setTimeout(() => { pedidos.set('xmls|' + k, { status, andamento, erro: '', em }); mudou(); }, ms);
      pedidos.set('xmls|' + k, { status: 'pendente', andamento: '', erro: '', em });
      mudou();
      passo('processando', 'Emitidas · NF-e (0 XMLs até agora)', 600);
      passo('processando', 'Recebidas · NF-e (62 XMLs até agora)', 1400);
      passo('processando', 'Salvando 104 XMLs no Drive', 2200);
      setTimeout(() => {
        const pasta = 'Claudio Secretario/' + competencia + '/EMPRESA ' + codigo;
        notasBaixadas.set(k, { codigo, competencia, em: agora(), pasta, arquivos: 104, novos: 104, emitidas: [], recebidas: [] });
        pedidos.set('xmls|' + k, { status: 'concluido', andamento: '', erro: '', em, resultado: { arquivos: 104, novos: 104, pasta, emitidas: 62, recebidas: 38 } });
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
