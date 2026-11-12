// ViewModels das telas do Administrativo da Área do Cliente (12/11/2026: "quero uma tela melhor disso aqui"; "também
// melhor desse"; "quero o faturamento do cliente aqui via fiscal"): os Dados cadastrais, o Fale com o escritório e o
// Faturamento, que eram janelas (os dois primeiros) e agora são telas do menu.
import { areaCliente as ac, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { baixarArquivo } from '../dados/baixar';
import { repoAreaCliente } from '../dados/repo';
import { dataBr } from '../dados/regras';
import type { DaCasca } from './useAreaCliente';

/** Os Dados cadastrais: a ficha da empresa em blocos (a identificação, a tributação, o endereço e os sócios). */
export function useEmpresa({ area, copiar }: DaCasca) {
  const f = area.ficha;
  const pct = (p: string) => Math.max(0, Math.min(100, Number(p.replace(',', '.').replace(/[^\d.]/g, '')) || 0));
  return {
    tem: !!f,
    identificacao: f ? [
      { rotulo: 'Razão social', valor: f.razaoSocial },
      ...(f.nomeFantasia ? [{ rotulo: 'Nome fantasia', valor: f.nomeFantasia }] : []),
      { rotulo: 'CNPJ', valor: f.cnpj, copiar: true },
      ...(f.inscricaoEstadual ? [{ rotulo: 'Inscrição estadual', valor: f.inscricaoEstadual, copiar: true }] : []),
      ...(f.inscricaoMunicipal ? [{ rotulo: 'Inscrição municipal', valor: f.inscricaoMunicipal, copiar: true }] : []),
      ...(f.abertura ? [{ rotulo: 'Abertura', valor: dataBr(f.abertura) }] : []),
    ] : [],
    regime: f?.regime ?? '', cnae: f?.cnae ?? '', endereco: f?.endereco ?? '',
    socios: (f?.socios ?? []).map(s => ({ nome: s.nome, participacao: s.participacao, largura: pct(s.participacao) })),
    copiar: (valor: string, rotulo: string) => copiar(valor, rotulo),
  };
}

/** O Fale com o escritório: o WhatsApp em destaque, o telefone e os e-mails de cada setor, com copiar e escrever. */
export function useContato({ copiar, irPara }: DaCasca, contato: { whatsapp?: string; telefone?: string; email?: string; horario: string; setores: { nome: string; email: string }[] }) {
  const emails = [{ nome: 'Atendimento', email: contato.email ?? '' }, ...contato.setores].filter(s => s.email);
  return {
    whatsapp: contato.whatsapp ?? '', telefone: contato.telefone ?? '', horario: contato.horario,
    // o e-mail quebra só antes do @ (12/11/2026: "o gmail tá clipando": quebrava no meio do domínio)
    emails: emails.map(s => ({ setor: s.nome, email: s.email, usuario: s.email.split('@')[0], dominio: s.email.includes('@') ? '@' + s.email.split('@').slice(1).join('@') : '', mailto: 'mailto:' + s.email })),
    telLink: contato.telefone ? 'tel:' + contato.telefone.replace(/\D/g, '') : '',
    copiar: (valor: string, rotulo: string) => copiar(valor, rotulo),
    novaSolicitacao: () => irPara('chamados'),
  };
}

const mesBr = (c: string) => c.slice(5, 7) + '/' + c.slice(0, 4);
const mesPorExtenso = (c: string) => formatos.capital(formatos.rot(c).toLowerCase());
const porcento = (v: number) => (v > 0 ? '+' : '') + String(v).replace('.', ',') + '%';

/** O valor curto do eixo, do topo da barra e do limite: 120 mil, 4,8 mi (com o R$ fora do eixo). */
function curto(n: number): string {
  if (n >= 1_000_000) return String(Math.round(n / 100_000) / 10).replace('.', ',') + ' mi';
  if (n >= 1_000) return String(Math.round(n / 100) / 10).replace('.', ',').replace(/,0$/, '') + ' mil';
  return String(Math.round(n));
}
const reaisCurto = (n: number) => 'R$ ' + curto(n);

/** O topo redondo do eixo (um degrau redondo logo acima do maior mês: 120 mil, 150 mil, 2 mi…). */
function topoDoEixo(maior: number): number {
  if (maior <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(maior));
  return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(f => f * p).find(v => v >= maior) ?? 10 * p);
}

