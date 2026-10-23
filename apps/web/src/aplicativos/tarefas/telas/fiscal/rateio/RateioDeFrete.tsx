// Fiscal › Rateio de frete (Heverton, 22/10/2026: a planilha "RATEIO - FRETE"; 23/10/2026: o frete vem do CT-e), de cima
// para baixo: (1) na barra, a empresa e o mês; (2) os CT-e recebidos no mês numa tabela com busca; (3) o CT-e escolhido numa
// linha (o valor, editável, e o ICMS), as NF-e que ele transporta (com o frete de cada uma; marcar outras), o rateio pelas
// tributações e, clicando numa linha, o frete pelos NCMs. "Sem XML? Digite os valores" faz a planilha à mão. Só as peças
// do catálogo (Busca com lupa, Botão com borda, SeletorMes, Segmentado, busca curta, Cartão, Tabela padrão, Linhas
// especiais, Checkbox, Valor editável, Botão fantasma, Dica, Alerta, Vazio, Esqueleto).
import { Alerta, BotaoIcone, Dica, Esqueleto, Icone, Segmentado, SeletorMes, useCarregando, Vazio } from '@nads/ui';
import { ValorEditavel } from '../../financeiro/partes/ValorEditavel';
import { EmpresaDaBarra } from '../partes/EmpresaDaBarra';
import { EspelhoDaNota } from '../partes/EspelhoDaNota';
import { useRateioDeFrete, type VmRateioDeFrete } from './useRateioDeFrete';

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';

export function RateioDeFrete() {
  const vm = useRateioDeFrete();
  useCarregando(vm.carregando);
  const doCte = vm.fonte === 'cte';
  return (
    <section className="rateio-frete">
      {vm.vendo && <EspelhoDaNota nota={vm.vendo} codigo={vm.empresa?.codigo} competencia={vm.competencia} fechar={vm.fecharNota} />}
      <div className="tarefas-barra-topo">
        {doCte && (
          <>
            <EmpresaDaBarra vm={vm} id="rateio-empresas" />
            <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" />
          </>
        )}
        <span className="tarefas-barra-espaco" />
        {doCte
          ? <button type="button" className="btn btn-ghost" onClick={vm.digitar}>Sem XML? Digite os valores</button>
          : <button type="button" className="btn btn-ghost" onClick={vm.voltarAsNotas}><Icone nome="caminhao" width={16} height={16} />Voltar aos CT-e do SIEG</button>}
      </div>
      {vm.exemplos && doCte && <p className="hint drive-aviso">Dados de exemplo: o CT-e T701 leva a NF-e T502, com os números da planilha.</p>}

      {!doCte ? <Digitar vm={vm} />
        : !vm.empresa ? <Vazio icone="caminhao" titulo="Escolha a empresa" texto="Depois o mês e o CT-e: o valor dele vai para as notas que ele transporta." />
        : vm.carregando ? <Esqueleto linhas={6} />
        : !vm.quantosCtes ? (
          <Vazio icone="caminhao" titulo={'Nenhum CT-e recebido em ' + vm.rotuloCompetencia}
            texto={vm.semXml ? 'Os XMLs deste mês ainda não foram baixados do SIEG (na rotina do Fiscal).' : 'Troque o mês.'}>
            <button type="button" className="btn btn-outline" onClick={vm.digitar}>Digitar os valores</button>
          </Vazio>
        )
        : !vm.cte ? <Ctes vm={vm} /> : <Resultado vm={vm} />}
    </section>
  );
}

