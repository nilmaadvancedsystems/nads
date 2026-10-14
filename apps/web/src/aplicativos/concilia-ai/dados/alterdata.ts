// O balancete gerado no Alterdata Contábil pelo robô do PC do escritório (Vitor, 14/10/2026: "Gerar no Alterdata" na
// Importação). A Conferência pede (pedidosAlterdata), acompanha ao vivo e, com o pedido pronto, lê o .xlsx que o robô
// guardou no próprio pedido. Interface + a versão de exemplo; a do banco é alterdata.firestore.ts.
import { conferencia as c } from '@nads/core';

export interface PassoAlterdata { n: number; nome: string; quando: string }

export interface PedidoAlterdata {
  id: string;
  codigo: number;
  empresa: string;
  competencia: string;
  /** pendente, trabalhando, pronto, erro, cancelado */
  status: string;
  erro: string;
  arquivoNome: string;
  criadoEm: string;
  criadoPor: string;
  fimEm: string;
  passos: PassoAlterdata[];
}

/** O robô do Alterdata (robo/alterdata): ligado, e onde ele roda. */
export interface RoboAlterdata { carregado: boolean; ligado: boolean; onde: string }

/** Quem está pedindo; podePedir = o contábil ou o admin (as regras do banco conferem de novo). */
export interface QuemPedeAlterdata { nome: string; uid: string; podePedir: boolean }

export interface RepoAlterdata {
  exemplos: boolean;
  /** só o contábil e o admin pedem (o botão some para os outros) */
  podePedir(): boolean;
  robo(): RoboAlterdata;
  /** cria o pedido do balancete e devolve o id dele */
  pedir(dados: { codigo: number; empresa: string; competencia: string }): Promise<string>;
  /** o pedido ao vivo; null = não existe (ou sem acesso). Devolve quem para de ouvir. */
  ouvir(id: string, aoMudar: (p: PedidoAlterdata | null) => void): () => void;
  /** o .xlsx que o robô guardou (pedidosAlterdata/{id}/arquivo/xlsx) */
  arquivo(id: string): Promise<{ base64: string; nome: string } | null>;
  /** cancela o pedido na fila ou com o robô */
  cancelar(id: string): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** Nos exemplos: o robô ligado, e o pedido anda sozinho (na fila → com o robô, passo a passo → pronto) em uns 6 s, com um balancete pequeno. */
export function criarAlterdataMemoria(quem: () => QuemPedeAlterdata | null): RepoAlterdata {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const pedidos = new Map<string, PedidoAlterdata>();
  const vendo = new Map<string, Set<(p: PedidoAlterdata | null) => void>>();
  const agora = () => new Date().toISOString();
  const por = (id: string, m: Partial<PedidoAlterdata>) => {
    const atual = pedidos.get(id);
    // pedido cancelado não anda mais
    if (!atual || atual.status === 'cancelado') return;
    const novo = { ...atual, ...m };
    pedidos.set(id, novo);
    for (const f of vendo.get(id) || []) f(novo);
  };
  return {
    exemplos: true,
    podePedir: () => quem()?.podePedir ?? false,
    robo: () => ({ carregado: true, ligado: true, onde: 'exemplo' }),
    async pedir({ codigo, empresa, competencia }) {
      const id = 'ex-' + codigo + '-' + Date.now();
      pedidos.set(id, { id, codigo, empresa, competencia, status: 'pendente', erro: '', arquivoNome: '', criadoEm: agora(), criadoPor: quem()?.nome || 'exemplo', fimEm: '', passos: [] });
      const passo = (nome: string) => { const p = pedidos.get(id); if (p) por(id, { passos: [...p.passos, { n: p.passos.length + 1, nome, quando: agora() }] }); };
      setTimeout(() => por(id, { status: 'trabalhando' }), 1500);
      setTimeout(() => passo('abrindo o Alterdata Contábil'), 1800);
      setTimeout(() => passo('escolhendo a empresa ' + codigo), 2800);
      setTimeout(() => passo('gerando o balancete de ' + competencia.slice(5) + '/' + competencia.slice(0, 4)), 3800);
      setTimeout(() => passo('exportando o Excel'), 4800);
      setTimeout(() => por(id, { status: 'pronto', arquivoNome: 'Balancete ' + codigo + ' ' + competencia + '.csv', fimEm: agora() }), 5800);
      mudou();
      return id;
    },
    ouvir(id, aoMudar) {
      const s = vendo.get(id) || new Set();
      vendo.set(id, s);
      s.add(aoMudar);
      aoMudar(pedidos.get(id) || null);
      return () => { s.delete(aoMudar); };
    },
    // o balancete pequeno de exemplo (o core o gera, no formato do Xlsx Dados Arquivo)
    arquivo: async id => (pedidos.get(id)?.status === 'pronto' ? { base64: c.balanceteDeExemploEmBase64(), nome: pedidos.get(id)!.arquivoNome } : null),
    async cancelar(id) { por(id, { status: 'cancelado', fimEm: agora() }); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
