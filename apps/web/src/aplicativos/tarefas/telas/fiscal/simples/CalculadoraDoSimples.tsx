// Fiscal › Simples (Heverton, 22/10/2026: a planilha do Simples Nacional do Fiscal; enxugada no mesmo dia: "muita
// informação… os botões se repetem e tá tudo fora dos componentes"; 30/10/2026: refeita para "parecer parte do site", no
// modelo do Gmail). A barra (empresa, mês e o anexo como filtro); à esquerda, o cartão com a conta (o RBT12 e as receitas
// em grupos, cada valor editável, a fonte num selo) e, recolhidos no pé dele, por tributo e o Fator R; à direita, o cartão
// do resultado (o DAS grande, a alíquota efetiva de cada anexo com a faixa e o RBT12 com a barra até o teto). No celular, o
// resultado vem primeiro. Só as peças do catálogo: busca de cliente com lista, SeletorMes, Filtro da barra (menu), Alerta,
// Cartão, Tabela padrão, Valor editável, selo suave, Botão de ícone, Faixas que abrem, Vazio, Esqueleto.
import { Alerta, BotaoIcone, Esqueleto, MenuSuspenso, NumeroQueConta, SeletorMes, useCarregando, Vazio } from '@nads/ui';
import { tarefas as t } from '@nads/core';
import { FaixaQueAbre } from '../../../../../comum/FaixaQueAbre';
import { EmpresaDaBarra } from '../partes/EmpresaDaBarra';
import { ValorEditavel } from '../../financeiro/partes/ValorEditavel';
import { SEM_O_QUE, useCalculadoraDoSimples, type NumeroDoSimples, type VmCalculadoraDoSimples } from './useCalculadoraDoSimples';

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%');

export function CalculadoraDoSimples() {
  const vm = useCalculadoraDoSimples();
  useCarregando(vm.carregando);
  return (
    <section className="fc">
      <div className="tarefas-barra-topo fc-topo">
        <EmpresaDaBarra vm={vm} id="simples-empresas" />
        <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" />
        {vm.empresa && vm.anexosUsados.map(a => (
          <MenuSuspenso key={a.tipo} rotulo={a.tipo + ': Anexo ' + a.anexo} titulo={'Anexo · ' + a.tipo} className="btn btn-outline ativo"
            itens={(a.tipo === 'Mercadorias' ? vm.anexosDaMercadoria : vm.anexosDoServico).map(o => ({
              rotulo: o.rotulo, marcado: o.valor === a.anexo,
              onClick: () => (a.tipo === 'Mercadorias' ? vm.setAnexoDaMercadoria(o.valor) : vm.setAnexoDoServico(o.valor)),
            }))} />
        ))}
      </div>
      {!vm.empresa ? <div className="card fc-cartao"><Vazio icone="recibo" titulo="Escolha a empresa" texto="O nads preenche a conta com os XMLs do SIEG, a rotina do Fiscal e a folha do DP; cada número pode ser trocado à mão." /></div>
        : vm.carregando ? <Esqueleto numeros={3} linhas={8} /> : <Calculo vm={vm} />}
    </section>
  );
}

/** a fonte: o selo pequeno (o detalhe no título) */
function Fonte({ n }: { n: NumeroDoSimples }) {
  const tom = !n.fonte ? 'badge-neutral' : n.digitado ? 'badge-warn' : 'badge-ok';
  return <span className={'badge badge-suave ' + tom} title={n.detalhe}>{n.fonte || 'Sem dado'}</span>;
}

