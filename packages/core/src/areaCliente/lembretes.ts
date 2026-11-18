// O lembrete de vencimento ao cliente (plano do Acessórias, 17/11/2026, ficha lembrete-de-vencimento; frase do dono:
// "Seguir"). Alguns dias antes de a guia vencer, um e-mail com o link da Área do Cliente, só das guias que o cliente ainda
// não abriu (o registro de abertura, ficha comprovante-de-leitura). Um e-mail por empresa por dia, com as guias juntas.
// O robô da nuvem (robo/lembrete-guia.js) manda; vem desligado (Robôs › Ajustes) e travado (só para o escritório) até o
// escritório liberar. O dia útil é o do calendário único (tarefas/regras/diasUteis.ts). Só a lógica.
import { ajustar, dataDe, ehDiaUtil, isoDe } from '../tarefas/regras/diasUteis';
import { ROTULO_DA_GUIA, rotuloDaGuia, type GuiaDoCliente } from './guias';

/** 'dd/mm/aaaa' → 'aaaa-mm-dd' ('' se torto) */
const isoDoBr = (br: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
const diasEntre = (de: string, ate: string) => Math.round((dataDe(ate).getTime() - dataDe(de).getTime()) / 864e5);

/**
 * As guias para lembrar hoje: as que vencem daqui a um dos `dias` (0 = hoje) e que o cliente não abriu. Só em dia útil;
 * no último dia útil antes de um fim de semana ou feriado, também as que vencem até o próximo dia útil (na sexta, o que
 * vence no sábado, no domingo e na segunda). A vencida não lembra.
 */
export function guiasParaLembrar(guias: readonly GuiaDoCliente[], hoje: Date, dias: readonly number[], abertas: ReadonlySet<string>): GuiaDoCliente[] {
  const hojeIso = isoDe(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
  if (!ehDiaUtil(hojeIso, 'federal')) return [];
  const amanha = isoDe(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1));
  const proximoUtil = ajustar(amanha, 'posterga', 'federal');
  const antesDoBuraco = proximoUtil !== amanha;
  return guias.filter(g => {
    // a paga não lembra (ficha guia-paga-confirmada, 18/11/2026)
    if (abertas.has(g.id) || g.pagoEm) return false;
    const venc = isoDoBr(g.vencimento);
    if (!venc || venc < hojeIso) return false;
    const d = diasEntre(hojeIso, venc);
    return dias.includes(d) || (antesDoBuraco && venc > hojeIso && venc <= proximoUtil);
  }).sort((a, b) => isoDoBr(a.vencimento).localeCompare(isoDoBr(b.vencimento)));
}

/** Os dias de antecedência do ajuste (até N dias antes): 2 → [2, 1, 0]. */
export function diasDoLembrete(ate: unknown): number[] {
  const n = Math.min(10, Math.max(0, Math.floor(Number(ate))));
  return Number.isFinite(n) ? Array.from({ length: n + 1 }, (_, k) => n - k) : [2, 1, 0];
}

/**
 * O lembrete de uma empresa (17/11/2026, o dono: "quero que a parte de vencimento tenha como escolher por cliente"): a escolha dela no Cadastro sobre o
 * padrão do escritório (Robôs › Ajustes). 'nao' nunca manda; 'sim' manda mesmo com o geral desligado; os dias dela
 * valem sobre os do escritório.
 */
export function lembreteDaEmpresa(escolha: { modo?: string; diasAntes?: number } | null | undefined, geral: { ligado: boolean; dias: number[] }): { ligado: boolean; dias: number[] } {
  if (escolha?.modo === 'nao') return { ligado: false, dias: geral.dias };
  const dias = escolha?.diasAntes != null ? diasDoLembrete(escolha.diasAntes) : geral.dias;
  return { ligado: escolha?.modo === 'sim' || geral.ligado, dias };
}

/** O e-mail do lembrete: o assunto e o texto (o robô monta o HTML). Os textos são do NADS. */
export function emailDoLembrete(empresa: string, guias: readonly GuiaDoCliente[], link: string, assinatura = 'Nilma Contabilidade'): { assunto: string; texto: string } {
  const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const linhas = guias.map(g => '- ' + (g.tipo === 'outra' ? ROTULO_DA_GUIA.outra : rotuloDaGuia(g)) + ': vence em ' + g.vencimento + ' (' + reais(g.valor) + ')');
  const uma = guias.length === 1;
  return {
    assunto: (uma ? 'Guia vencendo' : guias.length + ' guias vencendo') + ' - ' + empresa,
    texto: ['Olá,', '', (uma ? 'A guia abaixo ainda não foi aberta na Área do Cliente e está perto de vencer:' : 'As guias abaixo ainda não foram abertas na Área do Cliente e estão perto de vencer:'), '',
      ...linhas, '', 'Para baixar, abra a Área do Cliente:', link, '', 'Se já pagou, pode desconsiderar este e-mail.', '', assinatura].join('\n'),
  };
}
