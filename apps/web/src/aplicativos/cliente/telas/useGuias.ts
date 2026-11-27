// ViewModel de Guias e obrigações (Vitor, 16/10/2026, a "Agenda de tributos e obrigações" do protótipo). Refeita em
// 13/11/2026 ("refaça esses 3"; "muita informação", a mesma guia aparecia na agenda e no "A pagar"): uma linha de resumo
// embaixo do título; as guias do mês numa lista com abas (A pagar e Pagas); o calendário do mês só com os pontos (o
// clique no dia destaca o que vence nele); a lista do que o escritório entrega no mês; os avisos da contabilidade.
// Enxugada em 16/11/2026 (o dono apresentou a área e ouviu "tinha muita informação"): saíram as entregas do escritório
// (trabalho interno; nem os pontos delas ficam no calendário) e os avisos (já estão no "Precisa de você" da Visão
// geral); o resumo ficou com dois fatos e cada guia só com a data curta (dados/guiasDoMes.ts).
import { areaCliente as ac, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { baixarArquivo } from '../dados/baixar';
import { repoAreaCliente } from '../dados/repo';
import { nomeDoZip } from '../dados/biblioteca';
import { useBaixarVarios } from './useBaixarVarios';
import { useVisualizar } from './useVisualizar';
import { abaDoDia, chaveDoMes, painelDasGuias, legendaDoCalendario, type MarcaDoMes } from '../dados/regras';
import { quandoVence, resumoCurtoDasGuias } from '../dados/guiasDoMes';
import { tituloDaGuiaNova } from '../dados/visaoGeral';
import type { DaCasca } from './useAreaCliente';
import { useJanelaDoComprovante } from './JanelaDeEnvio';

export type AbaDasGuias = 'apagar' | 'pagas';

/** 'dd/mm/aaaa' → 'aaaa-mm' */
const mesDaData = (br: string) => br.slice(6, 10) + '-' + br.slice(3, 5);
/** 'dd/mm/aaaa' → dd */
const diaDaData = (br: string) => Number(br.slice(0, 2)) || 0;

export function useGuias(props: DaCasca) {
  const { token, area, hoje, irPara, copiar, marcarGuiaPaga } = props;
  const { toast, modal } = useRetorno();
  // o "Já paguei: mandar o comprovante" (plano do Acessórias, 17/11/2026, ficha comprovante-da-guia, parte A)
  const abrirComprovante = useJanelaDoComprovante(props);
  const [baixando, setBaixando] = useState('');
  const [mes, setMesBruto] = useState(chaveDoMes(hoje));
  const [abaBruta, setAba] = useState<AbaDasGuias>('apagar');
  const [diaEscolhido, setDiaEscolhido] = useState<number | null>(null);
  const setMes = (m: string) => { setMesBruto(m); setDiaEscolhido(null); setAba('apagar'); };
  // até o mês que vem (o robô monta a agenda um mês na frente)
  const ultimo = chaveDoMes(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1));
  const guias = ac.guiasDeHoje(area.guias, hoje).filter(g => mesDaData(g.vencimento) === mes);
  const mostraPagas = area.secoes.pagas;
  const pagas = mostraPagas ? area.pagas.filter(p => mesDaData(p.pagoEm) === mes) : [];
  const aba: AbaDasGuias = mostraPagas ? abaBruta : 'apagar';

  // a pré-visualização da guia (12/11/2026: "quero que a pessoa tenha uma pré-visualização")
  const vista = useVisualizar();
  const verGuia = (id: string) => vista.ver(id, () => repoAreaCliente.baixarGuia(token, id));
  const zip = useBaixarVarios();

  async function baixar(id: string) {
    setBaixando(id);
    try {
      const pdf = await repoAreaCliente.baixarGuia(token, id);
      if (pdf) baixarArquivo(pdf.nome, pdf.arquivo); else toast('Não achamos o arquivo desta guia. Fale com o escritório.');
    } finally { setBaixando(''); }
  }

  async function comprovante(id: string) {
    setBaixando(id);
    try {
      const pdf = await repoAreaCliente.baixarComprovante(token, id);
      if (pdf) baixarArquivo(pdf.nome, pdf.arquivo); else toast('O comprovante ainda não chegou. Fale com o escritório.');
    } finally { setBaixando(''); }
  }

  // a próxima a pagar leva o único Baixar carmim da tela ("melhora mais" de 17/10/2026: a vencida leva o "Pedir nova")
  const proxima = guias.find(g => g.situacao !== 'vencida') ?? null;

  // (16/11/2026, "muita informação") sem as entregas do escritório: o calendário marca só as guias e as pagas
  const p = painelDasGuias(guias, pagas, [], mes, hoje, g => ac.rotuloDaGuia(g));
  const nomeDoMes = formatos.rot(mes).toLowerCase().replace(/ de \d{4}$/, '');
  const porDia = new Map<number, MarcaDoMes[]>();
  for (const x of p.linha.marcas) porDia.set(x.dia, [...(porDia.get(x.dia) ?? []), x]);
  // o dia escolhido no calendário (só vale se o dia tem algo)
  const escolhido = diaEscolhido != null && porDia.has(diaEscolhido) ? diaEscolhido : null;

  // o calendário do mês: as casas em semanas, cada dia com os pontos (a cor diz a situação)
  const casas = [...Array.from({ length: p.linha.primeiroDia }, () => null), ...Array.from({ length: p.linha.dias }, (_, i) => i + 1)];
  while (casas.length % 7) casas.push(null);
  const semanas = Array.from({ length: casas.length / 7 }, (_, s) => casas.slice(s * 7, s * 7 + 7).map((dia, k) => {
    if (dia == null) return { chave: 'v' + s + k, dia: 0, vazio: true, hoje: false, passou: false, fimDeSemana: false, escolhido: false, pontos: [] as string[], titulo: '' };
    const marcas = porDia.get(dia) ?? [];
    return {
      chave: 'd' + dia, dia, vazio: false, hoje: p.linha.hoje === dia, passou: p.linha.hoje != null && dia < p.linha.hoje,
      fimDeSemana: k === 0 || k === 6, escolhido: escolhido === dia,
      pontos: marcas.slice(0, 3).map(m => m.tipo + '-' + m.tom),
      titulo: marcas.length ? 'Dia ' + dia + ': ' + marcas.map(x => x.rotulo).join('; ') : '',
    };
  }));

  const linhasDasGuias = guias.map(g => ({
    guia: g, dia: diaDaData(g.vencimento), escolhida: escolhido != null && diaDaData(g.vencimento) === escolhido,
    // (16/11/2026, "muita informação") só a data: "Vence 19/11", "Venceu 11/11"
    quando: quandoVence(g.situacao, g.vencimento), codigo: area.codigos[g.id] as string | undefined, destaque: g.id === (proxima?.id ?? ''),
  }));
  const linhasDasPagas = pagas.map(x => ({ paga: x, dia: diaDaData(x.pagoEm), escolhida: escolhido != null && diaDaData(x.pagoEm) === escolhido }));
  const comPdf = guias.filter(g => g.temPdf);

  return {
    /** abre a janela do comprovante desta guia (o tipo e o prefixo já marcados) */
    mandarComprovante: abrirComprovante,
    /** 'dd/mm' do comprovante mais novo que o cliente mandou para a guia, ou '' */
    comprovanteEm: (g: ac.GuiaDoCliente) => { const r = ac.comprovanteDaGuia(g, area.envios); const d = r ? formatos.diaEmBrasilia(r.recebidoEm) : ''; return d ? d.slice(8, 10) + '/' + d.slice(5, 7) : ''; },
    mes, mudarMes: setMes, ultimo,
    // os parcelamentos ativos, numa linha cada (só se houver; nunca "atrasada") (plano do Acessórias, 18/11/2026, ficha parcelamentos; frase do dono: "Serve, seguir")
    // (24/11/2026: "esse aqui ta muito estranho", "essas 2") o parcelamento e os honorários num cartão só, "Outros
    // pagamentos", com as linhas no desenho das guias: o nome, a frase curta, o valor à direita e o botão na mesma casa
    parcelamentos: area.parcelamentos.map(x => ({
      id: x.id, nome: 'Parcelamento ' + x.orgao,
      sub: (x.modalidade ? x.modalidade + ' · ' : '') + 'parcela ' + x.parcela + ' de ' + x.parcelas + ' · vence ' + x.vencimento.slice(0, 5),
      valor: formatos.reais(x.valorParcela),
    })),
    // os boletos dos honorários do escritório (24/11/2026, ficha 50; o dono: "Só o boleto, sem 'pago'"): os três mais
    // novos, com o vencimento e sem situação (nem "vencida", nem "pago")
    honorarios: area.honorarios.slice(0, 3).map(h => ({
      id: h.id, nome: 'Honorários do escritório',
      sub: formatos.rot(h.competencia).replace(/^./, c => c.toUpperCase()) + ' · vence ' + h.vencimento.slice(0, 5),
      valor: formatos.reais(h.valor), linha: h.linha ?? '', pix: h.pix ?? '', temPdf: h.temPdf,
    })),
    // a linha embaixo do título (16/11/2026, "muita informação": no máximo dois fatos)
    resumo: resumoCurtoDasGuias({
      nomeDoMes, aPagar: { valor: formatos.reais(p.aPagar.valor), guias: p.aPagar.guias }, vencidas: p.vencidas.guias,
      proxima: proxima && /^\d\d\/\d\d/.test(proxima.vencimento) ? proxima.vencimento.slice(0, 5) : null, pagas: pagas.length,
    }),
    // as abas dentro do cartão da lista (como em Solicitações); as pagas só quando a área tem de onde tirar
    abas: [{ id: 'apagar' as const, rotulo: 'A pagar', n: guias.length }, ...(mostraPagas ? [{ id: 'pagas' as const, rotulo: 'Pagas', n: pagas.length }] : [])],
    aba, escolherAba: setAba,
    guias: linhasDasGuias, pagas: linhasDasPagas,
    // (13/11/2026, revisão) a lista vazia não repete o "Nada a pagar" do resumo logo acima: diz o que fazer ou esperar
    vazio: aba === 'pagas' ? 'Nenhuma guia paga em ' + nomeDoMes + '.'
      : pagas.length ? 'As guias de ' + nomeDoMes + ' que já foram pagas estão na aba Pagas.'
        : mes < chaveDoMes(hoje) ? 'Nenhuma guia em ' + nomeDoMes + '.'
          : 'Quando o escritório mandar uma guia de ' + nomeDoMes + ', ela aparece aqui.',
    calendario: { titulo: 'Agenda de ' + nomeDoMes, semanas, legenda: legendaDoCalendario(p.linha.marcas), mostra: p.linha.marcas.length > 0 },
    diaEscolhido: escolhido,
    /** escolhe o dia (o clique no calendário): destaca o que vence nele e abre a aba certa; no mesmo dia, solta */
    escolherDia: (d: number) => {
      if (escolhido === d) { setDiaEscolhido(null); return; }
      setDiaEscolhido(d);
      setAba(abaDoDia<AbaDasGuias>(d, linhasDasGuias.map(x => x.dia), linhasDasPagas.map(x => x.dia), aba, 'apagar', 'pagas'));
    },
    pedirGuiaNova: (g: ac.GuiaDoCliente) => irPara('chamados', { novoChamado: { tipo: 'documento', titulo: tituloDaGuiaNova(g) } }),
    /** "Já paguei: tirar da lista" (26/11/2026): confirma e a guia sai do "A pagar" neste aparelho */
    jaPaguei: marcarGuiaPaga ? (g: ac.GuiaDoCliente) => {
      const nome = ac.rotuloDaGuia(g);
      void modal<boolean>({ titulo: 'Já pagou esta guia?', corpo: nome + ' de ' + formatos.reais(g.valor) + ' sai da lista de guias a pagar neste aparelho. Se quiser, mande o comprovante pelo "Já paguei: mandar o comprovante".',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Já paguei', valor: true, variante: 'btn-primary' }] })
        .then(sim => { if (sim) { marcarGuiaPaga(g.id); toast(nome + ' saiu das guias a pagar.'); } });
    } : undefined,
    vista, verGuia, baixando, baixar, comprovante, copiarCodigo: (c: string) => copiar(c, 'Código'),
    // o Pix copia e cola do boleto dos honorários (24/11/2026: "se possivel poder gerar um codigo pix")
    copiarPix: (c: string) => copiar(c, 'Pix copia e cola'),
    // o mesmo padrão da Central (13/11/2026): as setas da janela andam pelas guias a pagar; todas num .zip
    setas: vista.setas(comPdf.map(g => g.id), id => repoAreaCliente.baixarGuia(token, id)),
    comPdf: comPdf.length, juntando: zip.juntando,
    baixarTodas: () => { void zip.baixarVarios(comPdf.map(g => g.id), id => repoAreaCliente.baixarGuia(token, id), nomeDoZip(area.resumo?.empresas?.[0]?.nome ?? '', mes, 'Guias')); },
  };
}
