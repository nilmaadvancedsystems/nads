// Fiscal › Simples (Heverton, 22/10/2026: a planilha do Simples Nacional do Fiscal; enxugada no mesmo dia: "muita
// informação… os botões se repetem e tá tudo fora dos componentes"). A barra (empresa, mês e o anexo como filtro), os
// números grandes, uma tabela com a conta (cada valor editável, a fonte num selo) e, recolhidos, por tributo e o Fator R.
// Só as peças do catálogo: busca de cliente com lista, SeletorMes, Filtro da barra (menu), Alerta, Stat, Tabela padrão,
// Valor editável, selo suave, Botão de ícone, Faixas que abrem, Vazio.
import { Alerta, BotaoIcone, Esqueleto, Icone, MenuSuspenso, SeletorMes, Stat, useCarregando, Vazio } from '@nads/ui';
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

      <div className="stat-grid">
        <Stat rotulo={'DAS de ' + t.rotuloCompetencia(vm.competencia)} valor={'R$ ' + brl(c.total)} />
        {vm.anexosUsados.map(a => <Stat key={a.tipo} rotulo={'Alíquota · Anexo ' + a.anexo + ' (' + a.p.faixa + 'ª faixa)'} valor={pct(a.p.efetiva)} />)}
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
