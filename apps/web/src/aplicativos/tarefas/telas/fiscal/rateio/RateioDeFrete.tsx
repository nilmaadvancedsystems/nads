// Fiscal › Rateio de frete (Heverton, 22/10/2026: a planilha "RATEIO - FRETE"), de cima para baixo: (1) na barra, a empresa
// (a busca com lupa, com a lista embaixo; escolhida, vira o botão com borda que troca), o mês e Entradas ou Saídas; (2) as notas do mês numa tabela com busca, as com frete primeiro; (3) a
// nota escolhida numa linha (produtos, frete e desconto, editáveis), o rateio e, clicando numa linha, o frete pelos NCMs.
// "Sem XML? Digite os valores" faz a planilha à mão. Só as peças do catálogo (Busca com lupa, Botão com borda, SeletorMes,
// Segmentado, busca curta, Cartão, Tabela padrão, Linhas especiais, Valor editável, Botão fantasma, Alerta, Vazio, Esqueleto).
import { Alerta, BotaoIcone, Dica, Esqueleto, Icone, Segmentado, SeletorMes, useCarregando, Vazio } from '@nads/ui';
import { ValorEditavel } from '../../financeiro/partes/ValorEditavel';
import { EmpresaDaBarra } from '../partes/EmpresaDaBarra';
import { useRateioDeFrete, type VmRateioDeFrete } from './useRateioDeFrete';

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';

export function RateioDeFrete() {
  const vm = useRateioDeFrete();
  useCarregando(vm.carregando);
  const daNota = vm.fonte === 'nota';
  return (
    <section className="rateio-frete">
      <div className="tarefas-barra-topo">
        {daNota && (
          <>
            <EmpresaDaBarra vm={vm} id="rateio-empresas" />
            <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" />
            <Segmentado valor={vm.lado} onMudar={vm.setLado} opcoes={[{ valor: 'recebidas', rotulo: 'Entradas' }, { valor: 'emitidas', rotulo: 'Saídas' }]} />
          </>
        )}
        <span className="tarefas-barra-espaco" />
        {daNota
          ? <button type="button" className="btn btn-ghost" onClick={vm.digitar}>Sem XML? Digite os valores</button>
          : <button type="button" className="btn btn-ghost" onClick={vm.voltarAsNotas}><Icone nome="recibo" width={16} height={16} />Voltar às notas do SIEG</button>}
      </div>
      {vm.exemplos && daNota && <p className="hint drive-aviso">Dados de exemplo: a NF-e T502 das entradas tem os números da planilha.</p>}

      {!daNota ? <Digitar vm={vm} />
        : !vm.empresa ? <Vazio icone="caminhao" titulo="Escolha a empresa" texto="Depois o mês e a nota: o frete e o desconto vêm do XML do SIEG." />
        : vm.carregando ? <Esqueleto linhas={6} />
        : !vm.quantasNotas ? (
          <Vazio icone="recibo" titulo={'Nenhuma NF-e ' + (vm.lado === 'recebidas' ? 'de entrada' : 'de saída') + ' em ' + vm.rotuloCompetencia}
            texto={vm.semXml ? 'Os XMLs deste mês ainda não foram baixados do SIEG (na rotina do Fiscal).' : 'Troque o mês ou o lado.'}>
            <button type="button" className="btn btn-outline" onClick={vm.digitar}>Digitar os valores</button>
          </Vazio>
        )
        : !vm.nota ? <Notas vm={vm} /> : <Resultado vm={vm} />}
    </section>
  );
}

function Notas({ vm }: { vm: VmRateioDeFrete }) {
  return (
    <section className="card">
      <div className="card-head">
        <h3>Escolha a nota <span className="fraco">· {vm.quantasNotas} {vm.lado === 'recebidas' ? 'de entrada' : 'de saída'}</span></h3>
        <label className="busca-curta">
          <Icone nome="search" width={16} height={16} />
          <input type="text" placeholder="Número, data ou nome" aria-label="Buscar a nota" value={vm.buscaDaNota} onChange={e => vm.setBuscaDaNota(e.target.value)} />
        </label>
      </div>
      <div className="table-wrap">
        <table className="table-compact rateio-frete-notas">
          <thead><tr><th>Número</th><th>Data</th><th>{vm.lado === 'recebidas' ? 'Emitente' : 'Destinatário'}</th><th className="num">Valor</th><th className="num">Frete</th><th className="num">Desconto</th></tr></thead>
          <tbody>
            {vm.notas.map(n => (
              <tr key={n.chave} onClick={() => vm.escolherNota(n.chave)} title="Ratear o frete desta nota">
                <td><b>{n.numero}</b></td><td>{n.data}</td><td className="wrap">{n.parte}</td><td className="num">{brl(n.valor)}</td>
                <td className="num">{n.frete ? <b>{brl(n.frete)}</b> : <span className="fraco">—</span>}</td>
                <td className="num">{n.desconto ? brl(n.desconto) : <span className="fraco">—</span>}</td>
              </tr>
            ))}
            {!vm.notas.length && <tr><td colSpan={6} className="hint">Nenhuma nota com essa busca.</td></tr>}
          </tbody>
        </table>
      </div>
      {vm.notasFora > 0 && <p className="hint rateio-frete-dica">Mais {vm.notasFora} notas: use a busca.</p>}
    </section>
  );
}

