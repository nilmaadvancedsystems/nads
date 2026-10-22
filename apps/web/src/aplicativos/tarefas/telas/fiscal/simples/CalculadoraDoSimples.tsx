// Fiscal › Simples (Heverton, 22/10/2026: a planilha do Simples Nacional do Fiscal): a empresa, a competência e o anexo em
// cima; os números (RBT12, a receita do mês segregada e a folha do Fator R), cada um editável e com a fonte; e as contas da
// planilha: a alíquota efetiva, o percentual e o valor de cada tributo por parcela da receita, e o Fator R. Só as peças do
// catálogo (busca de cliente com lista, SeletorMes, Segmentado, Stat, Tabela padrão, Valor editável, selo suave, Alerta, Vazio).
import { Alerta, BotaoIcone, Esqueleto, Icone, Segmentado, SeletorMes, Stat, useCarregando, Vazio } from '@nads/ui';
import { tarefas as t } from '@nads/core';
import { ValorEditavel } from '../../financeiro/partes/ValorEditavel';
import { useCalculadoraDoSimples, type NumeroDoSimples, type VmCalculadoraDoSimples } from './useCalculadoraDoSimples';

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%');
const TOM_DA_FONTE: Record<string, string> = { SIEG: 'badge-ok', 'Folha do DP': 'badge-ok', 'FGTS Digital': 'badge-ok', Digitado: 'badge-warn' };

export function CalculadoraDoSimples() {
  const vm = useCalculadoraDoSimples();
  useCarregando(vm.carregando);
  return (
    <section className="simples-calc">
      <div className="tarefas-barra-topo">
        <EscolherEmpresa vm={vm} />
        <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" />
        <span className="tarefas-barra-espaco" />
        {vm.temDigitado && <button type="button" className="btn btn-outline" onClick={vm.limpar}><Icone nome="girar" width={16} height={16} />Voltar aos números do nads</button>}
      </div>
      {vm.exemplos && <p className="hint drive-aviso">Dados de exemplo: as saídas, os XMLs, a folha e as guias são inventados.</p>}
      {!vm.empresa ? (
        <Vazio icone="recibo" titulo="Escolha a empresa" texto="A calculadora vem preenchida com o que o nads tem: o RBT12 pelas saídas do SIEG, a receita do mês pelos XMLs e a folha do Fator R pelo DP. Cada número pode ser trocado à mão." />
      ) : vm.carregando ? <Esqueleto linhas={8} /> : <Calculo vm={vm} />}
    </section>
  );
}

