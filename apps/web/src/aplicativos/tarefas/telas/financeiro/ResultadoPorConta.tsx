// Financeiro › Resultado (22/10/2026; melhorado no mesmo dia: "quero melhorar a aba de resultados"): duas visões — o
// Comparativo (o mês, o trimestre ou o ano contra o anterior e o mesmo do ano passado, com a variação) e o Ano mês a mês
// (jan a dez e o total) —, as contas pela árvore do plano (o grupo abre e fecha na seta; o nome abre os lançamentos que
// formam o valor) e o Exportar planilha. Só as peças do catálogo (Segmentado, SeletorMes, MenuSuspenso, Tabela, Vazio e a
// janela do desenho das outras).
import { financeiro, formatos } from '@nads/core';
import { BotaoFechar, Icone, MenuSuspenso, Segmentado, SeletorMes, useCarregando, useJanela, Vazio } from '@nads/ui';
import { useRef } from 'react';
import { dataBr } from './formatosDaNota';
import { useResultadoPorConta, type LinhaVisivel } from './useResultadoPorConta';

type Vm = ReturnType<typeof useResultadoPorConta>;

const reais = (v: number) => (v ? formatos.reais(v) : '—');
/** a cor do valor: verde no positivo, vermelho no negativo (ou na saída), cinza no zero */
const cor = (v: number, saida?: boolean) => (!v ? 'fraco' : saida || v < 0 ? 'fin-valor-saida' : 'fin-valor-entrada');
const somar = (vs: number[]) => vs.reduce((s, x) => s + Math.round(x * 100), 0) / 100;

function Variacao({ v, saida }: { v: number | null; saida?: boolean }) {
  if (v == null) return <span className="fraco">—</span>;
  // na saída, subir é ruim (vermelho); na entrada e no resultado, subir é bom (verde)
  const bom = saida ? v <= 0 : v >= 0;
  if (v === 0) return <span className="fraco">0%</span>;
  return <span className={'fin-variacao ' + (bom ? 'fin-valor-entrada' : 'fin-valor-saida')}>{v > 0 ? '▲' : '▼'} {Math.abs(v).toLocaleString('pt-BR')}%</span>;
}

/** as células de valor de uma linha: no comparativo, a variação logo depois do período; no ano, o total no fim */
function Valores({ vm, valores, saida, forte }: { vm: Vm; valores: number[]; saida?: boolean; forte?: boolean }) {
  const celulas = [];
  for (const [i, v] of valores.entries()) {
    const atual = vm.comparativo && i === 0;
    celulas.push(<td key={i} className={'num ' + (forte && atual ? cor(v, saida) : !atual && vm.comparativo ? 'fin-resultado-antes' : !v ? 'fraco' : '')}>{reais(v)}</td>);
    if (vm.comparativo && i === 0) celulas.push(<td key="var" className="num"><Variacao v={financeiro.variacao(valores[0], valores[1])} saida={saida} /></td>);
  }
  if (!vm.comparativo) {
    const total = somar(valores);
    celulas.push(<td key="total" className={'num fin-resultado-total-col ' + (forte ? cor(total, saida) : '')}>{reais(total)}</td>);
  }
  return <>{celulas}</>;
}

function Bloco({ vm, titulo, linhas, totais, saida }: { vm: Vm; titulo: string; linhas: LinhaVisivel[]; totais: number[]; saida?: boolean }) {
  const colunas = vm.colunas.length + 2;
  return (
    <>
      <tr className={'fin-resultado-grupo ' + (saida ? 'saida' : 'entrada')}><td colSpan={colunas}>{titulo}</td></tr>
      {linhas.length ? linhas.map(l => (
        <tr key={l.tipo + l.linha.conta} className={l.temFilhos ? 'fin-resultado-pai' : ''}>
          <td>
            <span className="fin-resultado-conta" style={{ paddingLeft: 4 + l.linha.fundo * 18 }}>
              {l.temFilhos
                ? <button type="button" className="fin-resultado-abre" aria-expanded={l.aberta} title={l.aberta ? 'Fechar o grupo' : 'Abrir o grupo'} onClick={() => vm.alternar(l)}><Icone nome={l.aberta ? 'caretDown' : 'chevronRight'} /></button>
                : <span className="fin-resultado-abre-vazio" />}
              <button type="button" className="fin-resultado-nome" title="Ver os lançamentos" onClick={() => vm.ver(l)}>{l.linha.rotulo}</button>
            </span>
          </td>
          <Valores vm={vm} valores={l.linha.valores} saida={saida} />
        </tr>
      )) : <tr><td colSpan={colunas} className="fraco">Nada no período.</td></tr>}
      <tr className="fin-resultado-total"><td>Total de {titulo.toLowerCase()}</td><Valores vm={vm} valores={totais} saida={saida} forte /></tr>
    </>
  );
}

