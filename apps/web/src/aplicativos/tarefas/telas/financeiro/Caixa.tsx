// Financeiro › Caixa (19/10/2026: "o Movimento de Caixa do Toriba, no nads"): o período e a busca, os quatro números (saldo
// inicial, entradas, saídas, saldo final) e a lista dos lançamentos. Clicar na linha abre o lançamento para alterar ou
// excluir; "Novo lançamento" abre a janela de criar; o "Mais" tem a calculadora, a contagem de cédulas e a planilha.
import { formatos } from '@nads/core';
import { CampoData, Icone, MenuSuspenso, Segmentado, Stat, useCarregando, Vazio } from '@nads/ui';
import { useState } from 'react';
import { dataBr } from './formatosDaNota';
import { JanelaCalculadora } from './JanelaCalculadora';
import { JanelaDeCedulas } from './JanelaDeCedulas';
import { JanelaDoLancamento } from './JanelaDoLancamento';
import { ValorDoCaixa } from './partes/ValorDoCaixa';
import { FILTROS_DE_TIPO, PERIODOS_RAPIDOS, useCaixaFinanceiro } from './useCaixaFinanceiro';

export function Caixa() {
  const vm = useCaixaFinanceiro();
  useCarregando(vm.carregando);
  const r = vm.resumo;
  const reais = (v: number | undefined) => (v == null ? '—' : formatos.reais(v));
  const [datas, setDatas] = useState(false);
  // as datas aparecem ao escolher "Escolher as datas…" ou quando o período não é um dos atalhos
  const mostrarDatas = datas || vm.periodoRapido === 'outro';
  const rotuloDoPeriodo = vm.periodoRapido === 'outro' || datas ? 'Período' : PERIODOS_RAPIDOS.find(p => p.valor === vm.periodoRapido)?.rotulo || 'Período';
  return (
    <section>
      {vm.aberto && <JanelaDoLancamento id={vm.aberto.id} valor={vm.aberto.valor} fechar={vm.fechar} />}
      {vm.contando && <JanelaDeCedulas fechar={() => vm.setContando(false)} usar={vm.usarCedulas} />}
      {vm.calculando && <JanelaCalculadora fechar={() => vm.setCalculando(false)} usar={vm.usarCalculadora} />}

      {/* uma barra só, como nos extratos (22/10/2026: "organizar e simplificar"): o período num menu (as datas só ao
          escolher), o tipo, a busca e, à direita, o "Mais" (calculadora, cédulas, planilha) e o Novo lançamento */}
      <div className="tarefas-barra-topo fin-barra">
        <MenuSuspenso rotulo={rotuloDoPeriodo} icone="calendar" titulo="O período" largura={220}
          itens={[
            ...PERIODOS_RAPIDOS.filter(p => !p.oculta).map(p => ({ rotulo: p.rotulo, marcado: vm.periodoRapido === p.valor, onClick: () => { setDatas(false); vm.escolherPeriodo(p.valor); } })),
            { rotulo: 'Escolher as datas…', marcado: vm.periodoRapido === 'outro', onClick: () => setDatas(true) },
          ]} />
        {mostrarDatas && (
          <span className="fin-periodo">
            <CampoData valor={vm.de} onMudar={vm.setDe} rotulo="Do dia" />
            <span className="fraco">até</span>
            <CampoData valor={vm.ate} onMudar={vm.setAte} rotulo="Até o dia" />
          </span>
        )}
        <Segmentado valor={vm.tipoFiltro} opcoes={FILTROS_DE_TIPO} onMudar={vm.setTipoFiltro} />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar lançamento" aria-label="Buscar lançamento (descrição, observações, valor, conta)" value={vm.busca}
            onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <span className="fin-acoes">
          {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
          <MenuSuspenso rotulo="Mais" titulo="Calculadora, contar cédulas, exportar e imprimir" direita largura={220}
            itens={[
              { rotulo: 'Calculadora', icone: 'hash', onClick: () => vm.setCalculando(true) },
              { rotulo: 'Contar cédulas', icone: 'dinheiro', onClick: () => vm.setContando(true) },
              { rotulo: 'Exportar planilha', icone: 'download', desabilitado: !vm.periodoValido, onClick: vm.exportar },
              { rotulo: 'Imprimir', icone: 'printer', desabilitado: !vm.periodoValido, onClick: vm.imprimir },
            ]} />
          <button type="button" className="btn btn-primary" onClick={() => vm.abrir({})}><Icone nome="plus" />Novo lançamento</button>
        </span>
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}
      {!vm.periodoValido && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />Confira o período: as duas datas precisam existir e a primeira não pode vir depois da segunda.</p>}

      {/* os quatro números num quadro só, neutro; a cor só no valor (entradas em verde, saídas em vermelho) */}
      <div className="stat-grid fin-numeros">
        <Stat rotulo="Saldo inicial" valor={reais(r?.saldoInicial)} />
        <Stat rotulo="Entradas" valor={reais(r?.entradas)} cor="entrada" />
        <Stat rotulo="Saídas" valor={reais(r?.saidas)} cor="saida" />
        <Stat rotulo="Saldo final" valor={reais(r?.saldoFinal)} cor={(r?.saldoFinal ?? 0) < 0 ? 'saida' : undefined} />
      </div>

      {!vm.carregando && vm.periodoValido && !vm.linhas.length ? (
        <Vazio icone="dinheiro" titulo={vm.busca ? 'Nenhum lançamento com isso' : 'Nenhum lançamento neste período'}>
          {vm.busca
            ? <button type="button" className="btn btn-outline" onClick={() => vm.setBusca('')}>Limpar a busca</button>
            : <button type="button" className="btn btn-primary" onClick={() => vm.abrir({})}><Icone nome="plus" />Novo lançamento</button>}
        </Vazio>
      ) : (
        <div className="table-wrap">
          <table className="tabela-empresas cad-lista fin-lista">
            <thead><tr><th>Data</th><th>Descrição</th><th>Conta</th><th className="fin-direita">Valor</th><th>Observações</th></tr></thead>
            <tbody>
              {!vm.carregando && vm.linhas.map(({ lancamento: l, conta }) => (
                <tr key={l.id} className="linha-abre" tabIndex={0} title="Abrir o lançamento" onClick={() => vm.abrir({ id: l.id })} onKeyDown={e => { if (e.key === 'Enter') vm.abrir({ id: l.id }); }}>
                  <td className="num fraco">{dataBr(l.data)}</td>
                  <td><span className="fin-corta" title={l.descricao}>{l.descricao}</span></td>
                  <td className="fraco">{conta ? <span title={conta.descricao}>{conta.codigo} · {conta.descricao}</span> : '—'}</td>
                  <td className="num fin-direita"><ValorDoCaixa valor={l.valor} tipo={l.tipo} /></td>
                  <td className="fraco"><span className="fin-corta" title={l.observacoes}>{l.observacoes || ''}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
