// Fiscal › Simples (Heverton, 22/10/2026: a planilha do Simples Nacional do Fiscal; refeita mais simples no mesmo dia):
// a empresa e o mês em cima; o resultado grande (o DAS e a alíquota); "Como chegou nesse valor" em três passos, cada número
// editável na própria linha e a fonte num selo pequeno (a explicação na dica); por tributo e o Fator R recolhidos. Só as
// peças do catálogo (busca de cliente com lista, SeletorMes, Alerta, Stat, passos, Tabela padrão, Valor editável, selo
// suave, Dica, Segmentado, Faixas que abrem, Vazio).
import { Alerta, BotaoIcone, Dica, Esqueleto, Icone, Segmentado, SeletorMes, Stat, useCarregando, Vazio } from '@nads/ui';
import { tarefas as t } from '@nads/core';
import { FaixaQueAbre } from '../../../../../comum/FaixaQueAbre';
import { ValorEditavel } from '../../financeiro/partes/ValorEditavel';
import { SEM_O_QUE, useCalculadoraDoSimples, type NumeroDoSimples, type VmCalculadoraDoSimples } from './useCalculadoraDoSimples';

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%');

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
        <Vazio icone="recibo" titulo="Escolha a empresa" texto="A conta do DAS vem pronta com o que o nads tem (o SIEG, a rotina do Fiscal e a folha do DP). Qualquer número pode ser trocado à mão." />
      ) : vm.carregando ? <Esqueleto linhas={8} /> : <Calculo vm={vm} />}
    </section>
  );
}

