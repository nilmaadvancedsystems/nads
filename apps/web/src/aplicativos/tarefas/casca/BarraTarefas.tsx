// View da barra da direita do cabeçalho da Tarefas (como a do GitHub):
//   [🔍 Buscar empresa  /]  |  [+ ▾]  [▶ Continuar]  [⚠ Paradas ·n]  [☰ Minhas empresas]  (V)
import { Icone, MenuSuspenso, SeletorTema } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { useBarraTarefas } from './useBarraTarefas';

export function BarraTarefas({ competencia }: { competencia?: string }) {
  const vm = useBarraTarefas(competencia);
  return (
    <>
      <BuscaEmpresa vm={vm} />
      <span className="gh-barra-sep" aria-hidden="true" />
      {vm.temRotina && (
        <MenuSuspenso icone="plus" rotulo="" className="btn btn-outline gh-barra-novo" dica="Novo" titulo="Novo" direita largura={280}
          itens={[
            { icone: 'play', rotulo: 'Iniciar empresa…', onClick: vm.iniciar },
            ...(vm.proximaDaFila ? [{ icone: 'repeat' as const, rotulo: 'Próxima da fila', dica: vm.proximaDaFila.codigo != null ? String(vm.proximaDaFila.codigo) : vm.proximaDaFila.nome, onClick: vm.irProximaDaFila }] : []),
          ]} />
      )}
      {vm.temRotina && (
        <button type="button" className="icon-btn gh-barra-btn" disabled={!vm.continuar} onClick={vm.irContinuar}
          title={vm.continuar ? 'Continuar: ' + (vm.continuar.codigo != null ? vm.continuar.codigo + ' · ' : '') + vm.continuar.nome + (vm.continuar.etapa ? ' — ' + vm.continuar.etapa : '') : 'Nada para continuar nesta competência'}
          aria-label="Continuar de onde parei">
          <Icone nome="play" />
        </button>
      )}
      {vm.temRotina && (
        <button type="button" className="icon-btn gh-barra-btn" onClick={vm.irParadas}
          title={vm.paradas ? vm.paradas + (vm.paradas === 1 ? ' empresa parada' : ' empresas paradas') : 'Nenhuma empresa parada'} aria-label="Paradas">
          <Icone nome="alert" />
          {vm.paradas > 0 && <span className="gh-barra-num">{vm.paradas > 99 ? '99+' : vm.paradas}</span>}
        </button>
      )}
      <button type="button" className="icon-btn gh-barra-btn" onClick={vm.irMinhasEmpresas} title="Minhas empresas" aria-label="Minhas empresas">
        <Icone nome="briefcase" />
      </button>
      <MenuSuspenso rotulo={<span className="gh-avatar" aria-hidden="true">{vm.pessoa.iniciais}</span>} semSeta direita largura={240}
        className="gh-avatar-btn" dica={vm.pessoa.nome}
        conteudo={fechar => (
          <div className="gh-voce">
            <p className="gh-voce-nome"><b>{vm.pessoa.nome}</b><span className="hint">{vm.pessoa.cargo}</span></p>
            <hr className="popover-sep" />
            <button type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); vm.trocarPessoa(); }}>
              <Icone nome="repeat" /><span className="popover-texto">Trocar de pessoa</span>
            </button>
            <hr className="popover-sep" />
            <div className="gh-voce-tema"><span className="hint">Tema</span><SeletorTema /></div>
          </div>
        )} />
    </>
  );
}

/** A busca do cabeçalho: "/" de qualquer tela (menos onde a página tem a busca dela), ↑ ↓ e Enter. */
function BuscaEmpresa({ vm }: { vm: ReturnType<typeof useBarraTarefas> }) {
  const campo = useRef<HTMLInputElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [aberta, setAberta] = useState(false);
  const [marcada, setMarcada] = useState(0);
  useEffect(() => {
    // no window: a busca da própria página (no document) vem antes e, se usar o "/", fica com ele
    const atalho = (e: KeyboardEvent) => {
      const alvo = e.target;
      if (e.key !== '/' || e.defaultPrevented || (alvo instanceof Element && alvo.closest('input, textarea, select, [contenteditable]'))) return;
      e.preventDefault();
      campo.current?.focus();
    };
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberta(false); };
    window.addEventListener('keydown', atalho);
    document.addEventListener('mousedown', fora);
    return () => { window.removeEventListener('keydown', atalho); document.removeEventListener('mousedown', fora); };
  }, []);
  const lista = vm.achadas;
  const escolher = (i: number) => { const l = lista[i]; if (!l) return; setAberta(false); campo.current?.blur(); vm.abrir(l); };
  return (
    <div className="gh-busca" ref={caixa}>
      <Icone nome="search" />
      <input ref={campo} type="text" placeholder="Buscar empresa" aria-label="Buscar empresa (código ou nome)" value={vm.busca}
        onFocus={() => setAberta(true)}
        onChange={e => { vm.setBusca(e.target.value); setMarcada(0); setAberta(true); }}
        onKeyDown={e => {
          if (e.key === 'Escape') { vm.setBusca(''); setAberta(false); campo.current?.blur(); }
          if (e.key === 'ArrowDown') { e.preventDefault(); setMarcada(m => Math.min(m + 1, lista.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setMarcada(m => Math.max(m - 1, 0)); }
          if (e.key === 'Enter') { e.preventDefault(); escolher(marcada); }
        }} />
      {!vm.busca && <kbd>/</kbd>}
      {aberta && vm.busca.trim() && (
        <div className="popover gh-busca-lista" role="listbox" aria-label="Empresas">
          {lista.length === 0 ? <p className="hint gh-busca-vazia">Nenhuma empresa com “{vm.busca.trim()}”.</p> : lista.map((l, i) => (
            <button key={l.chave} type="button" role="option" aria-selected={i === marcada} className={'popover-item' + (i === marcada ? ' marcado' : '')}
              onMouseEnter={() => setMarcada(i)} onClick={() => escolher(i)}>
              <span className={'bolinha-sit ' + l.situacao} title={l.rotuloSituacao} />
              <span className="gh-busca-cod">{l.codigo ?? ''}</span>
              <span className="popover-texto gh-busca-nome">{l.nome}</span>
              {l.etapa && <span className="popover-dica">{l.etapa}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
