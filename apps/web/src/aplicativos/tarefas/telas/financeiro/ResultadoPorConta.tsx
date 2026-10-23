// Financeiro › Painel › Resultado por conta (22/10/2026: "quero melhorar a aba de resultados"; no mesmo dia, "remova a
// explicação e melhore a tabela para ficar com melhor entendimento… a aba de resultado vai virar um botão no painel"):
// uma janela flutuante, aberta pelo Painel, com duas visões — o Comparativo (o mês, o trimestre ou o ano; cada coluna de
// comparação com a sua variação ao lado, e o peso de cada conta no total) e o Ano mês a mês (jan a dez, o total e o
// peso) —, as contas pela árvore do plano (o grupo abre e fecha na seta; o nome abre os lançamentos) e o Exportar planilha.
// Só as peças do catálogo (Segmentado, SeletorMes, MenuSuspenso, Tabela, Vazio e a janela do desenho das outras).
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
/** o nome de cada coluna do comparativo: o período e o que ele é */
const PAPEL = ['atual', 'período anterior', 'ano passado'];

function Variacao({ v, saida }: { v: number | null; saida?: boolean }) {
  if (v == null) return <span className="fraco">—</span>;
  // na saída, subir é ruim (vermelho); na entrada e no resultado, subir é bom (verde)
  const bom = saida ? v <= 0 : v >= 0;
  if (v === 0) return <span className="fraco">0%</span>;
  return <span className={'fin-variacao ' + (bom ? 'fin-valor-entrada' : 'fin-valor-saida')}>{v > 0 ? '▲' : '▼'} {Math.abs(v).toLocaleString('pt-BR')}%</span>;
}

/** o peso no total do bloco (as entradas ou as saídas), em % com uma casa */
function Peso({ v, total }: { v: number; total: number }) {
  if (!v || !total) return <span className="fraco">—</span>;
  return <span className="fin-peso">{(Math.round((v / total) * 1000) / 10).toLocaleString('pt-BR')}%</span>;
}

/**
 * As células de valor de uma linha. No comparativo: o atual, o peso, e cada comparação seguida da variação do atual sobre
 * ela. No ano: os doze meses, o total e o peso. O peso só nas contas (não nos totais nem no resultado).
 */
function Valores({ vm, valores, total, saida, forte }: { vm: Vm; valores: number[]; total?: number; saida?: boolean; forte?: boolean }) {
  const celulas = [];
  if (vm.comparativo) {
    celulas.push(<td key="a" className={'num fin-resultado-atual ' + (forte ? cor(valores[0], saida) : !valores[0] ? 'fraco' : '')}>{reais(valores[0])}</td>);
    celulas.push(<td key="p" className="num">{total != null ? <Peso v={valores[0]} total={total} /> : null}</td>);
    for (let i = 1; i < valores.length; i++) {
      celulas.push(<td key={'v' + i} className="num fin-resultado-antes fin-resultado-inicio">{reais(valores[i])}</td>);
      celulas.push(<td key={'x' + i} className="num"><Variacao v={financeiro.variacao(valores[0], valores[i])} saida={saida} /></td>);
    }
  } else {
    for (const [i, v] of valores.entries()) celulas.push(<td key={i} className={'num ' + (!v ? 'fraco' : '')}>{reais(v)}</td>);
    const t = somar(valores);
    celulas.push(<td key="t" className={'num fin-resultado-total-col ' + (forte ? cor(t, saida) : '')}>{reais(t)}</td>);
    celulas.push(<td key="p" className="num">{total != null ? <Peso v={t} total={total} /> : null}</td>);
  }
  return <>{celulas}</>;
}

