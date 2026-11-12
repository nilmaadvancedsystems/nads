// ViewModel da Visão geral da Área do Cliente (Vitor, 16/10/2026). "Melhora mais" de 17/10/2026 ("procura na net exemplos
// de portal de cliente"), no padrão dos portais das contabilidades (Assembly, TaxDome, a "Visão do Cliente" do Omie):
// o veredito com o que precisamos do cliente (dados/visaoGeral.ts), as guias do momento com o resumo do pagamento (quanto,
// até quando e como), a atividade recente e o envio rápido. Os quatro números saíram: o veredito diz a situação, o resumo
// do pagamento diz quanto, e cada um leva à ação no lugar dele.
import { areaCliente as ac, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { baixarArquivo } from '../dados/baixar';
import { repoAreaCliente } from '../dados/repo';
import { useVisualizar } from './useVisualizar';
import { chaveDoMes, resumoDoPessoal } from '../dados/regras';
import { atividadeRecente, guiasDoMomento, pendenciasDoCliente, proximosDoCliente, quandoFoi, vereditoDoMes, type AcaoDaPendencia } from '../dados/visaoGeral';
import type { DaCasca } from './useAreaCliente';

/** 'dd/mm/aaaa' → 'aaaa-mm' */
const mesDaData = (br: string) => br.slice(6, 10) + '-' + br.slice(3, 5);

export function useInicio({ token, area, hoje, irPara, copiar }: DaCasca, abrirEnvio: () => void) {
  const { toast } = useRetorno();
  const navegar = useNavigate();
  const [baixando, setBaixando] = useState('');
  const guias = guiasDoMomento(area.guias, hoje);
  const mes = chaveDoMes(hoje);
  const pendencias = pendenciasDoCliente(area, hoje);
  const veredito = vereditoDoMes(pendencias, guias);
  const aVencer = guias.filter(g => g.situacao !== 'vencida');
  const pagasDoMes = area.secoes.pagas ? area.pagas.filter(p => mesDaData(p.pagoEm) === mes) : [];

  // a pré-visualização da guia (12/11/2026: "quero que a pessoa tenha uma pré-visualização")
  const vista = useVisualizar();
  const verGuia = (id: string) => vista.ver(id, () => repoAreaCliente.baixarGuia(token, id));

  async function baixar(id: string) {
    setBaixando(id);
    try {
      const pdf = await repoAreaCliente.baixarGuia(token, id);
      if (pdf) baixarArquivo(pdf.nome, pdf.arquivo); else toast('Não achamos o arquivo desta guia. Fale com o escritório.');
    } finally { setBaixando(''); }
  }

  /** a guia vencida não passa no banco: o chamado "Pedir um documento" já com o título */
  const pedirGuiaNova = (titulo: string) => irPara('chamados', { novoChamado: { tipo: 'documento', titulo } });

  function agir(a: AcaoDaPendencia) {
    switch (a.tipo) {
      case 'baixar-guia': void baixar(a.guia); break;
      case 'pedir-guia': pedirGuiaNova(a.titulo); break;
      case 'ver-chamado': irPara('chamados', { chamado: a.chamado }); break;
      case 'pedir-renovacao': irPara('chamados', { novoChamado: { tipo: 'documento', titulo: 'Renovação do certificado digital' } }); break;
      case 'enviar': abrirEnvio(); break;
      case 'ir': irPara(a.aba); break;
      // o formulário do Mandei, neste mesmo site (11/11/2026)
      case 'abrir-ticket': navegar('/mandei/' + encodeURIComponent(a.codigo)); break;
    }
  }

  // em dias até o vencimento (negativo: já venceu)
  const diasAte = (g: ac.GuiaDoCliente) => {
    const v = ac.dataDoVencimento(g.vencimento);
    if (!v) return 0;
    return Math.round((new Date(v.getFullYear(), v.getMonth(), v.getDate()).getTime() - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime()) / 86_400_000);
  };
  const faltam = (g: ac.GuiaDoCliente) => { const d = diasAte(g); return d > 0 ? 'em ' + d + (d === 1 ? ' dia' : ' dias') : ''; };
  const proxima = aVencer[0] ?? null;
  const atualizado = area.resumo?.atualizadoEm ? quandoFoi(area.resumo.atualizadoEm, hoje) : '';

  // ---------- o painel do mês (12/11/2026: "retrabalhe completamente a página inicial"; a escolhida: "painel do mês") ----------
  const [aberto, setAberto] = useState('');
  const vencidas = guias.filter(g => g.situacao === 'vencida');
  const soma = (xs: readonly { valor: number }[]) => Math.round(xs.reduce((t, x) => t + x.valor, 0) * 100) / 100;
  const qtas = (n: number) => n + (n === 1 ? ' guia' : ' guias');
  const abertas = area.chamados.filter(c => c.situacao === 'aberto' || c.situacao === 'em andamento').length;
  const respondidas = area.chamados.filter(c => c.situacao === 'respondido').length;
  const hora = new Date().getHours();
  const numeros = [
    { chave: 'apagar', rotulo: 'A pagar', valor: formatos.reais(soma(aVencer)), dica: aVencer.length ? qtas(aVencer.length) + ' a vencer' : 'nada a vencer', tom: '', ir: 'guias' as const },
    { chave: 'vencidas', rotulo: 'Vencidas', valor: vencidas.length ? formatos.reais(soma(vencidas)) : 'Nenhuma', dica: vencidas.length ? qtas(vencidas.length) + ' · peça uma nova' : 'tudo em dia', tom: vencidas.length ? 'perigo' : 'ok', ir: 'guias' as const },
    { chave: 'proxima', rotulo: 'Próximo vencimento', valor: proxima ? proxima.vencimento.slice(0, 5) : '—', dica: proxima ? ac.ROTULO_DA_GUIA[proxima.tipo].replace(/ \(.*\)$/, '') + (faltam(proxima) ? ' · ' + faltam(proxima) : ' · hoje') : 'nenhuma guia a vencer', tom: '', ir: 'guias' as const },
    { chave: 'chamados', rotulo: 'Solicitações', valor: respondidas ? respondidas + (respondidas === 1 ? ' respondida' : ' respondidas') : abertas ? abertas + (abertas === 1 ? ' aberta' : ' abertas') : 'Nenhuma aberta',
      dica: respondidas && abertas ? abertas + (abertas === 1 ? ' aberta' : ' abertas') : respondidas ? 'o escritório respondeu' : abertas ? 'o escritório está vendo' : 'abra quando precisar', tom: respondidas ? 'aviso' : '', ir: 'chamados' as const },
  ];
  // os próximos vencimentos no estilo extrato (o mesmo das Guias): as guias e as entregas do escritório dos próximos 30 dias
  const SITUACAO_ENTREGA = 'O escritório entrega';
  const proximos = proximosDoCliente(area.guias, area.agenda, hoje, g => ac.ROTULO_DA_GUIA[g.tipo]).map(d => ({
    ...d, cabecalho: d.semana + ' ' + d.data.slice(8, 10) + '/' + d.data.slice(5, 7),
    itens: [
      ...d.itens.filter(x => x.tipo === 'guia').map(x => {
        const g = area.guias.find(y => y.id === x.guia);
        return { ...x, valorTexto: x.valor != null ? formatos.reais(x.valor) : '', aberto: aberto === x.chave,
          temPdf: !!g?.temPdf, codigo: g ? area.codigos[g.id] ?? '' : '', guiaObj: g ?? null };
      }),
      // as entregas do dia numa linha só, como nas Guias
      ...(d.itens.some(x => x.tipo === 'entrega') ? [{ chave: d.data + '-e', tipo: 'entrega' as const, tom: 'aberta' as const, nome: d.itens.filter(x => x.tipo === 'entrega').map(x => x.nome.replace(/\s*\(.*\)$/, '')).join(' · '),
        situacao: SITUACAO_ENTREGA, valor: null, valorTexto: '', aberto: false, temPdf: false, codigo: '', guiaObj: null }] : []),
    ],
  }));
  // os resumos ao lado: o Faturamento (o último mês fechado e as 12 barrinhas) e o Registro (os ativos e a folha)
  const empresaFat = area.faturamento?.empresas[0];
  const painelFat = empresaFat ? ac.painelDoFaturamento(empresaFat.meses, empresaFat.regime, hoje) : null;
  const maiorFat = painelFat ? Math.max(1, ...painelFat.meses.map(m => m.total ?? 0)) : 1;
  const pessoal = area.secoes.dp && area.pessoal ? resumoDoPessoal(area.pessoal, hoje) : null;

  return {
    saudacao: hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite',
    numeros, proximos,
    abrirLinha: (chave: string) => setAberto(a => (a === chave ? '' : chave)),
    faturamento: painelFat?.ultimo ? {
      mes: formatos.rot(painelFat.ultimo.competencia).toLowerCase(), valor: formatos.reais(painelFat.ultimo.total ?? 0),
      variacao: painelFat.ultimo.variacao == null ? '' : (painelFat.ultimo.variacao > 0 ? '+' : '') + String(painelFat.ultimo.variacao).replace('.', ',') + '%',
      subiu: (painelFat.ultimo.variacao ?? 0) >= 0,
      barras: painelFat.meses.map(m => ({ mes: m.competencia, altura: m.total ? Math.max(6, Math.round((m.total / maiorFat) * 100)) : 0, ultimo: m.competencia === painelFat.ultimo?.competencia })),
    } : null,
    registro: pessoal && (pessoal.ativos || pessoal.folha) ? {
      ativos: pessoal.ativos + (pessoal.ativos === 1 ? ' funcionário ativo' : ' funcionários ativos'),
      folha: formatos.reais(pessoal.folha), competencia: pessoal.competencia ? formatos.rot(pessoal.competencia).toLowerCase() : '',
    } : null,
    // a sobrelinha do veredito: o mês e quando o escritório atualizou ("Outubro de 2026 · atualizado hoje, 07:30")
    sobre: formatos.capital(hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })) + (atualizado ? ' · atualizado ' + (/^\d/.test(atualizado) ? 'em ' : '') + atualizado : ''),
    veredito, pendencias, agir,
    // as pagas do mês (as mesmas do "Já pago no mês")
    guias, pagas: pagasDoMes,
    // o resumo do pagamento: só quando tem guia por vencer (a vencida já está no veredito)
    resumo: aVencer.length ? {
      aPagar: aVencer.reduce((s, g) => s + g.valor, 0), quantas: aVencer.length,
      proximo: proxima ? proxima.vencimento.slice(0, 5) : '', faltam: proxima ? faltam(proxima) : '',
      pago: area.secoes.pagas ? { valor: pagasDoMes.reduce((s, p) => s + p.valor, 0), quantas: pagasDoMes.length } : undefined,
    } : null,
    // o Baixar carmim só quando o veredito não tem botão carmim (tudo em dia): a próxima guia a pagar
    destaque: pendencias.length === 0 ? proxima?.id ?? '' : '',
    temCodigo: guias.some(g => !!area.codigos[g.id]),
    faltam,
    atividade: atividadeRecente(area, new Date()).map(a => ({ ...a, quando: quandoFoi(a.em, hoje) })),
    baixarComprovante: async (id: string) => {
      const pdf = await repoAreaCliente.baixarComprovante(token, id);
      if (pdf) baixarArquivo(pdf.nome, pdf.arquivo); else toast('O comprovante ainda não chegou.');
    },
    codigos: area.codigos,
    vista, verGuia, baixando, baixar, pedirGuiaNova, irPara, copiarCodigo: (c: string) => copiar(c, 'Código'),
  };
}