function Ctes({ vm }: { vm: VmRateioDeFrete }) {
  return (
    <section className="card">
      <div className="card-head">
        <h3>Escolha o CT-e <span className="fraco">· {vm.quantosCtes} recebidos</span></h3>
        <label className="busca-curta">
          <Icone nome="search" width={16} height={16} />
          <input type="text" placeholder="Número, data ou transportadora" aria-label="Buscar o CT-e" value={vm.buscaDoCte} onChange={e => vm.setBuscaDoCte(e.target.value)} />
        </label>
      </div>
      <div className="table-wrap">
        <table className="table-compact rateio-frete-notas">
          <thead><tr><th>Número</th><th>Data</th><th>Transportadora</th><th className="num">Valor</th><th className="num">ICMS</th><th className="num">Notas</th><th aria-label="Ver o CT-e" /></tr></thead>
          <tbody>
            {vm.ctes.map(c => (
              <tr key={c.chave} onClick={() => vm.escolherCte(c.chave)} title="Ratear este CT-e">
                <td><b>{c.numero}</b></td><td>{c.data}</td><td className="wrap">{c.transportadora}</td><td className="num"><b>{brl(c.valor)}</b></td>
                <td className="num">{c.icms ? brl(c.icms) : <span className="fraco">—</span>}</td>
                <td className="num">{c.notas ?? <span className="fraco">—</span>}</td>
                <td className="nf-direita"><button type="button" className="btn btn-ghost btn-sm" title="Ver o CT-e" onClick={ev => { ev.stopPropagation(); vm.verNota(c.chave); }}><Icone nome="olho" width={14} height={14} />Ver</button></td>
              </tr>
            ))}
            {!vm.ctes.length && <tr><td colSpan={7} className="hint">Nenhum CT-e com essa busca.</td></tr>}
          </tbody>
        </table>
      </div>
      {vm.ctesFora > 0 && <p className="hint rateio-frete-dica">Mais {vm.ctesFora} CT-e: use a busca.</p>}
    </section>
  );
}

function Resultado({ vm }: { vm: VmRateioDeFrete }) {
  const c = vm.cte!;
  return (
    <>
      <section className="card">
        <div className="card-head">
          <h3>{c.titulo} <span className="fraco">· {c.data} · {c.transportadora}</span></h3>
          <span className="btn-row">
            <button type="button" className="btn btn-outline" onClick={() => vm.verNota(c.chave)}><Icone nome="olho" width={16} height={16} />Ver o CT-e</button>
            <button type="button" className="btn btn-outline" onClick={vm.trocarCte}>Trocar o CT-e</button>
          </span>
        </div>
        <div className="rateio-frete-valores">
          <label>Valor do CT-e <ValorEditavel zeroVale valor={vm.frete} rotulo="Valor do CT-e" aoSalvar={x => vm.mudar('frete', x)} /></label>
          {c.icms > 0 && <span className="rateio-frete-icms">ICMS do CT-e <b className="num">{brl(c.icms)}</b></span>}
          {vm.mudouValores && <button type="button" className="btn btn-ghost" onClick={vm.voltarValores}>Voltar ao do CT-e</button>}
        </div>
        {c.semNotas && <div className="rateio-frete-corpo"><Alerta naLinha titulo="Marque as notas que este CT-e leva" texto="Ele foi baixado antes de o nads guardar as notas do CT-e. Baixe os XMLs do SIEG de novo para elas virem sozinhas." /></div>}
        {c.faltam > 0 && <div className="rateio-frete-corpo"><Alerta naLinha titulo={c.faltam === 1 ? '1 nota do CT-e não está no SIEG' : c.faltam + ' notas do CT-e não estão no SIEG'} texto="Elas não estão nas entradas deste mês: o valor fica com as que estão. Baixe os XMLs do mês delas ou marque outras." /></div>}
        <NotasDoCte vm={vm} />
      </section>
      {vm.notasDoCte.length > 0 && (
        <section className="card">
          <Rateio vm={vm} />
        </section>
      )}
      {vm.ncms && <Ncms vm={vm} />}
    </>
  );
}

