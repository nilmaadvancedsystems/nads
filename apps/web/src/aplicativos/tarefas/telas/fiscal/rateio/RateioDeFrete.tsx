// Fiscal › Rateio de frete (Heverton, 22/10/2026: a planilha "RATEIO - FRETE"; 23/10/2026: o frete vem do CT-e; 30/10/2026:
// refeita para "parecer parte do site", no modelo do Gmail), de cima para baixo: (1) na barra, a empresa e o mês; (2) os
// CT-e recebidos no mês num cartão com busca, uma linha por CT-e; (3) o CT-e escolhido num cartão com os números dele em
// faixa (o valor, editável, o ICMS e quantas notas), as NF-e que ele transporta (com o frete de cada uma; marcar outras),
// o rateio pelas tributações e, clicando numa linha, o frete pelos NCMs, cada um no seu cartão. "Sem XML? Digite os
// valores" faz a planilha à mão. Só as peças do catálogo (Busca com lupa, Botão com borda, SeletorMes, Segmentado, busca
// curta, Cartão, Tabela padrão, Checkbox, Valor editável, Botão fantasma, Dica, Alerta, Vazio, Esqueleto).
import { Alerta, BotaoIcone, Dica, Esqueleto, Icone, Segmentado, SeletorMes, useCarregando, Vazio } from '@nads/ui';
import type { KeyboardEvent, ReactNode } from 'react';
import { ValorEditavel } from '../../financeiro/partes/ValorEditavel';
import { EmpresaDaBarra } from '../partes/EmpresaDaBarra';
import { EspelhoDaNota } from '../partes/EspelhoDaNota';
import { useRateioDeFrete, type VmRateioDeFrete } from './useRateioDeFrete';

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
/** a linha que se escolhe também pelo teclado (Enter ou espaço) */
const peloTeclado = (fazer: () => void) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fazer(); } };

export function RateioDeFrete() {
  const vm = useRateioDeFrete();
  useCarregando(vm.carregando);
  const doCte = vm.fonte === 'cte';
  return (
    <section className="fc">
      {vm.vendo && <EspelhoDaNota nota={vm.vendo} codigo={vm.empresa?.codigo} competencia={vm.competencia} fechar={vm.fecharNota} />}
      <div className="tarefas-barra-topo fc-topo">
        {doCte && (
          <>
            <EmpresaDaBarra vm={vm} id="rateio-empresas" />
            <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" />
          </>
        )}
        <span className="tarefas-barra-espaco" />
        {doCte
          ? <button type="button" className="btn btn-ghost" onClick={vm.digitar}><Icone nome="lapis" width={16} height={16} />Sem XML? Digite os valores</button>
          : <button type="button" className="btn btn-ghost" onClick={vm.voltarAsNotas}><Icone nome="caminhao" width={16} height={16} />Voltar aos CT-e do SIEG</button>}
      </div>
      {vm.exemplos && doCte && <p className="hint fc-exemplo">Dados de exemplo: o CT-e T701 leva a NF-e T502, com os números da planilha.</p>}

      {!doCte ? <Digitar vm={vm} />
        : !vm.empresa ? <div className="card fc-cartao"><Vazio icone="caminhao" titulo="Escolha a empresa" texto="Depois o mês e o CT-e: o valor dele vai para as notas que ele transporta." /></div>
        : vm.carregando ? <Esqueleto linhas={6} />
        : !vm.quantosCtes ? (
          <div className="card fc-cartao">
            <Vazio icone="caminhao" titulo={'Nenhum CT-e recebido em ' + vm.rotuloCompetencia}
              texto={vm.semXml ? 'Os XMLs deste mês ainda não foram baixados do SIEG (na rotina do Fiscal).' : 'Troque o mês.'}>
              <button type="button" className="btn btn-outline" onClick={vm.digitar}>Digitar os valores</button>
            </Vazio>
          </div>
        )
        : !vm.cte ? <Ctes vm={vm} /> : <Resultado vm={vm} />}
    </section>
  );
}