const numero = (n: number) => n.toLocaleString('pt-BR');
const plural = (n: number, um: string, varios: string) => numero(n) + ' ' + (n === 1 ? um : varios);
const reaisComSinal = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + formatos.reais(Math.abs(n));

const SITUACAO_DO_LIMITE: Record<ac.LimiteDoRegime['situacao'], { rotulo: string; tom: string }> = {
  ok: { rotulo: 'Dentro do limite', tom: 'badge-ok' },
  perto: { rotulo: 'Perto do limite', tom: 'badge-warn' },
  sublimite: { rotulo: 'Passou do sublimite', tom: 'badge-warn' },
  passou: { rotulo: 'Passou do limite', tom: 'badge-bad' },
};

const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const fracao = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 1000) / 10 : 0);
const pctTexto = (n: number) => String(n).replace('.', ',') + '%';

/** As colunas de um gráfico (os meses do ano, os dias do mês): a altura em % do topo redondo do eixo. */
export interface ColunaDoGrafico { chave: string; altura: number; vazia: boolean; foco: boolean; destaque: boolean; apagada: boolean; valor: string; aria: string; rotulo: string; rotuloCurto: string }

/**
 * O Faturamento como painel do mês (12/11/2026: "quero algo mais bonito e completo, realmente um dashboard mensal"): o
 * mês escolhido (no seletor, na coluna do gráfico do ano ou na linha da tabela) mostra os números dele, a venda por dia,
 * como vendeu (NF-e, NFC-e, serviço, a maior venda), os maiores clientes e as operações; embaixo, o ano (o acumulado, os
 * 12 meses, o limite do Simples/MEI, o gráfico e a tabela, com a planilha do Excel).
 */
/** O relatório do dia já em texto (a janela que abre no clique do dia; no estilo da lista do portal do SIEG). */
export function vistaDoRelatorio(r: ac.RelatorioDoDia, titulo: string, cortadas: boolean) {
  return {
    titulo,
    resumo: [
      { rotulo: 'Vendas', valor: formatos.reais(r.vendas) },
      ...(r.servicos ? [{ rotulo: 'Serviços', valor: formatos.reais(r.servicos) }] : []),
      { rotulo: 'Notas', valor: numero(r.quantidade) },
      ...(r.canceladas ? [{ rotulo: 'Canceladas', valor: numero(r.canceladas) }] : []),
    ],
    porTipo: r.porTipo.map(t => t.tipo + ': ' + plural(t.notas, 'nota', 'notas') + ', ' + formatos.reais(t.valor)).join('  ·  '),
    notas: r.notas.map(n => ({
      chave: n.chave || n.tipo + n.numero, temDanfe: !!ac.chaveDeNota(n.chave) && !n.cancelada, numero: n.numero, serie: n.serie, tipo: n.tipo, cliente: n.cliente,
      cfop: n.cfop || '—', valor: formatos.reais(n.valor), cancelada: !!n.cancelada,
      chaveCurta: n.chave ? n.chave.slice(0, 4) + '…' + n.chave.slice(-6) : '', chaveInteira: n.chave.replace(/(\d{4})(?=\d)/g, '$1 '),
    })),
    vazio: !r.notas.length,
    aviso: cortadas ? 'O mês tem notas demais para a lista: algumas podem faltar aqui.' : '',
  };
}
export type VistaDoRelatorio = ReturnType<typeof vistaDoRelatorio>;

