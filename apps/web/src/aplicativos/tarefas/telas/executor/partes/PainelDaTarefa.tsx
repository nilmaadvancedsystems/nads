// O painel de uma tarefa do Fiscal (a "checklist disfarçada", Vitor 06/10/2026), montado com as peças prontas do catálogo
// (Vitor: "resolva os elementos que já tinham sido criados… ao invés de usar os prontos"): os números no Stat, as
// comparações no ranking (rank), as notas por CFOP na tabela padrão (com a barra do rank), os avisos no Alerta, as
// marcas no badge e o vazio no gh-blank. Os gráficos novos (barras por dia, rosca, faixa 100%) saíram (Vitor: "não
// curti nenhum dos gráficos novos"): a composição virou o rank. Ao aparecer, anima (animarPainel.ts, animejs).
// A verificação (Vitor, 07/10/2026): NCM, CST e CEST nas entradas e saídas; os serviços com NBS, descrição, valor e o que
// cada nota retém; o faturamento com saídas e entradas lado a lado e a folha que o DP informou. Clicar numa linha (por
// CFOP ou por NCM/CST/CEST) abre as notas dela na janela do catálogo (Vitor, 07/10/2026: "quando eu clique, abra os
// detalhes da nota").
import { conferencia as c, formatos, tarefas as t } from '@nads/core';
import { Alerta, Icone, Stat } from '@nads/ui';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ROTULO_DO_RELATORIO, type VmPainelDoFiscal } from '../usePainelDoFiscal';
import { animarPainel } from './animarPainel';
import { SiegDaEtapa } from './SiegDaEtapa';

const { reais } = formatos;
type Formato = 'reais' | 'int';

/** Um número que conta do zero ao aparecer (vai como o valor do Stat; animarPainel.ts conta). */
function Conta({ valor, formato = 'int' }: { valor: number; formato?: Formato }) {
  return <span data-conta={valor} data-formato={formato}>{formato === 'reais' ? reais(valor) : Math.round(valor).toLocaleString('pt-BR')}</span>;
}

/** A composição (por natureza do CFOP) no rank: o nome, a fatia e o valor, a barra pela fatia. */
const composicao = (f: readonly t.painel.FatiaDaComposicao[]) => f.map(x => ({
  chave: x.classe, nome: x.rotulo, valor: x.valor, texto: x.pct.toLocaleString('pt-BR') + '% · ' + reais(x.valor),
}));

function Vazio({ relatorio, competencia, importar }: { relatorio: t.RelatorioImportavel; competencia: string; importar?: () => void }) {
  return (
    <div className="gh-blank">
      <Icone nome="fileUp" />
      <h4>Sem {ROTULO_DO_RELATORIO[relatorio]} de {t.rotuloNumericoCompetencia(competencia)}</h4>
      <p>Importe o relatório do Alterdata para ver aqui.</p>
      {importar && <button type="button" className="btn btn-primary" onClick={importar}><Icone nome="upload" />Importar {ROTULO_DO_RELATORIO[relatorio]}</button>}
    </div>
  );
}

/** O ranking do catálogo (rank): cada linha com o nome, o valor e a barra. */
function Rank({ linhas }: { linhas: readonly { chave: string; nome: ReactNode; valor: number; texto: string; cor?: string }[] }) {
  const max = Math.max(...linhas.map(l => l.valor), 0);
  return (
    <div className="rank">
      {linhas.map(l => (
        <div key={l.chave} className="rank-item">
          <span className="rank-nome">{l.nome}</span><span className="rank-val">{l.texto}</span>
          <span className="rank-barra"><span style={{ width: max ? Math.max(l.valor > 0 ? 2 : 0, (l.valor / max) * 100) + '%' : 0, background: l.cor || 'var(--accent)' }} /></span>
        </div>
      ))}
    </div>
  );
}

/** As notas de uma linha (o que abre na janela). */
interface NotasAbertas { titulo: string; notas: readonly c.Nota[] }