function JanelaDosLancamentos({ vm }: { vm: Vm }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.fecharVer);
  const v = vm.vendo;
  if (!v) return null;
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) vm.fecharVer(); }}>
      <div ref={janela} className="modal registro-novo" role="dialog" aria-modal="true" aria-label={'Os lançamentos de ' + v.rotulo}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="scale" />{v.tipo === 'E' ? 'Entradas' : 'Saídas'} · {v.periodo}<Icone nome="chevronRight" /><b>{v.rotulo}</b></span>
          <BotaoFechar onClick={vm.fecharVer} />
        </header>
        <div className="registro-corpo">
          {v.lancamentos.length ? (
            <div className="table-wrap fin-reajuste-lista">
              <table className="table-compact">
                <thead><tr><th>Data</th><th>Descrição</th><th className="num">Valor</th></tr></thead>
                <tbody>{v.lancamentos.map(l => (
                  <tr key={l.id}><td className="num">{dataBr(l.data)}</td><td>{l.descricao}</td><td className={'num ' + (v.tipo === 'E' ? 'fin-valor-entrada' : 'fin-valor-saida')}>{formatos.reais(l.valor)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="fraco">Nenhum lançamento.</p>}
        </div>
        <footer className="registro-pe">
          <span>{v.lancamentos.length} {v.lancamentos.length === 1 ? 'lançamento' : 'lançamentos'} · <b>{formatos.reais(v.total)}</b></span>
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={vm.fecharVer}>Fechar</button>
        </footer>
      </div>
    </div>
  );
}

export function ResultadoPorConta() {
  const vm = useResultadoPorConta();
  useCarregando(vm.carregando);
  const t = vm.totais;
  return (
    <section className="fin-painel">
      {vm.vendo && <JanelaDosLancamentos vm={vm} />}
      <div className="tarefas-barra-topo">
        <Segmentado valor={vm.visao} opcoes={vm.visoes} onMudar={vm.setVisao} />
        {vm.comparativo && <Segmentado valor={vm.periodo} opcoes={vm.periodos} onMudar={vm.setPeriodo} />}
        {vm.escolheMes
          ? <SeletorMes valor={vm.mes} onMudar={vm.setMes} rotulo="Mês" />
          : <MenuSuspenso rotulo={String(vm.ano)} icone="calendar" titulo="O ano" largura={140} itens={vm.anos.map(a => ({ rotulo: String(a), marcado: a === vm.ano, onClick: () => vm.setAno(a) }))} />}
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        <button type="button" className="btn btn-outline" onClick={vm.exportar}><Icone nome="download" />Exportar planilha</button>
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}

      {!vm.carregando && vm.vazio ? <Vazio icone="scale" titulo="Nenhum lançamento no período" /> : (
        <div className="card">
          <div className="table-wrap fin-resultado-wrap">
            <table className={'table-compact fin-resultado' + (vm.comparativo ? '' : ' fin-resultado-ano')}>
              <thead>
                <tr>
                  <th>
                    <span className="fin-resultado-cabeca">Conta
                      <button type="button" className="fin-resultado-tudo" onClick={vm.abrirTudo}>{vm.tudoAberto ? 'fechar os grupos' : 'abrir os grupos'}</button>
                    </span>
                  </th>
                  {vm.colunas.flatMap((c, i) => [<th key={c.chave} className="num">{c.rotulo}</th>, ...(vm.comparativo && i === 0 ? [<th key="var" className="num">Variação</th>] : [])])}
                  {!vm.comparativo && <th className="num">Total</th>}
                </tr>
              </thead>
              <tbody>
                <Bloco vm={vm} titulo="Entradas" linhas={vm.entradas} totais={t.entradas} />
                <Bloco vm={vm} titulo="Saídas" linhas={vm.saidas} totais={t.saidas} saida />
                <tr className="fin-resultado-final"><td>Resultado (entradas − saídas)</td><Valores vm={vm} valores={t.resultado} forte /></tr>
              </tbody>
            </table>
          </div>
          <p className="hint">Clique no nome da conta para ver os lançamentos {vm.comparativo ? 'do período' : 'do ano'}; a seta abre o grupo. A variação compara com o período anterior.</p>
        </div>
      )}
    </section>
  );
}
