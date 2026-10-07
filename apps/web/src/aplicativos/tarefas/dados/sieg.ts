// O SIEG no Fiscal (06/10/2026): as contagens de notas do mês e as saídas (a sequência), que o robô do PC do escritório
// grava (Entregas/scripts/sieg.js), e o pedido de baixar as saídas de uma empresa. Interface + a versão de exemplo; a do
// banco é sieg.firestore.ts.
import { tarefas as t } from '@nads/core';

export interface PedidoSieg { status: string; andamento: string; erro: string; em: string }

/** O que se pede ao robô: baixar as saídas (a sequência) ou contar as notas do mês agora (sem esperar a madrugada). */
export type TipoDePedidoSieg = 'saidas' | 'contagem';

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
    pedido: (codigo, competencia, tipo = 'saidas') => pedidos.get(tipo + '|' + codigo + '_' + competencia) || null,
    async pedirContagem(codigo, competencia) {
      const k = codigo + '_' + competencia;
      pedidos.set('contagem|' + k, { status: 'processando', andamento: '', erro: '', em: agora() });
      mudou();
      setTimeout(() => {
        contadasAgora.set(k, { codigo, competencia, em: agora(), emitidas: { NFe: 220, NFCe: 0, NFSe: 3, CTe: 0, CFe: 0 }, recebidas: { NFe: 90, NFCe: 0, NFSe: 5, CTe: 12, CFe: 0 } });
        pedidos.set('contagem|' + k, { status: 'concluido', andamento: '', erro: '', em: agora() });
        mudou();
      }, 1500);
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
