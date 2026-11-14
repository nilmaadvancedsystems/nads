// ViewModel de Guias e obrigações (Vitor, 16/10/2026, a "Agenda de tributos e obrigações" do protótipo). Refeita em
// 13/11/2026 ("refaça esses 3"; "muita informação", a mesma guia aparecia na agenda e no "A pagar"): uma linha de resumo
// embaixo do título; as guias do mês numa lista com abas (A pagar e Pagas); o calendário do mês só com os pontos (o
// clique no dia destaca o que vence nele); a lista do que o escritório entrega no mês; os avisos da contabilidade.
import { areaCliente as ac, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { baixarArquivo } from '../dados/baixar';
import { repoAreaCliente } from '../dados/repo';
import { nomeDoZip } from '../dados/biblioteca';
import { useBaixarVarios } from './useBaixarVarios';
import { useVisualizar } from './useVisualizar';
import { abaDoDia, chaveDoMes, painelDasGuias, resumoDasGuias, situacaoDoCertificado, vencimentoDaGuia, legendaDoCalendario, type MarcaDoMes } from '../dados/regras';
import { tituloDaGuiaNova } from '../dados/visaoGeral';
import type { DaCasca } from './useAreaCliente';

export type AbaDasGuias = 'apagar' | 'pagas';

/** 'dd/mm/aaaa' → 'aaaa-mm' */
const mesDaData = (br: string) => br.slice(6, 10) + '-' + br.slice(3, 5);
/** 'dd/mm/aaaa' → dd */
const diaDaData = (br: string) => Number(br.slice(0, 2)) || 0;

export function useGuias({ token, area, hoje, irPara, copiar }: DaCasca) {
  const { toast } = useRetorno();
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
  // o que o escritório entrega no mês; o "não se aplica" não aparece para o cliente
  const agenda: ac.ItemDaAgenda[] = (area.agenda.find(a => a.mes === mes)?.itens ?? []).filter(i => i.situacao !== 'nao se aplica' && i.vence.startsWith(mes)).sort((x, y) => x.vence.localeCompare(y.vence));

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

  // em dias até o vencimento (negativo: já venceu)
  const diasAte = (g: ac.GuiaDoCliente) => {
    const venc = ac.dataDoVencimento(g.vencimento);
    if (!venc) return 0;
    return Math.round((new Date(venc.getFullYear(), venc.getMonth(), venc.getDate()).getTime() - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime()) / 86_400_000);
  };
  // "em 4 dias", "há 5 dias"; no dia, nada (a situação já diz "Vence hoje")
  const faltam = (g: ac.GuiaDoCliente) => {
    if (!ac.dataDoVencimento(g.vencimento)) return '';
    const dias = diasAte(g);
    return dias > 0 ? 'em ' + dias + (dias === 1 ? ' dia' : ' dias') : dias < 0 ? 'há ' + -dias + (dias === -1 ? ' dia' : ' dias') : '';
  };
  // a próxima a pagar leva o único Baixar carmim da tela ("melhora mais" de 17/10/2026: a vencida leva o "Pedir nova")
  const proxima = guias.find(g => g.situacao !== 'vencida') ?? null;
  const nomeCurto = (g: ac.GuiaDoCliente) => ac.ROTULO_DA_GUIA[g.tipo].replace(/ \(.*\)$/, '');

  const p = painelDasGuias(guias, pagas, agenda, mes, hoje, g => ac.ROTULO_DA_GUIA[g.tipo]);
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
    // (13/11/2026, revisão) a linha menor: "Vencida em 08/11, há 5 dias", "Vence em 16/11, daqui a 3 dias"
    quando: vencimentoDaGuia(g.situacao, g.vencimento, ac.dataDoVencimento(g.vencimento) ? diasAte(g) : null), codigo: area.codigos[g.id] as string | undefined, destaque: g.id === (proxima?.id ?? ''),
  }));
  const linhasDasPagas = pagas.map(x => ({ paga: x, dia: diaDaData(x.pagoEm), escolhida: escolhido != null && diaDaData(x.pagoEm) === escolhido }));
  const entregas = agenda.map(x => {
    const dia = Number(x.vence.slice(8, 10));
    return { id: x.id, dia, data: x.vence.slice(8, 10) + '/' + x.vence.slice(5, 7), nome: x.nome, feita: x.situacao === 'feito', hoje: p.linha.hoje === dia, escolhida: escolhido === dia };
  });
  const feitas = entregas.filter(e => e.feita).length;
  const comPdf = guias.filter(g => g.temPdf);

  return {
    mes, mudarMes: setMes, ultimo,
    // a linha embaixo do título (13/11/2026: no lugar dos três cartões grandes)
    resumo: resumoDasGuias({
      nomeDoMes, aPagar: { valor: formatos.reais(p.aPagar.valor), guias: p.aPagar.guias }, vencidas: { valor: formatos.reais(p.vencidas.valor), guias: p.vencidas.guias },
      proxima: proxima ? { data: proxima.vencimento.slice(0, 5), nome: nomeCurto(proxima), faltam: faltam(proxima) } : null, pagas: pagas.length,
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
    entregas, resumoDasEntregas: entregas.length ? feitas + ' de ' + entregas.length + (feitas === 1 ? ' entregue' : ' entregues') : '',
    diaEscolhido: escolhido,
    /** escolhe o dia (o clique no calendário): destaca o que vence nele e abre a aba certa; no mesmo dia, solta */
    escolherDia: (d: number) => {
      if (escolhido === d) { setDiaEscolhido(null); return; }
      setDiaEscolhido(d);
      setAba(abaDoDia<AbaDasGuias>(d, linhasDasGuias.map(x => x.dia), linhasDasPagas.map(x => x.dia), aba, 'apagar', 'pagas'));
    },
    pedirGuiaNova: (g: ac.GuiaDoCliente) => irPara('chamados', { novoChamado: { tipo: 'documento', titulo: tituloDaGuiaNova(g) } }),
    vista, verGuia, baixando, baixar, comprovante, copiarCodigo: (c: string) => copiar(c, 'Código'),
    // o mesmo padrão da Central (13/11/2026): as setas da janela andam pelas guias a pagar; todas num .zip
    setas: vista.setas(comPdf.map(g => g.id), id => repoAreaCliente.baixarGuia(token, id)),
    comPdf: comPdf.length, juntando: zip.juntando,
    baixarTodas: () => { void zip.baixarVarios(comPdf.map(g => g.id), id => repoAreaCliente.baixarGuia(token, id), nomeDoZip(area.resumo?.empresas?.[0]?.nome ?? '', mes, 'Guias')); },
    certificado: area.certificado ? { ...area.certificado, ...situacaoDoCertificado(area.certificado, hoje) } : null,
    avisos: area.avisos, irPara,
  };
}
