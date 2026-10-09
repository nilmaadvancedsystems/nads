// Etapa Arquivo do Conversor, no visual da Importação: em cima, o banco (menu suspenso) e quantos lançamentos;
// embaixo, a linha do extrato com o ícone de importar. Lido, o check (que exclui), o período e as somas.
import { Alerta, CampoArquivos, Icone, LogoBanco, MenuSuspenso } from '@nads/ui';
import { useArquivo } from './useArquivo';

export function Arquivo() {
  const vm = useArquivo();
  return (
    <section>
      <div className="imp-topo">
        <MenuSuspenso icone="landmark" rotulo={vm.banco || 'Escolher o banco'} dica="O banco dá o nome da aba e do arquivo"
          itens={vm.bancos.map(b => ({ rotulo: b.nome, marcado: b.marcado, onClick: () => vm.escolherBanco(b.nome) }))} />
        <span className="imp-topo-num"><Icone nome="list" /><b>{vm.qtd}</b> {vm.qtd === 1 ? 'lançamento' : 'lançamentos'}</span>
        <span className="imp-topo-meio" />
      </div>

      <div className="imp-lista">
        <div className={'imp-bloco' + (vm.ok ? ' imp-ok' : '')}>
          <div className="imp-linha">
            <span className="imp-ico imp-logo">{vm.marca ? <LogoBanco banco={vm.marca} cor={vm.ok} /> : <Icone nome="landmark" />}</span>
            <div className="imp-txt">
              <span><b>Extrato do banco</b>{vm.arquivo && <span className="imp-conta">{vm.arquivo}</span>}</span>
            </div>
            <div className="imp-resumo">{!vm.lendo && vm.resumo.length > 0 && <div>{vm.resumo.map(t => <span key={t}>{t}</span>)}</div>}</div>
            <div className="imp-grupos">
              <div className="imp-grupo" aria-label="Extrato">
                <span className="imp-rotulo">Extrato</span>
                {vm.lendo ? <span className="btn-spinner" aria-label="Lendo o extrato" />
                  : vm.arquivo ? (
                    <button type="button" className={'icon-btn icon-btn-sm imp-btn' + (vm.ok ? ' imp-feito' : '')} onClick={vm.tirar}
                      title={'Lido: ' + vm.arquivo + '. Clique para tirar.'} aria-label={'Tirar ' + vm.arquivo}>
                      {vm.ok && <Icone nome="check" className="imp-feito-ok" />}
                      <Icone nome="x" className={vm.ok ? 'imp-feito-x' : undefined} />
                    </button>
                  ) : (
                    <CampoArquivos id="conversorExtrato" compacto aceitar={vm.aceitar} onEscolher={vm.ler} rotulo="Escolher o extrato (PDF, OFX, Excel ou CSV)" />
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {vm.erro && <Alerta titulo="Não deu para ler o extrato" texto={vm.erro} />}
      {vm.ok && !vm.banco && <Alerta titulo="Escolha o banco" texto="Não achei o nome do banco no extrato. Escolha no menu acima: ele vira o nome da aba e do arquivo." />}
      {vm.generico && (
        <Alerta titulo="Leitor genérico" texto="Este layout ainda não tem leitor próprio (por enquanto o Banco do Brasil, a Cora, a Unicred e a InfinitePay). Confira os valores, os sinais e os históricos na Conferência." />
      )}
    </section>
  );
}
