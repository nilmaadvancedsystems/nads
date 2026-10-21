// ViewModel dos papéis do mês do Cadastro › Empresas (Heverton, 20/10/2026), no padrão das Etiquetas da folha do DP:
//   - "Etiquetas do mês" ("Gerador de etiqueta mensal"; a planilha ETIQUETA ENVELOPE 2026): a competência, o
//     departamento (Fiscal por padrão), quantas por página e o texto da caixa (a sigla do regime, por padrão);
//   - "Protocolo de tributos" ("Relatório de empresa (Movimentação mensal)"; a planilha RELATORIO EMPRESA 2026): a
//     competência, o grupo (o regime) e, ligado, o que o Entregas já entregou na competência preenchido.
// As empresas são as da lista (com a busca e a situação da tela; no protocolo, só as do grupo), todas marcadas; dá para
// desmarcar. Imprimir abre a impressão em A4 (o mesmo quadro escondido das etiquetas da folha).
import { tarefas as t } from '@nads/core';
import { logoNilmaParaImprimir, useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { competenciasDaTela } from '../../../casca/navegacao';
import { useEntregasDeDocumentos, useGmailDoEntregas } from '../../../dados/repo';
import { imprimirHtml } from '../../dp/imprimirHtml';
import type { LinhaEmpresa } from './useListaDoCadastro';

export type PapelDoCadastro = 'etiquetas' | 'protocolo';
export type TextoDaCaixa = 'sigla' | 'regime' | 'branco';
export const TEXTOS_DA_CAIXA: { valor: TextoDaCaixa; rotulo: string }[] = [
  { valor: 'sigla', rotulo: 'Sigla do regime' }, { valor: 'regime', rotulo: 'Regime' }, { valor: 'branco', rotulo: 'Em branco' },
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
  const [caixa, setCaixa] = useState<TextoDaCaixa>('sigla');
  const [grupoId, setGrupoId] = useState(t.GRUPOS_DO_PROTOCOLO[0].id);
  const [preencher, setPreencher] = useState(true);
  const [desmarcadas, setDesmarcadas] = useState<ReadonlySet<string>>(new Set());
  const grupo = t.grupoDoProtocolo(grupoId);

  // as empresas da janela: as da lista da tela (no protocolo, só as do grupo)
  const candidatas = useMemo(() => (aberto === 'protocolo' ? linhas.filter(l => l.codigo != null && grupo.regimes.includes(l.regime)) : linhas), [aberto, linhas, grupo]);
  const escolhidas = candidatas.filter(l => !desmarcadas.has(l.chave));

  // o protocolo preenchido: as entregas da competência (só com a janela aberta), ligadas ao código pelo cliente do Entregas
  const doMes = aberto === 'protocolo' && preencher ? entregas.doMes(competencia) : null;
  const codigoDoCliente = new Map(gmail.clientes().lista.map(c => [c.id, Number(c.codigo)]));
  const guias: t.GuiaEntregue[] = (doMes?.lista || []).flatMap(e => {
    const codigo = e.clienteId ? codigoDoCliente.get(e.clienteId) : undefined;
    return codigo && e.status === 'confirmada' ? [{ codigo, itens: e.itens, em: e.confirmadoEm, porEmail: e.comprovantePorEmail || e.canal === 'email' }] : [];
  });

  const textoDaCaixa = (regime: string) => (caixa === 'branco' ? '' : caixa === 'regime' ? regime : t.regimeAbreviado(regime));
  const paginas = aberto === 'etiquetas' ? t.paginasDosEnvelopes(escolhidas.length, porPagina) : 0;
  return {
    aberto,
    abrir: (p: PapelDoCadastro) => { setDesmarcadas(new Set()); setAberto(p); },
    fechar: () => setAberto(null),
    competencia, setCompetencia,
    departamento, setDepartamento, departamentos: t.DEPARTAMENTOS_DO_ENVELOPE.map(d => ({ valor: d, rotulo: d })),
    porPagina, setPorPagina: (v: string) => setPorPagina(Number(v) as t.EnvelopesPorPagina),
    porPaginaOpcoes: t.ENVELOPES_POR_PAGINA.map(n => ({ valor: String(n), rotulo: n + (n === 1 ? ' por página' : ' por página') })),
    caixa, setCaixa, textosDaCaixa: TEXTOS_DA_CAIXA,
    grupo, setGrupo: (id: string) => { setGrupoId(id); setDesmarcadas(new Set()); },
    grupos: t.GRUPOS_DO_PROTOCOLO.map(g => ({ valor: g.id, rotulo: g.rotulo })),
    preencher, alternarPreencher: () => setPreencher(p => !p),
    carregandoEntregas: !!doMes && !doMes.carregada,
    guiasNoMes: guias.length,
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