/** A linha que abre as notas: o clique, o Enter e o espaço. */
const abre = (abrir: () => void) => ({
  className: 'graf-linha-abre', role: 'button', tabIndex: 0, title: 'Ver as notas', onClick: abrir,
  onKeyDown: (e: KeyboardEvent<HTMLTableRowElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } },
});

/** As notas por CFOP na tabela padrão, com a barra do rank na coluna do valor. */
function TabelaPorCfop({ r, abrir }: { r: t.painel.ResumoDeNotas; abrir: (n: NotasAbertas) => void }) {
  const max = Math.max(...r.porCfop.map(l => l.valor), 0);
  return (
    <div className="table-wrap table-compact">
      <table>
        <thead><tr><th>CFOP</th><th>Natureza</th><th className="num">Notas</th><th className="num">Valor contábil</th></tr></thead>
        <tbody>
          {r.porCfop.map(l => (
            <tr key={l.cfop} {...abre(() => abrir({ titulo: 'CFOP ' + l.cfop + ' · ' + l.desc, notas: l.notas }))}>
              <td><b className="num">{l.cfop}</b></td>
              <td className="wrap">{l.desc} {(l.classe === 'st' || l.classe === 'devolucao') && <span className="badge badge-warn">{t.painel.CLASSES[l.classe]}</span>}</td>
              <td className="num">{l.qtd}</td>
              <td className="num graf-celula-barra">{reais(l.valor)}<span className="rank-barra"><span style={{ width: max ? (l.valor / max) * 100 + '%' : 0, background: 'var(--accent)' }} /></span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** SIEG × Alterdata: o Alerta verde quando bate; o amarelo com a diferença; nada sem a contagem. */
function Veredito({ sieg, importadas, oQue }: { sieg: number | null; importadas: number; oQue: string }) {
  if (sieg == null) return <p className="hint">O SIEG ainda não contou este mês (a contagem roda de madrugada).</p>;
  if (sieg === importadas) return <Alerta tom="ok" titulo={'As ' + oQue + ' batem com o SIEG'} texto={importadas + ' de ' + sieg + '.'} />;
  return importadas < sieg
    ? <Alerta titulo={'Faltam ' + (sieg - importadas) + ' ' + oQue + ' no Alterdata'} texto={'O SIEG tem ' + sieg + '; o Alterdata, ' + importadas + '. Importe as que faltam e reimporte o relatório.'} />
    : <Alerta titulo={(importadas - sieg) + ' ' + oQue + ' a mais que o SIEG'} texto={'O Alterdata tem ' + importadas + '; o SIEG, ' + sieg + '. Confira se há nota lançada duas vezes ou de outro mês.'} />;
}

/** Os itens por NCM, CST e CEST (quando o relatório do Alterdata traz as colunas). */
function TabelaFiscal({ r, abrir }: { r: t.painel.ResumoFiscal; abrir: (n: NotasAbertas) => void }) {
  if (!r.temColunas) return <p className="hint">O relatório não trouxe NCM, CST e CEST: exporte do Alterdata com essas colunas e reimporte para ver por item.</p>;
  return (
    <div className="table-wrap table-compact">
      <table>
        <thead><tr><th>NCM</th><th>CST</th><th>CEST</th><th className="num">Itens</th><th className="num">Valor</th></tr></thead>
        <tbody>
          {r.linhas.map(l => (
            <tr key={l.ncm + '|' + l.cst + '|' + l.cest} {...abre(() => abrir({ titulo: ['NCM ' + (l.ncm || '—'), 'CST ' + (l.cst || '—'), l.cest ? 'CEST ' + l.cest : ''].filter(Boolean).join(' · '), notas: l.notas }))}>
              <td><b>{l.ncm || '—'}</b></td><td>{l.cst || '—'}</td><td>{l.cest || '—'}</td>
              <td className="num">{l.itens}</td><td className="num">{reais(l.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Os serviços do mês com NBS, descrição, valor e o que cada nota retém (lido da nota). */
function TabelaDeServicos({ linhas }: { linhas: readonly t.painel.ServicoNaVerificacao[] }) {
  const semColunas = !linhas.some(l => l.nbs || l.descricao);
  return (
    <>
      <div className="table-wrap table-compact">
        <table>
          <thead><tr><th>Nota</th><th>NBS</th><th>Descrição</th><th className="num">Valor</th><th>Retidos</th></tr></thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={l.tipo + l.numero + i}>
                <td className="wrap"><b>{l.nome}</b><span className="hint" style={{ display: 'block', margin: 0 }}>{l.tipo} · nº {l.numero}</span></td>
                <td className="num">{l.nbs || '—'}</td>
                <td className="wrap">{l.descricao || '—'}</td>
                <td className="num">{reais(l.valor)}</td>
                <td>{l.retencoes.length
                  ? <span className="graf-marcas">{l.retencoes.map(r => <span key={r.imposto} className="badge badge-warn">{r.imposto} {reais(r.valor)}</span>)}</span>
                  : <span className="hint" style={{ margin: 0 }}>nenhuma</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {semColunas && <p className="hint">O relatório não trouxe NBS e descrição do serviço: exporte do Alterdata com essas colunas e reimporte.</p>}
    </>
  );
}

/** O DP informa o total da folha do mês (o Fiscal vê ao lado do faturamento). */
function FolhaTotal({ valor, informar }: { valor: number | null; informar?: (v: number) => void }) {
  const [texto, setTexto] = useState(valor != null ? valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
  const lido = Number(texto.replace(/\./g, '').replace(',', '.'));
  const valido = texto.trim() !== '' && Number.isFinite(lido) && lido >= 0;
  return (
    <>
      <div className="stat-grid">
        <Stat rotulo="Total da folha informado" valor={valor != null ? <Conta valor={valor} formato="reais" /> : '—'} />
      </div>
      <form className="graf-marcas" onSubmit={e => { e.preventDefault(); if (valido && informar) informar(lido); }}>
        <input className="field" inputMode="decimal" placeholder="Total da folha do mês (salários, pró-labore e encargos)" value={texto} onChange={e => setTexto(e.target.value)} style={{ maxWidth: 360 }} />
        <button type="submit" className="btn btn-primary" disabled={!valido || !informar}><Icone nome="check" />Salvar</button>
      </form>
      <p className="hint">O Fiscal vê este valor ao lado do faturamento (Conferência de Faturamento × Notas Emitidas).</p>
    </>
  );
}

/** A janela com as notas de uma linha (a janela do catálogo: a da empresa no Cadastro e a do e-mail). Fecha no ×, no Esc e fora. */
function JanelaDasNotas({ aberta, fechar }: { aberta: NotasAbertas; fechar: () => void }) {
  useEffect(() => {
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [fechar]);
  const notas = aberta.notas;
  const qtd = new Set(notas.map(n => n.numero + '|' + n.nome + '|' + n.data)).size;
  const total = notas.reduce((s, n) => s + (Number(n.valor) || 0), 0);
  const tem = (k: 'conta' | 'ncm' | 'cst' | 'cest' | 'lanc') => notas.some(n => n[k]);
  return (
    <div className="cad-janela-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="cad-janela" role="dialog" aria-modal="true" aria-label={aberta.titulo}>
        <header className="cad-janela-topo">
          <span className="cad-janela-empresa"><span className="cad-janela-nome">{aberta.titulo}</span></span>
          <button type="button" className="btn btn-ghost cad-janela-x" onClick={fechar} aria-label="Fechar" title="Fechar (Esc)"><Icone nome="x" /></button>
        </header>
        <div className="cad-janela-conteudo">
          <div className="stat-grid">
            <Stat rotulo="Notas" valor={String(qtd)} />
            <Stat rotulo="Itens" valor={String(notas.length)} />
            <Stat rotulo="Valor" valor={reais(total)} />
          </div>
          <div className="table-wrap table-compact">
            <table>
              <thead>
                <tr>
                  <th>Data</th><th>Nota</th><th>Fornecedor / cliente</th><th>CFOP</th>
                  {tem('lanc') && <th>Lanç.</th>}{tem('conta') && <th>Conta</th>}
                  {tem('ncm') && <th>NCM</th>}{tem('cst') && <th>CST</th>}{tem('cest') && <th>CEST</th>}
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {[...notas].sort((a, b) => a.data.split('/').reverse().join('').localeCompare(b.data.split('/').reverse().join('')) || a.numero.localeCompare(b.numero)).map((n, i) => (
                  <tr key={n.numero + '|' + i}>
                    <td className="num">{n.data}</td>
                    <td className="num"><b>{n.numero}</b></td>
                    <td className="wrap">{n.nome}{n.doc && <span className="hint" style={{ display: 'block', margin: 0 }}>{n.doc}</span>}</td>
                    <td className="num">{n.cfop}</td>
                    {tem('lanc') && <td className="num">{n.lanc || '—'}</td>}{tem('conta') && <td className="num">{n.conta || '—'}</td>}
                    {tem('ncm') && <td>{n.ncm || '—'}</td>}{tem('cst') && <td>{n.cst || '—'}</td>}{tem('cest') && <td>{n.cest || '—'}</td>}
                    <td className="num">{reais(n.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function SemConta({ r }: { r: t.painel.ResumoDeNotas }) {
  return r.comConta ? null : <Alerta titulo="O relatório veio sem a conta contábil" texto="O Contábil precisa dela: ligue a coluna no Alterdata e reimporte." />;
}

/** O que o relatório (início e fim) recebe do executor: o regime e as etapas que entram no mês. */
export interface DadosDoRelatorio {
  regime: string;
  etapas: readonly { id: string; nome: string; secao: string; situacao: t.SituacaoEtapa; por: string; em: string }[];
}

interface PropsDoPainel {
  painel: t.PainelDaTarefa; vm: VmPainelDoFiscal; codigo: string; competencia: string; importar: (r: t.RelatorioImportavel[]) => void;
  /** os valores da execução aberta (o total da folha que o DP informou) e como informar um */
  valores?: Record<string, number>; informar?: (chave: string, valor: number) => void;
  relatorio?: DadosDoRelatorio;
}

const SITUACAO: Record<t.SituacaoEtapa, { rotulo: string; badge: string }> = {
  pendente: { rotulo: 'A fazer', badge: 'badge-neutral' }, feita: { rotulo: 'Feita', badge: 'badge-ok' },
  dispensada: { rotulo: 'Não se aplica', badge: 'badge-neutral' }, interrompida: { rotulo: 'Parada', badge: 'badge-warn' },
};
const quando = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

/** O relatório do início: o regime, as etapas do mês, o SIEG e o que já foi importado (e o que falta). */
function RelatorioInicio({ vm, relatorio, competencia, importar }: { vm: VmPainelDoFiscal; relatorio?: DadosDoRelatorio; competencia: string; importar: (r: t.RelatorioImportavel[]) => void }) {
  const tipos: { id: t.RelatorioImportavel; notas: number; valor: number | null }[] = [
    { id: 'entradas', notas: vm.entradas.qtd, valor: vm.entradas.total }, { id: 'saidas', notas: vm.saidas.qtd, valor: vm.saidas.total },
    { id: 'tomados', notas: vm.importado.tomados, valor: null }, { id: 'prestados', notas: vm.prestados.qtd, valor: vm.prestados.total },
  ];
  const faltam = tipos.filter(x => !x.notas).map(x => x.id);
  const secoes = [...new Set((relatorio?.etapas || []).map(e => e.secao))];
  return (
    <>
      <div className="stat-grid">
        <Stat rotulo="Regime" valor={relatorio?.regime || '—'} grande={false} />
        <Stat rotulo={'Etapas em ' + t.rotuloNumericoCompetencia(competencia)} valor={<Conta valor={relatorio?.etapas.length || 0} />} />
        <Stat rotulo="Emitidas no SIEG" valor={vm.sieg ? <Conta valor={vm.sieg.emitidasNFe} /> : '—'} />
        <Stat rotulo="Recebidas no SIEG" valor={vm.sieg ? <Conta valor={vm.sieg.recebidasNFe} /> : '—'} />
      </div>
      <div className="table-wrap table-compact">
        <table>
          <thead><tr><th>Relatório do Alterdata</th><th className="num">Notas</th><th className="num">Valor</th><th>Situação</th></tr></thead>
          <tbody>
            {tipos.map(x => (
              <tr key={x.id}>
                <td>{ROTULO_DO_RELATORIO[x.id]}</td><td className="num">{x.notas || '—'}</td>
                <td className="num">{x.valor != null && x.notas ? reais(x.valor) : '—'}</td>
                <td>{x.notas ? <span className="badge badge-ok">Importado</span> : <span className="badge badge-warn">Falta</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {faltam.length > 0 && (
        <Alerta titulo={'Falta importar: ' + faltam.map(x => ROTULO_DO_RELATORIO[x]).join(', ')} texto="Importe agora ou na etapa Importação no Alterdata.">
          <button type="button" className="btn btn-outline" onClick={() => importar(faltam)}><Icone nome="upload" />Importar</button>
        </Alerta>
      )}
      {secoes.length > 0 && (
        <div className="table-wrap table-compact">
          <table>
            <thead><tr><th>O que entra no mês</th><th>Etapas</th></tr></thead>
            <tbody>
              {secoes.map(s => <tr key={s}><td><b>{s}</b></td><td className="wrap">{(relatorio?.etapas || []).filter(e => e.secao === s).map(e => e.nome).join(' · ')}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** O relatório do fim: os números do mês, cada etapa com quem fez e quando, e o que ficou pendente. */
function RelatorioFim({ vm, relatorio, competencia }: { vm: VmPainelDoFiscal; relatorio?: DadosDoRelatorio; competencia: string }) {
  const etapas = relatorio?.etapas || [];
  const abertas = etapas.filter(e => e.situacao === 'pendente' || e.situacao === 'interrompida');
  const retido = vm.servicos.reduce((s, x) => s + x.retido, 0);
  return (
    <>
      <div className="stat-grid">
        <Stat rotulo={'Faturamento de ' + t.rotuloNumericoCompetencia(competencia)} valor={<Conta valor={vm.saidas.total} formato="reais" />} cor="saida" />
        <Stat rotulo="Entradas" valor={<Conta valor={vm.entradas.total} formato="reais" />} cor="entrada" />
        <Stat rotulo="Serviços prestados" valor={<Conta valor={vm.prestados.total} formato="reais" />} />
        <Stat rotulo="Total retido" valor={<Conta valor={retido} formato="reais" />} />
        <Stat rotulo="Folha do mês (DP)" valor={vm.folhaDoDp != null ? <Conta valor={vm.folhaDoDp} formato="reais" /> : '—'} />
      </div>
      {abertas.length
        ? <Alerta titulo={abertas.length === 1 ? '1 etapa ainda aberta' : abertas.length + ' etapas ainda abertas'} texto={abertas.map(e => e.nome).join(', ')} />
        : <Alerta tom="ok" titulo="Mês fechado" texto="Todas as etapas do mês estão feitas." />}
      <div className="table-wrap table-compact">
        <table>
          <thead><tr><th>Etapa</th><th>Situação</th><th>Quem</th><th>Quando</th></tr></thead>
          <tbody>
            {etapas.map(e => (
              <tr key={e.id}>
                <td><span className="hint" style={{ margin: 0 }}>{e.secao} › </span>{e.nome}</td>
                <td><span className={'badge ' + SITUACAO[e.situacao].badge}>{SITUACAO[e.situacao].rotulo}</span></td>
                <td>{e.por || '—'}</td><td className="num">{quando(e.em) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="graf-marcas"><button type="button" className="btn btn-outline" onClick={() => window.print()}><Icone nome="impressora" />Imprimir</button></div>
    </>
  );
}

function Corpo({ painel, vm, codigo, competencia, importar, valores, informar, abrir, relatorio }: PropsDoPainel & { abrir: (n: NotasAbertas) => void }) {
  const comp = t.rotuloNumericoCompetencia(competencia);
  const pctDe = (classe: t.painel.ClasseDoCfop) => vm.base.find(f => f.classe === classe)?.pct || 0;
  const vazio = (r: t.RelatorioImportavel) => <Vazio relatorio={r} competencia={competencia} importar={() => importar([r])} />;
  switch (painel) {
    case 'sieg':
      return codigo ? <SiegDaEtapa tipo="contagem" codigo={codigo} competencia={competencia} /> : null;
    case 'sequencia':
      return codigo ? <SiegDaEtapa tipo="saidas" codigo={codigo} competencia={competencia} /> : null;
    case 'recebimento':
      return (
        <>
          <div className="stat-grid">
            <Stat rotulo="Emitidas no SIEG (NF-e e NFC-e)" valor={vm.sieg ? <Conta valor={vm.sieg.emitidasNFe} /> : '—'} />
            <Stat rotulo="Saídas no Alterdata" valor={<Conta valor={vm.importado.saidas} />} />
          </div>
          <Veredito sieg={vm.sieg?.emitidasNFe ?? null} importadas={vm.importado.saidas} oQue="saídas" />
        </>
      );
    case 'saidas':
    case 'entradas': {
      const r = painel === 'saidas' ? vm.saidas : vm.entradas;
      if (!r.qtd) return vazio(painel);
      return (
        <>
          <div className="stat-grid">
            <Stat rotulo={painel === 'saidas' ? 'Notas de saída' : 'Notas de entrada'} valor={<Conta valor={r.qtd} />} />
            <Stat rotulo="Valor contábil" valor={<Conta valor={r.total} formato="reais" />} cor={painel === 'saidas' ? 'saida' : 'entrada'} />
            <Stat rotulo="CFOPs" valor={<Conta valor={r.porCfop.length} />} />
          </div>
          {painel === 'saidas' && (pctDe('st') > 0 || pctDe('devolucao') > 0) && (
            <p className="hint graf-marcas">
              {pctDe('st') > 0 && <span className="badge badge-warn">{pctDe('st').toLocaleString('pt-BR')}% com ST</span>}
              {pctDe('devolucao') > 0 && <span className="badge badge-warn">{pctDe('devolucao').toLocaleString('pt-BR')}% devolução</span>}
            </p>
          )}
          <TabelaPorCfop r={r} abrir={abrir} />
          <TabelaFiscal r={painel === 'saidas' ? vm.fiscalSaidas : vm.fiscalEntradas} abrir={abrir} />
          <SemConta r={r} />
        </>
      );
    }
    case 'faturamento': {
      if (!vm.saidas.qtd && !vm.entradas.qtd) return vazio('saidas');
      const folha = vm.folhaDoDp;
      const linha = (rotulo: string, sai: ReactNode, ent: ReactNode) => <tr><td>{rotulo}</td><td className="num">{sai}</td><td className="num">{ent}</td></tr>;
      return (
        <>
          <div className="stat-grid">
            <Stat rotulo={'Faturamento de ' + comp} valor={<Conta valor={vm.saidas.total} formato="reais" />} cor="saida" />
            <Stat rotulo="Folha do mês (DP)" valor={folha != null ? <Conta valor={folha} formato="reais" /> : '—'} />
            <Stat rotulo="Folha ÷ faturamento" valor={folha != null && vm.saidas.total ? (Math.round((folha / vm.saidas.total) * 1000) / 10).toLocaleString('pt-BR') + '%' : '—'} />
          </div>
          {folha == null && <p className="hint">O DP ainda não informou o total da folha deste mês (na etapa Folha de pagamento).</p>}
          {/* saídas e entradas lado a lado (Vitor, 07/10/2026) */}
          <div className="table-wrap table-compact">
            <table>
              <thead><tr><th /><th className="num">Saídas</th><th className="num">Entradas</th></tr></thead>
              <tbody>
                {linha('Notas no Alterdata', vm.saidas.qtd, vm.entradas.qtd)}
                {linha('No SIEG', vm.sieg ? vm.sieg.emitidasNFe : '—', vm.sieg ? vm.sieg.recebidasNFe : '—')}
                {linha('Diferença', vm.sieg ? vm.saidas.qtd - vm.sieg.emitidasNFe : '—', vm.sieg ? vm.entradas.qtd - vm.sieg.recebidasNFe : '—')}
                {linha('Valor contábil', reais(vm.saidas.total), reais(vm.entradas.total))}
                {linha('CFOPs', vm.saidas.porCfop.length, vm.entradas.porCfop.length)}
              </tbody>
            </table>
          </div>
          <Veredito sieg={vm.sieg?.emitidasNFe ?? null} importadas={vm.saidas.qtd} oQue="notas emitidas" />
        </>
      );
    }
    case 'servicos': {
      if (!vm.importado.tomados && !vm.importado.prestados) return vazio('tomados');
      const comRetencao = vm.servicos.filter(s => s.retido > 0);
      return (
        <>
          <div className="stat-grid">
            <Stat rotulo="Notas de serviço" valor={<Conta valor={vm.servicos.length} />} />
            <Stat rotulo="Com retenção" valor={<Conta valor={comRetencao.length} />} />
            <Stat rotulo="Total retido" valor={<Conta valor={comRetencao.reduce((s, x) => s + x.retido, 0)} formato="reais" />} />
          </div>
          <TabelaDeServicos linhas={vm.servicos} />
        </>
      );
    }
    case 'interestaduais':
      if (!vm.entradas.qtd) return vazio('entradas');
      if (!vm.interestaduais.qtd) return <Alerta tom="ok" titulo={'Nenhuma entrada de fora do estado em ' + comp} texto="Sem Antecipação, ST ou DIFAL das entradas neste mês." />;
      return (
        <>
          <div className="stat-grid">
            <Stat rotulo="Entradas interestaduais" valor={<Conta valor={vm.interestaduais.qtd} />} />
            <Stat rotulo="Valor" valor={<Conta valor={vm.interestaduais.total} formato="reais" />} cor="entrada" />
          </div>
          <Rank linhas={vm.interestaduais.linhas.map(l => ({ chave: l.nome, nome: <><b>{l.nome}</b> <span className="hint">{l.qtd} {l.qtd === 1 ? 'nota' : 'notas'} · CFOP {l.ufCfop}</span></>, valor: l.valor, texto: reais(l.valor) }))} />
        </>
      );
    case 'relatorio-inicio':
      return <RelatorioInicio vm={vm} relatorio={relatorio} competencia={competencia} importar={importar} />;
    case 'relatorio-fim':
      return <RelatorioFim vm={vm} relatorio={relatorio} competencia={competencia} />;
    case 'folha-total':
      return <FolhaTotal valor={valores?.folha ?? null} informar={informar ? v => informar('folha', v) : undefined} />;
    case 'entradas-sieg':
      if (!vm.entradas.qtd) return vazio('entradas');
      return (
        <>
          <Rank linhas={[
            { chave: 'sieg', nome: 'Recebidas no SIEG (NF-e)', valor: vm.sieg?.recebidasNFe || 0, texto: vm.sieg ? String(vm.sieg.recebidasNFe) : '—', cor: 'var(--ink-faint)' },
            { chave: 'alt', nome: 'Entradas no Alterdata', valor: vm.entradas.qtd, texto: String(vm.entradas.qtd) },
          ]} />
          <Veredito sieg={vm.sieg?.recebidasNFe ?? null} importadas={vm.entradas.qtd} oQue="entradas" />
        </>
      );
    case 'iss-retido':
    case 'inss-retido': {
      if (!vm.importado.tomados && !vm.importado.prestados) return vazio('tomados');
      const r = painel === 'iss-retido' ? vm.issRetido : vm.inssRetido;
      const imposto = painel === 'iss-retido' ? 'ISS' : 'INSS';
      if (!r.qtd) return <Alerta tom="ok" titulo={'Nenhum ' + imposto + ' retido em ' + comp} texto="Nenhuma nota de serviço do mês tem retenção." />;
      return (
        <>
          <div className="stat-grid">
            <Stat rotulo={imposto + ' retido'} valor={<Conta valor={r.total} formato="reais" />} />
            <Stat rotulo="Notas com retenção" valor={<Conta valor={r.qtd} />} />
          </div>
          <Rank linhas={r.linhas.map((l, i) => ({ chave: l.numero + i, nome: <><b>{l.nome}</b> <span className="hint">{l.tipo} · nº {l.numero} · serviço {reais(l.valor)}</span></>, valor: l.retido, texto: reais(l.retido) }))} />
        </>
      );
    }
    case 'receitas':
    case 'irpj': {
      if (!vm.receita.length) return vazio('saidas');
      const receita = vm.receita.filter(f => f.classe === 'venda' || f.classe === 'st' || f.classe === 'servico').reduce((s, f) => s + f.valor, 0);
      return (
        <>
          <div className="stat-grid">
            <Stat rotulo={painel === 'irpj' ? 'Receita do mês (o trimestre soma os 3)' : 'Receita do mês'} valor={<Conta valor={receita} formato="reais" />} cor="saida" />
            <Stat rotulo="Serviços prestados" valor={<Conta valor={vm.prestados.total} formato="reais" />} />
          </div>
          <Rank linhas={composicao(vm.receita)} />
        </>
      );
    }
    case 'base':
      if (!vm.base.length) return vazio('saidas');
      return (
        <>
          <Rank linhas={composicao(vm.base)} />
          {(pctDe('st') > 0 || pctDe('devolucao') > 0) && <Alerta titulo="Tire da base o que já teve o imposto pago antes" texto={'As saídas com ST' + (pctDe('devolucao') ? ' e as devoluções' : '') + ' não entram na base.'} />}
        </>
      );
    case 'icms':
      if (!vm.saidas.qtd && !vm.entradas.qtd) return vazio('saidas');
      return (
        <>
          <div className="stat-grid">
            <Stat rotulo="Saídas (débitos)" valor={<Conta valor={vm.saidas.total} formato="reais" />} cor="saida" />
            <Stat rotulo="Entradas (créditos)" valor={<Conta valor={vm.entradas.total} formato="reais" />} cor="entrada" />
          </div>
          {vm.base.length > 0 && <Rank linhas={composicao(vm.base)} />}
        </>
      );
    case 'prestados':
      if (!vm.prestados.qtd) return vazio('prestados');
      return (
        <div className="stat-grid">
          <Stat rotulo="Notas de serviço" valor={<Conta valor={vm.prestados.qtd} />} />
          <Stat rotulo="Valor dos serviços" valor={<Conta valor={vm.prestados.total} formato="reais" />} />
          <Stat rotulo="ISS" valor={<Conta valor={vm.prestados.iss} formato="reais" />} />
        </div>
      );
    default:
      return null;
  }
}

export function PainelDaTarefa(p: PropsDoPainel) {
  const ref = useRef<HTMLDivElement>(null);
  // anima quando o painel aparece e quando os dados chegam (a importação ou o ⚡)
  const chave = p.painel + '|' + p.vm.importado.entradas + '|' + p.vm.importado.saidas + '|' + p.vm.importado.tomados + '|' + p.vm.importado.prestados + '|' + (p.vm.sieg ? 1 : 0);
  useEffect(() => { animarPainel(ref.current); }, [chave]);
  // as notas de uma linha, na janela
  const [aberta, setAberta] = useState<NotasAbertas | null>(null);
  return (
    <>
      <div ref={ref} className="graf-painel"><Corpo {...p} abrir={setAberta} /></div>
      {/* no body: a faixa animada (transform) prenderia a janela fixa dentro dela */}
      {aberta && createPortal(<JanelaDasNotas aberta={aberta} fechar={() => setAberta(null)} />, document.body)}
    </>
  );
}