/** o topo de um cartão: o título (com a dica e a contagem) e, à direita, as ações */
function Topo({ titulo, dica, contagem, children }: { titulo: ReactNode; dica?: string; contagem?: ReactNode; children?: ReactNode }) {
  return (
    <header className="fc-cartao-topo">
      <h3 className="fc-cartao-titulo">{titulo}{dica && <Dica texto={dica} />}</h3>
      {contagem != null && <span className="fc-contagem">{contagem}</span>}
      {children && <span className="fc-acoes">{children}</span>}
    </header>
  );
}

function Ctes({ vm }: { vm: VmRateioDeFrete }) {
  return (
    <section className="card fc-cartao">
      <Topo titulo={'CT-e recebidos em ' + vm.rotuloCompetencia} contagem={vm.quantosCtes === 1 ? '1 CT-e' : vm.quantosCtes + ' CT-e'}>
        <label className="busca-curta fc-busca">
          <Icone nome="search" width={16} height={16} />
          <input type="text" placeholder="Número, data ou transportadora" aria-label="Buscar o CT-e" value={vm.buscaDoCte} onChange={e => vm.setBuscaDoCte(e.target.value)} />
        </label>
      </Topo>
      <div className="table-wrap fc-tabela">
        <table className="table-compact fc-clicavel">
          <thead><tr><th>Número</th><th>Data</th><th>Transportadora</th><th className="num">Valor</th><th className="num">ICMS</th><th className="num">Notas</th><th aria-label="Ver o CT-e" /></tr></thead>
          <tbody>
            {vm.ctes.map(c => (
              <tr key={c.chave} tabIndex={0} onClick={() => vm.escolherCte(c.chave)} onKeyDown={peloTeclado(() => vm.escolherCte(c.chave))} title="Ratear este CT-e">
                <td><b>{c.numero}</b></td><td>{c.data}</td><td className="wrap">{c.transportadora}</td><td className="num"><b>{brl(c.valor)}</b></td>
                <td className="num">{c.icms ? brl(c.icms) : <span className="fraco">—</span>}</td>
                <td className="num">{c.notas ?? <span className="fraco">—</span>}</td>
                <td className="fc-acao">
                  <BotaoIcone icone="olho" pequeno titulo="Ver o CT-e" onClick={ev => { ev.stopPropagation(); vm.verNota(c.chave); }} onKeyDown={ev => ev.stopPropagation()} />
                  <Icone nome="chevronRight" className="fc-seta" />
                </td>
              </tr>
            ))}
            {!vm.ctes.length && <tr><td colSpan={7} className="hint">Nenhum CT-e com essa busca.</td></tr>}
          </tbody>
        </table>
      </div>
      {vm.ctesFora > 0 && <p className="fc-pe">Mais {vm.ctesFora} CT-e: use a busca.</p>}
    </section>
  );
}

function Resultado({ vm }: { vm: VmRateioDeFrete }) {
  const c = vm.cte!;
  return (
    <>
      <section className="card fc-cartao">
        <header className="fc-cartao-topo fc-cte">
          <span className="fc-cte-icone" aria-hidden="true"><Icone nome="caminhao" /></span>
          <span className="fc-cte-txt">
            <h3 className="fc-cartao-titulo">{c.titulo}</h3>
            <span className="fc-sub">{c.data} · {c.transportadora}</span>
          </span>
          <span className="fc-acoes">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => vm.verNota(c.chave)}><Icone nome="olho" />Ver o CT-e</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={vm.trocarCte}><Icone nome="repeat" />Trocar o CT-e</button>
          </span>
        </header>
        <div className="fc-valores">
          <label className="fc-valor"><span className="fc-rotulo">Valor do CT-e</span><ValorEditavel zeroVale valor={vm.frete} rotulo="Valor do CT-e" aoSalvar={x => vm.mudar('frete', x)} /></label>
          {c.icms > 0 && <span className="fc-valor"><span className="fc-rotulo">ICMS do CT-e</span><b className="num">{brl(c.icms)}</b></span>}
          <span className="fc-valor"><span className="fc-rotulo">Notas</span><b className="num">{vm.notasDoCte.length}</b></span>
          {vm.mudouValores && <span className="fc-valor fc-valor-acao"><button type="button" className="btn btn-ghost btn-sm" onClick={vm.voltarValores}><Icone nome="girar" />Voltar ao do CT-e</button></span>}
        </div>
        {(c.semNotas || c.faltam > 0) && (
          <div className="fc-corpo">
            {c.semNotas && <Alerta naLinha titulo="Marque as notas que este CT-e leva" texto="Ele foi baixado antes de o nads guardar as notas do CT-e. Baixe os XMLs do SIEG de novo para elas virem sozinhas." />}
            {c.faltam > 0 && <Alerta naLinha titulo={c.faltam === 1 ? '1 nota do CT-e não está no SIEG' : c.faltam + ' notas do CT-e não estão no SIEG'} texto="Elas não estão nas entradas deste mês: o valor fica com as que estão. Baixe os XMLs do mês delas ou marque outras." />}
          </div>
        )}
      </section>
      <NotasDoCte vm={vm} />
      {vm.notasDoCte.length > 0 && <Rateio vm={vm} />}
      {vm.ncms && <Ncms vm={vm} />}
    </>
  );
}

