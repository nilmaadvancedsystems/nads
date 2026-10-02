// O catálogo de componentes (View): a casca do nads, com os tipos na gaveta ☰ (Botões, Selos, Janelas…; Vitor, 02/10/2026:
// "migre para esse menu lateral", as abas de cima já não cabiam) e as telas
// do sistema no menu lateral (filtra as peças que aparecem nela). Cada peça num cartão: o desenho ao vivo, como se
// escreve (componente e classes), o código e as telas onde ela aparece (clicar filtra).
import { AberturaN, Casca, Icone } from '@nads/ui';
import { VERSAO_SISTEMA } from '../../../versao';
import { useCatalogo } from './useCatalogo';

export function Catalogo() {
  const vm = useCatalogo();
  const secoes = [
    { id: '', rotulo: 'Todas as telas', icone: 'grade' as const, grupo: 0, ativa: !vm.tela },
    ...vm.telas.map(t => ({ id: t.id, rotulo: t.nome + (t.qtd ? ' · ' + t.qtd : ''), icone: 'fileText' as const, grupo: t.grupo, titulo: t.app, ativa: t.id === vm.tela })),
  ];
  return (
    <Casca sistema="Componentes" empresa={{ codigo: '', nome: 'Catálogo do nads' }} versao={VERSAO_SISTEMA}
      secoes={secoes} rotuloLateral="Telas"
      paginas={[]}
      aplicativos={vm.tipos.map(t => ({ id: t.id, nome: t.nome, icone: t.icone, ativo: t.ativo, contador: String(t.qtd) }))} onAplicativo={vm.escolherTipo}
      titulo={vm.tipo.nome} descricao={vm.tipo.descricao + (vm.nomeDaTela ? ' · em ' + vm.nomeDaTela.app + ' › ' + vm.nomeDaTela.nome : '')}
      acoes={(
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar código, peça ou classe" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} aria-label="Buscar peça ou classe" />
        </label>
      )}
      onSecao={vm.escolherTela} onPagina={vm.escolherTipo} onInicio={() => vm.escolherTela('')} onEmpresa={() => vm.escolherTela('')}>
      {vm.pecas.length ? (
        <div className="cat-lista">
          {vm.pecas.map(p => (
            <section key={p.id} className={'card cat-peca' + (p.largo ? ' largo' : '') + (p.removida ? ' cat-removida' : '')} id={p.id}>
              <header className="cat-peca-topo">
                <div>
                  <h3><span className="cat-cod">{p.cod}</span>{p.removida ? <s>{p.nome}</s> : p.nome}</h3>
                  {p.removida && <p className="cat-destino">{vm.destinoDe(p)}</p>}
                  {p.descricao && <p className="hint">{p.descricao}</p>}
                </div>
                <div className="cat-peca-nomes">
                  <button type="button" className="icon-btn icon-btn-sm cat-play" onClick={() => vm.reproduzir(p)}
                    title={p.aoVivo ? 'Reproduzir de verdade (por cima da tela)' : 'Reproduzir (a animação de entrada)'} aria-label={'Reproduzir ' + p.cod}><Icone nome="play" /></button>
                  {p.componente && <code className="cat-codigo-chip">{'<' + p.componente + '>'}</code>}
                  {(p.classes || []).map(c => <code key={c} className="cat-codigo-chip">.{c.split(' ').join('.')}</code>)}
                </div>
              </header>
              <div className="cat-palco" key={p.id + ':' + vm.vezDe(p.id)}>{p.demo()}</div>
              {p.uso && <pre className="cat-codigo"><code>{p.uso}</code></pre>}
              {p.telas.length > 0 && (
                <footer className="cat-telas">
                  <span className="hint">Aparece em</span>
                  {p.telas.map(t => (
                    <button key={t} type="button" className={'cat-tela' + (t === vm.tela ? ' ativa' : '')} onClick={() => vm.escolherTela(t)}>{vm.nomeDe(t)}</button>
                  ))}
                </footer>
              )}
            </section>
          ))}
        </div>
      ) : (
        <div className="gh-blank">
          <Icone nome="search" />
          <h4>Nenhuma peça{vm.nomeDaTela ? ' deste tipo nesta tela' : ''}</h4>
          <p>{vm.total} {vm.total === 1 ? 'peça' : 'peças'} de {vm.tipo.nome.toLowerCase()} no sistema.</p>
        </div>
      )}
      {/* o ▶ da abertura: na tela inteira, por uns segundos */}
      {vm.abertura && <AberturaN vidro={vm.abertura === 'vidro'} inteira={vm.abertura === 'completa'} />}
    </Casca>
  );
}
