// A impressão das etiquetas do Arquivo físico (19/11/2026): a da caixa (o modelo da planilha "Etiquetas Caixa Box", duas por
// folha) e a do envelope (a etiqueta do mês do Cadastro, com o mês de cada envelope). Cada uma com o QR code que abre a
// caixa no nads (o envelope, com ele em destaque). O QR é desenhado aqui no aparelho (a biblioteca qrcode, sem rede); o
// HTML vem do core e vai para a impressão num quadro escondido (imprimirHtml).
import { arquivoFisico as af, tarefas as t } from '@nads/core';
import { logoNilmaParaImprimir } from '@nads/ui';
import { imprimirHtml } from '../dp/imprimirHtml';

async function qrSvg(texto: string): Promise<string> {
  // a biblioteca vem embrulhada no default no navegador (como no danfsePdf.ts)
  const m = await import('qrcode');
  return (m.default ?? m).toString(texto, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
}

/** As etiquetas das caixas (duas por folha), com o QR de cada uma. */
export async function imprimirEtiquetasDasCaixas(caixas: readonly af.Caixa[]): Promise<void> {
  const origem = window.location.origin;
  const qr: Record<string, string> = {};
  for (const c of caixas) qr[c.id] = await qrSvg(af.linkDaCaixa(origem, c.id));
  imprimirHtml(af.htmlDasEtiquetasDaCaixa({ caixas, qr, logo: logoNilmaParaImprimir('colorida') }));
}

/** As etiquetas dos envelopes de uma caixa (uma por folha, como as do mês), com o QR que abre a caixa no envelope. */
export async function imprimirEtiquetasDosEnvelopes(c: af.Caixa, envelopes: readonly af.Envelope[]): Promise<void> {
  const origem = window.location.origin;
  const etiquetas: t.EtiquetaDoEnvelope[] = [];
  for (const e of envelopes) etiquetas.push({ codigo: c.codigo, nome: c.nome, caixa: c.tipo, competencia: e.competencia, qr: await qrSvg(af.linkDaCaixa(origem, c.id, e.id)) });
  if (!etiquetas.length) return;
  imprimirHtml(t.htmlDosEnvelopes({ competencia: envelopes[0].competencia, departamento: c.departamento, etiquetas, logo: logoNilmaParaImprimir('branca') }));
}

/** As placas das prateleiras (uma por folha, o número grande). */
export function imprimirPlacasDasPrateleiras(prateleiras: number, fileiras: number): void {
  imprimirHtml(af.htmlDasPlacasDasPrateleiras({ prateleiras: Array.from({ length: prateleiras }, (_, i) => i + 1), fileiras, logo: logoNilmaParaImprimir('colorida') }));
}

/** As etiquetas das fileiras (oito por folha), com o QR que abre as caixas de cada uma. */
export async function imprimirEtiquetasDasFileiras(prateleiras: number, fileiras: number): Promise<void> {
  const origem = window.location.origin;
  const lugares = af.lugares(prateleiras, fileiras);
  const qr: Record<string, string> = {};
  for (const l of lugares) qr[af.codigoDoLugar(l)] = await qrSvg(af.linkDoLugar(origem, l));
  imprimirHtml(af.htmlDasEtiquetasDasFileiras({ lugares, qr }));
}
