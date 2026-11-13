// ViewModel do Registro da Área do Cliente (12/11/2026: "a função de registro, onde o cliente vai ter acesso aos
// funcionários registrados, folha de pagamento, férias e afins"). O que vem do escritório (o robô grava no link):
//   - os funcionários, pelas guias do FGTS de cada mês (o CPF mascarado): quem está ativo, desde quando, a remuneração;
//   - os documentos do DP dos últimos meses (a folha, os recibos, o pró-labore, as férias, as rescisões, o FGTS, o INSS e o
//     cartão de ponto), da pasta da empresa no Drive, mês a mês e por categoria; o de um funcionário vai na ficha dele.
// E os pedidos de admissão, férias e desligamento (Vitor, 16/10/2026), que viram uma solicitação do tipo certo.
// Refeito (12/11/2026): a equipe (ativos ou quem saiu, com a busca) na largura toda e a ficha numa janela flutuante;
// embaixo, a folha do mês por categoria.
import { areaCliente as ac, formatos } from '@nads/core';
import { formatoPeloNome, useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useLocation } from 'react-router';
import { baixarArquivo } from '../dados/baixar';
import { repoAreaCliente } from '../dados/repo';
import { nomeDoZip } from '../dados/biblioteca';
import { tempoDeEmpresa } from '../dados/regras';
import { useBaixarVarios } from './useBaixarVarios';
import { useVisualizar } from './useVisualizar';
import {
  dataBr, erroDaAdmissao, erroDaDemissao, erroDasFerias, nomeDaPessoa, resumoDoPessoal, textoDaAdmissao, textoDaDemissao, textoDasFerias,
  type PedidoDeAdmissao, type PedidoDeDemissao, type PedidoDeFerias,
} from '../dados/regras';
import type { DaCasca, PedidoDaTela } from './useAreaCliente';
import { curto, topoDoEixo, type ColunaDoGrafico } from './useAdministrativo';

export type Pedido = 'admissao' | 'ferias' | 'demissao';
export type DadosDoPedido = PedidoDeAdmissao | PedidoDeFerias | PedidoDeDemissao;
const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** 'aaaa-mm' → '10/2026' */
const mesBr = (c: string) => (c ? c.slice(5, 7) + '/' + c.slice(0, 4) : '');

