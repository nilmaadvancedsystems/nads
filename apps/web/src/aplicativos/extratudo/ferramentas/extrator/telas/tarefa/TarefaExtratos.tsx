// A página que a etapa "Importação" da Tarefas abre: por enquanto, só importar (a conferência saiu daqui).
// Em cima, à direita (como o "New issue" do GitHub): Pedir extrato e Adicionar banco ▾ (escolhe o banco e
// pede agência e conta). Depois, uma linha por conta da empresa:
//   ▸ setinha: abre o movimento do extrato (data, descrição, valor, entrou/saiu e o saldo acumulado);
//   logo, nome, agência e conta (o logo fica colorido quando o extrato está importado);
//   Extrato: importar à mão (vira o check verde) ou buscar no Drive (fica só o logo do Drive, colorido);
//     com o mouse em cima, vira × vermelho para excluir;
//   Razão: importar à mão (check verde / × para excluir);
//   à direita: "Não teve movimento" (trava a linha e vira "Desfazer"); com o extrato vindo do Drive, um
//     botãozinho de PDF (abre pelo link temporário). O movimento se vê pela setinha.
// Ao importar, só uma barrinha por cima da tela, que some em 2,7 s.
import { extrator as x, type conferencia, type empresas, tarefas } from '@nads/core';
import { Icone, LogoBanco, LogoDrive, LogoGmail, MensagemFlutuante, MenuSuspenso, preCarregarLogosDosApps, urlDoLogoBanco, urlDoLogoNilma, useAbasParaAEtapa, useCarregando, type AbaDaEtapa } from '@nads/ui';
import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { usePonteDaTarefa, useRequisitosParaATarefa } from '../../../../../../comum/ponte';
import { useSessao } from '../../casca/sessao';
import { useImportacao, type Mensagem } from '../importacao/useImportacao';
import { BotaoGoogle } from '../../../../../../comum/BotaoGoogle';
import { ImportacaoNaEtapa } from '../../../../../concilia-ai/ImportacaoNaEtapa';
import { useImportadosDaConferencia } from '../../../../../concilia-ai/importadosNaEtapa';
import { JanelaHistoricoDePedidos, JanelaPedirExtratos } from './JanelaPedirExtratos';
import { caminhoNaFerramenta } from '../../../../casca/caminho';
import { useBancosOk } from './useBancosOk';
import { useDriveDaLinha } from './useDriveDaLinha';
import { usePedirExtratos } from './usePedirExtratos';

type Vm = ReturnType<typeof useImportacao>;
type Lado = { qtdArquivos: number; qtdLancamentos: number; lendo: boolean };

/** Botão só de ícone de um lado (extrato ou razão): importar → check verde → (mouse em cima) × para excluir. */
function BotaoLado({ lado, titulo, aceitar, travado, onArquivos, onExcluir }: {
  lado: Lado; titulo: string; aceitar: string; travado: boolean;
  onArquivos: (fs: File[]) => void; onExcluir: () => void;
}) {
  const id = useId();
  if (lado.lendo) return <span className="icon-btn icon-btn-sm imp-btn" title="Importando…"><span className="btn-spinner" /></span>;
  if (lado.qtdArquivos) {
    return (
      <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={onExcluir} disabled={travado}
        title={titulo + ': importado (' + lado.qtdLancamentos + ' lançamentos). Clique para excluir.'} aria-label={'Excluir ' + titulo.toLowerCase()}>
        <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
      </button>
    );
  }
  return (
    <>
      <label htmlFor={id} className={'icon-btn icon-btn-sm imp-btn' + (travado ? ' is-locked' : '')} title={'Importar ' + titulo.toLowerCase()} aria-label={'Importar ' + titulo.toLowerCase()}>
        <Icone nome="upload" />
      </label>
      <input id={id} type="file" multiple accept={aceitar} className="sr-only" disabled={travado}
        onChange={ev => { const fs = Array.from(ev.target.files || []); ev.target.value = ''; onArquivos(fs); }} />
    </>
  );
}

/**
 * O extrato que veio do Drive (o logo colorido; com o mouse em cima, o ×): dois cliques abrem o arquivo do Drive (o PDF) para ver
 * (o link temporário); um clique exclui (pergunta antes). O clique espera um instante para saber se vem o segundo.
 */
function BotaoDoDrive({ arquivos, travado, rotulo, onExcluir, onVer }: {
  arquivos: readonly { id: string; nome: string }[]; travado: boolean; rotulo: string;
  onExcluir: () => void; onVer: (arquivo: { id: string; nome: string }) => void;
}) {
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (espera.current) clearTimeout(espera.current); }, []);
  return (
    <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito imp-feito-drive" disabled={travado}
      onClick={ev => {
        ev.stopPropagation();
        if (espera.current) clearTimeout(espera.current);
        espera.current = setTimeout(() => { espera.current = null; onExcluir(); }, 260);
      }}
      onDoubleClick={ev => {
        ev.stopPropagation();
        if (espera.current) { clearTimeout(espera.current); espera.current = null; }
        const a = arquivos[arquivos.length - 1];
        if (a) onVer(a);
      }}
      title={'Do Drive: ' + arquivos.map(a => a.nome).join(', ') + '. Dois cliques abrem o arquivo do Drive; um clique exclui.'} aria-label={'Extrato do Drive ' + rotulo + ': dois cliques abrem, um exclui'}>
      <span className="imp-feito-ok"><LogoDrive cor /></span><Icone nome="x" className="imp-feito-x" />
    </button>
  );
}

/** "Adicionar banco ▾": a lista dos bancos (com logo) e, escolhido um, agência e conta. */
function AdicionarBanco({ bancos, onAdicionar, fechar }: {
  bancos: readonly empresas.BancoDaEmpresa[];
  onAdicionar: (b: empresas.BancoDaEmpresa, agencia: string, conta: string) => void;
  fechar: () => void;
}) {
  const [escolhido, setEscolhido] = useState<empresas.BancoDaEmpresa | null>(null);
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');
  const pronto = !!agencia.trim() && !!conta.trim();
  const adicionar = () => { if (!escolhido || !pronto) return; onAdicionar(escolhido, agencia, conta); fechar(); };

  if (!escolhido) {
    return (
      <div className="add-banco-lista" role="menu">
        {bancos.map(b => (
          <button key={b.id} type="button" className="popover-item add-banco-item" role="menuitem" onClick={() => setEscolhido(b)}>
            {b.nome}
          </button>
        ))}
      </div>
    );
  }
  return (
    <form className="add-banco-form" onSubmit={e => { e.preventDefault(); adicionar(); }}>
      <div className="add-banco-titulo">
        <span className="add-banco-logo"><LogoBanco banco={escolhido.id} cor /></span><b>{escolhido.nome}</b>
      </div>
      <label className="field"><span className="hint">Agência</span>
        <input type="text" autoFocus inputMode="numeric" value={agencia} onChange={e => setAgencia(e.target.value)} placeholder="Ex.: 3001" />
      </label>
      <label className="field"><span className="hint">Conta</span>
        <input type="text" inputMode="numeric" value={conta} onChange={e => setConta(e.target.value)} placeholder="Ex.: 12345-6" />
      </label>
      <div className="add-banco-acoes">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setEscolhido(null)}>Voltar</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!pronto}>Adicionar</button>
      </div>
    </form>
  );
}

