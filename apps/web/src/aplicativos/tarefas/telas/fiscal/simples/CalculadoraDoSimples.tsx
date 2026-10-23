// Fiscal › Simples (Heverton, 22/10/2026: a planilha do Simples Nacional do Fiscal; enxugada no mesmo dia: "muita
// informação… os botões se repetem e tá tudo fora dos componentes"). A barra (empresa, mês e o anexo como filtro), os
// números grandes, uma tabela com a conta (cada valor editável, a fonte num selo) e, recolhidos, por tributo e o Fator R.
// Só as peças do catálogo: busca de cliente com lista, SeletorMes, Filtro da barra (menu), Alerta, Stat, Tabela padrão,
// Valor editável, selo suave, Botão de ícone, Faixas que abrem, Vazio.
import { Alerta, BotaoIcone, Esqueleto, MenuSuspenso, SeletorMes, Stat, useCarregando, Vazio } from '@nads/ui';
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
    <section className="simples-calc">
      <div className="tarefas-barra-topo">
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
      {!vm.empresa ? <Vazio icone="recibo" titulo="Escolha a empresa" />
        : vm.carregando ? <Esqueleto linhas={8} /> : <Calculo vm={vm} />}
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
    <tr>
      <td>{n.rotulo}{SEM_O_QUE[n.campo] && <span className="fraco"> · {SEM_O_QUE[n.campo]}</span>}</td>
      <td className="num"><ValorEditavel zeroVale={!!n.fonte} valor={n.valor} rotulo={n.rotulo} aoSalvar={texto => vm.digitar(n.campo, texto)} /></td>
      <td><Fonte n={n} /></td>
      <td className="num">{aliquota == null ? '' : pct(aliquota)}</td>
      <td className="num">{das == null ? '' : brl(das)}</td>
      <td>{n.digitado && <BotaoIcone icone="girar" pequeno titulo="Voltar ao número do nads" onClick={() => vm.voltar(n.campo)} />}</td>
    </tr>
  );
}

function Calculo({ vm }: { vm: VmCalculadoraDoSimples }) {
  const c = vm.calculo;
  const linhas = [...(vm.temMercadoria || !vm.temServico ? vm.mercadorias : []), ...(vm.temServico ? vm.servicos : [])];
  const daParcela = (campo: string) => c.parcelas.find(p => p.id === campo);
  const faltaMes = vm.rbt12Meses != null && vm.rbt12Meses < 12;
  return (
    <>
      {vm.foraDoSimples && <Alerta naLinha titulo={'Empresa do ' + vm.regime} texto="Pelo cadastro ela não é do Simples: a conta é só simulação." />}
      {!vm.rbt12.valor ? <Alerta naLinha titulo="Falta o RBT12" texto="Digite o RBT12 do PGDAS na tabela." />
        : faltaMes && <Alerta naLinha titulo={'RBT12 com ' + vm.rbt12Meses + ' de 12 meses'} texto="Faltam meses no SIEG: confira o RBT12 com o PGDAS." />}
      {vm.aviso && <Alerta naLinha titulo={vm.aviso.nivel === 'passou' ? 'Limite passado' : 'Perto do limite'} texto={vm.aviso.texto} />}

      {/* o caminho da conta, como nas calculadoras do Simples (23/10/2026): o DAS e a receita, a alíquota efetiva com a faixa,
          a nominal e a parcela a deduzir, e o RBT12 com quanto já foi do teto */}
      <div className="stat-grid">
        <Stat rotulo={'DAS de ' + t.rotuloCompetencia(vm.competencia)} valor={'R$ ' + brl(c.total)} sub={'sobre a receita de R$ ' + brl(c.receita)} />
        {vm.anexosUsados.map(a => (
          <Stat key={a.tipo} rotulo={'Alíquota efetiva · Anexo ' + a.anexo + (vm.anexosUsados.length > 1 ? ' (' + a.tipo + ')' : '')} valor={pct(a.p.efetiva)}
            sub={a.p.faixa + 'ª faixa · nominal ' + pct(a.p.nominal) + (a.p.deduzir ? ' − R$ ' + brl(a.p.deduzir) + ' a deduzir' : '')} />
        ))}
        <Stat rotulo="RBT12" valor={'R$ ' + brl(vm.rbt12.valor)} sub={vm.rbt12.valor ? pct((vm.rbt12.valor / t.sieg.TETO) * 100) + ' do teto de R$ 4,8 milhões' : 'digite o do PGDAS na tabela'} />
      </div>

      <div className="table-wrap simples-calc-tabela">
        <table className="table-compact">
          <thead><tr><th /><th className="num">Valor (R$)</th><th>Fonte</th><th className="num">Alíquota</th><th className="num">DAS (R$)</th><th aria-label="Voltar" /></tr></thead>
          <tbody>
            <Linha vm={vm} n={{ ...vm.rbt12, rotulo: 'RBT12 (' + vm.rotuloDosMeses + ')' }} />
            {linhas.map(n => { const p = daParcela(n.campo); return <Linha key={n.campo} vm={vm} n={n} aliquota={p?.aplicada ?? null} das={p?.das ?? null} />; })}
          </tbody>
          <tfoot><tr><td><b>Total do mês</b></td><td className="num"><b>{brl(c.receita)}</b></td><td /><td /><td className="num"><b>{brl(c.total)}</b></td><td /></tr></tfoot>
        </table>
      </div>

      <div className="simples-calc-faixas">
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
                <tfoot><tr><td><b>Total</b></td><td className="num"><b>{brl(vm.fator.folha)}</b></td><td /><td /><td /><td /></tr></tfoot>
              </table>
            </div>
          </FaixaQueAbre>
        )}
      </div>
    </>
  );
}
