// Financeiro › Honorários (19/10/2026, fase 2): por competência (começa no mês anterior), os números (Previsto, Recebido, Em
// aberto, Clientes pagos), o filtro e a busca, e a lista dos clientes que controlam honorário: o valor se edita na linha,
// a situação diz "Pago em dd/mm · forma" ou "Em aberto" (não há vencimento), e Receber / Desfazer marcam à mão. Em 21/10/2026:
// Emitir NFS-e (a Nova nota já preenchida, com o selo da nota que já existe) e Cobrar (tirado em 21/10/2026, a pedido: "remove esse cobrar"; o "Cobrado em" das cobranças já feitas fica).
import { financeiro, formatos } from '@nads/core';
import { Icone, MenuSuspenso, Segmentado, SeletorMes, useCarregando, Vazio } from '@nads/ui';
import { useState } from 'react';
import { dataBr } from './formatosDaNota';
import { JanelaDosContratos } from './JanelaDosContratos';
import { JanelaDoReajuste } from './JanelaDoReajuste';
import { JanelaNovaNota } from './JanelaNovaNota';
import { JanelaReceber } from './JanelaReceber';
import { ValorEditavel } from './partes/ValorEditavel';
import { FILTROS_DE_HONORARIOS, useHonorariosDaCompetencia } from './useHonorariosDaCompetencia';

export function Honorarios() {
  const vm = useHonorariosDaCompetencia();
  useCarregando(vm.carregando);
  const s = vm.situacao;
  // a janela do reajuste (22/10/2026, o item 5 da lista do Painel)
  const [reajustando, setReajustando] = useState(false);
  const numeros = [
    { rotulo: 'Previsto', valor: formatos.reais(s.previsto), tom: 'neutro', icone: 'clock' },
    { rotulo: 'Recebido', valor: formatos.reais(s.recebido), tom: 'ok', icone: 'check' },
    { rotulo: 'Em aberto', valor: formatos.reais(s.emAberto), tom: 'aviso', icone: 'dinheiro' },
    { rotulo: 'Clientes pagos', valor: s.pagos + ' de ' + s.total, tom: 'info', icone: 'briefcase' },
  ] as const;
  return (
    <section>
      {vm.recebendo && <JanelaReceber contratoId={vm.recebendo} competencia={vm.competencia} fechar={vm.fecharReceber} />}
      {vm.emitindo && <JanelaNovaNota fechar={vm.fecharEmissao} inicial={vm.emitindo} />}
      {vm.gerenciando && <JanelaDosContratos fechar={() => vm.setGerenciando(false)} />}
      {reajustando && <JanelaDoReajuste fechar={() => setReajustando(false)} />}

      <div className="tarefas-barra-topo fin-barra">
        <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" />
        <Segmentado valor={vm.filtro} opcoes={FILTROS_DE_HONORARIOS} onMudar={vm.setFiltro} />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar cliente" aria-label="Buscar cliente (nome, código ou CNPJ)" value={vm.busca}
            onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        {/* o Exportar e o Reajustar num "Mais", como no Caixa: a barra não quebra (22/10/2026) */}
        <MenuSuspenso rotulo="Mais" titulo="Exportar a planilha e reajustar os honorários" direita largura={240}
          itens={[
            { rotulo: 'Exportar planilha', icone: 'download', desabilitado: !vm.valida, onClick: vm.exportar },
            { rotulo: 'Reajustar os honorários', icone: 'repeat', onClick: () => setReajustando(true) },
          ]} />
        <button type="button" className="btn btn-outline" onClick={() => vm.setGerenciando(true)}><Icone nome="briefcase" />Gerenciar clientes</button>
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}

      <div className="stat-grid dp-numeros fin-numeros">
        {numeros.map(n => (
          <div key={n.rotulo} className={'stat painel-numero painel-' + n.tom}>
            <span className="painel-numero-icone" aria-hidden="true"><Icone nome={n.icone} /></span>
            <p className="stat-label">{n.rotulo}</p>
            <p className="stat-value num">{n.valor}</p>
          </div>
        ))}
      </div>

      {!vm.carregando && !s.linhas.length ? (
        <Vazio icone="recibo" titulo={s.total ? 'Nenhum cliente com isso' : 'Nenhum cliente controla honorário ainda'}>
          {s.total
            ? <button type="button" className="btn btn-outline" onClick={() => { vm.setBusca(''); vm.setFiltro('todos'); }}>Limpar a busca e o filtro</button>
            : <button type="button" className="btn btn-primary" onClick={() => vm.setGerenciando(true)}><Icone nome="plus" />Adicionar cliente</button>}
        </Vazio>
      ) : (
        <div className="table-wrap">
          <table className="tabela-empresas cad-lista fin-lista">
            <thead><tr><th>Cód.</th><th>Cliente</th><th className="fin-direita">Valor</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {!vm.carregando && s.linhas.map(l => (
                <tr key={l.contrato.id}>
                  <td><span className="emp-cod">{l.contrato.codigo || '—'}</span></td>
                  <td><span className="fin-corta" title={l.contrato.nome}>{l.contrato.nome}</span></td>
                  <td className="fin-direita">
                    {l.recebimento
                      ? <span className="num">{formatos.reais(l.recebimento.valor)}</span>
                      : <ValorEditavel valor={l.contrato.valor} rotulo={'Valor do honorário de ' + l.contrato.nome} aoSalvar={t => void vm.definirValor(l.contrato.id, t)} />}
                  </td>
                  <td>
                    {l.recebimento
                      ? <span className="badge badge-ok">Pago em {dataBr(l.recebimento.recebidoEm).slice(0, 5)} · {financeiro.rotuloDaForma(l.recebimento.forma)}</span>
                      : <span className="badge badge-warn">Em aberto</span>}
                    {(() => { const selo = vm.seloDaNota(l); return selo && <span className={'badge badge-' + (selo.tom === 'info' ? 'neutral' : selo.tom) + ' fin-selo'}>{selo.rotulo}</span>; })()}
                    {!l.recebimento && vm.cobradoEm(l) && <span className="fraco fin-cobrado">Cobrado em {dataBr(vm.cobradoEm(l)).slice(0, 5)}</span>}
                  </td>
                  <td className="fin-direita fin-acoes">
                    <button type="button" className="btn btn-outline" onClick={() => vm.emitirNota(l)} title="Abre a Nova nota já preenchida com o cliente, o valor e a competência"><Icone nome="recibo" />Emitir NFS-e</button>
                    {l.recebimento
                      ? <button type="button" className="btn btn-outline" onClick={() => void vm.desfazer(l)}><Icone nome="repeat" />Desfazer</button>
                      : <button type="button" className="btn btn-primary" disabled={l.contrato.valor <= 0} title={l.contrato.valor <= 0 ? 'Defina o valor do honorário primeiro' : 'Marcar como recebido'} onClick={() => vm.receber(l.contrato.id)}><Icone nome="check" />Receber</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
