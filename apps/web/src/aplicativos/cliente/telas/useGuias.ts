// ViewModel de Guias e obrigações (Vitor, 16/10/2026, a "Agenda de tributos e obrigações" do protótipo): o mês escolhido
// e, nele, as três colunas — os próximos vencimentos (as guias para pagar, com baixar e copiar a linha digitável), o que
// foi quitado (com o comprovante) e os avisos da contabilidade (os recados do escritório e o certificado digital); embaixo,
// a agenda do que o escritório entrega no mês.
import { areaCliente as ac, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { baixarArquivo } from '../dados/baixar';
import { repoAreaCliente } from '../dados/repo';
import { nomeDoZip } from '../dados/biblioteca';
import { useBaixarVarios } from './useBaixarVarios';
import { useVisualizar } from './useVisualizar';
import { chaveDoMes, painelDasGuias, situacaoDoCertificado, type MarcaDoMes } from '../dados/regras';
import { tituloDaGuiaNova } from '../dados/visaoGeral';
import type { DaCasca } from './useAreaCliente';

/** Uma ação no dia aberto da agenda: a tela liga cada uma ao que já existe (ver, copiar, baixar, pedir nova, comprovante). */
export type AcaoDoDia = { tipo: 'ver' | 'pedir' | 'comprovante'; id: string } | { tipo: 'copiar'; id: string; codigo: string } | { tipo: 'baixar'; id: string; destaque: boolean };

/** 'dd/mm/aaaa' → 'aaaa-mm' */
const mesDaData = (br: string) => br.slice(6, 10) + '-' + br.slice(3, 5);

export function useGuias({ token, area, hoje, irPara, copiar }: DaCasca) {
  const { toast } = useRetorno();
  const [baixando, setBaixando] = useState('');
  const [mes, setMesBruto] = useState(chaveDoMes(hoje));
  const [diaEscolhido, setDiaEscolhido] = useState<number | null>(null);
  const setMes = (m: string) => { setMesBruto(m); setDiaEscolhido(null); };
  // até o mês que vem (o robô monta a agenda um mês na frente)
  const ultimo = chaveDoMes(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1));
  const guias = ac.guiasDeHoje(area.guias, hoje).filter(g => mesDaData(g.vencimento) === mes);
  const pagas = area.pagas.filter(p => mesDaData(p.pagoEm) === mes);
  // o que o escritório entrega no mês; o "não se aplica" não aparece para o cliente
  const agenda: ac.ItemDaAgenda[] = (area.agenda.find(a => a.mes === mes)?.itens ?? []).filter(i => i.situacao !== 'nao se aplica').sort((x, y) => x.vence.localeCompare(y.vence));

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
  const proxima = guias.find(g => g.situacao !== 'vencida') ?? null;
  const faltam = (g: ac.GuiaDoCliente) => {
    if (!ac.dataDoVencimento(g.vencimento)) return '';
    const dias = diasAte(g);
    return dias > 0 ? 'em ' + dias + (dias === 1 ? ' dia' : ' dias') : dias < 0 ? 'há ' + -dias + (dias === -1 ? ' dia' : ' dias') : '';
  };

  // o painel do mês (12/11/2026: "quero melhora nessa aba também"): os números no alto, a barra do andamento e a linha
  // do tempo dos vencimentos (as guias, as pagas e as entregas do escritório)
  const p = painelDasGuias(guias, area.secoes.pagas ? pagas : [], agenda, mes, hoje, g => ac.ROTULO_DA_GUIA[g.tipo]);
  const qtas = (n: number) => n + (n === 1 ? ' guia' : ' guias');
  const porDia = new Map<number, MarcaDoMes[]>();
  for (const x of p.linha.marcas) porDia.set(x.dia, [...(porDia.get(x.dia) ?? []), x]);
  const nomeDoMes = formatos.rot(mes).toLowerCase().replace(/ de \d{4}$/, '');
  // o calendário compacto e a agenda do mês ao lado (12/11/2026: "gostei da ideia mas está mal executado"): o
  // calendário só com os pontos (a cor diz a situação); a lista diz o que é, quanto e quando. O dia escolhido (o clique
  // no calendário) fica em destaque na lista; sem escolha, hoje (ou o primeiro dia com algo)
  const casas = [...Array.from({ length: p.linha.primeiroDia }, () => null), ...Array.from({ length: p.linha.dias }, (_, i) => i + 1)];
  while (casas.length % 7) casas.push(null);
  const diasComAlgo = [...porDia.keys()].sort((a, b) => a - b);
  // o dia aberto: só o que o cliente clicou (12/11/2026: abrir um sozinho deixava a grade dos dias desigual)
  const escolhido = diaEscolhido != null && porDia.has(diaEscolhido) ? diaEscolhido : null;
  const semanas = Array.from({ length: casas.length / 7 }, (_, s) => casas.slice(s * 7, s * 7 + 7).map((dia, k) => {
    if (dia == null) return { chave: 'v' + s + k, dia: 0, vazio: true, hoje: false, passou: false, fimDeSemana: false, escolhido: false, pontos: [] as string[], titulo: '' };
    const marcas = porDia.get(dia) ?? [];
    return {
      chave: 'd' + dia, dia, vazio: false, hoje: p.linha.hoje === dia, passou: p.linha.hoje != null && dia < p.linha.hoje,
      fimDeSemana: k === 0 || k === 6, escolhido: escolhido === dia,
      pontos: marcas.slice(0, 3).map(m => 'm-' + m.tipo + ' t-' + m.tom),
      titulo: marcas.length ? 'Dia ' + dia + ': ' + marcas.map(x => x.rotulo).join('; ') : '',
    };
  }));
  const SITUACAO: Record<string, string> = { 'guia vencida': 'Vencida', 'guia hoje': 'Vence hoje', 'guia aberta': 'A pagar', 'paga feita': 'Paga', 'entrega aberta': 'O escritório entrega', 'entrega feita': 'Entregue' };
  const semana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const nGuias = p.linha.marcas.filter(m => m.tipo !== 'entrega').length, nEntregas = p.linha.marcas.length - nGuias;
  const mm = mes.slice(5, 7);
  const agendaDoMes = diasComAlgo.map(dia => ({
    dia, extenso: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][new Date(Number(mes.slice(0, 4)), Number(mm) - 1, dia).getDay()] + ', ' + dia + ' de ' + nomeDoMes,
    cabecalho: semana[new Date(Number(mes.slice(0, 4)), Number(mm) - 1, dia).getDay()].toUpperCase() + ' ' + String(dia).padStart(2, '0') + '/' + mm,
    numero: String(dia).padStart(2, '0'), semana: semana[new Date(Number(mes.slice(0, 4)), Number(mm) - 1, dia).getDay()],
    data: semana[new Date(Number(mes.slice(0, 4)), Number(mm) - 1, dia).getDay()] + ' ' + String(dia).padStart(2, '0') + '/' + mm,
    hoje: p.linha.hoje === dia, passou: p.linha.hoje != null && dia < p.linha.hoje, escolhido: escolhido === dia,
    // o dia aberto (12/11/2026: "quero que o dia seja clicável", "ficou feio"): as mesmas linhas, cada guia com as ações
    // pequenas embaixo do nome e as entregas do escritório uma por uma, com a situação
    detalhe: [
      ...guias.filter(g => Number(g.vencimento.slice(0, 2)) === dia).map(g => {
        const vencida = g.situacao === 'vencida';
        const acoes: AcaoDoDia[] = [
          ...(g.temPdf ? [{ tipo: 'ver' as const, id: g.id }] : []),
          ...(!vencida && area.codigos[g.id] ? [{ tipo: 'copiar' as const, id: g.id, codigo: area.codigos[g.id] }] : []),
          vencida ? { tipo: 'pedir' as const, id: g.id } : { tipo: 'baixar' as const, id: g.id, destaque: g.id === (proxima?.id ?? '') },
        ];
        return {
          chave: g.id, classe: 'm-guia t-' + (vencida ? 'vencida' : g.situacao === 'vence hoje' ? 'hoje' : 'aberta'), entrega: false,
          nome: ac.ROTULO_DA_GUIA[g.tipo], sub: 'competência ' + g.competencia.slice(5, 7) + '/' + g.competencia.slice(0, 4) + (faltam(g) ? ' · ' + (vencida ? 'venceu ' : 'vence ') + faltam(g) : ''),
          situacao: vencida ? 'Vencida' : g.situacao === 'vence hoje' ? 'Vence hoje' : 'A pagar', valor: formatos.reais(g.valor), acoes,
        };
      }),
      ...(area.secoes.pagas ? pagas.filter(x => Number(x.pagoEm.slice(0, 2)) === dia) : []).map(x => ({
        chave: x.id, classe: 'm-paga t-feita', entrega: false, nome: x.nome, sub: 'pago em ' + x.pagoEm.slice(0, 5),
        situacao: 'Paga', valor: formatos.reais(x.valor), acoes: (x.temComprovante ? [{ tipo: 'comprovante' as const, id: x.id }] : []) as AcaoDoDia[],
      })),
      ...agenda.filter(x => x.vence.startsWith(mes) && Number(x.vence.slice(8, 10)) === dia).map(x => ({
        chave: x.id, classe: 'm-entrega t-' + (x.situacao === 'feito' ? 'feita' : 'aberta'), entrega: true, nome: x.nome, sub: '',
        situacao: x.situacao === 'feito' ? 'Entregue pelo escritório' : 'O escritório entrega', valor: '', acoes: [] as AcaoDoDia[],
      })),
    ],
    itens: (() => {
      const marcas = porDia.get(dia) ?? [];
      const dinheiro = marcas.filter(m => m.tipo !== 'entrega').map((m, k) => ({
        chave: dia + '-' + k, classe: 'm-' + m.tipo + ' t-' + m.tom, nome: m.nome, entrega: false,
        situacao: SITUACAO[m.tipo + ' ' + m.tom] ?? '', valor: m.valor != null ? formatos.reais(m.valor) : '',
      }));
      // as entregas do escritório do dia numa linha só (12/11/2026: "O escritório entrega" repetido pesava mais que as guias)
      const entregas = marcas.filter(m => m.tipo === 'entrega');
      const feitas = entregas.length > 0 && entregas.every(m => m.tom === 'feita');
      return entregas.length ? [...dinheiro, {
        // numa linha só, como no extrato: os nomes curtos juntos e, na coluna da situação, quem entrega
        chave: dia + '-e', classe: 'm-entrega t-' + (feitas ? 'feita' : 'aberta'), entrega: true, valor: '',
        nome: entregas.length === 1 ? entregas[0].nome : entregas.map(m => m.curto).join(' · '),
        situacao: feitas ? (entregas.length === 1 ? 'Entregue' : 'Entregues') : 'O escritório entrega',
      }] : dinheiro;
    })(),
  }));
  const painel = {
    numeros: [
      { chave: 'apagar', rotulo: 'A pagar no mês', valor: formatos.reais(p.aPagar.valor), dica: p.aPagar.guias ? qtas(p.aPagar.guias) : 'nenhuma guia', tom: '' },
      { chave: 'vencidas', rotulo: 'Vencidas', valor: p.vencidas.guias ? formatos.reais(p.vencidas.valor) : 'Nenhuma', dica: p.vencidas.guias ? qtas(p.vencidas.guias) + ' · peça uma nova' : 'tudo em dia', tom: p.vencidas.guias ? 'perigo' : 'ok' },
      { chave: 'proxima', rotulo: 'Próximo vencimento', valor: proxima ? proxima.vencimento.slice(0, 5) : '—', dica: proxima ? ac.ROTULO_DA_GUIA[proxima.tipo].replace(/ \(.*\)$/, '') + ' · ' + (faltam(proxima) || 'hoje') : 'nenhum no mês', tom: '' },
    ],
    titulo: 'Agenda de ' + nomeDoMes,
    resumo: [nGuias ? nGuias + (nGuias === 1 ? ' guia' : ' guias') : '', nEntregas ? nEntregas + (nEntregas === 1 ? ' entrega do escritório' : ' entregas do escritório') : ''].filter(Boolean).join(' · '),
    semanas, agenda: agendaDoMes,
    /** abre o dia (o clique no calendário ou na agenda); no dia já aberto, fecha */
    escolherDia: (d: number) => setDiaEscolhido(escolhido === d ? 0 : d),
    temCalendario: p.linha.marcas.length > 0,
  };

  return {
    painel,
    mes, mudarMes: setMes, ultimo,
    // o resumo do mês (a coluna da direita): o total a pagar, o total pago e o próximo vencimento
    totalAPagar: guias.reduce((s, g) => s + g.valor, 0),
    totalPago: pagas.reduce((s, p) => s + p.valor, 0),
    proxima,
    // a guia que leva o Baixar carmim (um só na área): a próxima a pagar ("melhora mais" de 17/10/2026: a vencida não
    // passa mais no banco, ela leva o "Pedir nova")
    urgente: proxima?.id ?? '',
    pedirGuiaNova: (g: ac.GuiaDoCliente) => irPara('chamados', { novoChamado: { tipo: 'documento', titulo: tituloDaGuiaNova(g) } }),
    guias, codigos: area.codigos, vista, verGuia, baixando, baixar,
    // o mesmo padrão da Central (13/11/2026): as setas da janela andam pelas guias a pagar; todas num .zip
    setas: vista.setas(guias.filter(g => g.temPdf).map(g => g.id), id => repoAreaCliente.baixarGuia(token, id)),
    comPdf: guias.filter(g => g.temPdf).length, juntando: zip.juntando,
    baixarTodas: () => { void zip.baixarVarios(guias.filter(g => g.temPdf).map(g => g.id), id => repoAreaCliente.baixarGuia(token, id), nomeDoZip(area.resumo?.empresas?.[0]?.nome ?? '', mes, 'Guias')); }, copiarCodigo: (c: string) => copiar(c, 'Código'),
    pagas, comprovante, mostraPagas: area.secoes.pagas,
    certificado: area.certificado ? { ...area.certificado, ...situacaoDoCertificado(area.certificado, hoje) } : null,
    avisos: area.avisos, irPara, agenda,
    // "em 4 dias", "há 5 dias"; no dia, nada (o selo já diz "Vence hoje")
    faltam,
  };
}
