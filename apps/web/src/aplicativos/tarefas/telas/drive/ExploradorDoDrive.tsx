// Drive › Pastas, com a cara do Explorador de Arquivos do Windows, numa barra só: voltar, avançar, acima, a trilha, a
// pesquisa, Detalhes/Ícones, Tela cheia (cobre o nads todo; Esc sai), o "⋯" (baixar a pasta, selecionar tudo, a árvore,
// classificar) e o botão cheio Enviar arquivos. Embaixo, a barra de status vira a da seleção (Baixar e limpar) quando
// há algo marcado. A árvore das pastas (escondida no começo) e a lista em Detalhes ou Ícones. Um clique seleciona (Ctrl junta, Shift faz
// o intervalo), dois cliques (ou Enter) abrem; na tela de toque, um toque abre. Abrir um arquivo: a aba nasce no
// clique (senão o navegador bloqueia) e recebe o link quando o robô termina de buscar. O botão direito abre o menu
// do Explorador (MenuDeContexto) e "Enviar para o Claudio Secretário" (botão, menu ou arrastar arquivos para a tela)
// manda arquivos para a pasta de onde o arquivamento tira.
import type { entregas as e } from '@nads/core';
import { Icone, useCarregando, useRetorno } from '@nads/ui';
import { useEffect, useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { EnviarAoSecretario } from './EnviarAoSecretario';
import { MenuDeContexto, type LinhaDoMenu, type MenuAberto, type OpcaoDoMenu } from './MenuDeContexto';
import { useEnvioAoSecretario } from './useEnvioAoSecretario';
import { useExploradorDoDrive, type VmDrive } from './useExploradorDoDrive';

type AoMenu = (ev: MouseEvent, x: e.EntradaDoExplorador | null) => void;

/** Onde abrir o menu: no mouse, ou (tecla de menu / Shift+F10) embaixo do elemento. */
function pontoDoMenu(ev: MouseEvent): { x: number; y: number } {
  if (ev.clientX || ev.clientY) return { x: ev.clientX, y: ev.clientY };
  const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
  return { x: r.left + 24, y: r.bottom };
}

const COLUNAS: { id: e.ColunaDoExplorador; rotulo: string }[] = [
  { id: 'nome', rotulo: 'Nome' }, { id: 'data', rotulo: 'Data de modificação' }, { id: 'tipo', rotulo: 'Tipo' }, { id: 'tamanho', rotulo: 'Tamanho' },
];

/** Na lista em Detalhes o Tipo não entra (a cor do ícone já diz; está no título e nas Propriedades). */
const COLUNAS_DA_LISTA = COLUNAS.filter(c => c.id !== 'tipo');

const toque = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

function baixar(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function abrirArquivo(vm: VmDrive, x: e.EntradaDoExplorador) {
  const janela = window.open('', '_blank');
  if (janela) { try { janela.document.title = 'Abrindo ' + x.nome; janela.document.body.textContent = 'Buscando "' + x.nome + '" no Drive…'; } catch { /* outra origem */ } }
  vm.linkParaAbrir(x.id).then(url => {
    if (janela && !janela.closed) janela.location.href = url; else window.open(url, '_blank');
  }, () => { try { janela?.close(); } catch { /* já fechou */ } });
}

function abrir(vm: VmDrive, x: e.EntradaDoExplorador) {
  if (x.pasta) vm.entrar(x.id); else abrirArquivo(vm, x);
}

/** Os eventos de uma linha (ou ícone): clique seleciona, duplo clique/Enter abre, espaço marca, botão direito abre o menu. */
function eventos(vm: VmDrive, x: e.EntradaDoExplorador, aoMenu: AoMenu) {
  return {
    onContextMenu: (ev: MouseEvent) => aoMenu(ev, x),
    onClick: (ev: MouseEvent) => {
      if (toque() && !ev.ctrlKey && !ev.shiftKey && !ev.metaKey) { abrir(vm, x); return; }
      vm.selecionar(x.id, { ctrl: ev.ctrlKey || ev.metaKey, shift: ev.shiftKey });
    },
    onDoubleClick: () => abrir(vm, x),
    onKeyDown: (ev: KeyboardEvent) => {
      if (ev.key === 'Enter') { ev.preventDefault(); abrir(vm, x); }
      else if (ev.key === ' ') { ev.preventDefault(); vm.selecionar(x.id, { ctrl: true }); }
    },
  };
}

function IconeDaEntrada({ x, grande }: { x: e.EntradaDoExplorador; grande?: boolean }) {
  const nome = x.pasta ? 'pasta' : /Google|texto|Word/.test(x.tipo) ? 'fileText' : 'arquivo';
  const cor = x.pasta ? ' pasta' : /PDF/.test(x.tipo) ? ' pdf' : /Excel|CSV|Planilha/.test(x.tipo) ? ' planilha' : /Word|Documento Google/.test(x.tipo) ? ' texto' : '';
  return <Icone nome={nome} className={'drive-ico' + cor + (grande ? ' grande' : '')} />;
}

function Arvore({ vm, aoMenu }: { vm: VmDrive; aoMenu: (ev: MouseEvent, no: e.NoDaArvore) => void }) {
  return (
    <nav className="explorador-arvore" aria-label="Painel de navegação">
      <ul role="tree">
        <li role="treeitem" aria-selected={vm.naRaiz} aria-expanded>
          <div className={'arvore-no' + (vm.naRaiz ? ' atual' : '')} style={{ paddingLeft: 6 }}>
            <span className="arvore-seta" />
            <button type="button" className="arvore-rotulo" onClick={vm.irParaRaiz}>
              <Icone nome="pasta" className="drive-ico pasta" /><span className="arvore-nome">{vm.ano}</span>
            </button>
          </div>
        </li>
        {vm.arvore.map(no => (
          <li key={no.id} role="treeitem" aria-selected={vm.naPasta(no.id)} aria-expanded={no.temFilhos ? no.aberto : undefined}>
            <div className={'arvore-no' + (vm.naPasta(no.id) ? ' atual' : '')} style={{ paddingLeft: 6 + (no.nivel + 1) * 14 }}>
              {no.temFilhos
                ? <button type="button" className="arvore-seta" aria-label={(no.aberto ? 'Fechar ' : 'Abrir ') + no.nome} onClick={() => vm.alternarNo(no.id)}>
                  <Icone nome={no.aberto ? 'caretDown' : 'chevronRight'} />
                </button>
                : <span className="arvore-seta" />}
              <button type="button" className="arvore-rotulo" title={no.nome} onClick={() => vm.abrirNo(no)} onContextMenu={ev => aoMenu(ev, no)}>
                <Icone nome="pasta" className="drive-ico pasta" /><span className="arvore-nome">{no.nome}</span>
                {no.carregando && <span className="drive-girando" aria-label="carregando" />}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Detalhes({ vm, aoMenu }: { vm: VmDrive; aoMenu: AoMenu }) {
  return (
    <table className="explorador-detalhes">
      <thead>
        <tr>
          {COLUNAS_DA_LISTA.map(c => (
            <th key={c.id} className={'col-' + c.id} aria-sort={vm.coluna === c.id ? (vm.desc ? 'descending' : 'ascending') : undefined}>
              <button type="button" onClick={() => vm.ordenarPor(c.id)}>
                {c.rotulo}{vm.coluna === c.id && <Icone nome={vm.desc ? 'arrowDown' : 'arrowUp'} className="explorador-ordem" />}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {vm.entradas.map(x => (
          <tr key={x.id} tabIndex={0} aria-selected={vm.estaMarcado(x.id)} className={vm.estaMarcado(x.id) ? 'marcado' : undefined} {...eventos(vm, x, aoMenu)}>
            <td className="col-nome" title={x.nome + ' · ' + x.tipo}>
              <span className="drive-nome"><IconeDaEntrada x={x} /><span>{x.nome}{x.onde && <span className="fraco drive-onde">{x.onde}</span>}</span></span>
            </td>
            <td className="col-data">{vm.quando(x.data)}</td>
            <td className="col-tamanho">{x.pasta ? '' : vm.tamanho(x.bytes)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Icones({ vm, aoMenu }: { vm: VmDrive; aoMenu: AoMenu }) {
  return (
    <ul className="explorador-icones" role="listbox" aria-multiselectable>
      {vm.entradas.map(x => (
        <li key={x.id} role="option" tabIndex={0} aria-selected={vm.estaMarcado(x.id)} className={vm.estaMarcado(x.id) ? 'marcado' : undefined}
          title={x.nome + '\n' + x.tipo + (x.pasta ? '' : '\n' + vm.tamanho(x.bytes))} {...eventos(vm, x, aoMenu)}>
          <IconeDaEntrada x={x} grande />
          <span className="explorador-icone-nome">{x.nome}</span>
        </li>
      ))}
    </ul>
  );
}

export function ExploradorDoDrive() {
  const vm = useExploradorDoDrive();
  const envio = useEnvioAoSecretario(vm.pastaCliente);
  const { toast, modal } = useRetorno();
  useCarregando(vm.carregando);
  // as opções do menu rodam depois de a seleção mudar: usam sempre o ViewModel mais novo
  const atual = useRef(vm);
  atual.current = vm;
  const [menu, setMenu] = useState<MenuAberto | null>(null);
  const [soltando, setSoltando] = useState(false);
  const baixarMarcados = () => { atual.current.linkDosMarcados().then(url => { baixar(url); atual.current.limparSelecao(); }, () => {}); };
  const baixarPasta = () => { atual.current.linkDaPasta().then(baixar, () => {}); };
  const copiar = (texto: string, oque: string) => {
    navigator.clipboard.writeText(texto).then(() => toast(oque + ' copiado.'), () => toast('Não consegui copiar (o navegador não deixou).'));
  };
  const nomes = (l: e.EntradaDoExplorador[]) => l.map(i => i.nome).join('\n');
  const caminhos = (l: e.EntradaDoExplorador[]) => l.map(i => atual.current.caminhoDe(i)).join('\n');
  const propriedades = (x: e.EntradaDoExplorador) => {
    void modal({
      icone: 'fileText', titulo: 'Propriedades de ' + x.nome, botoes: [{ rotulo: 'OK', valor: true, variante: 'btn-primary' }],
      corpo: <dl className="explorador-propriedades">{atual.current.propriedadesDe(x).map(l => <div key={l.rotulo}><dt>{l.rotulo}</dt><dd>{l.valor}</dd></div>)}</dl>,
    });
  };

  /** O menu de uma linha (ou do fundo, com x = null), como o do Windows. */
  const abrirMenu: AoMenu = (ev, x) => {
    ev.preventDefault();
    ev.stopPropagation();
    const v = atual.current;
    if (!x) {
      const exibir: LinhaDoMenu[] = [
        { titulo: 'Exibir' },
        { rotulo: 'Detalhes', icone: 'list', marcado: v.exibicao === 'detalhes', onClick: () => atual.current.mudarExibicao('detalhes') },
        { rotulo: 'Ícones', icone: 'grade', marcado: v.exibicao === 'icones', onClick: () => atual.current.mudarExibicao('icones') },
        { rotulo: 'Árvore (painel de navegação)', icone: 'painel', marcado: v.mostrarArvore, onClick: () => atual.current.alternarArvore() },
        { titulo: 'Classificar por' },
        ...COLUNAS.map<OpcaoDoMenu>(c => ({ rotulo: c.rotulo, marcado: v.coluna === c.id, onClick: () => atual.current.ordenarPor(c.id) })),
      ];
      setMenu({
        ...pontoDoMenu(ev),
        topo: [],
        linhas: [
          ...exibir,
          'separador',
          { rotulo: 'Selecionar tudo', icone: 'checkCircle', atalho: 'Ctrl+A', desabilitado: !v.entradas.length, onClick: () => atual.current.selecionarTodos() },
          { rotulo: 'Baixar esta pasta (.zip)', icone: 'download', desabilitado: !v.podeBaixarPasta, onClick: baixarPasta },
          { rotulo: 'Enviar para o Claudio Secretário…', icone: 'upload', onClick: () => envio.abrir() },
          'separador',
          { rotulo: v.telaCheia ? 'Sair da tela cheia' : 'Tela cheia', icone: v.telaCheia ? 'minimizar' : 'maximizar', onClick: () => atual.current.alternarTelaCheia() },
        ],
      });
      return;
    }
    v.selecionarParaMenu(x.id);
    const varios = v.estaMarcado(x.id) && v.marcados.length > 1 ? v.marcados : [x];
    const n = varios.length;
    const soPastas = n > 1 && varios.every(i => i.pasta);
    const baixarRotulo = n > 1 ? 'Baixar ' + n + ' itens (.zip)' : x.pasta ? 'Baixar pasta (.zip)' : 'Baixar';
    setMenu({
      ...pontoDoMenu(ev),
      topo: [
        { rotulo: baixarRotulo, icone: 'download', desabilitado: soPastas, onClick: baixarMarcados },
        { rotulo: 'Copiar nome', icone: 'copiar', onClick: () => copiar(nomes(varios), n > 1 ? 'Nomes' : 'Nome') },
        { rotulo: 'Copiar caminho', icone: 'link', onClick: () => copiar(caminhos(varios), 'Caminho') },
        { rotulo: 'Propriedades', icone: 'settings', desabilitado: n > 1, onClick: () => propriedades(x) },
      ],
      linhas: [
        { rotulo: 'Abrir', icone: x.pasta ? 'pasta' : 'arquivo', atalho: 'Enter', desabilitado: n > 1, onClick: () => abrir(atual.current, x) },
        { rotulo: baixarRotulo, icone: 'download', desabilitado: soPastas, onClick: baixarMarcados },
        'separador',
        { rotulo: 'Copiar nome', icone: 'copiar', onClick: () => copiar(nomes(varios), n > 1 ? 'Nomes' : 'Nome') },
        { rotulo: 'Copiar caminho', icone: 'link', atalho: 'Ctrl+Shift+C', onClick: () => copiar(caminhos(varios), 'Caminho') },
        'separador',
        { rotulo: 'Enviar para o Claudio Secretário…', icone: 'upload', onClick: () => envio.abrir() },
        { rotulo: 'Selecionar tudo', icone: 'checkCircle', atalho: 'Ctrl+A', onClick: () => atual.current.selecionarTodos() },
        'separador',
        { rotulo: 'Propriedades', icone: 'settings', atalho: 'Alt+Enter', desabilitado: n > 1, onClick: () => propriedades(x) },
      ],
    });
  };
  /** O "⋯" da barra: o que sai da vista (baixar a pasta, selecionar, classificar, a árvore), embaixo do botão. */
  const abrirMais = (ev: MouseEvent<HTMLButtonElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const v = atual.current;
    setMenu({
      x: r.right - 240, y: r.bottom + 4, topo: [],
      linhas: [
        { rotulo: 'Baixar esta pasta (.zip)', icone: 'download', desabilitado: !v.podeBaixarPasta, onClick: baixarPasta },
        { rotulo: 'Selecionar tudo', icone: 'checkCircle', atalho: 'Ctrl+A', desabilitado: !v.entradas.length, onClick: () => atual.current.selecionarTodos() },
        'separador',
        { rotulo: 'Árvore (painel de navegação)', icone: 'painel', marcado: v.mostrarArvore, onClick: () => atual.current.alternarArvore() },
        { titulo: 'Classificar por' },
        ...COLUNAS.map<OpcaoDoMenu>(c => ({ rotulo: c.rotulo, marcado: v.coluna === c.id, onClick: () => atual.current.ordenarPor(c.id) })),
      ],
    });
  };
  const menuDaArvore = (ev: MouseEvent, no: e.NoDaArvore) => {
    ev.preventDefault();
    ev.stopPropagation();
    const linhas: LinhaDoMenu[] = [{ rotulo: 'Abrir', icone: 'pasta', onClick: () => atual.current.abrirNo(no) }];
    if (no.temFilhos) linhas.push({ rotulo: no.aberto ? 'Recolher' : 'Expandir', icone: no.aberto ? 'caretDown' : 'chevronRight', onClick: () => atual.current.alternarNo(no.id) });
    linhas.push('separador',
      { rotulo: 'Copiar nome', icone: 'copiar', onClick: () => copiar(no.nome, 'Nome') },
      { rotulo: 'Enviar para o Claudio Secretário…', icone: 'upload', onClick: () => envio.abrir() });
    setMenu({ ...pontoDoMenu(ev), topo: [], linhas });
  };
  // arrastar arquivos do computador para o Explorador: abre o envio com eles
  const temArquivos = (ev: DragEvent) => Array.from(ev.dataTransfer?.types || []).includes('Files');
  const arrastando = (ev: DragEvent) => { if (!temArquivos(ev) || envio.aberto) return; ev.preventDefault(); setSoltando(true); };
  const soltar = (ev: DragEvent) => {
    if (!temArquivos(ev) || envio.aberto) return;
    ev.preventDefault();
    setSoltando(false);
    envio.abrir(Array.from(ev.dataTransfer.files || []));
  };

  const teclas = (ev: KeyboardEvent) => {
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return;
    const um = vm.marcados.length === 1 ? vm.marcados[0] : null;
    if (ev.altKey && ev.key === 'Enter' && um) { ev.preventDefault(); propriedades(um); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && ev.key.toLowerCase() === 'c' && vm.marcados.length) {
      ev.preventDefault();
      copiar(caminhos(vm.marcados), 'Caminho');
      return;
    }
    if (ev.altKey && ev.key === 'ArrowLeft') { ev.preventDefault(); vm.voltar(); }
    else if (ev.altKey && ev.key === 'ArrowRight') { ev.preventDefault(); vm.avancar(); }
    else if ((ev.altKey && ev.key === 'ArrowUp') || ev.key === 'Backspace') { ev.preventDefault(); vm.subir(); }
    else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'a') { ev.preventDefault(); vm.selecionarTodos(); }
  };
  const n = vm.entradas.length;
  const m = vm.marcados.length;
  // a barra de endereço mostra o fim do caminho (a pasta aberta), como no Windows
  const trilha = useRef<HTMLElement>(null);
  const fimDaTrilha = vm.trilha.map(p => p.p || p.c).join('/');
  useEffect(() => { const el = trilha.current; if (el) el.scrollLeft = el.scrollWidth; }, [fimDaTrilha]);
  // no PC o Explorador vai até o fim da janela e a página não rola (uma barra de rolagem só, a da lista);
  // na tela cheia ele cobre tudo. No celular, a página rola como sempre.
  const caixa = useRef<HTMLElement>(null);
  const [altura, setAltura] = useState<number | null>(null);
  useLayoutEffect(() => {
    const medir = () => {
      const el = caixa.current;
      if (!el || vm.telaCheia || window.innerWidth <= 760) { setAltura(null); return; }
      setAltura(Math.max(320, Math.floor(window.innerHeight - (el.getBoundingClientRect().top + window.scrollY))));
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [vm.telaCheia]);
  const travar = vm.telaCheia || altura !== null;
  // Esc (em qualquer lugar da página, fora dos campos): limpa a seleção; sem seleção, sai da tela cheia
  const esc = useRef(() => {});
  esc.current = () => { if (vm.marcados.length) vm.limparSelecao(); else if (vm.telaCheia) vm.alternarTelaCheia(); };
  useEffect(() => {
    const tecla = (ev: globalThis.KeyboardEvent) => {
      if (ev.key !== 'Escape' || ev.defaultPrevented || ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return;
      esc.current();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);
  useEffect(() => {
    if (!travar) return;
    const html = document.documentElement;
    const antes = html.style.overflow;
    window.scrollTo(0, 0);
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = antes; };
  }, [travar]);

  return (
    <section ref={caixa} className={'explorador' + (vm.telaCheia ? ' tela-cheia' : '') + (soltando ? ' soltando' : '')} style={altura ? { height: altura } : undefined}
      onKeyDown={teclas} onDragOver={arrastando} onDragLeave={ev => { if (!ev.currentTarget.contains(ev.relatedTarget as Node | null)) setSoltando(false); }} onDrop={soltar}>
      <div className="explorador-endereco" role="toolbar" aria-label="Drive">
        <div className="explorador-navegar">
          <button type="button" className="explorador-btn" title="Voltar (Alt+←)" aria-label="Voltar" onClick={vm.voltar}><Icone nome="chevronLeft" /></button>
          <button type="button" className="explorador-btn" title="Avançar (Alt+→)" aria-label="Avançar" onClick={vm.avancar}><Icone nome="chevronRight" /></button>
          <button type="button" className="explorador-btn" title="Acima (Alt+↑)" aria-label="Acima" disabled={!vm.podeSubir} onClick={vm.subir}><Icone nome="arrowUp" /></button>
        </div>
        <nav ref={trilha} className="explorador-trilha" aria-label="Endereço">
          <Icone nome="pasta" className="drive-ico pasta" />
          <button type="button" onClick={vm.irParaRaiz}>{vm.ano}</button>
          {vm.trilha.map(p => (
            <span key={p.c + '|' + p.p} className="explorador-trilha-item">
              <Icone nome="chevronRight" className="explorador-sep" />
              <button type="button" onClick={() => vm.irPara(p.c, p.p)}>{p.nome}</button>
            </span>
          ))}
        </nav>
        <label className="explorador-busca">
          <input type="search" placeholder={vm.placeholderBusca} aria-label="Pesquisar" value={vm.busca}
            onChange={ev => vm.setBusca(ev.target.value)} onKeyDown={ev => { if (ev.key === 'Escape') vm.setBusca(''); }} />
          <Icone nome="search" />
        </label>
        <div className="explorador-exibir" role="group" aria-label="Exibir">
          <button type="button" className={'explorador-btn' + (vm.exibicao === 'detalhes' ? ' on' : '')} aria-pressed={vm.exibicao === 'detalhes'}
            title="Detalhes" aria-label="Detalhes" onClick={() => vm.mudarExibicao('detalhes')}><Icone nome="list" /></button>
          <button type="button" className={'explorador-btn' + (vm.exibicao === 'icones' ? ' on' : '')} aria-pressed={vm.exibicao === 'icones'}
            title="Ícones" aria-label="Ícones" onClick={() => vm.mudarExibicao('icones')}><Icone nome="grade" /></button>
        </div>
        <button type="button" className="explorador-btn" aria-pressed={vm.telaCheia} aria-label={vm.telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
          title={vm.telaCheia ? 'Sair da tela cheia (Esc)' : 'Tela cheia'} onClick={vm.alternarTelaCheia}>
          <Icone nome={vm.telaCheia ? 'minimizar' : 'maximizar'} />
        </button>
        <button type="button" className="explorador-btn" title="Mais opções" aria-label="Mais opções" aria-haspopup="menu" onClick={abrirMais}><Icone nome="mais" /></button>
        <button type="button" className="btn btn-primary explorador-enviar" title="Manda para a pasta Claudio Secretário; a próxima rodada do arquivamento põe cada arquivo na pasta do cliente"
          onClick={() => envio.abrir()}><Icone nome="upload" />Enviar arquivos</button>
      </div>

      {vm.erro && <div className="alert"><Icone nome="alert" /><div><p className="alert-text">{vm.erro}</p></div></div>}
      {vm.exemplos && <p className="hint drive-aviso">Dados de exemplo: as pastas são inventadas e nenhum arquivo abre de verdade.</p>}

      <div className={'explorador-corpo' + (vm.mostrarArvore ? '' : ' sem-arvore')}>
        {vm.mostrarArvore && <Arvore vm={vm} aoMenu={menuDaArvore} />}
        <div className="explorador-conteudo" onClick={ev => { if (ev.target === ev.currentTarget) vm.limparSelecao(); }} onContextMenu={ev => abrirMenu(ev, null)}>
          {!vm.carregando && (vm.exibicao === 'detalhes' ? <Detalhes vm={vm} aoMenu={abrirMenu} /> : <Icones vm={vm} aoMenu={abrirMenu} />)}
          {!vm.carregando && !n && <p className="empty">{vm.buscando ? 'Nenhum item corresponde à pesquisa.' : 'Esta pasta está vazia.'}</p>}
        </div>
      </div>

      {m > 0
        ? (
          <div className="explorador-status selecao" role="status">
            <b>{m} {m === 1 ? 'selecionado' : 'selecionados'}</b>
            {vm.tamanhoMarcado && <span>{vm.tamanhoMarcado}</span>}
            <span className="tarefas-barra-espaco" />
            <button type="button" className="btn explorador-selecao-btn" onClick={baixarMarcados}><Icone nome="download" />Baixar{m > 1 ? ' ' + m : ''}</button>
            <button type="button" className="explorador-btn" title="Limpar seleção (Esc)" aria-label="Limpar seleção" onClick={vm.limparSelecao}><Icone nome="x" /></button>
          </div>
        )
        : (
          <div className="explorador-status" role="status">
            <span>{n} {n === 1 ? 'item' : 'itens'}</span>
            <span className="tarefas-barra-espaco" />
            {vm.atualizado && <span title="Quando o robô leu o Drive pela última vez">Atualizado em {vm.atualizado}</span>}
          </div>
        )}

      {vm.pedidos.length + envio.envios.length > 0 && (
        <div className="drive-pedidos" role="status" aria-live="polite">
          {vm.pedidos.map(p => <div key={p.id} className="drive-pedido"><span className="drive-girando" aria-hidden="true" />{p.texto}</div>)}
          {envio.envios.map(p => (
            <div key={p.id} className={'drive-pedido' + (p.erro ? ' com-erro' : '')}>
              {p.erro ? <Icone nome="alert" className="drive-ico" /> : <span className="drive-girando" aria-hidden="true" />}{p.texto}
            </div>
          ))}
        </div>
      )}
      {soltando && <div className="explorador-soltar" aria-hidden="true"><Icone nome="upload" />Solte para enviar ao Claudio Secretário</div>}
      {menu && <MenuDeContexto menu={menu} onFechar={() => setMenu(null)} />}
      <EnviarAoSecretario vm={envio} />
    </section>
  );
}
