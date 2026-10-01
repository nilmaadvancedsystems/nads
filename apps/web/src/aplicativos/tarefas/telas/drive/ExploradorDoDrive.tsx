// Drive › Pastas, com a cara do GitHub e só com as peças do nads (Vitor, 30/09/2026). Na pasta do ano, a página inicial de
// um repositório: o nome em cima (⋯), a barra (o ano ▾ como o "main ▾", o contador como o "6 Branches", a busca com o T,
// Enviar ▾ e Baixar ▾), o card com a faixa do mapa do robô e a lista dos clientes, e o Sobre ao lado. Abriu um cliente: o
// navegador de arquivos — à esquerda, a barra lateral com as pastas dele (a aberta marcada) e, à direita, a trilha
// (CLIENTE / PASTA /, copiar, Enviar ▾, Baixar ▾, ⋯) e o card com a lista (com o ".."). Um clique abre (a pasta entra; o
// arquivo abre numa aba nova, que nasce no clique e recebe o link quando o robô termina); Ctrl e Shift marcam; o botão
// direito abre o menu (MenuDeContexto); arrastar arquivos, ou Enviar, manda para o Claudio Secretário. Tela cheia cobre
// o nads (Esc sai). "T" vai para a busca, como no GitHub.
import type { entregas as e } from '@nads/core';
import { Icone, MenuSuspenso, useCarregando, useRetorno } from '@nads/ui';
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from 'react';
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
  { id: 'nome', rotulo: 'Nome' }, { id: 'tipo', rotulo: 'Tipo' }, { id: 'tamanho', rotulo: 'Tamanho' }, { id: 'data', rotulo: 'Modificado' },
];

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

/** "há 3 horas", "ontem", "há 5 dias", "12/08/2026" — como as datas do GitHub (a completa no title). */
function relativo(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return 'há ' + Math.floor(s / 60) + ' min';
  if (s < 86400) return 'há ' + Math.floor(s / 3600) + (Math.floor(s / 3600) === 1 ? ' hora' : ' horas');
  const dias = Math.floor(s / 86400);
  if (dias === 1) return 'ontem';
  if (dias < 7) return 'há ' + dias + ' dias';
  if (dias < 14) return 'semana passada';
  if (dias < 30) return 'há ' + Math.floor(dias / 7) + ' semanas';
  return d.toLocaleDateString('pt-BR');
}

function IconeDaEntrada({ x }: { x: e.EntradaDoExplorador }) {
  const nome = x.pasta ? 'pasta' : /Google|texto|Word/.test(x.tipo) ? 'fileText' : 'arquivo';
  const cor = x.pasta ? ' pasta' : /PDF/.test(x.tipo) ? ' pdf' : /Excel|CSV|Planilha/.test(x.tipo) ? ' planilha' : /Word|Documento Google/.test(x.tipo) ? ' texto' : '';
  return <Icone nome={nome} className={'drive-ico' + cor} />;
}