function Resultado({ vm }: { vm: VmRateioDeFrete }) {
  const n = vm.nota!;
  return (
    <>
      <section className="card">
        <div className="card-head">
          <h3>{n.titulo} <span className="fraco">· {n.data} · {n.parte}</span></h3>
          <button type="button" className="btn btn-outline" onClick={vm.trocarNota}>Trocar a nota</button>
        </div>
        <Valores vm={vm} />
        {vm.estimado && <div className="rateio-frete-corpo"><Alerta naLinha titulo="Frete estimado" texto="A nota foi baixada antes de o nads guardar o frete: o valor veio da diferença do total da nota. Confira com o DANFE." /></div>}
        <Rateio vm={vm} />
      </section>
      {vm.ncms && <Ncms vm={vm} />}
    </>
  );
}

/** A linha com os valores: produtos, frete e desconto, cada um editável. */
function Valores({ vm }: { vm: VmRateioDeFrete }) {
  const daNota = vm.fonte === 'nota';
  return (
    <div className="rateio-frete-valores">
      <label>Produtos <ValorEditavel valor={vm.total} rotulo="Total dos produtos" aoSalvar={x => vm.mudar('total', x)} /></label>
      <label>Frete <ValorEditavel zeroVale valor={vm.frete} rotulo="Valor do frete" aoSalvar={x => vm.mudar('frete', x)} /></label>
      <label>Desconto <ValorEditavel zeroVale valor={vm.desconto} rotulo="Desconto" aoSalvar={x => vm.mudar('desconto', x)} /></label>
      {daNota && vm.mudouValores && <button type="button" className="btn btn-ghost" onClick={vm.voltarValores}>Voltar aos da nota</button>}
    </div>
  );
}

function Rateio({ vm }: { vm: VmRateioDeFrete }) {
  const r = vm.rateio;
  const daNota = vm.fonte === 'nota';
  if (!vm.linhas.length) return <Vazio compacto texto={daNota ? 'A nota não tem itens com valor.' : 'Digite o valor de pelo menos uma linha.'} />;
  return (
    <>
      <div className="rateio-frete-corpo rateio-frete-explica">
        {/* a explicação numa dica (23/10/2026: sem textos soltos na tela) */}
        <span className="rateio-frete-titulo">Rateio <Dica texto={'O frete e o desconto vão para cada linha na proporção do valor dela; a base é valor + IPI + frete − desconto.' + (daNota ? ' Clique numa linha para ver pelos NCMs.' : '')} /></span>
        {daNota && <Segmentado valor={vm.agrupar} onMudar={vm.setAgrupar} opcoes={[{ valor: 'tributacao', rotulo: 'Por tributação' }, { valor: 'cfop', rotulo: 'Por CFOP' }]} />}
      </div>
      <div className="table-wrap">
        <table className="table-compact">
          <thead>
            <tr><th>{daNota && vm.agrupar === 'cfop' ? 'CFOP' : 'Tributação'}</th><th className="num">Valor</th><th className="num">IPI</th><th className="num">%</th><th className="num">Frete</th><th className="num">Desconto</th><th className="num">Base de cálculo</th></tr>
          </thead>
          <tbody>
            {vm.linhas.map(l => (
              <tr key={l.id} className={(daNota ? 'rateio-frete-abre' : '') + (daNota && vm.aberto === l.id ? ' linha-atual' : '')} onClick={daNota ? () => vm.abrir(l.id) : undefined}>
                <td><b>{l.rotulo}</b>{l.detalhe && <span className="fraco"> · {l.detalhe}</span>}</td>
                <td className="num">{brl(l.valor)}</td><td className="num">{brl(l.ipi)}</td><td className="num">{pct(l.pct)}</td>
                <td className="num">{brl(l.frete)}</td><td className="num">{brl(l.desconto)}</td><td className="num"><b>{brl(l.base)}</b></td>
              </tr>
            ))}
            {r.foraDaLista && (
              <tr className="fraco">
                <td>Fora das linhas</td><td className="num">{brl(r.foraDaLista.valor)}</td><td className="num" /><td className="num">{pct((r.foraDaLista.valor * 100) / r.total)}</td>
                <td className="num">{brl(r.foraDaLista.frete)}</td><td className="num">{brl(r.foraDaLista.desconto)}</td><td className="num" />
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td><b>Total</b></td><td className="num"><b>{brl(r.total)}</b></td><td className="num"><b>{brl(r.soma.ipi)}</b></td><td className="num"><b>{pct(r.foraDaLista ? 100 : r.soma.pct)}</b></td>
              <td className="num"><b>{brl(r.frete)}</b></td><td className="num"><b>{brl(r.desconto)}</b></td><td className="num"><b>{brl(r.soma.base)}</b></td>
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
      <Valores vm={vm} />
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
