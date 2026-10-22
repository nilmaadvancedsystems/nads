// ViewModel dos papéis do mês do Cadastro › Empresas (Heverton, 20/10/2026), no padrão das Etiquetas da folha do DP:
//   - "Etiquetas do mês" ("Gerador de etiqueta mensal"; a planilha ETIQUETA ENVELOPE 2026): a competência, o
//     departamento (Fiscal por padrão), quantas por página e o texto da caixa (o tipo, PJ-F, por padrão);
//   - "Protocolo de tributos" ("Relatório de empresa (Movimentação mensal)"; a planilha RELATORIO EMPRESA 2026): a
//     competência, o grupo (o regime) e, ligado, o que o Entregas já entregou na competência preenchido;
//   - "Protocolo de extratos" e "Protocolo da REINF" (Heverton, 22/10/2026; as abas "Protocolo Extratos" e "Protocolo -
//     Reinf" da mesma planilha): o ano e, ligado, o que o nads já sabe preenchido mês a mês (os extratos marcados na
//     Pendências; a REINF transmitida pelo Fiscal e a feita pelo DP). No de extratos, as empresas com banco; no da REINF,
//     as que têm a REINF no Fiscal ou no DP.
// As empresas são as da lista (com a busca e a situação da tela; no protocolo, só as do grupo), todas marcadas; dá para
// desmarcar. Imprimir abre a impressão em A4 (o mesmo quadro escondido das etiquetas da folha).
import { tarefas as t } from '@nads/core';
import { logoNilmaParaImprimir, useRetorno } from '@nads/ui';
import { useEffect, useMemo, useState } from 'react';
import { competenciasDaTela } from '../../../casca/navegacao';
import type { DocumentoMensal } from '../../../dados/entregasDeDocumentos';
import { useEntregasDeDocumentos, useExecucoesDoPeriodo, useGmailDoEntregas } from '../../../dados/repo';
import { imprimirHtml } from '../../dp/imprimirHtml';
import { useClientesDoDp } from '../../dp/useClientesDoDp';
import { estadosDaReinf } from '../../fiscal/reinf/useReinf';
import type { LinhaEmpresa } from './useListaDoCadastro';

export type PapelDoCadastro = 'etiquetas' | 'protocolo' | 'extratos' | 'reinf';
/** os protocolos do ano (uma coluna por mês) */
const DO_ANO: readonly PapelDoCadastro[] = ['extratos', 'reinf'];
export type TextoDaCaixa = 'tipo' | 'sigla' | 'regime' | 'branco';
export const TEXTOS_DA_CAIXA: { valor: TextoDaCaixa; rotulo: string }[] = [
  { valor: 'tipo', rotulo: 'PJ-F' }, { valor: 'sigla', rotulo: 'Sigla' }, { valor: 'regime', rotulo: 'Regime' }, { valor: 'branco', rotulo: 'Nada' },
];

