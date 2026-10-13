// A janela Nova empresa (Vitor, 07/10/2026), no desenho da Novo usuário: o código do ERP, o nome e o regime; Cadastrar
// grava e abre a janela da empresa (bancos, sócios, plano…).
import { BotaoAcao, Icone, MenuSuspenso } from '@nads/ui';
import { Cartao, JanelaLateral, Linha, type TopicoDaJanela } from '../../janela/JanelaLateral';
import { useNovaEmpresa } from './useNovaEmpresa';

const TOPICOS: TopicoDaJanela<'dados'>[] = [{ id: 'dados', rotulo: 'Dados', icone: 'briefcase' }];

export function JanelaNovaEmpresa({ fechar }: { fechar: () => void }) {
  const vm = useNovaEmpresa(fechar);
  return (
    <JanelaLateral rotulo="Nova empresa" topicos={TOPICOS} topico="dados" mudar={() => {}} fechar={fechar}
      resumo={(
        <div className="usuario-quem">
          <span className="pessoal-foto grande pessoal-iniciais" aria-hidden="true"><Icone nome="briefcase" /></span>
          <b>{vm.nome.trim().toUpperCase() || 'Empresa nova'}</b>
          {(vm.codigo.trim() || vm.regime) && <span className="fraco">{[vm.codigo.trim(), vm.regime].filter(Boolean).join(' · ')}</span>}
        </div>
      )}
      pe={(
        <>
          {vm.erros.length > 0 && <ul className="usuario-erros">{vm.erros.map(e => <li key={e}>{e}</li>)}</ul>}
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={vm.salvando} onClick={() => void vm.cadastrar()}>
            {vm.salvando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="plus" />}Cadastrar
          </button>
        </>
      )}>
      <Cartao titulo="Dados">
        {/* pelo CNPJ (13/10/2026): a Receita preenche o nome e, no Simples ou no MEI, o regime */}
        <Linha rotulo="CNPJ" dica={vm.avisoReceita ? <b>{vm.avisoReceita}</b> : vm.resumoDaReceita ? (vm.receitaAtiva ? vm.resumoDaReceita : <b>{vm.resumoDaReceita}</b>) : undefined}>
          <input className="usuario-campo usuario-campo-cnpj" type="text" inputMode="numeric" value={vm.cnpj} onChange={e => vm.setCnpj(e.target.value)} placeholder="00.000.000/0000-00" autoFocus
            onKeyDown={e => { if (e.key === 'Enter') void vm.buscar(); }} />
          <BotaoAcao className="btn btn-outline" carregando={vm.consultando} textoCarregando="Buscando…" disabled={vm.cnpj.replace(/\D/g, '').length !== 14} onClick={() => { void vm.buscar(); }}>
            <Icone nome="search" />Buscar na Receita
          </BotaoAcao>
        </Linha>
        <Linha rotulo="Código do ERP">
          <input className="usuario-campo" type="text" inputMode="numeric" value={vm.codigo} onChange={e => vm.setCodigo(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Ex.: 612" />
        </Linha>
        <Linha rotulo="Nome">
          <input className="usuario-campo" type="text" value={vm.nome} onChange={e => vm.setNome(e.target.value)} placeholder="Razão social" autoComplete="off"
            onKeyDown={e => { if (e.key === 'Enter') void vm.cadastrar(); }} />
        </Linha>
        <Linha rotulo="Regime">
          <MenuSuspenso rotulo={vm.regime || 'Escolher'} className="btn btn-outline" titulo="Regime" direita largura={200}
            itens={vm.regimes.map(r => ({ rotulo: r, marcado: r === vm.regime, onClick: () => vm.setRegime(r) }))} />
        </Linha>
      </Cartao>
    </JanelaLateral>
  );
}
