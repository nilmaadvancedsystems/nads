// As contas da Visão geral da Área do Cliente (Vitor, 17/10/2026: "melhora mais", "procura na net exemplos de portal de
// cliente"), no padrão dos portais de cliente das contabilidades (Assembly, TaxDome, a "Visão do Cliente" do Omie):
//   - as guias do momento: só as que vencem neste mês ou depois. O espelho traz 12 meses de FGTS e não sabe o que foi
//     pago; sem este corte, um cliente em dia veria "11 guias vencidas" (as dos meses passados, quase sempre pagas);
//   - o que precisamos de você: a lista curta do que está com o cliente (a guia que venceu, a que vence hoje, a resposta
//     do escritório, o certificado, o recado do escritório), cada uma com UMA ação;
//   - o veredito: a frase do topo ("Tudo em dia", "O DAS venceu em 12/10", "Você tem 2 pendências");
//   - a atividade recente: o que aconteceu, com a data (o arquivo que chegou, a resposta, o que o escritório concluiu).
// Funções puras, testadas em visaoGeral.test.ts.
import { areaCliente as ac, formatos } from '@nads/core';
import type { EstadoDaArea } from './areaCliente';
import { chaveDoMes, situacaoDoCertificado } from './regras';

/** 'dd/mm/aaaa' → 'aaaa-mm' */
const mesDaData = (br: string) => br.slice(6, 10) + '-' + br.slice(3, 5);
/** "a, b e c" */
export const emFrase = (l: string[]) => (l.length > 1 ? l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1] : l[0] ?? '');
const nomeDaGuia = (g: ac.GuiaDoCliente) => (g.tipo === 'outra' ? 'A guia' : g.tipo === 'DAS' ? 'O DAS' : g.tipo === 'DAE' ? 'O DAE' : 'O FGTS');
const nomeCurto = (g: Pick<ac.GuiaDoCliente, 'tipo'>) => (g.tipo === 'outra' ? 'Guia' : g.tipo);

/** O título do chamado que pede a guia nova de uma vencida: "Guia nova do DAS (competência 09/2026)". */
export const tituloDaGuiaNova = (g: Pick<ac.GuiaDoCliente, 'tipo' | 'competencia'>) =>
  'Guia nova do ' + nomeCurto(g) + ' (competência ' + g.competencia.slice(5, 7) + '/' + g.competencia.slice(0, 4) + ')';

/** As guias do momento (com a situação de hoje): as que vencem neste mês ou depois, a mais próxima primeiro. */
export function guiasDoMomento(guias: ac.GuiaDoCliente[], hoje: Date): ac.GuiaDoCliente[] {
  const mes = chaveDoMes(hoje);
  return ac.guiasDeHoje(guias, hoje).filter(g => mesDaData(g.vencimento) >= mes);
}

export type Tom = 'ok' | 'warn' | 'bad';

/** O que a ação do item faz (a tela escolhe o botão e o ícone pelo tipo). */
export type AcaoDaPendencia =
  | { tipo: 'baixar-guia'; guia: string }
  | { tipo: 'pedir-guia'; titulo: string }
  | { tipo: 'ver-chamado'; chamado: string }
  | { tipo: 'pedir-renovacao' }
  | { tipo: 'enviar' }
  | { tipo: 'ir'; aba: 'documentos' | 'guias' | 'dp' | 'chamados' };

export interface Pendencia {
  id: string;
  /** de onde vem (o ícone sai daqui) */
  origem: 'guia' | 'chamado' | 'certificado' | 'aviso';
  tom: Tom;
  titulo: string;
  texto: string;
  /** o rótulo do botão */
  rotulo: string;
  acao: AcaoDaPendencia;
}

const PESO: Record<Tom, number> = { bad: 0, warn: 1, ok: 2 };

/**
 * O que está com o cliente, o mais urgente primeiro: a guia do mês que já venceu (se ainda não pagou, a guia vencida não
 * serve mais no banco: ele pede uma nova), a que vence hoje, a resposta do escritório a ler, o certificado perto de
 * vencer e os recados do escritório que pedem alguma coisa.
 */
export function pendenciasDoCliente(e: Pick<EstadoDaArea, 'guias' | 'chamados' | 'certificado' | 'avisos'>, hoje: Date): Pendencia[] {
  const lista: Pendencia[] = [];
  for (const g of guiasDoMomento(e.guias, hoje)) {
    const comp = g.competencia.slice(5, 7) + '/' + g.competencia.slice(0, 4);
    if (g.situacao === 'vencida') {
      lista.push({
        id: 'g-' + g.id, origem: 'guia', tom: 'bad', titulo: nomeDaGuia(g) + ' venceu em ' + g.vencimento.slice(0, 5),
        texto: formatos.reais(g.valor) + '. Se ainda não pagou, peça uma guia nova: a vencida não passa no banco.',
        rotulo: 'Pedir guia nova', acao: { tipo: 'pedir-guia', titulo: tituloDaGuiaNova(g) },
      });
    } else if (g.situacao === 'vence hoje') {
      lista.push({
        id: 'g-' + g.id, origem: 'guia', tom: 'warn', titulo: nomeDaGuia(g) + ' vence hoje', texto: formatos.reais(g.valor) + ', competência ' + comp + '.',
        rotulo: 'Baixar guia', acao: g.temPdf ? { tipo: 'baixar-guia', guia: g.id } : { tipo: 'ir', aba: 'guias' },
      });
    }
  }
  for (const c of e.chamados) {
    if (c.situacao === 'respondido') lista.push({ id: 'c-' + c.id, origem: 'chamado', tom: 'warn', titulo: 'O escritório respondeu', texto: c.titulo, rotulo: 'Ver resposta', acao: { tipo: 'ver-chamado', chamado: c.id } });
  }
  if (e.certificado) {
    const s = situacaoDoCertificado(e.certificado, hoje);
    if (s.tom !== 'ok') lista.push({ id: 'cert', origem: 'certificado', tom: s.tom, titulo: 'Certificado digital ' + (s.tom === 'bad' ? 'vencido' : 'perto de vencer'), texto: s.texto, rotulo: 'Pedir renovação', acao: { tipo: 'pedir-renovacao' } });
  }
  for (const a of e.avisos) {
    if (!a.ir) continue;
    lista.push({ id: 'a-' + a.id, origem: 'aviso', tom: 'warn', titulo: a.titulo, texto: a.texto, rotulo: a.ir === 'documentos' ? 'Enviar agora' : 'Abrir', acao: a.ir === 'documentos' ? { tipo: 'enviar' } : { tipo: 'ir', aba: a.ir } });
  }
  // estável: dentro do mesmo tom, a ordem acima (guias, respostas, certificado, recados)
  return lista.map((p, i) => [p, i] as const).sort(([a, i], [b, j]) => PESO[a.tom] - PESO[b.tom] || i - j).map(([p]) => p);
}