export function useFaturamento({ token, area, hoje, copiar }: DaCasca) {
  const { toast } = useRetorno();
  const empresas = area.faturamento?.empresas ?? [];
  const [escolhida, setEscolhida] = useState(0);
  const [mesEscolhido, setMesEscolhido] = useState<string | null>(null);
  const [diaEmFoco, setDiaEmFoco] = useState<number | null>(null);
  const e = empresas[Math.min(escolhida, Math.max(0, empresas.length - 1))];
  const todos = e?.meses ?? [];
  const p = ac.painelDoFaturamento(todos, e?.regime, hoje);
  const fonte = area.faturamento?.fonte ?? '';
  const mes = mesEscolhido ?? p.ultimo?.competencia ?? p.emAndamento;
  const d = ac.detalheDoMes(todos, mes, hoje);
  const m = d?.mes;
  const n = m?.notasDoMes;
  const totalDoMes = m?.total ?? 0;

  // ---------- o mês ----------
  const comparacao = (c: ac.ComparacaoDoMes | null) => c && { mes: mesPorExtenso(c.competencia), valor: formatos.reais(c.total), diferenca: reaisComSinal(c.diferenca), variacao: c.variacao == null ? '' : porcento(c.variacao), subiu: c.diferenca >= 0 };
  const anterior = d ? comparacao(d.anterior) : null;
  const anoPassado = d ? comparacao(d.anoPassado) : null;

  // a venda por dia: o melhor dia em destaque; o dia em foco (o mouse, o toque) no texto de cima
  const porDia = n?.porDia ?? [];
  const topoDias = topoDoEixo(Math.max(0, ...porDia));
  const melhor = porDia.length ? porDia.indexOf(Math.max(...porDia)) : -1;
  const ano = Number(mes.slice(0, 4)), numMes = Number(mes.slice(5, 7));
  const semanaDe = (i: number) => new Date(ano, numMes - 1, i + 1).getDay();
  const ateHoje = d?.emAndamento ? hoje.getDate() : porDia.length;
  const diasComVenda = porDia.filter(v => v > 0).length;
  const foco = diaEmFoco != null && diaEmFoco < porDia.length ? diaEmFoco : melhor;
  const ultimoDia = porDia.length;
  const dias: ColunaDoGrafico[] = porDia.map((v, i) => ({
    chave: String(i + 1), altura: v ? Math.max(1, Math.round((v / topoDias) * 1000) / 10) : 0, vazia: !v,
    foco: i === foco, destaque: i === melhor, apagada: i >= ateHoje, valor: v ? curto(v) : '',
    aria: 'Dia ' + (i + 1) + ': ' + (v ? formatos.reais(v) : 'sem venda'),
    rotulo: [1, 5, 10, 15, 20, 25].includes(i + 1) || i + 1 === ultimoDia ? String(i + 1) : '', rotuloCurto: [1, 10, 20].includes(i + 1) || i + 1 === ultimoDia ? String(i + 1) : '',
  }));
  const dataDoDia = (i: number) => DIAS_DA_SEMANA[semanaDe(i)] + ', ' + (i + 1) + ' de ' + formatos.rot(mes).toLowerCase().replace(/ de \d{4}$/, '');

  const maiorCliente = n?.clientes[0]?.valor ?? 0;
  const maiorCfop = n?.cfops[0]?.valor ?? 0;
  const vendas = n ? n.clientes.reduce((t, c) => t + c.valor, 0) + (n.outrosClientes?.valor ?? 0) : 0;
  const parteNfe = m?.total ? fracao(m.nfe ?? 0, m.total) : 0;

  const painel = !m ? null : {
    titulo: mesPorExtenso(mes), emAndamento: !!d?.emAndamento, tem: m.total != null, temNotas: !!n,
    numeros: {
      total: m.total == null ? 'Sem nota' : formatos.reais(totalDoMes),
      anterior, anoPassado,
      notas: m.total == null ? '—' : numero(m.notas), canceladas: m.canceladas ? plural(m.canceladas, 'cancelada', 'canceladas') : 'nenhuma cancelada',
      ticket: d?.ticketMedio == null ? '—' : formatos.reais(d.ticketMedio),
      clientes: n ? numero(n.totalClientes) : '—', clientesDica: n ? 'compraram no mês' : 'chega com os XMLs do mês',
    },
    dias: {
      colunas: dias, eixo: [0, topoDias / 2, topoDias].map(v => ({ valor: v ? curto(v) : '0', posicao: Math.round((v / topoDias) * 1000) / 10 })),
      foco: foco >= 0 ? { data: formatos.capital(dataDoDia(foco)), valor: porDia[foco] ? formatos.reais(porDia[foco]) : 'Sem venda', melhor: foco === melhor && porDia[foco] > 0 } : null,
      media: diasComVenda ? formatos.reais(Math.round((porDia.reduce((t, v) => t + v, 0) / diasComVenda) * 100) / 100) : '—',
      diasComVenda: plural(diasComVenda, 'dia com venda', 'dias com venda'),
    },
    composicao: {
      partes: m.total ? { nfe: parteNfe, nfce: Math.round((100 - parteNfe) * 10) / 10 } : null,
      nfe: m.nfe == null ? '—' : formatos.reais(m.nfe), nfce: m.nfce == null ? '—' : formatos.reais(m.nfce),
      textoNfe: pctTexto(parteNfe), textoNfce: pctTexto(Math.round((100 - parteNfe) * 10) / 10),
      servicos: n?.servicos ? { valor: formatos.reais(n.servicos.valor), notas: plural(n.servicos.notas, 'nota de serviço', 'notas de serviço') } : null,
      maiorVenda: n?.maiorVenda ? { valor: formatos.reais(n.maiorVenda.valor), quando: 'dia ' + n.maiorVenda.dia + ' · ' + n.maiorVenda.cliente } : null,
      series: (m.series ?? []).map(x => ({
        chave: x.modelo + '-' + x.serie, nome: (x.modelo === '65' ? 'NFC-e' : x.modelo === '55' ? 'NF-e' : 'Modelo ' + x.modelo) + ' · série ' + x.serie,
        faixa: x.primeira == null ? '' : x.primeira === x.ultima ? 'nº ' + numero(x.primeira) : 'nº ' + numero(x.primeira) + ' a ' + numero(x.ultima ?? x.primeira),
        notas: plural(x.notas, 'nota', 'notas'), valor: formatos.reais(x.valor),
      })),
    },
    clientes: (n?.clientes ?? []).map((c, i) => ({ chave: i + c.nome, nome: c.nome, valor: formatos.reais(c.valor), notas: plural(c.notas, 'nota', 'notas'), parte: pctTexto(fracao(c.valor, vendas)), largura: fracao(c.valor, maiorCliente) })),
    outrosClientes: n?.outrosClientes ? { texto: 'Mais ' + plural(n.outrosClientes.clientes, 'cliente', 'clientes'), valor: formatos.reais(n.outrosClientes.valor), parte: pctTexto(fracao(n.outrosClientes.valor, vendas)) } : null,
    cfops: (n?.cfops ?? []).map(c => ({ chave: c.cfop || c.descricao, cfop: c.cfop, descricao: c.descricao, valor: formatos.reais(c.valor), parte: pctTexto(fracao(c.valor, vendas)), largura: fracao(c.valor, maiorCfop) })),
  };

  // ---------- o ano ----------
  const topo = topoDoEixo(Math.max(0, ...p.meses.map(x => x.total ?? 0)));
  const lim = p.limite;
  const meses: ColunaDoGrafico[] = p.meses.map(x => ({
    chave: x.competencia, altura: x.total ? Math.max(1, Math.round((x.total / topo) * 1000) / 10) : 0, vazia: x.total == null,
    foco: x.competencia === mes, destaque: false, apagada: x.competencia === p.emAndamento, valor: x.total == null ? '' : curto(x.total),
    aria: mesPorExtenso(x.competencia) + ': ' + (x.total == null ? 'sem nota' : formatos.reais(x.total)) + '. Abrir o mês',
    rotulo: formatos.mesCurto(x.competencia), rotuloCurto: formatos.mesCurto(x.competencia).split('/')[0],
  }));

  return {
    tem: empresas.length > 0,
    empresas: empresas.map((x, i) => ({ i, nome: x.nome, ativa: x === e })),
    escolher: (i: number) => { setEscolhida(i); setMesEscolhido(null); setDiaEmFoco(null); },
    fonte,
    mes, maxMes: p.emAndamento,
    /** troca o mês do painel (o seletor, a coluna do ano, a linha da tabela) */
    abrirMes: (c: string) => { setMesEscolhido(c); setDiaEmFoco(null); },
    focarDia: (i: number | null) => setDiaEmFoco(i),
    /** o relatório do dia (12/11/2026: "quando eu clico no dia, um relatório do dia com as notas no estilo do SIEG") */
    async relatorioDoDia(i: number): Promise<VistaDoRelatorio | null> {
      if (!e) return null;
      const notas = await repoAreaCliente.notasDoMes(token, e.codigo, mes);
      if (!notas) { toast('As notas deste mês ainda não chegaram. Tente mais tarde.'); return null; }
      return vistaDoRelatorio(ac.relatorioDoDia(notas, i + 1), formatos.capital(dataDoDia(i)), false);
    },
    copiarChave: (chave: string) => copiar(chave.replace(/\D/g, ''), 'Chave de acesso'),
    /** a DANFE da nota (12/11/2026: "quero poder clicar e ver a danfe da nota"): pede ao robô e devolve o PDF */
    pegarDanfe: (chave: string) => repoAreaCliente.pedirDanfe(token, chave),
    painel,
    ano: {
      acumulado: p.ano ? { titulo: 'Acumulado de ' + p.ano.ano, valor: formatos.reais(p.ano.total), periodo: p.ano.ate.endsWith('-01') ? 'janeiro' : 'jan a ' + formatos.mesCurto(p.ano.ate).split('/')[0], comparacao: p.ano.variacao == null ? '' : porcento(p.ano.variacao) + ' sobre ' + (p.ano.ano - 1), subiu: (p.ano.variacao ?? 0) >= 0 } : null,
      doze: { valor: formatos.reais(p.doze.total), media: 'média de ' + formatos.reais(p.doze.media) + ' por mês' },
      andamento: { mes: mesPorExtenso(p.emAndamento), valor: (() => { const a = p.meses.find(x => x.competencia === p.emAndamento); return a?.total == null ? 'Sem nota ainda' : formatos.reais(a.total); })() },
      limite: lim ? {
        titulo: 'Limite do ' + lim.nome + ' em ' + hoje.getFullYear(),
        usado: formatos.reais(lim.usado), teto: formatos.reais(lim.teto), tetoCurto: reaisCurto(lim.teto),
        fracao: Math.min(100, Math.round(lim.fracao * 1000) / 10), texto: pctTexto(Math.round(lim.fracao * 1000) / 10) + ' do limite',
        resta: lim.usado < lim.teto ? 'faltam ' + formatos.reais(Math.round((lim.teto - lim.usado) * 100) / 100) : '',
        sublimite: lim.sublimite ? { posicao: Math.round((lim.sublimite / lim.teto) * 1000) / 10, rotulo: 'sublimite ' + reaisCurto(lim.sublimite) } : null,
        situacao: SITUACAO_DO_LIMITE[lim.situacao], alerta: lim.situacao !== 'ok',
      } : null,
      colunas: meses,
      eixo: [0, topo / 2, topo].map(v => ({ valor: v ? curto(v) : '0', posicao: Math.round((v / topo) * 1000) / 10 })),
      linhas: [...p.meses].reverse().map(x => ({
        competencia: x.competencia, mes: mesBr(x.competencia), emAndamento: x.competencia === p.emAndamento, escolhida: x.competencia === mes,
        nfe: x.nfe == null ? '—' : formatos.reais(x.nfe), nfce: x.nfce == null ? '—' : formatos.reais(x.nfce),
        notas: x.total == null ? '—' : String(x.notas), total: x.total == null ? '—' : formatos.reais(x.total),
        variacao: x.variacao == null || x.competencia === p.emAndamento ? '' : porcento(x.variacao), subiu: (x.variacao ?? 0) >= 0,
      })),
    },
    baixarPlanilha: () => {
      if (!e) return;
      baixarArquivo('faturamento-' + formatos.slug(e.nome) + '.xlsx', new Blob([ac.planilhaDoFaturamento(e, fonte)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      toast('Planilha baixada.');
    },
  };
}