/** O card da lista: a faixa de cima (o mapa do robô, ou o que está marcado) e a tabela (o ".." quando dá para subir). */
function Lista({ vm, aoMenu, acima, baixarMarcados }: { vm: VmDrive; aoMenu: AoMenu; acima: boolean; baixarMarcados: () => void }) {
  const m = vm.marcados.length;
  const linha = (x: e.EntradaDoExplorador) => ({
    className: 'linha-abre' + (vm.estaMarcado(x.id) ? ' linha-atual' : ''),
    tabIndex: 0,
    'aria-selected': vm.estaMarcado(x.id),
    onContextMenu: (ev: MouseEvent) => aoMenu(ev, x),
    onClick: (ev: MouseEvent) => {
      if (ev.ctrlKey || ev.metaKey || ev.shiftKey) vm.selecionar(x.id, { ctrl: ev.ctrlKey || ev.metaKey, shift: ev.shiftKey });
      else abrir(vm, x);
    },
    onKeyDown: (ev: KeyboardEvent) => {
      if (ev.key === 'Enter') { ev.preventDefault(); abrir(vm, x); }
      else if (ev.key === ' ') { ev.preventDefault(); vm.selecionar(x.id, { ctrl: true }); }
    },
  });
  return (
    <div className="card drive-card" onContextMenu={ev => aoMenu(ev, null)}>
      <div className="card-head">
        {m > 0 ? (
          <>
            <h3>{m} {m === 1 ? 'selecionado' : 'selecionados'}{vm.tamanhoMarcado ? ' · ' + vm.tamanhoMarcado : ''}</h3>
            <span className="tarefas-barra-espaco" />
            <button type="button" className="btn btn-outline" onClick={baixarMarcados}><Icone nome="download" />Baixar</button>
            <button type="button" className="btn btn-ghost" onClick={vm.limparSelecao}>Limpar</button>
          </>
        ) : (
          <>
            <h3 className="drive-faixa"><Icone nome="robo" />Mapa do robô</h3>
            <span className="hint">{vm.exemplos ? 'dados de exemplo: as pastas são inventadas e nenhum arquivo abre de verdade' : 'o Drive do escritório, como o robô do Entregas leu'}</span>
            <span className="tarefas-barra-espaco" />
            {vm.atualizado && <span className="hint drive-faixa"><Icone nome="clock" />{vm.atualizado}</span>}
          </>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {COLUNAS.map(c => (
                <th key={c.id} className={'th-sort' + (c.id === 'tamanho' || c.id === 'data' ? ' num' : '')} onClick={() => vm.ordenarPor(c.id)}
                  aria-sort={vm.coluna === c.id ? (vm.desc ? 'descending' : 'ascending') : undefined}>
                  {c.rotulo}{vm.coluna === c.id && <Icone nome="caretDown" className={'th-seta' + (vm.desc ? '' : ' cima')} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {acima && (
              <tr className="linha-abre" tabIndex={0} onClick={vm.subir} onKeyDown={ev => { if (ev.key === 'Enter') vm.subir(); }} title="A pasta de cima">
                <td colSpan={COLUNAS.length}><span className="drive-nome"><Icone nome="pasta" className="drive-ico pasta" />..</span></td>
              </tr>
            )}
            {vm.entradas.map(x => (
              <tr key={x.id} {...linha(x)}>
                <td className="drive-col-nome"><span className="drive-nome" title={x.nome}><IconeDaEntrada x={x} /><span>{x.nome}{x.onde && <span className="fraco drive-onde">{x.onde}</span>}</span></span></td>
                <td className="fraco">{x.tipo}</td>
                <td className="fraco num">{x.pasta ? '' : vm.tamanho(x.bytes)}</td>
                <td className="fraco num" title={vm.quando(x.data)}>{relativo(x.data)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!vm.carregando && !vm.entradas.length && <p className="empty">{vm.buscando ? 'Nada com essa busca.' : 'Esta pasta está vazia.'}</p>}
    </div>
  );
}

/** A barra lateral do cliente: as pastas dele (a aberta marcada), nos itens da barra lateral do nads. */
function Arvore({ vm, aoMenu }: { vm: VmDrive; aoMenu: (ev: MouseEvent, no: e.NoDaArvore) => void }) {
  const cliente = vm.pastaCliente?.id || '';
  return (
    <div className="subnav-itens" role="tree" aria-label="Pastas">
      {vm.arvore.filter(no => no.cliente === cliente && no.nivel >= 1).map(no => (
        <div key={no.id} className="drive-no" style={{ paddingLeft: (no.nivel - 1) * 16 }} role="treeitem" aria-selected={vm.naPasta(no.id)} aria-expanded={no.temFilhos ? no.aberto : undefined}>
          {no.temFilhos
            ? <button type="button" className={'imp-seta' + (no.aberto ? ' aberta' : '')} aria-label={(no.aberto ? 'Fechar ' : 'Abrir ') + no.nome} onClick={() => vm.alternarNo(no.id)}><Icone nome="caretDown" /></button>
            : <span className="imp-seta" />}
          <button type="button" className={'subnav-item' + (vm.naPasta(no.id) ? ' active' : '')} title={no.nome} onClick={() => vm.abrirNo(no)} onContextMenu={ev => aoMenu(ev, no)}>
            <Icone nome="pasta" /><span>{no.nome}</span>
            {no.carregando && <span className="drive-girando" aria-label="carregando" />}
          </button>
        </div>
      ))}
    </div>
  );
}

/** A busca (a mesma das listas do nads), com o T no canto como o "Go to file" do GitHub. */
function Busca({ vm, campo, larga }: { vm: VmDrive; campo: RefObject<HTMLInputElement | null>; larga?: boolean }) {
  return (
    <label className={'busca-curta' + (larga ? ' larga' : '')}>
      <Icone nome="search" />
      <input ref={campo} type="text" placeholder={vm.naRaiz ? 'Ir para o cliente' : 'Ir para arquivo'} aria-label={vm.placeholderBusca} value={vm.busca}
        onChange={ev => vm.setBusca(ev.target.value)} onKeyDown={ev => { if (ev.key === 'Escape') { vm.setBusca(''); ev.currentTarget.blur(); } }} />
      {!vm.busca && <kbd>T</kbd>}
    </label>
  );
}

/** O ano, como o "main ▾" do GitHub (hoje, só a pasta do ano que o robô mapeia). */
function Ano({ vm }: { vm: VmDrive }) {
  return <MenuSuspenso icone="calendar" rotulo={vm.ano} titulo="Pasta do ano" dica="A pasta do ano no Drive" itens={[{ rotulo: vm.ano, marcado: true, onClick: vm.irParaRaiz }]} />;
}

export function ExploradorDoDrive() {
  const vm = useExploradorDoDrive();
  const envio = useEnvioAoSecretario(vm.pastaCliente);
  const { toast, modal } = useRetorno();
  useCarregando(vm.carregando);
  // as opções do menu rodam depois de a seleção mudar: usam sempre o ViewModel mais novo
  const atual = useRef(vm);
  atual.current = vm;
  const busca = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<MenuAberto | null>(null);
  const [soltando, setSoltando] = useState(false);
  const baixarMarcados = () => { atual.current.linkDosMarcados().then(url => { baixar(url); atual.current.limparSelecao(); }, () => {}); };
  const baixarPasta = () => { atual.current.linkDaPasta().then(baixar, () => {}); };
  const copiar = (texto: string, oque: string) => {
    navigator.clipboard.writeText(texto).then(() => toast(oque + ' copiado.'), () => toast('Não consegui copiar (o navegador não deixou).'));
  };
  const nomes = (l: e.EntradaDoExplorador[]) => l.map(i => i.nome).join('\n');
  const caminhos = (l: e.EntradaDoExplorador[]) => l.map(i => atual.current.caminhoDe(i)).join('\n');
  const caminhoDaPasta = [vm.ano, ...vm.trilha.map(p => p.nome)].join(' › ');
  const propriedades = (x: e.EntradaDoExplorador) => {
    void modal({
      icone: 'fileText', titulo: 'Propriedades de ' + x.nome, botoes: [{ rotulo: 'OK', valor: true, variante: 'btn-primary' }],
      corpo: <dl className="explorador-propriedades">{atual.current.propriedadesDe(x).map(l => <div key={l.rotulo}><dt>{l.rotulo}</dt><dd>{l.valor}</dd></div>)}</dl>,
    });
  };

  /** O que o ⋯ e o botão direito no fundo oferecem: exibir, classificar, selecionar, baixar a pasta, enviar, tela cheia. */
  const linhasDoFundo = (): LinhaDoMenu[] => {
    const v = atual.current;
    return [
      { titulo: 'Exibir' },
      { rotulo: 'Lista', icone: 'list', marcado: v.exibicao === 'detalhes', onClick: () => atual.current.mudarExibicao('detalhes') },
      { rotulo: 'Ícones', icone: 'grade', marcado: v.exibicao === 'icones', onClick: () => atual.current.mudarExibicao('icones') },
      { titulo: 'Classificar por' },
      ...COLUNAS.map<OpcaoDoMenu>(c => ({ rotulo: c.rotulo, marcado: v.coluna === c.id, onClick: () => atual.current.ordenarPor(c.id) })),
      'separador',
      { rotulo: 'Selecionar tudo', icone: 'checkCircle', atalho: 'Ctrl+A', desabilitado: !v.entradas.length, onClick: () => atual.current.selecionarTodos() },
      { rotulo: 'Baixar esta pasta (.zip)', icone: 'download', desabilitado: !v.podeBaixarPasta, onClick: baixarPasta },
      { rotulo: 'Enviar para o Claudio Secretário…', icone: 'upload', onClick: () => envio.abrir() },
      'separador',
      { rotulo: v.telaCheia ? 'Sair da tela cheia' : 'Tela cheia', icone: v.telaCheia ? 'minimizar' : 'maximizar', onClick: () => atual.current.alternarTelaCheia() },
    ];
  };

  /** O menu de uma linha (ou do fundo, com x = null), como o do Windows. */
  const abrirMenu: AoMenu = (ev, x) => {
    ev.preventDefault();
    ev.stopPropagation();
    const v = atual.current;
    if (!x) { setMenu({ ...pontoDoMenu(ev), topo: [], linhas: linhasDoFundo() }); return; }
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
  // arrastar arquivos do computador para o Drive: abre o envio com eles
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
  // Esc (fora dos campos): limpa a seleção; sem seleção, sai da tela cheia. "T": vai para a busca (como no GitHub)
  const esc = useRef(() => {});
  esc.current = () => { if (vm.marcados.length) vm.limparSelecao(); else if (vm.telaCheia) vm.alternarTelaCheia(); };
  useEffect(() => {
    const tecla = (ev: globalThis.KeyboardEvent) => {
      if (ev.defaultPrevented || ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement || ev.target instanceof HTMLTextAreaElement) return;
      if (ev.key === 'Escape') esc.current();
      else if ((ev.key === 't' || ev.key === 'T') && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { ev.preventDefault(); busca.current?.focus(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);
  // na tela cheia, a página de trás não rola
  useEffect(() => {
    if (!vm.telaCheia) return;
    const html = document.documentElement;
    const antes = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = antes; };
  }, [vm.telaCheia]);

  // a página inicial (só a pasta do ano, com os clientes) ou o navegador de arquivos (o cliente e as pastas dele)
  const naRaiz = vm.trilha.length === 0;
  const mais = (
    <button type="button" className="icon-btn" title="Mais ações" aria-label="Mais ações"
      onClick={ev => setMenu({ ...pontoDoMenu(ev), topo: [], linhas: linhasDoFundo() })}><Icone nome="mais" /></button>
  );
  const enviarEBaixar = (
    <>
      <MenuSuspenso icone="upload" rotulo="Enviar" direita dica="Mandar arquivos para a pasta Claudio Secretario (a próxima rodada do arquivamento põe na pasta do cliente)"
        itens={[{ rotulo: 'Enviar para o Claudio Secretário…', icone: 'upload', onClick: () => envio.abrir() }]} />
      <MenuSuspenso icone="download" rotulo="Baixar" className="btn btn-primary" direita
        itens={[
          { rotulo: 'Esta pasta (.zip)', icone: 'pasta', desabilitado: !vm.podeBaixarPasta, onClick: baixarPasta },
          { rotulo: vm.marcados.length ? 'Os ' + vm.marcados.length + ' marcados' : 'Os marcados', icone: 'download', desabilitado: !vm.marcados.length, onClick: baixarMarcados },
        ]} />
    </>
  );
  const corpo: ReactNode = naRaiz ? (
    <div className="drive-inicio">
      <div className="tarefas-barra-topo drive-titulo">
        <Icone nome="pasta" className="drive-ico pasta" />
        <h2 className="page-title">{vm.ano}</h2>
        <span className="badge badge-neutral">pasta do ano</span>
        <span className="tarefas-barra-espaco" />
        {mais}
      </div>
      <div className="drive-colunas">
        <div>
          <div className="tarefas-barra-topo">
            <Ano vm={vm} />
            <span className="tarefas-contador"><Icone nome="pasta" /><b>{vm.entradas.length}</b> {vm.entradas.length === 1 ? 'cliente' : 'clientes'}</span>
            <span className="tarefas-barra-espaco" />
            <Busca vm={vm} campo={busca} />
            {enviarEBaixar}
          </div>
          <Lista vm={vm} aoMenu={abrirMenu} acima={false} baixarMarcados={baixarMarcados} />
        </div>
        <aside className="card drive-sobre">
          <div className="card-head"><h3>Sobre</h3></div>
          <p>A pasta {vm.ano} do Drive do escritório: uma pasta por cliente.</p>
          <ul className="drive-sobre-lista">
            <li><Icone nome="pasta" /><span><b>{vm.entradas.length}</b> clientes</span></li>
            {vm.atualizado && <li><Icone nome="clock" /><span>Mapa do robô de {vm.atualizado}</span></li>}
            <li><Icone nome="upload" /><span>Arraste arquivos para cá para enviar ao Claudio Secretário</span></li>
          </ul>
        </aside>
      </div>
    </div>
  ) : (
    <div className={'drive-navegador' + (vm.mostrarArvore ? '' : ' sem-painel')}>
      {vm.mostrarArvore && (
        <nav className="subnav drive-painel" aria-label="Arquivos">
          <div className="tarefas-barra-topo">
            <button type="button" className="icon-btn" title="Fechar o painel" aria-label="Fechar o painel" onClick={vm.alternarArvore}><Icone nome="painel" /></button>
            <span className="drive-painel-titulo">Arquivos</span>
          </div>
          <div className="tarefas-barra-topo">
            <Ano vm={vm} />
            <span className="tarefas-barra-espaco" />
            <button type="button" className="icon-btn" title="Enviar para o Claudio Secretário" aria-label="Enviar para o Claudio Secretário" onClick={() => envio.abrir()}><Icone nome="plus" /></button>
          </div>
          <Busca vm={vm} campo={busca} larga />
          <Arvore vm={vm} aoMenu={menuDaArvore} />
        </nav>
      )}
      <div className="drive-direita">
        <div className="tarefas-barra-topo">
          {!vm.mostrarArvore && <button type="button" className="icon-btn" title="Abrir o painel" aria-label="Abrir o painel" onClick={vm.alternarArvore}><Icone nome="painel" /></button>}
          <nav className="gh-crumbs drive-trilha" aria-label="Caminho">
            {vm.trilha.map((p, i) => (
              <span key={p.c + '|' + p.p} style={{ display: 'contents' }}>
                {i > 0 && <span className="gh-sep">/</span>}
                {i === vm.trilha.length - 1 ? <span className="gh-crumb gh-crumb-fim">{p.nome}</span> : <button type="button" className="gh-crumb" onClick={() => vm.irPara(p.c, p.p)}>{p.nome}</button>}
              </span>
            ))}
            <span className="gh-sep">/</span>
          </nav>
          <button type="button" className="icon-btn" title="Copiar o caminho" aria-label="Copiar o caminho" onClick={() => copiar(caminhoDaPasta, 'Caminho')}><Icone nome="copiar" /></button>
          <span className="tarefas-barra-espaco" />
          {enviarEBaixar}
          {mais}
        </div>
        <Lista vm={vm} aoMenu={abrirMenu} acima={vm.podeSubir} baixarMarcados={baixarMarcados} />
      </div>
    </div>
  );

  return (
    <section className={'drive' + (vm.telaCheia ? ' tela-cheia' : '') + (soltando ? ' soltando' : '')}
      onKeyDown={teclas} onDragOver={arrastando} onDragLeave={ev => { if (!ev.currentTarget.contains(ev.relatedTarget as Node | null)) setSoltando(false); }} onDrop={soltar}>
      {vm.erro && <div className="alert"><Icone nome="alert" /><div><p className="alert-text">{vm.erro}</p></div></div>}
      {corpo}
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