/** As NF-e que o CT-e leva, com o frete de cada uma; e a lista para marcar outras. */
function NotasDoCte({ vm }: { vm: VmRateioDeFrete }) {
  const total = vm.notasDoCte.reduce((t, n) => ({ produtos: t.produtos + n.produtos, frete: t.frete + n.frete }), { produtos: 0, frete: 0 });
  return (
    <section className="card fc-cartao">
      <Topo titulo="Notas transportadas" dica="O valor do CT-e vai para cada nota na proporção dos produtos dela.">
        {vm.mudouNotas && <button type="button" className="btn btn-ghost btn-sm" onClick={vm.voltarNotas}>Voltar às do CT-e</button>}
        {vm.notasDoCte.length > 0 && <button type="button" className={'btn btn-sm ' + (vm.escolhendoNotas ? 'btn-primary' : 'btn-outline')} onClick={vm.alternarEscolherNotas}>{vm.escolhendoNotas ? 'Pronto' : 'Marcar outras notas'}</button>}
      </Topo>
      {vm.escolhendoNotas ? (
        <>
          <div className="fc-corpo fc-corpo-busca">
            <label className="busca-curta larga">
              <Icone nome="search" width={16} height={16} />
              <input type="text" placeholder="Número, data ou fornecedor" aria-label="Buscar a nota" value={vm.buscaDaNota} onChange={e => vm.setBuscaDaNota(e.target.value)} />
            </label>
          </div>
          <div className="table-wrap fc-tabela">
            <table className="table-compact fc-clicavel">
              <thead><tr><th aria-label="Marcar" /><th>Número</th><th>Data</th><th>Emitente</th><th className="num">Valor</th><th /></tr></thead>
              <tbody>
                {vm.paraMarcar.map(n => (
                  <tr key={n.chave} className={n.marcada ? 'fc-marcada' : undefined} onClick={() => vm.marcar(n.chave)}>
                    <td><input type="checkbox" checked={n.marcada} onChange={() => vm.marcar(n.chave)} onClick={e => e.stopPropagation()} aria-label={'Levada pelo CT-e: nota ' + n.numero} /></td>
                    <td><b>{n.numero}</b></td><td>{n.data}</td><td className="wrap">{n.emitente}</td><td className="num">{brl(n.valor)}</td>
                    <td>{n.doCte && <span className="badge badge-suave badge-neutral">no CT-e</span>}</td>
                  </tr>
                ))}
                {!vm.paraMarcar.length && <tr><td colSpan={6} className="hint">Nenhuma NF-e de entrada com essa busca.</td></tr>}
              </tbody>
            </table>
          </div>
          {vm.paraMarcarFora > 0 && <p className="fc-pe">Mais {vm.paraMarcarFora} notas: use a busca.</p>}
        </>
      ) : (
        <div className="table-wrap fc-tabela">
          <table className="table-compact">
            <thead><tr><th>Número</th><th>Emitente</th><th className="num">Produtos</th><th className="num">%</th><th className="num">Frete</th><th aria-label="Ver a nota" /></tr></thead>
            <tbody>
              {vm.notasDoCte.map(n => (
                <tr key={n.chave}>
                  <td><b>{n.numero}</b></td><td className="wrap">{n.emitente}</td><td className="num">{brl(n.produtos)}</td><td className="num">{pct(n.pct)}</td><td className="num"><b>{brl(n.frete)}</b></td>
                  <td className="fc-acao"><BotaoIcone icone="olho" pequeno titulo="Ver a nota" onClick={() => vm.verNota(n.chave)} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td>Total</td><td /><td className="num">{brl(total.produtos)}</td><td className="num">{pct(100)}</td><td className="num">{brl(Math.round(total.frete * 100) / 100)}</td><td /></tr></tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

function Rateio({ vm }: { vm: VmRateioDeFrete }) {
  const r = vm.rateio;
  const doCte = vm.fonte === 'cte';
  return (
    <section className="card fc-cartao">
      {/* a explicação numa dica (23/10/2026: sem textos soltos na tela) */}
      <Topo titulo={doCte ? 'Pelas tributações' : 'Rateio'} dica={doCte ? 'O valor do CT-e vai para cada tributação na proporção dos itens das notas; a base é valor + IPI + frete. Clique numa linha para ver pelos NCMs.' : 'O frete e o desconto vão para cada linha na proporção do valor dela; a base é valor + IPI + frete − desconto.'}>
        {doCte && <Segmentado valor={vm.agrupar} onMudar={vm.setAgrupar} opcoes={[{ valor: 'tributacao', rotulo: 'Por tributação' }, { valor: 'cfop', rotulo: 'Por CFOP' }]} />}
      </Topo>
      {!vm.linhas.length ? <Vazio compacto texto={doCte ? 'As notas não têm itens com valor.' : 'Digite o valor de pelo menos uma linha.'} /> : (
        <div className="table-wrap fc-tabela">
          <table className={'table-compact' + (doCte ? ' fc-clicavel' : '')}>
            <thead>
              <tr><th>{doCte && vm.agrupar === 'cfop' ? 'CFOP' : 'Tributação'}</th><th className="num">Valor</th><th className="num">IPI</th><th className="num">%</th><th className="num">Frete</th>{!doCte && <th className="num">Desconto</th>}<th className="num">Base de cálculo</th>{doCte && <th aria-label="Pelos NCMs" />}</tr>
            </thead>
            <tbody>
              {vm.linhas.map(l => (
                <tr key={l.id} className={doCte && vm.aberto === l.id ? 'fc-marcada' : undefined} tabIndex={doCte ? 0 : undefined} aria-expanded={doCte ? vm.aberto === l.id : undefined}
                  onClick={doCte ? () => vm.abrir(l.id) : undefined} onKeyDown={doCte ? peloTeclado(() => vm.abrir(l.id)) : undefined}>
                  <td><b>{l.rotulo}</b>{l.detalhe && <span className="fraco"> · {l.detalhe}</span>}</td>
                  <td className="num">{brl(l.valor)}</td><td className="num">{brl(l.ipi)}</td><td className="num">{pct(l.pct)}</td>
                  <td className="num">{brl(l.frete)}</td>{!doCte && <td className="num">{brl(l.desconto)}</td>}<td className="num"><b>{brl(l.base)}</b></td>
                  {doCte && <td className="fc-acao"><Icone nome="chevronRight" className="fc-seta" /></td>}
                </tr>
              ))}
              {r.foraDaLista && (
                <tr className="fraco">
                  <td>Fora das linhas</td><td className="num">{brl(r.foraDaLista.valor)}</td><td className="num" /><td className="num">{pct((r.foraDaLista.valor * 100) / r.total)}</td>
                  <td className="num">{brl(r.foraDaLista.frete)}</td>{!doCte && <td className="num">{brl(r.foraDaLista.desconto)}</td>}<td className="num" />{doCte && <td />}
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td><td className="num">{brl(r.total)}</td><td className="num">{brl(r.soma.ipi)}</td><td className="num">{pct(r.foraDaLista ? 100 : r.soma.pct)}</td>
                <td className="num">{brl(r.frete)}</td>{!doCte && <td className="num">{brl(r.desconto)}</td>}<td className="num">{brl(r.soma.base)}</td>{doCte && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

function Ncms({ vm }: { vm: VmRateioDeFrete }) {
  const d = vm.ncms!;
  return (
    <section className="card fc-cartao">
      <Topo titulo={<>{vm.grupoAberto} <span className="fraco">· pelos NCMs</span></>}>
        <BotaoIcone icone="x" pequeno titulo="Fechar" onClick={() => vm.abrir(vm.aberto)} />
      </Topo>
      <div className="table-wrap fc-tabela">
        <table className="table-compact">
          <thead><tr><th>NCM</th><th className="num">Valor</th><th className="num">IPI</th><th className="num">%</th><th className="num">Frete</th><th className="num">Desconto</th><th className="num">Base de cálculo</th></tr></thead>
          <tbody>
            {d.linhas.map(l => (
              <tr key={l.rotulo}>
                <td><b>{l.rotulo}</b></td><td className="num">{brl(l.valor)}</td><td className="num">{brl(l.ipi)}</td><td className="num">{pct(l.pct)}</td>
                <td className="num">{brl(l.frete)}</td><td className="num">{brl(l.desconto)}</td><td className="num"><b>{brl(l.base)}</b></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td>Total</td><td className="num">{brl(d.soma.valor)}</td><td className="num">{brl(d.soma.ipi)}</td><td className="num">{pct(d.soma.pct)}</td>
              <td className="num">{brl(d.soma.frete)}</td><td className="num">{brl(d.soma.desconto)}</td><td className="num">{brl(d.soma.base)}</td></tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function Digitar({ vm }: { vm: VmRateioDeFrete }) {
  return (
    <>
      <section className="card fc-cartao">
        <Topo titulo="Rateio digitado" dica="Sem o XML: digite o total dos produtos, o frete, o desconto e o valor de cada tributação (ou CFOP, NCM)." />
        <div className="fc-valores">
          <label className="fc-valor"><span className="fc-rotulo">Produtos</span><ValorEditavel valor={vm.total} rotulo="Total dos produtos" aoSalvar={x => vm.mudar('total', x)} /></label>
          <label className="fc-valor"><span className="fc-rotulo">Frete</span><ValorEditavel zeroVale valor={vm.frete} rotulo="Valor do frete" aoSalvar={x => vm.mudar('frete', x)} /></label>
          <label className="fc-valor"><span className="fc-rotulo">Desconto</span><ValorEditavel zeroVale valor={vm.desconto} rotulo="Desconto" aoSalvar={x => vm.mudar('desconto', x)} /></label>
        </div>
        <div className="table-wrap fc-tabela">
          <table className="table-compact fc-digitadas">
            <thead><tr><th>Tributação (ou CFOP, NCM)</th><th className="num">Valor</th><th className="num">IPI</th><th aria-label="Tirar" /></tr></thead>
            <tbody>
              {vm.digitadas.map((l, i) => (
                <tr key={i}>
                  <td><input type="text" className="fin-valor-edita" aria-label={'Tributação da linha ' + (i + 1)} placeholder={i === 0 ? 'Ex.: 2102' : 'Ex.: 2403'} value={l.rotulo} onChange={e => vm.mudarDigitada(i, 'rotulo', e.target.value)} /></td>
                  <td className="num"><input type="text" inputMode="decimal" className="fin-valor-edita num" aria-label={'Valor da linha ' + (i + 1)} placeholder="0,00" value={l.valor} onChange={e => vm.mudarDigitada(i, 'valor', e.target.value)} /></td>
                  <td className="num"><input type="text" inputMode="decimal" className="fin-valor-edita num" aria-label={'IPI da linha ' + (i + 1)} placeholder="0,00" value={l.ipi} onChange={e => vm.mudarDigitada(i, 'ipi', e.target.value)} /></td>
                  <td className="fc-acao"><BotaoIcone icone="x" pequeno titulo="Tirar a linha" onClick={() => vm.tirarLinha(i)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="fc-pe"><button type="button" className="btn btn-outline btn-sm" onClick={vm.novaLinha}><Icone nome="plus" />Nova linha</button></div>
      </section>
      <Rateio vm={vm} />
    </>
  );
}