export interface Veredito { tom: Tom; titulo: string; texto: string }

/** A frase do topo: tudo em dia, a pendência sozinha, ou quantas são e quais. */
export function vereditoDoMes(pendencias: Pendencia[], guias: ac.GuiaDoCliente[]): Veredito {
  if (!pendencias.length) {
    const proxima = guias.find(g => g.situacao === 'a vencer');
    return {
      tom: 'ok', titulo: 'Tudo em dia',
      texto: 'Nada pendente com você.' + (proxima ? ' A próxima guia, ' + (proxima.tipo === 'outra' ? 'do escritório' : 'do ' + proxima.tipo) + ', vence em ' + proxima.vencimento.slice(0, 5) + '.' : ''),
    };
  }
  if (pendencias.length === 1) return { tom: pendencias[0].tom, titulo: pendencias[0].titulo, texto: pendencias[0].texto };
  const conta = (n: number, um: string, varios: string) => (n ? [n === 1 ? um : n + ' ' + varios] : []);
  const de = (o: Pendencia['origem'], f?: (p: Pendencia) => boolean) => pendencias.filter(p => p.origem === o && (!f || f(p))).length;
  const partes = [
    ...conta(de('guia', p => p.tom === 'bad'), '1 guia vencida', 'guias vencidas'),
    ...conta(de('guia', p => p.tom !== 'bad'), '1 guia vence hoje', 'guias vencem hoje'),
    ...conta(de('chamado'), '1 resposta do escritório', 'respostas do escritório'),
    ...conta(de('certificado'), 'o certificado digital', ''),
    ...conta(de('aviso'), '1 recado do escritório', 'recados do escritório'),
  ];
  return { tom: pendencias[0].tom, titulo: 'Você tem ' + pendencias.length + ' pendências', texto: formatos.capital(emFrase(partes)) + '.' };
}

export interface Atividade {
  id: string;
  origem: 'envio' | 'resposta' | 'chamado' | 'feito' | 'documento';
  titulo: string;
  texto: string;
  /** ISO */
  em: string;
  /** o chamado que abre ao clicar */
  chamado?: string;
}

/**
 * O que aconteceu por último, o mais novo primeiro: os arquivos que chegaram ao escritório, as mensagens dos chamados
 * (a resposta do escritório, o chamado aberto, a resposta do cliente), o que o escritório concluiu na agenda e os
 * documentos que ele deixou. Só o que já aconteceu (até agora), no máximo `limite`.
 */
export function atividadeRecente(e: Pick<EstadoDaArea, 'envios' | 'chamados' | 'agenda' | 'documentos'>, agora: Date, limite = 6): Atividade[] {
  const lista: Atividade[] = [];
  for (const r of e.envios) if (r.recebidoEm) lista.push({ id: 'e-' + r.id, origem: 'envio', titulo: 'Recebemos seu arquivo', texto: r.nome, em: r.recebidoEm });
  for (const c of e.chamados) {
    c.mensagens.forEach((m, i) => {
      if (!m.em) return;
      const titulo = m.de === 'escritorio' ? 'O escritório respondeu' : i === 0 ? 'Você abriu um chamado' : 'Você respondeu';
      lista.push({ id: 'c-' + c.id + '-' + i, origem: m.de === 'escritorio' ? 'resposta' : 'chamado', titulo, texto: c.titulo, em: m.em, chamado: c.id });
    });
  }
  for (const a of e.agenda) for (const i of a.itens) if (i.situacao === 'feito' && i.feitoEm) lista.push({ id: 'f-' + a.mes + '-' + i.id, origem: 'feito', titulo: i.nome, texto: 'Concluído pelo escritório', em: i.feitoEm });
  for (const d of e.documentos) lista.push({ id: 'd-' + d.id, origem: 'documento', titulo: 'Documento novo: ' + d.nome, texto: d.descricao, em: d.enviadoEm });
  const ate = agora.toISOString();
  return lista.filter(a => a.em <= ate).sort((a, b) => b.em.localeCompare(a.em)).slice(0, limite);
}

/** "hoje, 09:12", "ontem, 16:40" ou "11/10", no fuso de quem olha. */
export function quandoFoi(iso: string, hoje: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(hoje) - dia(d)) / 86_400_000);
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (dias === 0) return 'hoje, ' + hora;
  if (dias === 1) return 'ontem, ' + hora;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