/** a linha de um número: o nome, o valor editável, a fonte e o ↺ (só quando foi digitado) */
function Linha({ vm, n, aliquota, das }: { vm: VmCalculadoraDoSimples; n: NumeroDoSimples; aliquota?: number | null; das?: number | null }) {
  return (
    <tr className={n.valor ? undefined : 'fc-zerada'}>
      <td>{n.rotulo}{SEM_O_QUE[n.campo] && <span className="fraco"> · {SEM_O_QUE[n.campo]}</span>}</td>
      <td className="num"><ValorEditavel zeroVale={!!n.fonte} valor={n.valor} rotulo={n.rotulo} aoSalvar={texto => vm.digitar(n.campo, texto)} /></td>
      <td><Fonte n={n} /></td>
      <td className="num">{aliquota == null ? '' : pct(aliquota)}</td>
      <td className="num">{das == null ? '' : brl(das)}</td>
      <td className="fc-acao">{n.digitado && <BotaoIcone icone="girar" pequeno titulo="Voltar ao número do nads" onClick={() => vm.voltar(n.campo)} />}</td>
    </tr>
  );
}

/** o rótulo de um grupo da tabela (RBT12, Mercadorias, Serviços) */
function Grupo({ rotulo, dica }: { rotulo: string; dica?: string }) {
  return <tr className="fc-grupo"><th colSpan={6} scope="colgroup">{rotulo}{dica && <span> · {dica}</span>}</th></tr>;
}

