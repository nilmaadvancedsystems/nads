// Financeiro › Honorários (19/10/2026, fase 2): por competência (começa no mês anterior), os números (Previsto, Recebido, Em
// aberto, Clientes pagos), o filtro e a busca, e a lista dos clientes que controlam honorário: o valor se edita na linha,
// a situação diz "Pago em dd/mm · forma" ou "Em aberto" (não há vencimento), e Receber / Desfazer marcam à mão.
import { financeiro, formatos } from '@nads/core';
import { Icone, Segmentado, SeletorMes, useCarregando, Vazio } from '@nads/ui';
import { dataBr } from './formatosDaNota';
import { JanelaDosContratos } from './JanelaDosContratos';
import { JanelaReceber } from './JanelaReceber';
import { ValorEditavel } from './partes/ValorEditavel';
import { FILTROS_DE_HONORARIOS, useHonorariosDaCompetencia } from './useHonorariosDaCompetencia';

export function Honorarios() {
  const vm = useHonorariosDaCompetencia();
  useCarregando(vm.carregando);
  const s = vm.situacao;
  const numeros = [
    { rotulo: 'Previsto', valor: formatos.reais(s.previsto), tom: 'neutro', icone: 'clock' },
    { rotulo: 'Recebido', valor: formatos.reais(s.recebido), tom: 'ok', icone: 'check' },
    { rotulo: 'Em aberto', valor: formatos.reais(s.emAberto), tom: 'aviso', icone: 'dinheiro' },
    { rotulo: 'Clientes pagos', valor: s.pagos + ' de ' + s.total, tom: 'info', icone: 'briefcase' },
  ] as const;
  return (
    <section>
      {vm.recebendo && <JanelaReceber contratoId={vm.recebendo} competencia={vm.competencia} fechar={vm.fecharReceber} />}
      {vm.gerenciando && <JanelaDosContratos fechar={() => vm.setGerenciando(false)} />}

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
        <button type="button" className="btn btn-outline" disabled={!vm.valida} onClick={vm.exportar}><Icone nome="download" />Exportar planilha</button>
        <button type="button" className="btn btn-outline" onClick={() => vm.setGerenciando(true)}><Icone nome="briefcase" />Gerenciar clientes</button>
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}

      <div className="stat-grid fin-numeros">
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
                  </td>
                  <td className="fin-direita">
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