function Bloco({ vm, titulo, linhas, totais, saida, colunas }: { vm: Vm; titulo: string; linhas: LinhaVisivel[]; totais: number[]; saida?: boolean; colunas: number }) {
  // o total do bloco no período que o peso usa: o atual (comparativo) ou o ano inteiro
  const base = vm.comparativo ? totais[0] : somar(totais);
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
          <Valores vm={vm} valores={l.linha.valores} total={base} saida={saida} />
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

/** A janela flutuante do resultado por conta (aberta pelo botão do Painel). */
export function JanelaDoResultado({ fechar }: { fechar: () => void }) {
  const vm = useResultadoPorConta();
  useCarregando(vm.carregando);
  const janela = useRef<HTMLDivElement>(null);
  // com os lançamentos abertos por cima, o Esc fecha só eles
  useJanela(janela, () => { if (!vm.vendo) fechar(); });
  const t = vm.totais;
  const colunas = 1 + (vm.comparativo ? 2 + (vm.colunas.length - 1) * 2 : vm.colunas.length + 2);
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      {vm.vendo && <JanelaDosLancamentos vm={vm} />}
      <div ref={janela} className="modal registro-novo fin-resultado-janela" role="dialog" aria-modal="true" aria-label="Resultado por conta">
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="scale" />Financeiro<Icone nome="chevronRight" /><b>Resultado por conta</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo fin-resultado-corpo">
          <div className="tarefas-barra-topo">
            <Segmentado valor={vm.visao} opcoes={vm.visoes} onMudar={vm.setVisao} />
            {vm.comparativo && <Segmentado valor={vm.periodo} opcoes={vm.periodos} onMudar={vm.setPeriodo} />}
            {vm.escolheMes
              ? <SeletorMes valor={vm.mes} onMudar={vm.setMes} rotulo="Mês" />
              : <MenuSuspenso rotulo={String(vm.ano)} icone="calendar" titulo="O ano" largura={140} itens={vm.anos.map(a => ({ rotulo: String(a), marcado: a === vm.ano, onClick: () => vm.setAno(a) }))} />}
            <span className="tarefas-barra-espaco" />
            {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
          </div>
          {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}

          {!vm.carregando && vm.vazio ? <Vazio icone="scale" titulo="Nenhum lançamento no período" /> : (
            <div className="table-wrap fin-resultado-wrap">
              <table className={'table-compact fin-resultado' + (vm.comparativo ? '' : ' fin-resultado-ano')}>
                <thead>
                  <tr>
                    <th>
                      <span className="fin-resultado-cabeca">Conta
                        <button type="button" className="fin-resultado-tudo" onClick={vm.abrirTudo}>{vm.tudoAberto ? 'fechar os grupos' : 'abrir os grupos'}</button>
                      </span>
                    </th>
                    {vm.comparativo ? (
                      vm.colunas.flatMap((c, i) => i === 0
                        ? [<th key={c.chave} className="num fin-resultado-atual"><span className="fin-resultado-col">{c.rotulo}<small>{PAPEL[0]}</small></span></th>, <th key="p" className="num"><span className="fin-resultado-col">% do total<small>no {c.rotulo}</small></span></th>]
                        : [<th key={c.chave} className="num fin-resultado-inicio"><span className="fin-resultado-col">{c.rotulo}<small>{i === 1 ? (vm.periodo === 'ano' ? 'ano anterior' : vm.periodo === 'trimestre' ? 'trimestre anterior' : 'mês anterior') : PAPEL[i]}</small></span></th>, <th key={'x' + i} className="num"><span className="fin-resultado-col">Variação<small>sobre {c.rotulo}</small></span></th>])
                    ) : (
                      <>
                        {vm.colunas.map(c => <th key={c.chave} className="num">{c.rotulo}</th>)}
                        <th className="num">Total</th>
                        <th className="num">% do total</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  <Bloco vm={vm} titulo="Entradas" linhas={vm.entradas} totais={t.entradas} colunas={colunas} />
                  <Bloco vm={vm} titulo="Saídas" linhas={vm.saidas} totais={t.saidas} saida colunas={colunas} />
                  <tr className="fin-resultado-final"><td>Resultado (entradas − saídas)</td><Valores vm={vm} valores={t.resultado} forte /></tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
        <footer className="registro-pe">
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={vm.exportar}><Icone nome="download" />Exportar planilha</button>
          <button type="button" className="btn btn-outline" onClick={fechar}>Fechar</button>
        </footer>
      </div>
    </div>
  );
}