function Calculo({ vm }: { vm: VmCalculadoraDoSimples }) {
  const c = vm.calculo;
  const mostraMercadorias = vm.temMercadoria || !vm.temServico;
  const daParcela = (campo: string) => c.parcelas.find(p => p.id === campo);
  const faltaMes = vm.rbt12Meses != null && vm.rbt12Meses < 12;
  const doTeto = vm.rbt12.valor ? (vm.rbt12.valor / t.sieg.TETO) * 100 : 0;
  const linha = (n: NumeroDoSimples) => { const p = daParcela(n.campo); return <Linha key={n.campo} vm={vm} n={n} aliquota={p?.aplicada ?? null} das={p?.das ?? null} />; };
  return (
    <>
      {(vm.foraDoSimples || !vm.rbt12.valor || faltaMes || vm.aviso) && (
        <div className="fc-avisos">
          {vm.foraDoSimples && <Alerta naLinha titulo={'Empresa do ' + vm.regime} texto="Pelo cadastro ela não é do Simples: a conta é só simulação." />}
          {!vm.rbt12.valor ? <Alerta naLinha titulo="Falta o RBT12" texto="Digite o RBT12 do PGDAS na tabela." />
            : faltaMes && <Alerta naLinha titulo={'RBT12 com ' + vm.rbt12Meses + ' de 12 meses'} texto="Faltam meses no SIEG: confira o RBT12 com o PGDAS." />}
          {vm.aviso && <Alerta naLinha titulo={vm.aviso.nivel === 'passou' ? 'Limite passado' : 'Perto do limite'} texto={vm.aviso.texto} />}
        </div>
      )}

      <div className="fc-grade">
        {/* o resultado, como nas calculadoras do Simples (23/10/2026): o DAS e a receita, a alíquota efetiva com a faixa, a
            nominal e a parcela a deduzir, e o RBT12 com quanto já foi do teto */}
        <aside className="card fc-cartao fc-resumo" aria-label="Resultado">
          <div className="fc-resumo-das">
            <span className="fc-rotulo">DAS de {t.rotuloCompetencia(vm.competencia)}</span>
            <b className="fc-das"><NumeroQueConta texto={'R$ ' + brl(c.total)} /></b>
            <span className="fc-sub">sobre a receita de R$ {brl(c.receita)}</span>
          </div>
          {vm.anexosUsados.map(a => (
            <div key={a.tipo} className="fc-resumo-item">
              <span className="fc-rotulo">Alíquota efetiva · Anexo {a.anexo}{vm.anexosUsados.length > 1 ? ' (' + a.tipo + ')' : ''}</span>
              <b className="fc-resumo-valor">{pct(a.p.efetiva)}</b>
              <span className="fc-sub">{a.p.faixa}ª faixa · nominal {pct(a.p.nominal)}{a.p.deduzir ? ' − R$ ' + brl(a.p.deduzir) + ' a deduzir' : ''}</span>
            </div>
          ))}
          <div className="fc-resumo-item">
            <span className="fc-rotulo">RBT12</span>
            <b className="fc-resumo-valor">R$ {brl(vm.rbt12.valor)}</b>
            <span className={'fc-medidor' + (vm.aviso ? ' ' + vm.aviso.nivel : '')} role="meter" aria-label="Quanto do teto" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(doTeto)}>
              <i style={{ width: Math.min(100, doTeto) + '%' }} />
            </span>
            <span className="fc-sub">{vm.rbt12.valor ? pct(doTeto) + ' do teto de R$ 4,8 milhões' : 'digite o do PGDAS na tabela'}</span>
          </div>
        </aside>

        <section className="card fc-cartao fc-conta">
          <header className="fc-cartao-topo">
            <h3 className="fc-cartao-titulo">A conta</h3>
            <span className="fc-contagem">receita de {t.rotuloCompetencia(vm.competencia)}</span>
          </header>
          <div className="table-wrap fc-tabela">
            <table className="table-compact">
              <thead><tr><th>Receita</th><th className="num">Valor (R$)</th><th>Fonte</th><th className="num">Alíquota</th><th className="num">DAS (R$)</th><th aria-label="Voltar" /></tr></thead>
              <tbody>
                <Grupo rotulo="Os 12 meses antes" dica={vm.rotuloDosMeses} />
                <Linha vm={vm} n={{ ...vm.rbt12, rotulo: 'RBT12' }} />
                {mostraMercadorias && <><Grupo rotulo="Mercadorias" dica={'Anexo ' + vm.anexoDaMercadoria} />{vm.mercadorias.map(linha)}</>}
                {vm.temServico && <><Grupo rotulo="Serviços" dica={'Anexo ' + vm.anexoDoServico} />{vm.servicos.map(linha)}</>}
              </tbody>
              <tfoot><tr><td>Total do mês</td><td className="num">{brl(c.receita)}</td><td /><td /><td className="num">{brl(c.total)}</td><td /></tr></tfoot>
            </table>
          </div>

          <div className="fc-faixas">
            <FaixaQueAbre titulo="Por tributo" qtd={c.porTributo.length}>
              <div className="table-wrap">
                <table className="table-compact">
                  <thead><tr><th>Tributo</th>{c.percentuais.map(p => <th key={p.anexo} className="num">Anexo {p.anexo}</th>)}<th className="num">Valor (R$)</th></tr></thead>
                  <tbody>
                    {c.porTributo.map(tr => (
                      <tr key={tr.tributo}>
                        <td>{t.sieg.ROTULO_DO_TRIBUTO[tr.tributo]}</td>
                        {c.percentuais.map(p => <td key={p.anexo} className="num">{pct(p.tributos.find(y => y.tributo === tr.tributo)?.pct ?? null)}</td>)}
                        <td className="num">{brl(tr.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FaixaQueAbre>
            {vm.mostraFatorR && (
              <FaixaQueAbre titulo={'Fator R · ' + (vm.temFolha ? pct(vm.fator.fator) + ' (Anexo ' + vm.fator.anexo + ')' : 'sem a folha')} qtd={vm.folha.filter(x => x.fonte).length}>
                <div className="table-wrap">
                  <table className="table-compact">
                    <thead><tr><th>Folha ({vm.rotuloDosMeses})</th><th className="num">Valor (R$)</th><th>Fonte</th><th /><th /><th aria-label="Voltar" /></tr></thead>
                    <tbody>{vm.folha.map(n => <Linha key={n.campo} vm={vm} n={n} />)}</tbody>
                    <tfoot><tr><td>Total</td><td className="num">{brl(vm.fator.folha)}</td><td /><td /><td /><td /></tr></tfoot>
                  </table>
                </div>
              </FaixaQueAbre>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