export function useDp({ token, area, hoje }: DaCasca) {
  const { toast } = useRetorno();
  // a busca geral abre esta tela com a busca já preenchida (13/11/2026)
  const { state } = useLocation();
  const [busca, setBusca] = useState(() => ((state ?? {}) as PedidoDaTela).busca ?? '');
  const [mostrarSaidas, setMostrarSaidas] = useState(false);
  const [focoDaFolha, setFocoDaFolha] = useState<number | null>(null);
  // as abas do Registro (13/11/2026: "quero trabalhar no DP"): a equipe, as férias, a folha e o calendário
  const [abaDoRegistro, setAbaDoRegistro] = useState<'equipe' | 'ferias' | 'folha' | 'calendario'>('equipe');
  // o mês do calendário do DP (o de hoje; as setas andam)
  const [mesDoCalendario, setMesDoCalendario] = useState(() => hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0'));
  const vista = useVisualizar();
  const zip = useBaixarVarios();
  const meses = ac.mesesDosDocumentosDp(area.documentosDp);
  const [mesEscolhido, setMes] = useState('');
  const mes = meses.includes(mesEscolhido) ? mesEscolhido : meses[0] ?? '';
  // os documentos do mês, por categoria, na ordem da tela (as setas e o .zip andam por eles; só os que dá para baixar)
  const gruposDoMes = ac.documentosPorCategoria(area.documentosDp.filter(d => d.competencia === mes));
  const docsDoMes = gruposDoMes.flatMap(g => g.documentos).filter(d => d.partes > 0);
  const [baixando, setBaixando] = useState('');

  /** confere e manda o pedido como solicitação; devolve o erro em português, ou '' quando foi */
  async function pedir(pedido: Pedido, dados: DadosDoPedido): Promise<string> {
    const problema = pedido === 'admissao' ? erroDaAdmissao(dados as PedidoDeAdmissao) : pedido === 'ferias' ? erroDasFerias(dados as PedidoDeFerias) : erroDaDemissao(dados as PedidoDeDemissao);
    if (problema) return problema;
    const texto = pedido === 'admissao' ? textoDaAdmissao(dados as PedidoDeAdmissao) : pedido === 'ferias' ? textoDasFerias(dados as PedidoDeFerias) : textoDaDemissao(dados as PedidoDeDemissao);
    const foto = pedido === 'admissao' ? (dados as PedidoDeAdmissao).foto : undefined;
    try {
      const id = await repoAreaCliente.abrirChamado(token, { tipo: pedido, texto, ...(foto ? { foto } : {}) });
      if (!id) return 'Não deu para mandar o pedido. Tente de novo.';
    } catch (e) {
      // o banco recusou (link revogado) ou caiu a internet: a frase vem pronta do repositório
      return e instanceof Error ? e.message : 'Não deu para mandar o pedido. Tente de novo.';
    }
    toast('Pedido enviado ao escritório. Acompanhe em Solicitações.');
    return '';
  }

  async function baixar(id: string) {
    setBaixando(id);
    try {
      const r = await repoAreaCliente.baixarDocumentoDp(token, id);
      if (r) baixarArquivo(r.nome, r.arquivo); else toast('Não achamos este arquivo agora. Peça ao escritório em Solicitações.');
    } finally { setBaixando(''); }
  }

  const funcionarios = area.pessoal?.funcionarios ?? [];
  const nomeDe = new Map(funcionarios.map(f => [f.id, nomeDaPessoa(f.nome)]));
  const docsDe = (id: string) => area.documentosDp.filter(d => d.funcionario === id);
  /** um documento como a tela mostra: o nome, de quem, o mês e o tamanho, o ícone e se dá para baixar */
  // sem a extensão (o ícone já diz o tipo) e, na ficha da pessoa, sem o nome dela de novo (12/11/2026)
  const linhaDoDoc = (d: ac.DocumentoDoDp, naFicha = false) => ({
    id: d.id, nome: d.nome.replace(/\.[a-z0-9]{2,5}$/i, ''), formato: formatoPeloNome(d.nome), dono: d.funcionario && !naFicha ? nomeDe.get(d.funcionario) ?? '' : '',
    detalhe: [mesBr(d.competencia), d.tamanho ? ac.tamanhoLegivel(d.tamanho) : ''].filter(Boolean).join(' · '), podeBaixar: d.partes > 0,
  });
  const b = sem(busca.trim());
  // a equipe: os ativos ou quem saiu (um ou outro), com a busca
  const visiveis = funcionarios.filter(f => (mostrarSaidas ? !f.ativo : f.ativo) && (!b || sem(f.nome + ' ' + f.cpf + ' ' + f.matricula).includes(b)))
    .sort((x, y) => nomeDaPessoa(x.nome).localeCompare(nomeDaPessoa(y.nome)));
  const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

  // as férias de cada ativo pelo tempo no registro, descontando os recibos de férias dele (os meses distintos)
  const recibosDeFerias = (id: string) => area.documentosDp.filter(d => d.categoria === 'ferias' && d.funcionario === id).map(d => d.competencia);
  const ativos = funcionarios.filter(f => f.ativo && f.desde);
  // as férias de cada um (13/11/2026: a folha de verdade): pela previsão de férias do DP quando veio; senão, a estimativa
  // pelas guias, que o holerite corrige quando marca "Férias Vencidas"
  const feriasDe = new Map(ativos.map(f => {
    const estimativa = ac.feriasDoFuncionario(f.desde, hoje, recibosDeFerias(f.id));
    const pelaPrevisao = f.periodosDeFerias?.length ? ac.feriasPelaFolha(f.periodosDeFerias, hoje) : null;
    let x: ac.FeriasDoFuncionario = pelaPrevisao ?? estimativa;
    if (!pelaPrevisao && f.feriasVencidas && x.situacao !== 'vencida') x = { ...x, situacao: 'vencida', pendentes: Math.max(1, x.pendentes), texto: 'O holerite marca férias vencidas · ' + x.texto };
    return [f.id, { ...x, pelaFolha: !!pelaPrevisao || !!f.feriasVencidas }] as const;
  }));
  const TOM_DAS_FERIAS: Record<ac.SituacaoDasFerias, string> = { vencida: 'ruim', 'vence-logo': 'atencao', tem: 'bom', 'a-adquirir': 'neutro' };
  const ROTULO_DAS_FERIAS: Record<ac.SituacaoDasFerias, string> = { vencida: 'Venceu', 'vence-logo': 'Vence logo', tem: 'Pode tirar', 'a-adquirir': 'Em dia' };
  const ferias = ativos.map(f => ({ f, x: feriasDe.get(f.id)! }))
    .sort((a, b) => ac.ORDEM_DAS_FERIAS[a.x.situacao] - ac.ORDEM_DAS_FERIAS[b.x.situacao] || a.f.nome.localeCompare(b.f.nome))
    .map(({ f, x }) => ({ id: f.id, nome: nomeDaPessoa(f.nome), tom: TOM_DAS_FERIAS[x.situacao], rotulo: ROTULO_DAS_FERIAS[x.situacao], texto: x.texto, podeProgramar: x.situacao !== 'a-adquirir', pelaFolha: x.pelaFolha }));
  const feriasUrgentes = ferias.filter(x => x.tom === 'ruim' || x.tom === 'atencao').length;
  const feriasParaTirar = ferias.filter(x => x.podeProgramar).length;

  // o custo da folha mês a mês (as guias do FGTS): os salários (a base) e o FGTS, empilhados
  const historico = area.pessoal?.historico ?? [];
  const topoDaFolha = topoDoEixo(Math.max(1, ...historico.map(m => m.base + m.fgts)));
  // o mês em foco no gráfico (13/11/2026: o gráfico do Faturamento): o último, até passar o mouse ou clicar noutro
  const iFoco = focoDaFolha != null && focoDaFolha < historico.length ? focoDaFolha : historico.length - 1;
  const ultimoDaFolha = historico[iFoco];
  const anteriorDaFolha = historico[iFoco - 1];

  // o calendário do DP do mês escolhido
  const calendario = ac.calendarioDoDp(mesDoCalendario, funcionarios.map(f => ({ nome: nomeDaPessoa(f.nome).split(' ')[0], desde: f.desde, ativo: f.ativo, ferias: feriasDe.get(f.id) })));
  const DIAS_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  return {
    aba: abaDoRegistro, escolherAba: setAbaDoRegistro,
    abas: [
      { id: 'equipe' as const, rotulo: 'Equipe', icone: 'usuario' as const, conta: 0 },
      { id: 'ferias' as const, rotulo: 'Férias', icone: 'calendar' as const, conta: feriasUrgentes },
      { id: 'folha' as const, rotulo: 'Folha', icone: 'barChart' as const, conta: 0 },
      { id: 'calendario' as const, rotulo: 'Calendário', icone: 'clock' as const, conta: 0 },
    ],
    // as férias (13/11/2026: os avisos de férias)
    ferias, feriasParaTirar, feriasUrgentes,
    // de onde vieram as férias: todas pela previsão do DP, algumas, ou nenhuma (a estimativa)
    feriasFonte: !ferias.length || !ferias.some(x => x.pelaFolha) ? 'guias' as const : ferias.every(x => x.pelaFolha) ? 'folha' as const : 'misto' as const,
    feriasDoFuncionario: (id: string) => { const x = feriasDe.get(id); return x ? { rotulo: ROTULO_DAS_FERIAS[x.situacao], tom: TOM_DAS_FERIAS[x.situacao], texto: x.texto } : null; },
    // o custo da folha
    // as colunas do custo, no mesmo gráfico do Faturamento
    folhaColunas: historico.map((m, i): ColunaDoGrafico => ({
      chave: m.competencia, altura: Math.max(1, Math.round(((m.base + m.fgts) / topoDaFolha) * 1000) / 10), vazia: false,
      foco: i === iFoco, destaque: false, apagada: false, valor: curto(m.base + m.fgts),
      aria: formatos.capital(formatos.rot(m.competencia).toLowerCase()) + ': ' + formatos.reais(m.base + m.fgts) + ' (salários ' + formatos.reais(m.base) + ' + FGTS ' + formatos.reais(m.fgts) + ')',
      rotulo: formatos.mesCurto(m.competencia), rotuloCurto: formatos.mesCurto(m.competencia).split('/')[0],
    })),
    folhaEixo: [0, topoDaFolha / 2, topoDaFolha].map(v => ({ valor: v ? curto(v) : '0', posicao: Math.round((v / topoDaFolha) * 1000) / 10 })),
    focarFolha: (i: number | null) => { if (i != null) setFocoDaFolha(i); },
    custoDoMes: ultimoDaFolha ? {
      mes: formatos.capital(formatos.rot(ultimoDaFolha.competencia).toLowerCase()),
      salarios: formatos.reais(ultimoDaFolha.base), fgts: formatos.reais(ultimoDaFolha.fgts), total: formatos.reais(ultimoDaFolha.base + ultimoDaFolha.fgts),
      variacao: anteriorDaFolha && anteriorDaFolha.base + anteriorDaFolha.fgts > 0
        ? Math.round((((ultimoDaFolha.base + ultimoDaFolha.fgts) / (anteriorDaFolha.base + anteriorDaFolha.fgts)) - 1) * 1000) / 10 : null,
      porFuncionario: ultimoDaFolha.funcionarios ? formatos.reais((ultimoDaFolha.base + ultimoDaFolha.fgts) / ultimoDaFolha.funcionarios) : '—',
      // (13/11/2026) pelos holerites do mês, quando o DP salvou a folha: o que foi descontado e o que foi pago
      holerite: ultimoDaFolha.holerites ? {
        quantos: ultimoDaFolha.holerites, proventos: formatos.reais(ultimoDaFolha.proventos ?? 0), descontos: formatos.reais(ultimoDaFolha.descontos ?? 0),
        inss: formatos.reais(ultimoDaFolha.inss ?? 0), irrf: formatos.reais(ultimoDaFolha.irrf ?? 0), liquido: formatos.reais(ultimoDaFolha.liquido ?? 0),
      } : null,
    } : null,
    temHolerites: historico.some(m => !!m.holerites),
    // o calendário
    calendario: {
      titulo: formatos.capital(formatos.rot(mesDoCalendario).toLowerCase()),
      anterior: () => setMesDoCalendario(m => { const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 2, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }),
      proximo: () => setMesDoCalendario(m => { const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }),
      datas: calendario.map((d, k) => {
        const data = d.dia ? new Date(Number(mesDoCalendario.slice(0, 4)), Number(mesDoCalendario.slice(5, 7)) - 1, d.dia) : null;
        const passou = !!data && data < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        return { chave: k + d.tipo, dia: d.dia ? String(d.dia).padStart(2, '0') : '', semana: data ? DIAS_DA_SEMANA[data.getDay()] : 'no mês', titulo: d.titulo, detalhe: d.detalhe, tipo: d.tipo, passou };
      }),
    },
    numeros: resumoDoPessoal(area.pessoal, hoje),
    competencia: mesBr(area.pessoal?.competencia ?? ''),
    temFuncionarios: funcionarios.length > 0,
    funcionarios: visiveis.map(f => ({
      id: f.id, nome: nomeDaPessoa(f.nome), iniciais: iniciais(nomeDaPessoa(f.nome)), cpf: f.cpf, matricula: f.matricula, desde: mesBr(f.desde), remuneracao: formatos.reais(f.remuneracao),
      ativo: f.ativo, situacao: f.ativo ? 'Ativo' : 'Saiu em ' + mesBr(f.ultimo), documentos: docsDe(f.id).length,
      // há quanto tempo está no registro (13/11/2026: a ficha refeita)
      tempo: f.ativo && (f.admissao || f.desde) ? tempoDeEmpresa(f.admissao ?? f.desde + '-01', hoje).replace(/^há /, '') : '',
      // (13/11/2026) do holerite, quando veio: o cargo, a admissão de verdade, o salário, o líquido e o afastamento (sem o motivo)
      cargo: f.cargo ?? '', admissao: f.admissao ? dataBr(f.admissao) : '',
      salarioBase: f.salarioBase != null ? formatos.reais(f.salarioBase) : '', liquido: f.liquido != null ? formatos.reais(f.liquido) : '',
      afastado: f.ativo && f.afastadoDe ? 'Afastado ' + (f.afastadoAte ? 'de ' + dataBr(f.afastadoDe) + ' a ' + dataBr(f.afastadoAte) : 'desde ' + dataBr(f.afastadoDe)) : '',
      pelaFolha: f.fonte === 'folha',
      ferias: f.ativo ? (() => { const x = feriasDe.get(f.id); return x ? { rotulo: ROTULO_DAS_FERIAS[x.situacao], tom: TOM_DAS_FERIAS[x.situacao] } : null; })() : null,
      /** os documentos dele, o mais novo primeiro (a ficha) */
      docs: docsDe(f.id).sort((x, y) => y.competencia.localeCompare(x.competencia)).map(d => linhaDoDoc(d, true)),
    })),
    ativosN: funcionarios.filter(f => f.ativo).length,
    saidas: funcionarios.filter(f => !f.ativo).length,
    mostrarSaidas, verAtivos: () => setMostrarSaidas(false), verSaidas: () => setMostrarSaidas(true),
    vista, verDoc: (id: string) => vista.ver(id, () => repoAreaCliente.baixarDocumentoDp(token, id)),
    // o mesmo padrão da Central (13/11/2026): as setas andam pelos documentos do mês; a folha do mês num .zip
    setas: vista.setas(docsDoMes.map(d => d.id), id => repoAreaCliente.baixarDocumentoDp(token, id)),
    docsDoMesN: docsDoMes.length, juntando: zip.juntando,
    baixarFolha: () => { void zip.baixarVarios(docsDoMes.map(d => d.id), id => repoAreaCliente.baixarDocumentoDp(token, id), nomeDoZip(area.resumo?.empresas?.[0]?.nome ?? '', mes, 'Folha')); },
    busca, mudarBusca: setBusca,
    // os documentos do mês, por categoria
    meses: meses.map(m => ({ valor: m, rotulo: formatos.capital(formatos.rot(m).toLowerCase()) })),
    mes, mudarMes: setMes,
    grupos: gruposDoMes.map(g => ({ categoria: g.categoria, rotulo: g.rotulo, docs: g.documentos.map(d => linhaDoDoc(d)) })),
    baixar: (id: string) => { void baixar(id); }, baixando,
    // os pedidos
    pedir, nomes: funcionarios.filter(f => f.ativo).map(f => nomeDaPessoa(f.nome)).sort(),
    // quem pode sair de férias, para a janela (13/11/2026): a que vence primeiro no alto, com o selo de cada um
    equipeDasFerias: funcionarios.filter(f => f.ativo).map(f => ({ f, x: feriasDe.get(f.id) }))
      .sort((a, b) => (a.x ? ac.ORDEM_DAS_FERIAS[a.x.situacao] : 9) - (b.x ? ac.ORDEM_DAS_FERIAS[b.x.situacao] : 9) || a.f.nome.localeCompare(b.f.nome))
      .map(({ f, x }) => ({ nome: nomeDaPessoa(f.nome), rotulo: x ? ROTULO_DAS_FERIAS[x.situacao] : '', tom: x ? TOM_DAS_FERIAS[x.situacao] : 'neutro', texto: x?.texto ?? '', limite: x?.limite ?? '' })),
    hoje,
    novaAdmissao: (): PedidoDeAdmissao => ({ nome: '', cpf: '', cargo: '', salario: '', inicio: '', contrato: 'Prazo indeterminado', observacoes: '' }),
    novasFerias: (empregado = ''): PedidoDeFerias => ({ empregado, inicio: '', dias: '30 dias', adiantar13: false, observacoes: '' }),
    novaDemissao: (empregado = ''): PedidoDeDemissao => ({ empregado, ultimoDia: '', motivo: '', aviso: 'Trabalhado', observacoes: '' }),
    dataBr,
  };
}