export function usePapeisDoCadastro(linhas: readonly LinhaEmpresa[]) {
  const { toast } = useRetorno();
  const entregas = useEntregasDeDocumentos();
  const gmail = useGmailDoEntregas();
  const [aberto, setAberto] = useState<PapelDoCadastro | null>(null);
  // a competência de trabalho da tela (em outubro, o movimento de setembro)
  const [competencia, setCompetencia] = useState(() => competenciasDaTela(1)[0]);
  const [departamento, setDepartamento] = useState<t.DepartamentoDoEnvelope>('Fiscal');
  const [porPagina, setPorPagina] = useState<t.EnvelopesPorPagina>(2);
  const [caixa, setCaixa] = useState<TextoDaCaixa>('tipo');
  const [grupoId, setGrupoId] = useState(t.GRUPOS_DO_PROTOCOLO[0].id);
  const [preencher, setPreencher] = useState(true);
  const [desmarcadas, setDesmarcadas] = useState<ReadonlySet<string>>(new Set());
  const grupo = t.grupoDoProtocolo(grupoId);
  // os protocolos do ano: o da competência de trabalho (em janeiro, ainda o ano passado) ou o anterior
  const deTrabalho = competenciasDaTela(1)[0];
  const anoDeTrabalho = Number(deTrabalho.slice(0, 4));
  const [ano, setAno] = useState(anoDeTrabalho);
  const doAno = !!aberto && DO_ANO.includes(aberto);
  // até onde o "-" vai: a competência de trabalho (no ano anterior, o ano inteiro)
  const ate = ano < anoDeTrabalho ? ano + '-12' : deTrabalho;

  // a REINF: as do Fiscal (Fiscal › REINF) e as do DP (a REINF autorizada no DP), e a etapa dp-reinf dos 12 meses
  const doDp = useClientesDoDp(deTrabalho);
  const reinfNoDp = useMemo(() => new Set(doDp.clientes.filter(c => c.reinfAutorizada).map(c => c.codigo)), [doDp.clientes]);
  const reinfNoFiscal = useMemo(() => new Set(t.EMPRESAS_REINF.map(e => e.codigo)), []);
  const execucoesDoDp = useExecucoesDoPeriodo(aberto === 'reinf' && preencher ? t.competenciasDoAno(ano) : [], 'dp');

  // os extratos: os documentos do mês da Pendências do ano todo (uma consulta, com a janela aberta)
  const [documentos, setDocumentos] = useState<{ ano: number; lista: DocumentoMensal[] } | null>(null);
  const querDocumentos = aberto === 'extratos' && preencher;
  useEffect(() => {
    if (!querDocumentos) return;
    let vale = true;
    void entregas.garantirTodosOsClientes().catch(() => undefined);
    entregas.documentosDasCompetencias(t.competenciasDoAno(ano))
      .then(lista => { if (vale) setDocumentos({ ano, lista }); })
      .catch(() => { if (vale) { setDocumentos({ ano, lista: [] }); toast('Não deu para ler os extratos da Pendências: o protocolo sai em branco'); } });
    return () => { vale = false; };
  }, [querDocumentos, ano, entregas, toast]);

  // as empresas da janela: as da lista da tela (no protocolo, só as do grupo; no de extratos, as com banco; no da REINF,
  // as que têm REINF)
  const candidatas = useMemo(() => {
    if (aberto === 'protocolo') return linhas.filter(l => l.codigo != null && grupo.regimes.includes(l.regime));
    if (aberto === 'extratos') return linhas.filter(l => l.codigo != null && l.bancos.length > 0);
    if (aberto === 'reinf') return linhas.filter(l => l.codigo != null && (reinfNoFiscal.has(l.codigo) || reinfNoDp.has(l.codigo)));
    return linhas;
  }, [aberto, linhas, grupo, reinfNoFiscal, reinfNoDp]);
  const escolhidas = candidatas.filter(l => !desmarcadas.has(l.chave));

  // o protocolo preenchido: as entregas da competência (só com a janela aberta), ligadas ao código pelo cliente do Entregas
  const doMes = aberto === 'protocolo' && preencher ? entregas.doMes(competencia) : null;
  const codigoDoCliente = new Map(gmail.clientes().lista.map(c => [c.id, Number(c.codigo)]));
  const guias: t.GuiaEntregue[] = (doMes?.lista || []).flatMap(e => {
    const codigo = e.clienteId ? codigoDoCliente.get(e.clienteId) : undefined;
    return codigo && e.status === 'confirmada' ? [{ codigo, itens: e.itens, em: e.confirmadoEm, porEmail: e.comprovantePorEmail || e.canal === 'email' }] : [];
  });

  // os extratos do ano, com o código do cliente do Entregas, e os que não mandam extrato ("não se aplica")
  const clientesDoEntregas = querDocumentos ? entregas.clientes().lista : [];
  const codigoDoId = new Map(clientesDoEntregas.map(c => [c.id, Number(c.codigoOrigem)]));
  for (const c of gmail.clientes().lista) if (!codigoDoId.has(c.id)) codigoDoId.set(c.id, Number(c.codigo));
  const docsDoAno: t.DocumentoDoMes[] = (documentos?.ano === ano ? documentos.lista : []).flatMap(d => {
    const codigo = codigoDoId.get(d.clienteId);
    return codigo ? [{ codigo, competencia: d.competencia, extrato: d.extrato, semMovimento: d.semMovimento }] : [];
  });
  const semExtrato = new Set(clientesDoEntregas.filter(c => c.documentosNaoAplicaveis.includes('extrato')).map(c => Number(c.codigoOrigem)));

  // a REINF do ano de cada empresa: o "transmitido até" do Fiscal e quem fez a etapa dp-reinf de cada mês
  function reinfDoAno(): t.ReinfDoAno[] {
    const estados = estadosDaReinf();
    const doDpPorCodigo = new Map<number, Record<string, 'dp' | 'fiscal'>>();
    for (const m of execucoesDoDp.porMes) for (const ex of m.execucoes) {
      const e = t.estadoDa(ex, 'dp-reinf');
      if (ex.codigo == null || e?.situacao !== 'feita') continue;
      doDpPorCodigo.set(ex.codigo, { ...doDpPorCodigo.get(ex.codigo), [m.competencia]: e.por.endsWith('(Fiscal)') ? 'fiscal' : 'dp' });
    }
    return escolhidas.map(l => {
      const codigo = l.codigo as number;
      return { codigo, nome: l.nome, noFiscal: reinfNoFiscal.has(codigo), noDp: reinfNoDp.has(codigo), transmitidoAte: estados[codigo]?.transmitidoAte, doDp: doDpPorCodigo.get(codigo) || {} };
    });
  }
  const reinfNoAno = aberto === 'reinf' && preencher
    ? execucoesDoDp.porMes.reduce((n, m) => n + m.execucoes.filter(ex => t.estadoDa(ex, 'dp-reinf')?.situacao === 'feita').length, 0) : 0;

  const textoDaCaixa = (regime: string) => (caixa === 'branco' ? '' : caixa === 'tipo' ? t.tipoNaEtiqueta(regime, departamento) : caixa === 'regime' ? regime : t.regimeAbreviado(regime));
  const paginas = aberto === 'etiquetas' ? t.paginasDosEnvelopes(escolhidas.length, porPagina) : 0;
  return {
    aberto,
    abrir: (p: PapelDoCadastro) => { setDesmarcadas(new Set()); setAberto(p); },
    fechar: () => setAberto(null),
    competencia, setCompetencia,
    departamento, setDepartamento, departamentos: t.DEPARTAMENTOS_DO_ENVELOPE.map(d => ({ valor: d, rotulo: d })),
    porPagina, setPorPagina: (v: string) => setPorPagina(Number(v) as t.EnvelopesPorPagina),
    porPaginaOpcoes: t.ENVELOPES_POR_PAGINA.map(n => ({ valor: String(n), rotulo: String(n) })),
    caixa, setCaixa, textosDaCaixa: TEXTOS_DA_CAIXA,
    grupo, setGrupo: (id: string) => { setGrupoId(id); setDesmarcadas(new Set()); },
    grupos: t.GRUPOS_DO_PROTOCOLO.map(g => ({ valor: g.id, rotulo: g.rotulo })),
    preencher, alternarPreencher: () => setPreencher(p => !p),
    carregandoEntregas: !!doMes && !doMes.carregada,
    guiasNoMes: guias.length,
    doAno,
    ano, setAno: (v: string) => setAno(Number(v)),
    anos: [anoDeTrabalho - 1, anoDeTrabalho].map(a => ({ valor: String(a), rotulo: String(a) })),
    /** ainda lendo o que preenche o protocolo do ano */
    lendoDoAno: aberto === 'extratos' ? querDocumentos && documentos?.ano !== ano : aberto === 'reinf' && preencher && !execucoesDoDp.carregada,
    extratosNoAno: docsDoAno.filter(d => d.extrato).length,
    reinfNoAno,
    /** as empresas da janela, com a marca e o texto da caixa */
    empresas: candidatas.map(l => ({ chave: l.chave, codigo: l.codigo, nome: l.nome, regime: l.regime, marcada: !desmarcadas.has(l.chave), caixa: textoDaCaixa(l.regime) })),
    quantas: escolhidas.length,
    paginas,
    alternar: (chave: string) => setDesmarcadas(s => { const n = new Set(s); if (n.has(chave)) n.delete(chave); else n.add(chave); return n; }),
    marcarTodas: () => setDesmarcadas(new Set()),
    desmarcarTodas: () => setDesmarcadas(new Set(candidatas.map(l => l.chave))),
    imprimir() {
      if (!escolhidas.length) return;
      if (aberto === 'etiquetas') {
        imprimirHtml(t.htmlDosEnvelopes({ competencia, departamento, porPagina, logo: logoNilmaParaImprimir('branca'),
          etiquetas: escolhidas.map(l => ({ codigo: l.codigo, nome: l.nome, caixa: textoDaCaixa(l.regime) })) }));
        toast(escolhidas.length + (escolhidas.length === 1 ? ' etiqueta pronta' : ' etiquetas prontas') + ': escolha a impressora');
      } else if (aberto === 'extratos') {
        const linhasDoAno = t.linhasDoProtocoloDeExtratos({ ano, ate, preencher, documentos: docsDoAno, semExtrato,
          empresas: escolhidas.map(l => ({ codigo: l.codigo as number, nome: l.nome })) });
        imprimirHtml(t.htmlDoProtocoloDeExtratos({ ano, linhas: linhasDoAno, logo: logoNilmaParaImprimir('colorida') }));
        toast('Protocolo de extratos pronto: escolha a impressora');
      } else if (aberto === 'reinf') {
        const linhasDoAno = t.linhasDoProtocoloDaReinf({ ano, ate, preencher, empresas: reinfDoAno() });
        imprimirHtml(t.htmlDoProtocoloDaReinf({ ano, linhas: linhasDoAno, logo: logoNilmaParaImprimir('colorida') }));
        toast('Protocolo da REINF pronto: escolha a impressora');
      } else {
        const linhasDoProtocolo = t.linhasDoProtocolo(grupo, escolhidas.map(l => ({ codigo: l.codigo as number, nome: l.nome })), guias, preencher);
        imprimirHtml(t.htmlDoProtocolo({ competencia, grupo, linhas: linhasDoProtocolo, logo: logoNilmaParaImprimir('colorida') }));
        toast('Protocolo pronto: escolha a impressora');
      }
      setAberto(null);
    },
  };
}

export type VmPapeis = ReturnType<typeof usePapeisDoCadastro>;