/** As NF-e que o CT-e leva, com o frete de cada uma; e a lista para marcar outras. */
function NotasDoCte({ vm }: { vm: VmRateioDeFrete }) {
  const total = vm.notasDoCte.reduce((t, n) => ({ produtos: t.produtos + n.produtos, frete: t.frete + n.frete }), { produtos: 0, frete: 0 });
  return (
    <>
      <div className="rateio-frete-corpo rateio-frete-explica">
        <span className="rateio-frete-titulo">Notas transportadas <Dica texto="O valor do CT-e vai para cada nota na proporção dos produtos dela." /></span>
        <span className="btn-row">
          {vm.mudouNotas && <button type="button" className="btn btn-ghost" onClick={vm.voltarNotas}>Voltar às do CT-e</button>}
          {vm.notasDoCte.length > 0 && <button type="button" className="btn btn-outline" onClick={vm.alternarEscolherNotas}>{vm.escolhendoNotas ? 'Pronto' : 'Marcar outras notas'}</button>}
        </span>
      </div>
      {vm.escolhendoNotas ? (
        <>
          <label className="busca-curta larga">
            <Icone nome="search" width={16} height={16} />
            <input type="text" placeholder="Número, data ou fornecedor" aria-label="Buscar a nota" value={vm.buscaDaNota} onChange={e => vm.setBuscaDaNota(e.target.value)} />
          </label>
          <div className="table-wrap">
            <table className="table-compact rateio-frete-notas">
              <thead><tr><th aria-label="Marcar" /><th>Número</th><th>Data</th><th>Emitente</th><th className="num">Valor</th><th /></tr></thead>
              <tbody>
                {vm.paraMarcar.map(n => (
                  <tr key={n.chave} className={n.marcada ? 'linha-atual' : undefined} onClick={() => vm.marcar(n.chave)}>
                    <td><input type="checkbox" checked={n.marcada} onChange={() => vm.marcar(n.chave)} onClick={e => e.stopPropagation()} aria-label={'Levada pelo CT-e: nota ' + n.numero} /></td>
                    <td><b>{n.numero}</b></td><td>{n.data}</td><td className="wrap">{n.emitente}</td><td className="num">{brl(n.valor)}</td>
                    <td>{n.doCte && <span className="badge badge-neutral">no CT-e</span>}</td>
                  </tr>
                ))}
                {!vm.paraMarcar.length && <tr><td colSpan={6} className="hint">Nenhuma NF-e de entrada com essa busca.</td></tr>}
              </tbody>
            </table>
          </div>
          {vm.paraMarcarFora > 0 && <p className="hint rateio-frete-dica">Mais {vm.paraMarcarFora} notas: use a busca.</p>}
        </>
      ) : (
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Número</th><th>Emitente</th><th className="num">Produtos</th><th className="num">%</th><th className="num">Frete</th><th aria-label="Ver a nota" /></tr></thead>
            <tbody>
              {vm.notasDoCte.map(n => (
                <tr key={n.chave}>
                  <td><b>{n.numero}</b></td><td className="wrap">{n.emitente}</td><td className="num">{brl(n.produtos)}</td><td className="num">{pct(n.pct)}</td><td className="num"><b>{brl(n.frete)}</b></td>
                  <td className="nf-direita"><button type="button" className="btn btn-ghost btn-sm" title="Ver a nota" onClick={() => vm.verNota(n.chave)}><Icone nome="olho" width={14} height={14} />Ver</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td><b>Total</b></td><td /><td className="num"><b>{brl(total.produtos)}</b></td><td className="num"><b>{pct(100)}</b></td><td className="num"><b>{brl(Math.round(total.frete * 100) / 100)}</b></td><td /></tr></tfoot>
          </table>
        </div>
      )}
    </>
  );
}

function Rateio({ vm }: { vm: VmRateioDeFrete }) {
  const r = vm.rateio;
  const doCte = vm.fonte === 'cte';
  if (!vm.linhas.length) return <Vazio compacto texto={doCte ? 'As notas não têm itens com valor.' : 'Digite o valor de pelo menos uma linha.'} />;
  return (
    <>
      <div className="rateio-frete-corpo rateio-frete-explica">
        {/* a explicação numa dica (23/10/2026: sem textos soltos na tela) */}
        <span className="rateio-frete-titulo">{doCte ? 'Pelas tributações' : 'Rateio'} <Dica texto={doCte ? 'O valor do CT-e vai para cada tributação na proporção dos itens das notas; a base é valor + IPI + frete. Clique numa linha para ver pelos NCMs.' : 'O frete e o desconto vão para cada linha na proporção do valor dela; a base é valor + IPI + frete − desconto.'} /></span>
        {doCte && <Segmentado valor={vm.agrupar} onMudar={vm.setAgrupar} opcoes={[{ valor: 'tributacao', rotulo: 'Por tributação' }, { valor: 'cfop', rotulo: 'Por CFOP' }]} />}
      </div>
      <div className="table-wrap">
        <table className="table-compact">
          <thead>
            <tr><th>{doCte && vm.agrupar === 'cfop' ? 'CFOP' : 'Tributação'}</th><th className="num">Valor</th><th className="num">IPI</th><th className="num">%</th><th className="num">Frete</th>{!doCte && <th className="num">Desconto</th>}<th className="num">Base de cálculo</th></tr>
          </thead>
          <tbody>
            {vm.linhas.map(l => (
              <tr key={l.id} className={(doCte ? 'rateio-frete-abre' : '') + (doCte && vm.aberto === l.id ? ' linha-atual' : '')} onClick={doCte ? () => vm.abrir(l.id) : undefined}>
                <td><b>{l.rotulo}</b>{l.detalhe && <span className="fraco"> · {l.detalhe}</span>}</td>
                <td className="num">{brl(l.valor)}</td><td className="num">{brl(l.ipi)}</td><td className="num">{pct(l.pct)}</td>
                <td className="num">{brl(l.frete)}</td>{!doCte && <td className="num">{brl(l.desconto)}</td>}<td className="num"><b>{brl(l.base)}</b></td>
              </tr>
            ))}
            {r.foraDaLista && (
              <tr className="fraco">
                <td>Fora das linhas</td><td className="num">{brl(r.foraDaLista.valor)}</td><td className="num" /><td className="num">{pct((r.foraDaLista.valor * 100) / r.total)}</td>
                <td className="num">{brl(r.foraDaLista.frete)}</td>{!doCte && <td className="num">{brl(r.foraDaLista.desconto)}</td>}<td className="num" />
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td><b>Total</b></td><td className="num"><b>{brl(r.total)}</b></td><td className="num"><b>{brl(r.soma.ipi)}</b></td><td className="num"><b>{pct(r.foraDaLista ? 100 : r.soma.pct)}</b></td>
              <td className="num"><b>{brl(r.frete)}</b></td>{!doCte && <td className="num"><b>{brl(r.desconto)}</b></td>}<td className="num"><b>{brl(r.soma.base)}</b></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

function Ncms({ vm }: { vm: VmRateioDeFrete }) {
  const d = vm.ncms!;
  return (
    <section className="card">
      <div className="card-head">
        <h3>{vm.grupoAberto} <span className="fraco">· pelos NCMs</span></h3>
        <BotaoIcone icone="x" pequeno titulo="Fechar" onClick={() => vm.abrir(vm.aberto)} />
      </div>
      <div className="table-wrap">
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
            <tr><td><b>Total</b></td><td className="num"><b>{brl(d.soma.valor)}</b></td><td className="num"><b>{brl(d.soma.ipi)}</b></td><td className="num"><b>{pct(d.soma.pct)}</b></td>
              <td className="num"><b>{brl(d.soma.frete)}</b></td><td className="num"><b>{brl(d.soma.desconto)}</b></td><td className="num"><b>{brl(d.soma.base)}</b></td></tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function Digitar({ vm }: { vm: VmRateioDeFrete }) {
  return (
    <section className="card">
      <h3>Rateio digitado</h3>
      <div className="rateio-frete-valores">
        <label>Produtos <ValorEditavel valor={vm.total} rotulo="Total dos produtos" aoSalvar={x => vm.mudar('total', x)} /></label>
        <label>Frete <ValorEditavel zeroVale valor={vm.frete} rotulo="Valor do frete" aoSalvar={x => vm.mudar('frete', x)} /></label>
        <label>Desconto <ValorEditavel zeroVale valor={vm.desconto} rotulo="Desconto" aoSalvar={x => vm.mudar('desconto', x)} /></label>
      </div>
      <div className="table-wrap">
        <table className="table-compact">
          <thead><tr><th>Tributação (ou CFOP, NCM)</th><th className="num">Valor</th><th className="num">IPI</th><th /></tr></thead>
          <tbody>
            {vm.digitadas.map((l, i) => (
              <tr key={i}>
                <td><input type="text" className="fin-valor-edita" aria-label={'Tributação da linha ' + (i + 1)} placeholder={i === 0 ? 'Ex.: 2102' : 'Ex.: 2403'} value={l.rotulo} onChange={e => vm.mudarDigitada(i, 'rotulo', e.target.value)} /></td>
                <td className="num"><input type="text" inputMode="decimal" className="fin-valor-edita num" aria-label={'Valor da linha ' + (i + 1)} placeholder="0,00" value={l.valor} onChange={e => vm.mudarDigitada(i, 'valor', e.target.value)} /></td>
                <td className="num"><input type="text" inputMode="decimal" className="fin-valor-edita num" aria-label={'IPI da linha ' + (i + 1)} placeholder="0,00" value={l.ipi} onChange={e => vm.mudarDigitada(i, 'ipi', e.target.value)} /></td>
                <td><BotaoIcone icone="x" pequeno titulo="Tirar a linha" onClick={() => vm.tirarLinha(i)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rateio-frete-corpo"><button type="button" className="btn btn-outline" onClick={vm.novaLinha}><Icone nome="plus" width={16} height={16} />Nova linha</button></div>
      <Rateio vm={vm} />
    </section>
  );
}
