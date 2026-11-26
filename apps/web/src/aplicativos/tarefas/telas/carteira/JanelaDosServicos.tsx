// Os serviços comissionados (Vitor, 12/11/2026: "no financeiro, pode adicionar mais serviços e definir qual a porcentagem de
// cada serviço"): a lista que aparece na janela de registrar a comissão e a % de cada um. Começa com os 9 do Vitor, sem a %.
// A % própria por pessoa saiu daqui (16/11/2026): fica num lugar do banco que nenhuma tela lê (a comissão escondida).
// Em tabela (Vitor, 26/11/2026: "coloque em formato de tabela e que possa ajustar as colunas, juntamente com nomeacao crecente ou
// descrescente quando clica no cabeçalho"): as colunas com a alça (arrastar ajusta, duplo clique volta) e o título que ordena.
import { BotaoFechar, BotaoIcone, CampoReais, Icone, useJanela } from '@nads/ui';
import { useRef, type ReactNode } from 'react';
import { useColunasAjustaveis } from '../../../../comum/ColunasAjustaveis';
import { useJanelaDosServicos, type ColunaDosServicos } from './useCarteiraDaPessoa';

/** O título que ordena (o das Minhas empresas): clicar ordena crescente, de novo decrescente; o triângulo só depois do clique. */
function Titulo({ vm, coluna, numero, alca, children }: { vm: ReturnType<typeof useJanelaDosServicos>; coluna: ColunaDosServicos; numero?: boolean; alca: ReactNode; children: ReactNode }) {
  const ativo = vm.ordem?.coluna === coluna;
  return (
    <th className={'th-sort' + (numero ? ' num' : '')} onClick={() => vm.ordenar(coluna)} title="Ordenar por esta coluna"
      aria-sort={ativo ? (vm.ordem?.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      {children}{ativo && <Icone nome="caretDown" className={'th-seta' + (vm.ordem?.dir === 'asc' ? ' cima' : '')} />}
      {alca}
    </th>
  );
}

export function JanelaDosServicos({ fechar }: { fechar: () => void }) {
  const vm = useJanelaDosServicos(fechar);
  const col = useColunasAjustaveis('carteira-servicos', [
    { id: 'servico', padrao: 220 }, ...(vm.comValor ? [{ id: 'valor', padrao: 150 }] : []), { id: 'pct', padrao: 120 }, { id: 'tirar', padrao: 120 },
  ], 'servico');
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo cart-servicos-janela" role="dialog" aria-modal="true" aria-label="Serviços comissionados">
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="dinheiro" />Comissões da equipe<Icone nome="chevronRight" /><b>Serviços comissionados</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo">
          <p className="registro-dica"><Icone nome="lampada" />A comissão sai do valor do serviço × a %. Serviço sem a % não pode ser registrado.{vm.comValor && ' Com o valor, a pessoa só escolhe a quantidade; sem ele, ela digita quanto o cliente pagou.'}</p>
          {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}
          <div className="table-wrap">
            <table className="dp-tabela cart-servicos-tabela" style={col.tabela}>
              <colgroup>
                <col style={col.col('servico')} />{vm.comValor && <col style={col.col('valor')} />}<col style={col.col('pct')} /><col style={col.col('tirar')} />
              </colgroup>
              <thead>
                <tr>
                  <Titulo vm={vm} coluna="nome" alca={col.alca('servico')}>Serviço</Titulo>
                  {vm.comValor && <Titulo vm={vm} coluna="valor" numero alca={col.alca('valor')}>Valor do serviço</Titulo>}
                  <Titulo vm={vm} coluna="percentual" numero alca={col.alca('pct')}>% da comissão</Titulo>
                  <th aria-label="Tirar" />
                </tr>
              </thead>
              <tbody>
                {vm.lista.map(s => (
                  <tr key={s.id}>
                    <td><input type="text" value={s.nome} maxLength={80} onChange={e => vm.mudar(s.id, 'nome', e.target.value)} aria-label="Nome do serviço" /></td>
                    {/* o valor do serviço (23/11/2026): vazio, a pessoa digita na comissão */}
                    {vm.comValor && <td className="num"><CampoReais valor={s.valor} onMudar={v => vm.mudar(s.id, 'valor', v)} rotulo={'Valor de ' + s.nome} placeholder="a pessoa digita" /></td>}
                    <td className="num"><input type="text" inputMode="decimal" value={s.percentual} onChange={e => vm.mudar(s.id, 'percentual', e.target.value)} placeholder="0" aria-label={'% de ' + s.nome} /></td>
                    <td><BotaoIcone icone="lixeira" titulo={'Tirar ' + s.nome} pequeno onClick={() => vm.tirar(s.id)} /></td>
                  </tr>
                ))}
                <tr>
                  <td><input type="text" value={vm.novo} maxLength={80} onChange={e => vm.setNovo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') vm.acrescentar(); }} placeholder="Serviço novo" aria-label="Serviço novo" /></td>
                  {vm.comValor && <td />}
                  <td />
                  <td><button type="button" className="btn btn-outline" disabled={!vm.novo.trim()} onClick={vm.acrescentar}><Icone nome="plus" />Acrescentar</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          {vm.erros.length > 0 && <ul className="registro-erros">{vm.erros.map(e => <li key={e}><Icone nome="alert" />{e}</li>)}</ul>}
        </div>
        <footer className="registro-pe">
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={vm.salvando || !vm.carregada} onClick={() => void vm.salvar()}><Icone nome="check" />Gravar</button>
        </footer>
      </div>
    </div>
  );
}