function EscolherEmpresa({ vm }: { vm: VmCalculadoraDoSimples }) {
  if (vm.empresa) {
    return (
      <div className="registro-busca simples-calc-empresa">
        <Icone nome="briefcase" width={16} height={16} />
        <span className="nf-escolhido"><b>{vm.empresa.codigo}</b> · {vm.empresa.nome}{vm.regime && <span className="fraco"> · {vm.regime}</span>}</span>
        <BotaoIcone icone="x" pequeno titulo="Trocar a empresa" onClick={vm.trocarEmpresa} />
      </div>
    );
  }
  const aberta = vm.achadas.length > 0;
  return (
    <div className="simples-calc-empresa simples-calc-busca">
      <div className="registro-busca">
        <Icone nome="search" width={16} height={16} />
        <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Empresa: código do ERP ou nome" aria-label="Buscar a empresa por código ou nome" autoComplete="off"
          role="combobox" aria-expanded={aberta} aria-controls="simples-empresas"
          onKeyDown={e => {
            if (!aberta) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); vm.mover(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); vm.mover(-1); }
            else if (e.key === 'Enter') { e.preventDefault(); vm.escolherDestacado(); }
            else if (e.key === 'Escape') vm.setBusca('');
          }} />
      </div>
      {aberta && (
        <ul className="nf-achados" id="simples-empresas" role="listbox" aria-label="Empresas encontradas">
          {vm.achadas.map((e, i) => (
            <li key={e.codigo + e.nome}>
              <button type="button" className={'popover-item' + (i === vm.ativo ? ' nf-ativo' : '')} role="option" aria-selected={i === vm.ativo} tabIndex={-1}
                onMouseEnter={() => vm.setAtivo(i)} onClick={() => vm.escolher(e)}>
                <span className="nf-achado-codigo">{e.codigo}</span>
                <span className="popover-texto">{e.nome}</span>
                {e.regime && <span className="popover-dica">{e.regime}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Calculo({ vm }: { vm: VmCalculadoraDoSimples }) {
  const c = vm.calculo;
  const efetiva = (a: string) => c.percentuais.find(p => p.anexo === a);
  const tributos = t.sieg.TRIBUTOS_DO_SIMPLES.filter(tr => c.percentuais.some(p => p.tributos.some(x => x.tributo === tr)));
  const pctDe = (a: string, tr: string) => efetiva(a)?.tributos.find(x => x.tributo === tr)?.pct ?? null;
  return (
    <>
      <div className="simples-calc-anexo">
        <span className="hint">Mercadorias</span>
        <Segmentado valor={vm.anexoDaMercadoria} opcoes={[...vm.anexosDaMercadoria]} onMudar={vm.setAnexoDaMercadoria} />
        <span className="hint">Serviços</span>
        <Segmentado valor={vm.anexoDoServico} opcoes={[...vm.anexosDoServico]} onMudar={vm.setAnexoDoServico} />
        <span className="hint">{vm.motivoDoServico}</span>
        {!vm.anexoDoServicoAutomatico && <button type="button" className="btn btn-ghost" onClick={vm.voltarAnexoAutomatico}>Anexo do serviço pelo nads</button>}
      </div>
      {vm.aviso && <Alerta naLinha titulo={vm.aviso.nivel === 'passou' ? 'Limite passado' : 'Perto do limite'} texto={vm.aviso.texto} />}
      <div className="stat-grid">
        <Stat rotulo="DAS do mês" valor={'R$ ' + brl(c.total)} />
        <Stat rotulo="Receita do mês" valor={'R$ ' + brl(c.receita)} />
        <Stat rotulo="Alíquota sobre a receita" valor={pct(c.receita > 0 ? Math.round((c.total / c.receita) * 10000) / 100 : null)} />
        <Stat rotulo={'Fator R (' + vm.rotuloDosMeses + ')'} valor={vm.temFolha ? pct(vm.fator.fator) + ' · Anexo ' + vm.fator.anexo : 'sem a folha'} />
      </div>
      <div className="simples-calc-colunas">
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Os números</th><th className="num">Valor (R$)</th><th>De onde veio</th><th aria-label="Voltar" /></tr></thead>
            <tbody>
              <LinhaDoNumero vm={vm} n={vm.rbt12} />
              <tr><th colSpan={4}>Mercadorias em {t.rotuloCompetencia(vm.competencia)} (Anexo {vm.anexoDaMercadoria})</th></tr>
              {vm.mercadorias.map(n => <LinhaDoNumero key={n.campo} vm={vm} n={n} />)}
              <tr><th colSpan={4}>Serviços em {t.rotuloCompetencia(vm.competencia)} (Anexo {vm.anexoDoServico})</th></tr>
              {vm.servicos.map(n => <LinhaDoNumero key={n.campo} vm={vm} n={n} />)}
              <tr><th colSpan={4}>Folha do Fator R ({vm.rotuloDosMeses})</th></tr>
              {vm.folha.map(n => <LinhaDoNumero key={n.campo} vm={vm} n={n} />)}
              <tr><td><b>Folha dos 12 meses</b></td><td className="num"><b>{brl(vm.fator.folha)}</b></td><td colSpan={2} className="fraco">{!vm.temFolha ? 'sem a folha (ou sem o RBT12), o Fator R não sai' : 'Fator R ' + pct(vm.fator.fator) + (vm.fator.anexo === 'III' ? ': 28% ou mais, Anexo III' : ': abaixo de 28%, Anexo V')}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="simples-calc-resultado">
          <div className="table-wrap">
            <table className="table-compact">
              <thead><tr><th>Percentuais efetivos</th>{c.percentuais.map(p => <th key={p.anexo} className="num" title={t.sieg.ANEXOS[p.anexo].nome}>Anexo {p.anexo}</th>)}</tr></thead>
              <tbody>
                {tributos.map(tr => <tr key={tr}><td>{t.sieg.ROTULO_DO_TRIBUTO[tr]}</td>{c.percentuais.map(p => <td key={p.anexo} className="num">{pctDe(p.anexo, tr) == null ? <span className="fraco">—</span> : pct(pctDe(p.anexo, tr))}</td>)}</tr>)}
              </tbody>
              <tfoot>
                <tr><td><b>Alíquota efetiva</b></td>{c.percentuais.map(p => <td key={p.anexo} className="num"><b>{pct(p.efetiva)}</b></td>)}</tr>
                <tr><td className="fraco">Faixa · nominal · deduzir</td>{c.percentuais.map(p => <td key={p.anexo} className="num fraco">{p.faixa}ª · {pct(p.nominal)} · {brl(p.deduzir)}</td>)}</tr>
              </tfoot>
            </table>
          </div>
          {c.parcelas.length === 0 ? <Vazio compacto icone="recibo" titulo="Sem receita no mês" texto="Digite a receita do mês ao lado para calcular o DAS." /> : (
            <div className="table-wrap">
              <table className="table-compact">
                <thead><tr><th>O DAS (R$)</th>{c.parcelas.map(x => <th key={x.id} className="num" title={x.rotulo + ' · Anexo ' + x.anexo}>{x.rotulo.split(' (')[0]}</th>)}<th className="num">Total</th></tr></thead>
                <tbody>
                  {c.porTributo.map(tr => (
                    <tr key={tr.tributo}>
                      <td>{t.sieg.ROTULO_DO_TRIBUTO[tr.tributo]}</td>
                      {c.parcelas.map(x => <td key={x.id} className="num">{x.valores[tr.tributo] == null ? <span className="fraco" title="Esta parcela não paga este tributo no DAS">—</span> : brl(x.valores[tr.tributo]!)}</td>)}
                      <td className="num"><b>{brl(tr.valor)}</b></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td><b>DAS</b></td>{c.parcelas.map(x => <td key={x.id} className="num"><b>{brl(x.das)}</b></td>)}<td className="num"><b>{brl(c.total)}</b></td></tr>
                  <tr><td className="fraco">Receita · alíquota</td>{c.parcelas.map(x => <td key={x.id} className="num fraco">{brl(x.valor)} · {pct(x.aplicada)}</td>)}<td className="num fraco">{brl(c.receita)}</td></tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
      <p className="hint">
        As contas da planilha do Fiscal: a alíquota efetiva pelo RBT12 e pela faixa, arredondada como no Excel, e o percentual de cada tributo pela repartição do anexo.
        A mercadoria com ICMS-ST não paga o ICMS, a monofásica não paga o PIS/Cofins e o serviço com o ISS retido não paga o ISS{c.deduzido > 0 ? ' (aqui, R$ ' + brl(c.deduzido) + ' a menos)' : ''}.
        {c.percentuais.some(p => p.issNoTeto) && ' O ISS passou de 5% nesta faixa: fica em 5% e o excesso vai para os tributos federais.'} É prévia para conferir: o que vale é o PGDAS-D.
      </p>
    </>
  );
}

function LinhaDoNumero({ vm, n }: { vm: VmCalculadoraDoSimples; n: NumeroDoSimples }) {
  return (
    <tr>
      <td>{n.rotulo}</td>
      <td className="num"><ValorEditavel zeroVale={!!n.fonte} valor={n.valor} rotulo={n.rotulo} aoSalvar={texto => vm.digitar(n.campo, texto)} /></td>
      <td title={n.detalhe}>{n.fonte ? <span className={'badge badge-suave ' + (TOM_DA_FONTE[n.fonte] || 'badge-neutral')}>{n.fonte}</span> : <span className="badge badge-suave badge-neutral">Sem dado</span>} <span className="fraco simples-calc-detalhe">{n.detalhe}</span></td>
      <td>{n.digitado && <BotaoIcone icone="girar" pequeno titulo="Voltar ao número do nads" onClick={() => vm.voltar(n.campo)} />}</td>
    </tr>
  );
}
