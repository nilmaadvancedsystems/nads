// O FGTS Digital pelo robô (07/10/2026: "tenho que baixar FGTS toda vez pelo site do governo manualmente"): o robô da
// máquina do Google (robo/fgts-digital.js) entra no portal com o certificado do escritório, como procurador, e emite a
// guia mensal de cada cliente. A tela do DP pede (pedidosFgts) e acompanha; o PDF fica no próprio pedido. Interface +
// a versão de exemplo; a do banco é fgts.firestore.ts.

/** 'ensaio' só entra no perfil do cliente (para conferir o caminho); 'emitir' emite a guia e guarda o PDF */
export type ModoFgts = 'ensaio' | 'emitir';

export interface PassoFgts { n: number; nome: string; url: string; texto: string; quando: string }

export interface PedidoFgts {
  id: string;
  cnpj: string;
  codigo: string;
  empresa: string;
  competencia: string;
  modo: ModoFgts;
  /** pendente, trabalhando, verificacao (esperando a pessoa no gov.br), pronto, erro, captcha */
  status: string;
  erro: string;
  resultado: string;
  pdfNome: string;
  /** a guia emitida (o robô grava): o número, o total (ex. 917,42) e o vencimento (dd/mm/aaaa) */
  numeroGuia: string;
  valor: string;
  vencimento: string;
  criadoEm: string;
  criadoPor: string;
  fimEm: string;
  passos: PassoFgts[];
}

/** a tela do navegador do robô enquanto ele espera a verificação do gov.br */
export interface TelaAoVivo { imagem: string; largura: number; altura: number; quando: string }

export interface RoboFgts {
  carregado: boolean;
  ligado: boolean;
  motivo: string;
  certificado: { titular: string; validade: string } | null;
}

export interface RepoFgts {
  exemplos: boolean;
  /** o robô do FGTS: ligado (com o certificado do escritório) ou o motivo de estar desligado */
  robo(): RoboFgts;
  /** os pedidos da competência: o mais novo de cada CNPJ */
  pedidos(competencia: string): { carregados: boolean; porCnpj: ReadonlyMap<string, PedidoFgts> };
  pedir(dados: { cnpj: string; codigo: number; empresa: string; competencia: string; modo: ModoFgts }): Promise<void>;
  /** cancela o pedido que está na fila ou com o robô (09/10/2026) */
  cancelar(id: string): Promise<void>;
  /** o PDF da guia (pedidosFgts/{id}/arquivo/pdf) */
  pdf(id: string): Promise<{ base64: string; nome: string } | null>;
  /** as fotos das telas por onde o robô passou (pedidosFgts/{id}/telas) */
  telas(id: string): Promise<{ n: string; nome: string; imagem: string }[]>;
  /** a tela ao vivo (pedidosFgts/{id}/ao-vivo/tela); null quando o robô não está esperando */
  aoVivo(id: string, chegou: (t: TelaAoVivo | null) => void): () => void;
  /** um clique da pessoa na tela ao vivo (nas coordenadas do navegador do robô) */
  clicar(id: string, x: number, y: number): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** Nos exemplos: o robô ligado, e o pedido anda sozinho (na fila → trabalhando → pronto) em 3 s. */
export function criarFgtsMemoria(): RepoFgts {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const pedidos = new Map<string, Map<string, PedidoFgts>>();
  const agora = () => new Date().toISOString();
  return {
    exemplos: true,
    robo: () => ({ carregado: true, ligado: true, motivo: '', certificado: { titular: 'NILMA CONTABILIDADE (exemplo)', validade: '2027-05-20' } }),
    pedidos: competencia => ({ carregados: true, porCnpj: pedidos.get(competencia) || new Map() }),
    async pedir({ cnpj, codigo, empresa, competencia, modo }) {
      const id = 'ex-' + cnpj + '-' + Date.now();
      const base: PedidoFgts = { id, cnpj, codigo: String(codigo), empresa, competencia, modo, status: 'pendente', erro: '', resultado: '', pdfNome: '', numeroGuia: '', valor: '', vencimento: '', criadoEm: agora(), criadoPor: 'exemplo', fimEm: '', passos: [] };
      const doMes = pedidos.get(competencia) || new Map<string, PedidoFgts>();
      pedidos.set(competencia, doMes);
      const por = (m: Partial<PedidoFgts>) => { doMes.set(cnpj, { ...(doMes.get(cnpj) || base), ...m }); mudou(); };
      por(base);
      setTimeout(() => por({ status: 'trabalhando', passos: [{ n: 1, nome: 'portal', url: 'https://fgtsdigital.sistema.gov.br/portal/', texto: '', quando: agora() }] }), 800);
      setTimeout(() => por(modo === 'emitir'
        ? { status: 'pronto', resultado: 'guia emitida', pdfNome: 'FGTS ' + competencia + ' ' + cnpj + '.pdf', fimEm: agora() }
        : { status: 'pronto', resultado: 'entrou no perfil do cliente (ensaio, nada emitido)', fimEm: agora() }), 3000);
    },
    async cancelar(id) {
      for (const doMes of pedidos.values()) for (const [cnpj, p] of doMes) if (p.id === id) { doMes.set(cnpj, { ...p, status: 'cancelado', fimEm: agora() }); mudou(); }
    },
    pdf: async () => null,
    telas: async () => [],
    aoVivo: (_id, chegou) => { chegou(null); return () => undefined; },
    clicar: async () => undefined,
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