function EscolherEmpresa({ vm }: { vm: VmCalculadoraDoSimples }) {
  if (vm.empresa) {
    return (
      <div className="registro-busca simples-calc-empresa">
        <Icone nome="briefcase" width={16} height={16} />
        <span className="nf-escolhido"><b>{vm.empresa.codigo}</b> · {vm.empresa.nome}</span>
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
        <ul className="nf-achados" id="simples-empresas" role="listbox" aria-label="Empresas encontradas (as do Simples primeiro)">
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

/** a fonte do número: o selo pequeno e a explicação na dica */
function Fonte({ n }: { n: NumeroDoSimples }) {
  const tom = !n.fonte ? 'badge-neutral' : n.digitado ? 'badge-warn' : 'badge-ok';
  return <span className="simples-calc-fonte"><span className={'badge badge-suave ' + tom}>{n.fonte || 'Sem dado'}</span><Dica texto={n.detalhe} /></span>;
}

function Valor({ vm, n }: { vm: VmCalculadoraDoSimples; n: NumeroDoSimples }) {
  return (
    <span className="simples-calc-valor">
      <ValorEditavel zeroVale={!!n.fonte} valor={n.valor} rotulo={n.rotulo} aoSalvar={texto => vm.digitar(n.campo, texto)} />
      <Fonte n={n} />
      {n.digitado && <BotaoIcone icone="girar" pequeno titulo="Voltar ao número do nads" onClick={() => vm.voltar(n.campo)} />}
    </span>
  );
}

function Calculo({ vm }: { vm: VmCalculadoraDoSimples }) {
  const c = vm.calculo;
  const linhas = [...(vm.temMercadoria || !vm.temServico ? vm.mercadorias : []), ...(vm.temServico ? vm.servicos : [])];
  const daParcela = (campo: string) => c.parcelas.find(p => p.id === campo);
  const faltamMeses = vm.rbt12Meses != null && vm.rbt12Meses < 12;
  return (
    <>
      {vm.foraDoSimples && <Alerta naLinha titulo={'Esta empresa é do ' + vm.regime + ', não do Simples'} texto="O regime vem do cadastro. A conta abaixo é só uma simulação: o Simples não vale para ela." />}
      {vm.aviso && <Alerta naLinha titulo={vm.aviso.nivel === 'passou' ? 'Limite passado' : 'Perto do limite'} texto={vm.aviso.texto} />}

      <div className="stat-grid">
        <Stat rotulo={'DAS de ' + t.rotuloCompetencia(vm.competencia)} valor={'R$ ' + brl(c.total)} />
        {vm.anexosUsados.map(a => <Stat key={a.tipo} rotulo={'Alíquota efetiva · ' + a.tipo + ' (Anexo ' + a.anexo + ')'} valor={pct(a.p.efetiva)} />)}
      </div>
      <p className="hint simples-calc-anexo">
        {vm.anexosUsados.map(a => a.tipo + ': ' + a.nome + ' (' + a.porque + ')').join(' · ')}{' '}
        <button type="button" className="btn btn-ghost" aria-expanded={vm.trocandoAnexo} onClick={vm.abrirTrocaDeAnexo}>Trocar anexo</button>
      </p>
      {vm.trocandoAnexo && (
        <div className="simples-calc-anexo">
          <span className="hint">Mercadorias</span>
          <Segmentado valor={vm.anexoDaMercadoria} opcoes={[...vm.anexosDaMercadoria]} onMudar={vm.setAnexoDaMercadoria} />
          <span className="hint">Serviços</span>
          <Segmentado valor={vm.anexoDoServico} opcoes={[...vm.anexosDoServico]} onMudar={vm.setAnexoDoServico} />
        </div>
      )}

      <section className="card simples-calc-como">
        <h3>Como chegou nesse valor</h3>
        <ol className="fgts-passos simples-calc-passos">
          <li>
            <span className="fgts-passo-marca" aria-hidden="true">1</span>
            <div>
              <b>A receita dos 12 meses antes ({vm.rotuloDosMeses})</b>
              <div className="simples-calc-linha"><span>RBT12</span><Valor vm={vm} n={vm.rbt12} /></div>
              {!vm.rbt12.valor && <Alerta naLinha titulo="Falta o RBT12" texto="Sem ele, a conta usa a 1ª faixa e a alíquota sai errada. Digite o RBT12 do PGDAS." />}
              {faltamMeses && <Alerta naLinha titulo={'Só ' + vm.rbt12Meses + ' de 12 meses têm saídas no SIEG'} texto="O RBT12 ficou menor do que é e a alíquota sai errada. Digite o RBT12 do PGDAS (ou o da rotina do Fiscal)." />}
            </div>
          </li>
          <li>
            <span className="fgts-passo-marca" aria-hidden="true">2</span>
            <div>
              <b>A faixa e a alíquota</b>
              {vm.anexosUsados.map(a => (
                <p key={a.tipo} className="simples-calc-conta">
                  Anexo {a.anexo}, {a.p.faixa}ª faixa: (RBT12 × {pct(a.p.nominal)} − {brl(a.p.deduzir)}) ÷ RBT12 = <b>{pct(a.p.efetiva)}</b>
                </p>
              ))}
            </div>
          </li>
          <li>
            <span className="fgts-passo-marca" aria-hidden="true">3</span>
            <div>
              <b>A receita de {t.rotuloCompetencia(vm.competencia)} × a alíquota</b>
              <div className="table-wrap">
                <table className="table-compact">
                  <thead><tr><th>Receita</th><th>Valor (R$)</th><th className="num">Alíquota</th><th className="num">DAS (R$)</th></tr></thead>
                  <tbody>
                    {linhas.map(n => {
                      const p = daParcela(n.campo);
                      return (
                        <tr key={n.campo}>
                          <td>{n.rotulo}{SEM_O_QUE[n.campo] && <span className="fraco simples-calc-tipo">{SEM_O_QUE[n.campo]}</span>}</td>
                          <td><Valor vm={vm} n={n} /></td>
                          <td className="num">{p ? pct(p.aplicada) : <span className="fraco">—</span>}</td>
                          <td className="num">{p ? brl(p.das) : <span className="fraco">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot><tr><td><b>Total</b></td><td className="num"><b>{brl(c.receita)}</b></td><td /><td className="num"><b>{brl(c.total)}</b></td></tr></tfoot>
                </table>
              </div>
            </div>
          </li>
        </ol>
      </section>

      <div className="simples-calc-faixas">
        <FaixaQueAbre titulo="Ver por tributo" qtd={c.porTributo.length}>
          {!c.parcelas.length ? <Vazio compacto icone="recibo" titulo="Sem receita no mês" texto="Digite a receita do mês para ver os tributos." /> : (
            <div className="table-wrap">
              <table className="table-compact">
                <thead><tr><th>Tributo</th>{c.percentuais.map(p => <th key={p.anexo} className="num">% Anexo {p.anexo}</th>)}<th className="num">Valor (R$)</th></tr></thead>
                <tbody>
                  {c.porTributo.map(tr => (
                    <tr key={tr.tributo}>
                      <td>{t.sieg.ROTULO_DO_TRIBUTO[tr.tributo]}</td>
                      {c.percentuais.map(p => { const x = p.tributos.find(y => y.tributo === tr.tributo); return <td key={p.anexo} className="num">{x ? pct(x.pct) : <span className="fraco">—</span>}</td>; })}
                      <td className="num">{brl(tr.valor)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td><b>DAS</b></td>{c.percentuais.map(p => <td key={p.anexo} className="num"><b>{pct(p.efetiva)}</b></td>)}<td className="num"><b>{brl(c.total)}</b></td></tr></tfoot>
              </table>
            </div>
          )}
          <p className="hint">
            O percentual de cada tributo é a alíquota efetiva × a repartição do anexo, arredondado como na planilha. O ICMS-ST tira o ICMS, o monofásico tira o PIS e a Cofins e o ISS retido tira o ISS
            {c.deduzido > 0 ? ' (aqui, R$ ' + brl(c.deduzido) + ' a menos)' : ''}.{c.percentuais.some(p => p.issNoTeto) && ' O ISS passou de 5% nesta faixa: fica em 5% e o excesso vai para os tributos federais.'}
          </p>
        </FaixaQueAbre>
        {vm.mostraFatorR && (
          <FaixaQueAbre titulo={'Fator R: ' + (vm.temFolha ? pct(vm.fator.fator) + ' (Anexo ' + vm.fator.anexo + ')' : 'sem a folha')} qtd={vm.folha.filter(x => x.fonte).length}>
            <p className="hint">A folha de {vm.rotuloDosMeses} (salário, FGTS e CPP) ÷ RBT12. De 28% para cima, o serviço vai no Anexo III; abaixo, no V.</p>
            <div className="table-wrap">
              <table className="table-compact">
                <tbody>
                  {vm.folha.map(n => <tr key={n.campo}><td>{n.rotulo}</td><td><Valor vm={vm} n={n} /></td></tr>)}
                  <tr><td><b>Folha dos 12 meses</b></td><td className="num"><b>{brl(vm.fator.folha)}</b></td></tr>
                </tbody>
              </table>
            </div>
          </FaixaQueAbre>
        )}
      </div>
      <p className="hint">É prévia para conferir: o que vale é o PGDAS-D.</p>
    </>
  );
}
