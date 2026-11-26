// Os serviços comissionados (Vitor, 12/11/2026: "no financeiro, pode adicionar mais serviços e definir qual a porcentagem de
// cada serviço"): a lista que aparece na janela de registrar a comissão e a % de cada um. Começa com os 9 do Vitor, sem a %.
// A % própria por pessoa saiu daqui (16/11/2026): fica num lugar do banco que nenhuma tela lê (a comissão escondida).
// Em tabela (Vitor, 26/11/2026: "coloque em formato de tabela e que possa ajustar as colunas, juntamente com nomeacao crecente ou
// descrescente quando clica no cabeçalho"): o título que ordena. No jeito de planilha (26/11/2026: "Prefiro um modo tabela
// auto-ajustavel, sem essas box de borda arredondada, o botao de lixeira vermelho e um botao de adicionar abaixo"): a tabela
// ocupa a largura da janela (o Serviço fica com o que sobra), a célula é o próprio campo, a lixeira vermelha e o Adicionar embaixo.
import { BotaoFechar, BotaoIcone, CampoReais, Icone, useJanela } from '@nads/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useJanelaDosServicos, type ColunaDosServicos } from './useCarteiraDaPessoa';

/** O título que ordena (o das Minhas empresas): clicar ordena crescente, de novo decrescente; o triângulo só depois do clique. */
function Titulo({ vm, coluna, children }: { vm: ReturnType<typeof useJanelaDosServicos>; coluna: ColunaDosServicos; children: ReactNode }) {
  const ativo = vm.ordem?.coluna === coluna;
  return (
    <th className="th-sort" onClick={() => vm.ordenar(coluna)} title="Ordenar por esta coluna"
      aria-sort={ativo ? (vm.ordem?.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      {children}{ativo && <Icone nome="caretDown" className={'th-seta' + (vm.ordem?.dir === 'asc' ? ' cima' : '')} />}
    </th>
  );
}

export function JanelaDosServicos({ fechar }: { fechar: () => void }) {
  const vm = useJanelaDosServicos(fechar);
  // o Adicionar põe o cursor no nome da linha nova
  const [focar, setFocar] = useState('');
  const tabela = useRef<HTMLTableElement>(null);
  useEffect(() => {
    if (!focar) return;
    const campo = tabela.current?.querySelector<HTMLInputElement>('input[data-servico="' + focar + '"]');
    campo?.focus();
    campo?.scrollIntoView({ block: 'nearest' });
    setFocar('');
  }, [focar]);
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
            <table ref={tabela} className="dp-tabela cart-servicos-tabela">
              <colgroup>
                <col />{vm.comValor && <col className="cart-servicos-valor" />}<col className="cart-servicos-pct" /><col className="cart-servicos-tirar" />
              </colgroup>
              <thead>
                <tr>
                  <Titulo vm={vm} coluna="nome">Serviço</Titulo>
                  {vm.comValor && <Titulo vm={vm} coluna="valor">Valor do serviço</Titulo>}
                  <Titulo vm={vm} coluna="percentual">% da comissão</Titulo>
                  <th aria-label="Tirar" />
                </tr>
              </thead>
              <tbody>
                {vm.lista.map(s => (
                  <tr key={s.id}>
                    <td><input type="text" data-servico={s.id} value={s.nome} maxLength={80} onChange={e => vm.mudar(s.id, 'nome', e.target.value)} placeholder="O nome do serviço" aria-label="Nome do serviço" /></td>
                    {/* o valor do serviço (23/11/2026): vazio, a pessoa digita na comissão */}
                    {vm.comValor && <td><CampoReais valor={s.valor} onMudar={v => vm.mudar(s.id, 'valor', v)} rotulo={'Valor de ' + (s.nome || 'serviço novo')} placeholder="a pessoa digita" /></td>}
                    <td><input type="text" inputMode="decimal" value={s.percentual} onChange={e => vm.mudar(s.id, 'percentual', e.target.value)} placeholder="0" aria-label={'% de ' + (s.nome || 'serviço novo')} /></td>
                    <td><BotaoIcone icone="lixeira" className="cart-servicos-tirar-btn" titulo={'Tirar ' + (s.nome || 'o serviço novo')} pequeno onClick={() => vm.tirar(s.id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <button type="button" className="btn btn-outline" onClick={() => setFocar(vm.adicionar())}><Icone nome="plus" />Adicionar serviço</button>
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