/**
 * As pendências do banco (o que corrigir no razão): uma faixa grudada embaixo da linha do banco, "Pendências  N ▾",
 * que abre a planilha — o dia, a situação, o lançamento (com o detalhe e a dica embaixo), banco, razão e diferença.
 */
const LIMITE_CORRECOES = 30;
/** A faixa grudada no bloco do banco que abre e fecha (▸ Título  N): Lançamentos e, embaixo, Pendências (o número em laranja). */
function FaixaQueAbre({ titulo, qtd, aviso, children }: { titulo: string; qtd: number; aviso?: boolean; children: ReactNode }) {
  const [aberta, setAberta] = useState(false);
  return (
    <div className={'imp-faixa' + (aviso ? ' aviso' : '') + (aberta ? ' aberta' : '')}>
      <button type="button" className="imp-faixa-barra" aria-expanded={aberta} onClick={() => setAberta(a => !a)}>
        <Icone nome="caretDown" className="imp-faixa-seta" />
        <b>{titulo}</b>
        <span className="imp-faixa-qtd">{qtd}</span>
      </button>
      {aberta && <div className="imp-faixa-corpo">{children}</div>}
    </div>
  );
}

function PendenciasDoBanco({ itens }: { itens: x.CorrecaoDoRazao[] }) {
  if (!itens.length) return null;
  const valor = (n: number | null) => (n == null ? '' : x.valorBR(Math.abs(n)));
  return (
    <FaixaQueAbre titulo="Pendências" qtd={itens.length} aviso>
        <>
          <div className="table-wrap">
            <table className="table-compact imp-planilha">
              <thead><tr>
                <th>Data</th><th>Situação</th><th>Lançamento</th>
                <th className="num">Banco</th><th className="num">Razão</th><th className="num">Diferença</th>
              </tr></thead>
              <tbody>
                {itens.slice(0, LIMITE_CORRECOES).map((c, i) => {
                  // o lote quebrado: a linha do lote com os totais, cada lançamento numa linha embaixo e a dica no fim
                  const partes = c.partes || [];
                  const linhas = 1 + partes.length + (c.dica ? 1 : 0);
                  return (
                    <Fragment key={i}>
                      <tr className={partes.length ? 'imp-planilha-grupo' : undefined}>
                        <td className="imp-planilha-dia" rowSpan={linhas}>{x.dataBR(c.data)}</td>
                        <td className="imp-planilha-sit" rowSpan={linhas}>{x.ROTULO_CORRECAO[c.tipo]}</td>
                        <td className="imp-planilha-lanc">
                          <b>{c.lancamento}</b>
                          {!partes.length && c.detalhe && <span className="hint">{c.detalhe}</span>}
                          {!partes.length && c.dica && <span className="hint imp-planilha-dica">{c.dica}</span>}
                        </td>
                        <td className="num"><b>{valor(c.noBanco)}</b></td>
                        <td className="num"><b>{valor(c.noRazao)}</b></td>
                        <td className={'num' + (c.diferenca ? ' ext-neg' : '')}>{c.diferenca ? (c.diferenca > 0 ? '+' : '−') + x.valorBR(Math.abs(c.diferenca)) : ''}</td>
                      </tr>
                      {partes.map((p, j) => (
                        <tr key={j} className="imp-planilha-parte">
                          <td>{p.historico}</td>
                          <td className="num">{p.lado === 'banco' ? valor(p.valor) : ''}</td>
                          <td className="num">{p.lado === 'razao' ? valor(p.valor) : ''}</td>
                          <td />
                        </tr>
                      ))}
                      {partes.length > 0 && c.dica && (
                        <tr className="imp-planilha-parte"><td colSpan={4} className="imp-planilha-dica">{c.dica}</td></tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {itens.length > LIMITE_CORRECOES && <p className="hint">E mais {itens.length - LIMITE_CORRECOES}: veja tudo em Extrato × sistema.</p>}
        </>
    </FaixaQueAbre>
  );
}

type ColunaMov = 'data' | 'historico' | 'valor' | 'tipo' | 'saldo';
const COMPARAR_MOV: Record<ColunaMov, (a: x.LinhaDoMovimento, b: x.LinhaDoMovimento) => number> = {
  data: (a, b) => a.data.localeCompare(b.data),
  historico: (a, b) => a.historico.localeCompare(b.historico, 'pt-BR'),
  valor: (a, b) => Math.abs(a.valor) - Math.abs(b.valor),
  tipo: (a, b) => Number(b.valor > 0) - Number(a.valor > 0),
  saldo: (a, b) => a.saldo - b.saldo,
};
const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * O movimento do extrato da conta na competência (abre pela setinha): o saldo acumula os meses importados.
 * Ao lado da busca, o olho: o PDF do Drive do mês (link temporário, sem baixar). Grudado nele, o mês mostrado
 * ("Mostrando Janeiro/2026"). A linha do saldo anterior fica sempre em cima. Busca (data, descrição ou valor) e ordem por
 * coluna (clicar no título; clicar de novo inverte; a setinha só aparece depois do clique).
 */
function Movimento({ m, pdf, onPdf, competencia }: {
  m: x.MovimentoDoExtrato;
  /** o mês aberto ('aaaa-mm'): ao lado do olho, qual mês a tabela mostra */
  competencia: string;
  /** o extrato do mês veio do Drive: o olho ao lado da busca abre o PDF de lá */
  pdf?: { id: string; nome: string } | null; onPdf?: (arquivo: { id: string; nome: string }) => void;
}) {
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<{ coluna: ColunaMov; dir: 'asc' | 'desc' } | null>(null);
  if (!m.linhas.length) return <p className="hint imp-mov-vazio">Nenhum lançamento do extrato nesta competência.</p>;
  const q = semAcento(busca.trim());
  const achadas = q ? m.linhas.filter(l => semAcento([x.dataBR(l.data), l.historico, x.valorBR(Math.abs(l.valor)), x.valorBR(l.saldo)].join(' ')).includes(q)) : m.linhas;
  const linhas = ordem ? achadas.slice().sort((a, b) => (ordem.dir === 'asc' ? 1 : -1) * COMPARAR_MOV[ordem.coluna](a, b)) : achadas;
  // o total do que a busca achou: quantos, quanto entrou, quanto saiu e o saldo (negativo em vermelho, sem sinal)
  const entrou = achadas.filter(l => l.valor > 0).reduce((t, l) => t + l.valor, 0);
  const saiu = achadas.filter(l => l.valor < 0).reduce((t, l) => t - l.valor, 0);
  const saldoBusca = entrou - saiu;
  const ordenar = (c: ColunaMov) => setOrdem(o => (o?.coluna === c && o.dir === 'asc' ? { coluna: c, dir: 'desc' } : { coluna: c, dir: 'asc' }));
  const Titulo = ({ c, rotulo, num }: { c: ColunaMov; rotulo: string; num?: boolean }) => (
    <th className={'th-sort' + (num ? ' num' : '')} onClick={() => ordenar(c)} title="Ordenar por esta coluna"
      aria-sort={ordem?.coluna === c ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      {rotulo}{ordem?.coluna === c && <Icone nome="caretDown" className={'th-seta' + (ordem.dir === 'asc' ? ' cima' : '')} />}
    </th>
  );
  return (
    <div className="imp-mov-caixa">
      <div className="imp-mov-topo">
        <label className="busca-curta imp-mov-busca">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar no extrato" aria-label="Buscar no extrato (data, descrição ou valor)" value={busca}
            onChange={e => setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setBusca(''); }} />
        </label>
        {pdf && onPdf && (
          <button type="button" className="icon-btn imp-mov-pdf" title={'Ver o PDF no Drive (link temporário, sem baixar): ' + pdf.nome} aria-label="Ver o PDF no Drive" onClick={() => onPdf(pdf)}>
            <Icone nome="olho" />
          </button>
        )}
        {/* grudado à direita do olho: o mês que a tabela mostra */}
        <span className="imp-mov-periodo" aria-live="polite">Mostrando {tarefas.rotuloCompetencia(competencia)}</span>
        {q && (
          <div className="imp-mov-total" aria-live="polite">
            <span><b>{achadas.length}</b> {achadas.length === 1 ? 'lançamento' : 'lançamentos'}</span>
            <span>Entrou <b className="ext-pos">{x.valorBR(entrou)}</b></span>
            <span>Saiu <b className="ext-neg">{x.valorBR(saiu)}</b></span>
            <span>Saldo <b className={saldoBusca < 0 ? 'ext-neg' : 'imp-mov-saldo'}>{x.valorBR(Math.abs(saldoBusca))}</b></span>
          </div>
        )}
      </div>
    <div className="imp-mov">
      <table className="table-compact">
        <thead><tr>
          <Titulo c="data" rotulo="Data" /><Titulo c="historico" rotulo="Descrição" /><Titulo c="valor" rotulo="Valor" num />
          <Titulo c="tipo" rotulo="Entrou/Saiu" /><Titulo c="saldo" rotulo="Saldo atual" num />
        </tr></thead>
        <tbody>
          <tr className="imp-mov-anterior">
            <td colSpan={4}>Saldo anterior <span className="hint">{m.mesesAntes ? '(dos meses já importados)' : m.abertura != null ? '(do extrato)' : '(o extrato não trouxe)'}</span></td>
            <td className="num">{x.valorBR(m.saldoAnterior)}</td>
          </tr>
          {!linhas.length && <tr><td colSpan={5} className="hint">Nada com essa busca.</td></tr>}
          {linhas.map((l, i) => (
            <tr key={i}>
              <td style={{ whiteSpace: 'nowrap' }}>{x.dataBR(l.data)}</td>
              <td className="wrap">{l.historico}</td>
              <td className="num">{x.valorBR(Math.abs(l.valor))}</td>
              <td><span className={l.valor > 0 ? 'ext-pos' : 'ext-neg'}>{l.valor > 0 ? 'Entrou' : 'Saiu'}</span></td>
              <td className={'num' + (l.saldo < 0 ? ' ext-neg' : '')}>{x.valorBR(l.saldo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}

/** O que já entrou do banco, no meio da linha: "Extrato: 12 lançamentos", "Razão: 13 lançamentos" (só o que foi importado). */
function resumo(b: Vm['bancos'][number]): string[] {
  const parte = (nome: string, l: Lado) => (l.qtdArquivos ? nome + ': ' + l.qtdLancamentos + (l.qtdLancamentos === 1 ? ' lançamento' : ' lançamentos') : '');
  return [parte('Extrato', b.extrato), parte('Razão', b.razao)].filter(Boolean);
}

/**
 * A Etapa com vários meses, embaixo de cada banco: por mês, os ícones de um mês — Extrato: importar (vira ✓, ×
 * para excluir) e o Drive (cinza até o extrato daquele mês vir de lá; aí fica só ele, colorido); sem nada, o
 * "s/ mov." marca que o mês não teve movimento. Razão: importar. Clicar no mês abre ele (a aba de cima).
 */
function MesesDoBanco({ meses, competencia, travado, aceitarExtrato, aceitarRazao, onMes, onArquivos, onExcluir, onDrive, onVer, onSemMovimento, naTarefa }: {
  meses: ReturnType<Vm['mesesDoBanco']>;
  competencia: string; travado: boolean; aceitarExtrato: string; aceitarRazao: string; naTarefa: boolean;
  onMes: (m: string) => void; onArquivos: (lado: 'banco' | 'sistema', fs: File[]) => void; onExcluir: (lado: 'banco' | 'sistema', mes: string) => void;
  onDrive: (mes: string) => void; onVer: (arquivo: { id: string; nome: string }) => void; onSemMovimento: (mes: string, marcado: boolean) => void;
}) {
  const mes = (m: ReturnType<Vm['mesesDoBanco']>[number], lado: 'banco' | 'sistema') => {
    const info = lado === 'banco' ? m.ladoExtrato : m.ladoRazao;
    const doDrive = lado === 'banco' && info.doDrive.length > 0;
    const trava = travado || m.semMovimento;
    return (
      // a caixa toda do mês abre o mês (os ícones dentro dela fazem o deles)
      <span key={m.mes} className={'imp-mes-celula' + (m.mes === competencia ? ' atual' : '') + (m.semMovimento ? ' sem-mov' : '')}
        onClick={() => onMes(m.mes)} title={'Abrir ' + m.rotulo}>
        <span className="imp-mes-nome">{m.rotulo}</span>
        <span className="imp-mes-icones">
        {m.semMovimento ? (
          <button type="button" className="imp-mes-sem" disabled={travado || !naTarefa} onClick={() => onSemMovimento(m.mes, false)} title="Não teve movimento — clique para desfazer">s/ mov.</button>
        ) : info.lendo ? (
          <span className="icon-btn icon-btn-sm imp-btn"><span className="btn-spinner" /></span>
        ) : doDrive ? (
          <BotaoDoDrive arquivos={info.doDrive} travado={trava} rotulo={'de ' + m.rotulo} onExcluir={() => onExcluir(lado, m.mes)} onVer={onVer} />
        ) : (
          <>
            <BotaoLado lado={info} titulo={(lado === 'banco' ? 'Extrato' : 'Razão') + ' de ' + m.rotulo} aceitar={lado === 'banco' ? aceitarExtrato : aceitarRazao} travado={trava}
              onArquivos={fs => onArquivos(lado, fs)} onExcluir={() => onExcluir(lado, m.mes)} />
            {lado === 'banco' && !info.qtdArquivos && (
              <>
                <button type="button" className="icon-btn icon-btn-sm imp-btn imp-drive" disabled={trava} title={'Buscar no Drive o extrato de ' + m.rotulo}
                  aria-label={'Buscar no Drive o extrato de ' + m.rotulo} onClick={() => onDrive(m.mes)}><LogoDrive /></button>
                {naTarefa && <button type="button" className="imp-mes-sem-btn" disabled={trava} onClick={() => onSemMovimento(m.mes, true)} title={'Não teve movimento em ' + m.rotulo}>s/ mov.</button>}
              </>
            )}
          </>
        )}
        </span>
      </span>
    );
  };
  return (
    <div className="imp-periodo-linha">
      <div className="imp-periodo-lado">
        <span className="imp-rotulo">Extrato</span>
        <span className="imp-mes-celulas" style={{ gridTemplateColumns: 'repeat(' + meses.length + ', minmax(0, 1fr))' }}>{meses.map(m => mes(m, 'banco'))}</span>
      </div>
      <div className="imp-periodo-lado">
        <span className="imp-rotulo">Razão</span>
        <span className="imp-mes-celulas" style={{ gridTemplateColumns: 'repeat(' + meses.length + ', minmax(0, 1fr))' }}>{meses.map(m => mes(m, 'sistema'))}</span>
      </div>
    </div>
  );
}

/** "Remover todos" (vários meses): com todos os meses importados, exclui o lado do banco no período (pergunta antes). */
function RemoverTodos({ titulo, travado, onRemover }: { titulo: string; travado: boolean; onRemover: () => void }) {
  return (
    <button type="button" className="btn btn-outline btn-sm imp-todos" disabled={travado} onClick={onRemover}
      title={'Todos os meses importados. Remover ' + titulo + ' de todos os meses'}>
      <Icone nome="x" />Remover todos
    </button>
  );
}

/** "Importar Todos" (vários meses): vários arquivos de uma vez; cada lançamento cai no seu mês. */
function ImportarTodos({ titulo, aceitar, travado, onArquivos, restantes }: { titulo: string; aceitar: string; travado: boolean; onArquivos: (fs: File[]) => void; restantes?: boolean }) {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className={'btn btn-outline btn-sm imp-todos' + (travado ? ' is-locked' : '')} title={(restantes ? 'Importar ' + titulo + ' dos meses que faltam' : 'Importar ' + titulo + ' de todos os meses de uma vez') + ' (cada lançamento cai no seu mês)'}>
        <Icone nome="upload" />{restantes ? 'Adicionar restantes' : 'Importar Todos'}
      </label>
      <input id={id} type="file" multiple accept={aceitar} className="sr-only" disabled={travado}
        onChange={ev => { const fs = Array.from(ev.target.files || []); ev.target.value = ''; onArquivos(fs); }} />
    </>
  );
}

/**
 * O seletor de competência, com duas abas (como o "Code ▾" do GitHub: Local | Codespaces):
 *   Competência — os meses (a partir de 01/2026); nos vários meses, só os do período (cada um abre o seu aqui);
 *   Vários meses — (dentro da Tarefas) de / até (MM/AAAA) e Iniciar: a empresa abre nos meses juntos e fica neles
 *   (prometido); no período, os meses e "Encerrar", que só funciona com todos os meses 100% concluídos.
 */
function SeletorDeCompetencia({ vm, naTarefa, trocar, periodoDaTarefa, encerrar }: {
  vm: ReturnType<typeof useImportacao>;
  naTarefa: boolean;
  trocar: (c: string) => void;
  periodoDaTarefa: { meses: string[]; concluido: boolean } | null;
  encerrar: () => void;
}) {
  const periodo = vm.periodo.length > 1 ? vm.periodo : [];
  const mmaaaa = tarefas.rotuloNumericoCompetencia;
  const [aba, setAba] = useState<'mes' | 'varios'>('mes');
  const cs = vm.competencias.map(c => c.valor);
  const [de, setDe] = useState(cs[Math.min(2, cs.length - 1)] || vm.competencia);
  const [ate, setAte] = useState(cs[0] || vm.competencia);
  const qtd = tarefas.competenciasDoPeriodo(tarefas.rotaDoPeriodo(de, ate)).length;
  const rotulo = periodo.length
    ? <>{mmaaaa(periodo[0])} a {mmaaaa(periodo[periodo.length - 1])}<span className="imp-periodo-qtd">{periodo.length} meses</span></>
    : vm.rotuloCompetencia;
  const lista = periodo.length ? periodo.map(c => ({ valor: c, rotulo: tarefas.rotuloCompetencia(c) })) : vm.competencias;
  const concluido = !!periodoDaTarefa?.concluido;
  return (
    <MenuSuspenso icone="calendar" rotulo={rotulo} largura={300}
      dica={periodo.length ? 'Em lote: ' + periodo.map(mmaaaa).join(', ') : 'Trocar a competência'}
      className={'btn btn-outline' + (periodo.length ? ' imp-periodo-ativo' : '')}
      conteudo={fechar => (
        <div className="comp-pop">
          {naTarefa && (
            <div className="iniciar-abas comp-abas" role="tablist">
              <button type="button" role="tab" className="iniciar-aba" aria-selected={aba === 'mes'} onClick={() => setAba('mes')}>Competência</button>
              <button type="button" role="tab" className="iniciar-aba" aria-selected={aba === 'varios'} onClick={() => setAba('varios')}>
                Em Lote{periodo.length > 0 && <span className="imp-periodo-qtd">{periodo.length}</span>}
              </button>
            </div>
          )}
          {aba === 'mes' || !naTarefa ? (
            <div className="comp-lista">
              {lista.map(c => (
                <button key={c.valor} type="button" className="popover-item" role="menuitem"
                  onClick={() => { fechar(); if (periodo.length || !naTarefa) vm.setCompetencia(c.valor); else trocar(c.valor); }}>
                  <span className="popover-marca">{c.valor === vm.competencia && <Icone nome="check" />}</span>
                  <span className="popover-texto">{c.rotulo}</span>
                </button>
              ))}
            </div>
          ) : periodo.length ? (
            <div className="comp-varios">
              <p className="comp-varios-texto">A empresa está nos meses <b>{mmaaaa(periodo[0])} a {mmaaaa(periodo[periodo.length - 1])}</b> ({periodo.length} meses).</p>
              <div className="imp-mes-chips">{periodo.map(m => <span key={m} className="imp-mes-chip">{mmaaaa(m)}</span>)}</div>
              {concluido
                ? <p className="comp-varios-texto ok"><Icone nome="checkCircle" />Todos os meses concluídos: já dá para cancelar a função.</p>
                : <p className="hint">Para cancelar a função, os {periodo.length} meses precisam estar 100% concluídos (todas as etapas). Até lá, a empresa abre sempre nesses meses.</p>}
              <button type="button" className="btn btn-primary btn-sm comp-varios-botao" disabled={!concluido} onClick={() => { fechar(); encerrar(); }}>Cancelar função</button>
            </div>
          ) : (
            <div className="comp-varios">
              <p className="hint">A empresa abre nesses meses juntos e fica neles até todos estarem concluídos.</p>
              <div className="varios-de-ate">
                <label>De
                  <select value={de} onChange={e => setDe(e.target.value)}>
                    {vm.competencias.map(c => <option key={c.valor} value={c.valor}>{mmaaaa(c.valor)}</option>)}
                  </select>
                </label>
                <label>Até
                  <select value={ate} onChange={e => setAte(e.target.value)}>
                    {vm.competencias.map(c => <option key={c.valor} value={c.valor}>{mmaaaa(c.valor)}</option>)}
                  </select>
                </label>
              </div>
              <button type="button" className="btn btn-primary btn-sm comp-varios-botao" disabled={qtd < 2} onClick={() => { fechar(); trocar(tarefas.rotaDoPeriodo(de, ate)); }}>
                {qtd > 1 ? 'Iniciar ' + qtd + ' meses' : 'Escolha dois meses ou mais'}
              </button>
            </div>
          )}
        </div>
      )} />
  );
}

/**
 * As abas da Importação (Vitor, 30/09/2026: "separe em menu superior"): os bancos (extrato e razão) e, da
 * Conferência, o balancete, as notas e os serviços. Dentro da Tarefas, ficam no cabeçalho dela, por cima do
 * checklist; aberta sozinha, em cima da página.
 */
type AbaImportacao = 'bancos' | conferencia.PaginaImportacao;
const ABAS_DA_IMPORTACAO: { id: AbaImportacao; rotulo: string; icone: AbaDaEtapa['icone'] }[] = [
  { id: 'bancos', rotulo: 'Bancos', icone: 'landmark' },
  { id: 'balancete', rotulo: 'Balancete', icone: 'scale' },
  { id: 'entradas', rotulo: 'Entradas', icone: 'arrowDown' },
  { id: 'saidas', rotulo: 'Saídas', icone: 'arrowUp' },
  { id: 'tomados', rotulo: 'Tomados', icone: 'fileDown' },
  { id: 'prestados', rotulo: 'Prestados', icone: 'fileUp' },
];

export function TarefaExtratos() {
  const vm = useImportacao();
  const s = useSessao();
  const ponte = usePonteDaTarefa(vm.competencia);
  const d = useDriveDaLinha(vm, s.codigo);
  const pe = usePedirExtratos(vm, s.codigo, s.nome, ponte.semMovimento, d.pedirLogin, { logo: urlDoLogoNilma(), logoDoBanco: urlDoLogoBanco });
  // os logos do Pedir extrato (Gmail/WhatsApp) já vêm com a página: no clique, aparecem na hora
  useEffect(preCarregarLogosDosApps, []);
  // qualquer operação rodando (importar, ler, buscar no Drive): a barra do topo e todos os botões travados até acabar
  // (o botão que está girando no Drive vira "Cancelar")
  const ocupadoGeral = vm.ocupado || !!d.buscando || vm.bancos.some(b => b.extrato.lendo || b.razao.lendo);
  useCarregando(ocupadoGeral);
  // extrato e razão batendo no período: a linha vira só o selo Ok (sem botões, a setinha não abre)
  const { ok: bancosOk, correcoes, situacoes, explicarCheque } = useBancosOk(vm, ponte, ocupadoGeral);
  // os requisitos para seguir (o botão de avançar da Tarefas só aparece com tudo pronto): cada banco Ok e, na
  // Conferência, Balancete, Entradas, Saídas, Tomados e (se presta serviço) Prestados importados
  const importados = useImportadosDaConferencia(s.nome);
  const mesesDaEtapa = vm.periodo.length > 1 ? vm.periodo : [vm.competencia];
  const semMovimentoNoPeriodo = (banco: string) => mesesDaEtapa.every(m => (vm.periodo.length > 1 ? ponte.semMovimentoPorMes[m] || [] : ponte.semMovimento).includes(banco));
  const diasSemCheque = (banco: string) => { const t = situacoes[banco]; return t && t.tipo === 'falta-cheque' ? t.faltam.length : 0; };
  // na etapa Cheque especial: todo banco Ok (o cheque dos dias negativos no razão); na Importação, "falta o cheque" passa
  useRequisitosParaATarefa(!ponte.naTarefa ? null : vm.etapaCheque
    ? x.requisitosDoChequeEspecial(vm.bancos.map(b => ({ nome: b.nome, ok: !!bancosOk[b.id], semMovimento: semMovimentoNoPeriodo(b.id), diasSemCheque: diasSemCheque(b.id) })))
    : importados ? x.requisitosDaImportacao(vm.bancos.map(b => ({
      nome: b.nome, ok: !!bancosOk[b.id], faltaCheque: diasSemCheque(b.id) > 0, semMovimento: semMovimentoNoPeriodo(b.id),
    })), importados, vm.prestaServico) : null);
  const bancosSemCheque = vm.bancos.filter(b => diasSemCheque(b.id) > 0);
  // os dias que fecham negativos (somando os bancos), para o aviso da etapa Cheque especial
  const diasNegativosNoPeriodo = vm.bancos.reduce((t, b) => { const x = situacoes[b.id]; return t + (x && x.tipo !== 'pendente' ? x.negativos.length : 0); }, 0);
  const [cxExtrato, cxRazao] = vm.caixas;
  const [abertas, setAbertas] = useState<string[]>([]);
  const [abaEscolhida, setAba] = useState<AbaImportacao>('bancos');
  // Prestados só para quem presta serviço (a regra do Cadastro; sem informar, aparece)
  const visiveis = ABAS_DA_IMPORTACAO.filter(a => a.id !== 'prestados' || vm.prestaServico !== false);
  const aba = visiveis.some(a => a.id === abaEscolhida) ? abaEscolhida : 'bancos';
  const abas = visiveis.map(a => ({ ...a, ativa: a.id === aba }));
  useAbasParaAEtapa(ponte.naTarefa && !vm.etapaCheque ? abas : null, id => { if (ABAS_DA_IMPORTACAO.some(a => a.id === id)) setAba(id as AbaImportacao); });
  const alternar = (id: string) => setAbertas(v => (v.includes(id) ? v.filter(a => a !== id) : [...v, id]));
  // Em Lote: os bancos com a grade dos meses recolhida (pela setinha)
  const [recolhidas, setRecolhidas] = useState<string[]>([]);
  const alternarGrade = (id: string) => setRecolhidas(v => (v.includes(id) ? v.filter(a => a !== id) : [...v, id]));

  /** Visualizar o que veio do Drive: abre a janela já (senão o navegador bloqueia) e põe o link temporário quando o robô responder. */
  function visualizarDoDrive(arquivo: { id: string; nome: string }) {
    if (!d.entrou) { d.pedirLogin(() => visualizarDoDrive(arquivo)); return; }
    const janela = window.open('', '_blank');
    janela?.document.write('<p style="font:14px sans-serif;padding:24px;color:#555">Buscando ' + arquivo.nome.replace(/</g, '') + ' no Drive…</p>');
    d.link(arquivo).then(url => { if (janela) janela.location.href = url; else window.open(url, '_blank'); },
      e => { janela?.close(); vm.avisarErro('Não consegui abrir do Drive', e instanceof Error ? e.message : String(e)); });
  }

  return (
    <section className="tarefa-extratos">
      {!ponte.naTarefa && !vm.etapaCheque && (
        <nav className="menu imp-abas" aria-label="Importação">
          {abas.map(a => (
            <button key={a.id} type="button" className={'menu-item' + (a.ativa ? ' active' : '')} aria-current={a.ativa ? 'page' : undefined} onClick={() => setAba(a.id)}>
              <Icone nome={a.icone} /><span>{a.rotulo}</span>
            </button>
          ))}
        </nav>
      )}
      {aba !== 'bancos' ? <ImportacaoNaEtapa nome={s.nome} tipo={aba} prestaServico={vm.prestaServico} /> : (<>
      <div className={'imp-topo' + (ocupadoGeral ? ' travado' : '')} aria-busy={ocupadoGeral}>
        {/* à esquerda, como o "⎇ main ▾  6 Branches" do GitHub: a competência e o número de bancos */}
        <SeletorDeCompetencia vm={vm} naTarefa={ponte.naTarefa} trocar={ponte.trocarCompetencia} periodoDaTarefa={ponte.periodo} encerrar={ponte.encerrarPeriodo} />
        <span className="imp-topo-num"><Icone nome="landmark" /><b>{vm.bancos.length}</b> {vm.bancos.length === 1 ? 'banco' : 'bancos'}</span>
        <span className="imp-topo-meio" />
        <MenuSuspenso rotulo="Pedir extratos" setaAntes className="btn btn-outline" direita
          conteudo={fechar => (
            <>
              <button type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); pe.abrir(); }}>
                <span className="popover-marca-app"><LogoGmail /></span><span className="popover-texto">E-mail</span>
              </button>
              <button type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); pe.abrirHistorico(); }}>
                <Icone nome="clock" /><span className="popover-texto">Histórico</span>
                {pe.pedidos.length > 0 && <span className="popover-dica">{pe.pedidos.length}</span>}
              </button>
            </>
          )} />
        <MenuSuspenso rotulo="Adicionar banco" icone="plus" className="btn btn-primary" direita largura={260}
          conteudo={fechar => <AdicionarBanco bancos={vm.bancosParaAdicionar} onAdicionar={vm.adicionarBanco} fechar={fechar} />} />
      </div>

      {/* a etapa Cheque especial: o que fazer (ou que está tudo certo) */}
      {vm.etapaCheque && (bancosSemCheque.length ? (
        <div className="alert imp-cheque">
          <Icone nome="alert" />
          <div>
            <p className="alert-title">Saldo negativo: faça o cheque especial</p>
            <p className="alert-text">
              {bancosSemCheque.map(b => b.nome).join(', ')} {bancosSemCheque.length === 1 ? 'fecha' : 'fecham'} negativo em alguns dias (clique no <b>Conferido</b> para ver).
              Gere os lançamentos no Cheque especial, lance no Alterdata e importe o razão de novo: a conferência confere o saldo final ignorando os lançamentos do cheque especial.
            </p>
            <a className="btn btn-outline btn-sm imp-cheque-abrir" href={caminhoNaFerramenta('cheque-especial', s.rota)} target="_blank" rel="noreferrer">
              <Icone nome="link" />Abrir o Cheque especial
            </a>
          </div>
        </div>
      ) : vm.bancos.length > 0 && vm.bancos.every(b => bancosOk[b.id] || semMovimentoNoPeriodo(b.id)) ? (
        // sem dia negativo em nenhum banco, nada a fazer; com dia negativo e o cheque no razão, conferido
        <p className="hint imp-cheque-ok">{diasNegativosNoPeriodo === 0
          ? 'Nenhum dia com saldo negativo no período: não precisa de cheque especial. Pode seguir.'
          : 'Cheque especial conferido (' + diasNegativosNoPeriodo + (diasNegativosNoPeriodo === 1 ? ' dia negativo' : ' dias negativos') + '): o saldo final bate sem os lançamentos dele. Pode seguir.'}</p>
      ) : null)}

      <div className="imp-lista">
        {vm.bancos.map(b => {
          const semMov = ponte.semMovimento.includes(b.id);
          const buscando = d.buscando === b.id;
          // sem movimento: a linha toda trava (só o Desfazer fica)
          const travado = semMov || ocupadoGeral;
          const temExtrato = b.extrato.qtdArquivos > 0;
          const doDrive = b.extrato.doDrive;
          // Em Lote: os meses do banco — completo (todo mês importado ou sem movimento) e os que faltam
          const meses = vm.periodo.length > 1 ? vm.mesesDoBanco(b.id, ponte.semMovimentoPorMes) : [];
          const lote = {
            extratoCompleto: meses.length > 0 && meses.every(m => m.extrato || m.semMovimento) && meses.some(m => m.extrato),
            razaoCompleto: meses.length > 0 && meses.every(m => m.razao || m.semMovimento) && meses.some(m => m.razao),
            faltamExtrato: meses.filter(m => !m.extrato && !m.semMovimento).map(m => m.mes),
            comExtrato: meses.filter(m => m.extrato).map(m => m.mes),
            comRazao: meses.filter(m => m.razao).map(m => m.mes),
          };
          const ok = bancosOk[b.id];
          // batendo, mas com dia negativo sem o cheque especial: "Conferido" (o clique explica); o razão fica para reimportar
          const situacao = situacoes[b.id];
          const faltaCheque = situacao?.tipo === 'falta-cheque';
          const aberta = abertas.includes(b.id) && !ok;
          // Em Lote: a setinha abre ou recolhe tudo junto — a grade dos meses e os lançamentos do mês (começa aberta)
          const emLote = vm.periodo.length > 1;
          const gradeAberta = !recolhidas.includes(b.id) && !ok;
          const verLancamentos = (emLote ? gradeAberta : aberta) && !semMov;
          return (
            <div key={b.id} className={'imp-bloco' + (semMov ? ' sem-movimento' : '') + (ok ? ' imp-ok' : '')}>
              <div className="imp-linha">
                {ok ? (
                  <span className="imp-seta" aria-hidden="true"><Icone nome="caretDown" /></span>
                ) : emLote ? (
                  <button type="button" className={'imp-seta' + (gradeAberta ? ' aberta' : '')} aria-expanded={gradeAberta}
                    title={gradeAberta ? 'Recolher os meses e os lançamentos' : 'Abrir os meses e os lançamentos'} aria-label="Os meses e os lançamentos do banco" onClick={() => alternarGrade(b.id)}>
                    <Icone nome="caretDown" />
                  </button>
                ) : (
                  <button type="button" className={'imp-seta' + (aberta ? ' aberta' : '')} aria-expanded={aberta} disabled={semMov}
                    title={aberta ? 'Fechar o movimento' : 'Ver o movimento do extrato'} aria-label="Movimento do extrato" onClick={() => alternar(b.id)}>
                    <Icone nome="caretDown" />
                  </button>
                )}
                <span className="imp-ico imp-logo"><LogoBanco banco={b.marca} cor={temExtrato && !semMov} /></span>
                <div className="imp-txt">
                  <span><b>{b.nome}</b>{b.conta && <span className="imp-conta">{b.conta}</span>}</span>
                </div>
                {/* no meio da linha, uma parte embaixo da outra: Extrato: 12 lançamentos / Razão: 13 lançamentos */}
                <div className="imp-resumo">
                  {!semMov && vm.periodo.length <= 1 && resumo(b).length > 0 && <div>{resumo(b).map(t => <span key={t}>{t}</span>)}</div>}
                </div>
                {ok ? (
                  // extrato e razão batem no período: só o Ok
                  <div className="imp-grupos">
                    <span className="badge badge-ok" title="O extrato e o razão batem em todos os meses do período">Ok</span>
                  </div>
                ) : faltaCheque ? (
                  <div className="imp-grupos">
                    <div className="imp-grupo" aria-label="Razão da conta">
                      <span className="imp-rotulo">Razão</span>
                      {vm.periodo.length > 1
                        ? (lote.razaoCompleto
                          ? <RemoverTodos titulo="o razão" travado={ocupadoGeral} onRemover={() => { void vm.excluirDoPeriodo(b.id, 'sistema', lote.comRazao); }} />
                          : <ImportarTodos titulo="o razão" restantes={lote.comRazao.length > 0} aceitar={cxRazao.aceitar} travado={ocupadoGeral} onArquivos={fs => { void vm.importarArquivos(b.id, 'sistema', fs); }} />)
                        : <BotaoLado lado={b.razao} titulo="Razão" aceitar={cxRazao.aceitar} travado={travado}
                          onArquivos={fs => { void vm.importarArquivos(b.id, 'sistema', fs); }} onExcluir={() => { void vm.excluirDoBanco(b.id, 'sistema'); }} />}
                    </div>
                    <button type="button" className="badge badge-conferido imp-conferido" onClick={() => explicarCheque(b, situacao)}
                      title="Bate com o razão, mas fecha negativo em algum dia: falta o cheque especial. Clique para ver.">Conferido</button>
                  </div>
                ) : vm.periodo.length > 1 ? (
                  // vários meses: os botões de um mês ficam embaixo (por mês); aqui, o de todos de uma vez.
                  // Todos os meses importados (à mão ou pelo Drive; sem movimento conta): vira "Remover todos".
                  // Faltando algum mês (mesmo com os outros do Drive): "Importar Todos" (à mão) e "Todos pelo Drive"; com uns
                  // importados e outros não, os dois viram "Adicionar restantes" (à mão e pelo Drive).
                  <div className="imp-grupos">
                    <div className="imp-grupo" aria-label="Extrato do banco (todos os meses)">
                      <span className="imp-rotulo">Extrato</span>
                      {lote.extratoCompleto ? (
                        <RemoverTodos titulo="o extrato" travado={ocupadoGeral} onRemover={() => { void vm.excluirDoPeriodo(b.id, 'banco', lote.comExtrato); }} />
                      ) : (
                        <>
                          <ImportarTodos titulo="o extrato" restantes={lote.comExtrato.length > 0} aceitar={cxExtrato.aceitar} travado={ocupadoGeral} onArquivos={fs => { void vm.importarArquivos(b.id, 'banco', fs); }} />
                          {/* buscando: o próprio botão vira "Cancelar" (para depois do mês que está baixando); o resto fica travado */}
                          <button type="button" className={'btn btn-outline btn-sm imp-todos' + (buscando ? ' imp-cancelar' : '')}
                            disabled={buscando ? d.cancelando : ocupadoGeral}
                            title={buscando ? 'Cancelar: para depois do mês que está baixando (os meses que já vieram ficam)' : 'Buscar no Drive, na pasta da empresa, o extrato de cada mês que falta e importar'}
                            onClick={() => (buscando ? d.cancelar() : d.buscarNoPeriodo(b, lote.faltamExtrato))}>
                            {buscando ? <><span className="btn-spinner" />{d.cancelando ? 'Cancelando…' : 'Cancelar'}</> : <><LogoDrive cor />{lote.comExtrato.length > 0 ? 'Adicionar restantes' : 'Todos pelo Drive'}</>}
                          </button>
                        </>
                      )}
                    </div>
                    <div className="imp-grupo" aria-label="Razão da conta (todos os meses)">
                      <span className="imp-rotulo">Razão</span>
                      {lote.razaoCompleto
                        ? <RemoverTodos titulo="o razão" travado={ocupadoGeral} onRemover={() => { void vm.excluirDoPeriodo(b.id, 'sistema', lote.comRazao); }} />
                        : <ImportarTodos titulo="o razão" restantes={lote.comRazao.length > 0} aceitar={cxRazao.aceitar} travado={ocupadoGeral} onArquivos={fs => { void vm.importarArquivos(b.id, 'sistema', fs); }} />}
                    </div>
                  </div>
                ) : (
                  <div className="imp-grupos">
                    <div className="imp-grupo" aria-label="Extrato do banco">
                      <span className="imp-rotulo">Extrato</span>
                      {buscando || b.extrato.lendo ? (
                        <span className="icon-btn icon-btn-sm imp-btn" title="Trazendo o extrato…"><span className="btn-spinner" /></span>
                      ) : doDrive.length ? (
                        // veio do Drive: fica só o Drive, colorido (dois cliques abrem o PDF; um clique, com o ×, exclui)
                        <BotaoDoDrive arquivos={doDrive} travado={travado} rotulo="" onExcluir={() => { void vm.excluirDoBanco(b.id, 'banco'); }} onVer={visualizarDoDrive} />
                      ) : temExtrato ? (
                        // importado à mão: fica só o check
                        <BotaoLado lado={b.extrato} titulo="Extrato" aceitar={cxExtrato.aceitar} travado={travado}
                          onArquivos={() => undefined} onExcluir={() => { void vm.excluirDoBanco(b.id, 'banco'); }} />
                      ) : (
                        <>
                          <BotaoLado lado={b.extrato} titulo="Extrato" aceitar={cxExtrato.aceitar} travado={travado}
                            onArquivos={fs => { void vm.importarArquivos(b.id, 'banco', fs); }} onExcluir={() => undefined} />
                          <button type="button" className="icon-btn icon-btn-sm imp-btn imp-drive" disabled={travado} title="Buscar no Drive" aria-label="Buscar no Drive"
                            onClick={() => d.buscar(b)}><LogoDrive /></button>
                          <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={travado} title="Protótipo: importar um extrato de teste" aria-label="Extrato de teste"
                            onClick={() => { void vm.importarTeste('banco', b.id); }}><Icone nome="zap" /></button>
                        </>
                      )}
                    </div>
                    <div className="imp-grupo" aria-label="Razão da conta">
                      <span className="imp-rotulo">Razão</span>
                      <BotaoLado lado={b.razao} titulo="Razão" aceitar={cxRazao.aceitar} travado={travado}
                        onArquivos={fs => { void vm.importarArquivos(b.id, 'sistema', fs); }} onExcluir={() => { void vm.excluirDoBanco(b.id, 'sistema'); }} />
                      {!b.razao.qtdArquivos && (
                        <button type="button" className="icon-btn icon-btn-sm imp-btn" disabled={travado} title="Protótipo: importar um razão de teste" aria-label="Razão de teste"
                          onClick={() => { void vm.importarTeste('sistema', b.id); }}><Icone nome="zap" /></button>
                      )}
                    </div>
                    {/* importado: o movimento se vê pela setinha; do Drive, um botãozinho de PDF (link temporário, não guardado) */}
                    {temExtrato ? doDrive.length > 0 && (
                      <button type="button" className="btn btn-sm btn-outline imp-pdf" title={'Abrir o PDF do Drive: ' + doDrive[doDrive.length - 1].nome}
                        aria-label="Abrir o PDF do Drive" onClick={() => visualizarDoDrive(doDrive[doDrive.length - 1])}>
                        <Icone nome="fileText" />PDF
                      </button>
                    ) : ponte.naTarefa && (
                      <button type="button" className={'btn btn-sm btn-outline imp-sem-mov' + (semMov ? ' marcado' : '')} aria-pressed={semMov}
                        disabled={!semMov && ocupadoGeral}
                        onClick={() => ponte.marcarSemMovimento(b.id, !semMov)}>{semMov ? 'Desfazer' : 'Não teve movimento'}</button>
                    )}
                  </div>
                )}
              </div>
              {emLote && gradeAberta && <MesesDoBanco meses={meses} competencia={vm.competencia} naTarefa={ponte.naTarefa}
                travado={ocupadoGeral} aceitarExtrato={cxExtrato.aceitar} aceitarRazao={cxRazao.aceitar}
                onMes={vm.setCompetencia} onArquivos={(lado, fs) => { void vm.importarArquivos(b.id, lado, fs); }}
                onExcluir={(lado, mes) => { void vm.excluirDoBanco(b.id, lado, mes); }}
                onDrive={mes => d.buscarNoPeriodo(b, [mes])}
                onVer={visualizarDoDrive}
                onSemMovimento={(mes, marcado) => ponte.marcarSemMovimento(b.id, marcado, mes)} />}
              {verLancamentos && (emLote ? (
                <FaixaQueAbre titulo="Lançamentos" qtd={vm.movimentoDe(b.id).linhas.length}>
                  <Movimento m={vm.movimentoDe(b.id)} pdf={doDrive.length ? doDrive[doDrive.length - 1] : null} onPdf={visualizarDoDrive} competencia={vm.competencia} />
                </FaixaQueAbre>
              ) : <Movimento m={vm.movimentoDe(b.id)}
                pdf={doDrive.length ? doDrive[doDrive.length - 1] : null} onPdf={visualizarDoDrive} competencia={vm.competencia} />)}
              {!ok && <PendenciasDoBanco itens={correcoes[b.id] || []} />}
            </div>
          );
        })}
      </div>

      {/* o resultado: uma barrinha por cima da tela; o que deu certo some em 2,7 s, erro fica até o × */}
      <MensagemFlutuante id="impAviso" className="imp-aviso" chave={vm.seqMensagem} onFechar={vm.fecharMensagem}
        duracao={vm.mensagem?.tom === 'erro' ? null : 2700}>
        {vm.mensagem && <Aviso m={vm.mensagem} onFechar={vm.fecharMensagem} />}
      </MensagemFlutuante>

      {d.login.aberto && (
        <div className="modal-overlay" role="presentation" onClick={d.login.fechar}>
          <div className="modal drive-login" role="dialog" aria-modal="true" aria-labelledby="tituloDrive" onClick={e => e.stopPropagation()}>
            <h3 id="tituloDrive">Entrar no Entregas</h3>
            <p className="drive-login-texto">Com a conta Google do escritório. Fica guardado neste computador: é só uma vez.</p>
            <div className="drive-login-google">
              <BotaoGoogle entrando={d.login.entrando} onClick={d.login.entrar} />
            </div>
            {d.login.erro && <p className="hint drive-login-erro">{d.login.erro}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={d.login.fechar}>Voltar</button>
            </div>
          </div>
        </div>
      )}

      {d.escolha && (
        <div className="modal-overlay" role="presentation" onClick={d.fecharEscolha}>
          <div className="modal drive-escolha" role="dialog" aria-modal="true" aria-labelledby="tituloEscolha" onClick={e => e.stopPropagation()}>
            <h3 id="tituloEscolha">Extrato do {d.escolha.linha.nome} no Drive</h3>
            <p className="hint">{d.escolha.texto}</p>
            {d.escolha.candidatos.length > 0 && (
              <div className="drive-candidatos">
                {d.escolha.candidatos.slice(0, 12).map(a => (
                  <button key={a.id} type="button" className="popover-item" onClick={() => d.usar(a)}>
                    <span className="add-banco-logo"><LogoDrive /></span>
                    <span className="popover-texto">{a.caminho}</span>
                    {a.daCompetencia && <span className="popover-dica">{vm.competencia.slice(5) + '/' + vm.competencia.slice(0, 4)}</span>}
                  </button>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={d.fecharEscolha}>Fechar</button>
            </div>
          </div>
        </div>
      )}
      </>)}
      <JanelaPedirExtratos p={pe} />
      <JanelaHistoricoDePedidos p={pe} />
    </section>
  );
}

function Aviso({ m, onFechar }: { m: Mensagem; onFechar: () => void }) {
  return (
    <div className={'imp-aviso-barra ' + m.tom} role="status">
      <Icone nome={m.tom === 'erro' ? 'alert' : m.tom === 'info' ? 'clock' : 'checkCircle'} />
      <span><b>{m.titulo}</b>{m.textos.length > 0 && <span className="hint"> · {m.textos.map(t => t.texto).join(' · ')}</span>}</span>
      <button type="button" aria-label="Fechar" title="Fechar" onClick={onFechar}>×</button>
    </div>
  );
}
