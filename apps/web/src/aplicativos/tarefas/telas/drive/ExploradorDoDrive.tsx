// Drive › Pastas, com a cara do GitHub (Vitor, 30/09/2026: "no Drive, faça esse design"). Na pasta do ano, a página
// inicial de um repositório: o nome em cima, a barra (o ano ▾, quantas pastas e arquivos, "Ir
// para arquivo", Enviar e Baixar), a caixa com a faixa do mapa do robô e a lista dos clientes, e ao lado o "Sobre".
// Abriu um cliente: o navegador de arquivos — o painel "Arquivos" à esquerda (o ano, a busca e as pastas do cliente) e,
// à direita, a trilha (CLIENTE / PASTA /, copiar o caminho, ⋯), a faixa do robô e a lista com o "..". Um clique no nome abre (a pasta entra, o
// arquivo abre numa aba nova: ela nasce no clique, senão o navegador bloqueia, e recebe o link quando o robô termina);
// Ctrl e Shift marcam; o botão direito abre o menu (MenuDeContexto); arrastar arquivos para a tela, ou "Enviar", manda
// para o Claudio Secretário. Tela cheia cobre o nads (Esc sai). "T" vai para a busca, como no GitHub.
import type { entregas as e } from '@nads/core';
import { Icone, MenuSuspenso, useCarregando, useRetorno } from '@nads/ui';
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
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

function IconeDaEntrada({ x, grande }: { x: e.EntradaDoExplorador; grande?: boolean }) {
  const nome = x.pasta ? 'pasta' : /Google|texto|Word/.test(x.tipo) ? 'fileText' : 'arquivo';
  const cor = x.pasta ? ' pasta' : /PDF/.test(x.tipo) ? ' pdf' : /Excel|CSV|Planilha/.test(x.tipo) ? ' planilha' : /Word|Documento Google/.test(x.tipo) ? ' texto' : '';
  return <Icone nome={nome} className={'ghf-ico' + cor + (grande ? ' grande' : '')} />;
}

/** A caixa da lista, como a do GitHub: a faixa de cima (o mapa do robô, ou o que está marcado) e as linhas. */
/** faixaFora: a faixa numa caixa própria, em cima da lista (o navegador de arquivos); sem, dentro (a página inicial). */
function Lista({ vm, aoMenu, acima, baixarMarcados, faixaFora }: { vm: VmDrive; aoMenu: AoMenu; acima: boolean; baixarMarcados: () => void; faixaFora?: boolean }) {
  const m = vm.marcados.length;
  const linha = (x: e.EntradaDoExplorador) => ({
    onContextMenu: (ev: MouseEvent) => aoMenu(ev, x),
    onClick: (ev: MouseEvent) => {
      if (ev.ctrlKey || ev.metaKey || ev.shiftKey) { ev.preventDefault(); vm.selecionar(x.id, { ctrl: ev.ctrlKey || ev.metaKey, shift: ev.shiftKey }); }
    },
    onKeyDown: (ev: KeyboardEvent) => {
      if (ev.key === 'Enter') { ev.preventDefault(); abrir(vm, x); }
      else if (ev.key === ' ') { ev.preventDefault(); vm.selecionar(x.id, { ctrl: true }); }
    },
  });
  const faixa = (
      <div className={'ghf-faixa' + (faixaFora ? ' fora' : '')}>
        {m > 0 ? (
          <>
            <span><b>{m}</b> {m === 1 ? 'selecionado' : 'selecionados'}{vm.tamanhoMarcado ? ' · ' + vm.tamanhoMarcado : ''}</span>
            <span className="ghf-espaco" />
            <button type="button" className="btn btn-sm btn-outline" onClick={baixarMarcados}><Icone nome="download" />Baixar</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={vm.limparSelecao}>Limpar</button>
          </>
        ) : (
          <>
            <span className="ghf-robo"><Icone nome="robo" /></span>
            <b>Mapa do robô</b>
            <span className="fraco ghf-faixa-texto">{vm.exemplos ? 'dados de exemplo: as pastas são inventadas e nenhum arquivo abre de verdade' : 'o Drive do escritório, como o robô do Entregas leu'}</span>
            <span className="ghf-espaco" />
            {vm.atualizado && <span className="fraco" title={'Atualizado em ' + vm.atualizado}><Icone nome="clock" />{vm.atualizado}</span>}
            <span className="fraco"><b>{vm.entradas.length}</b> {vm.entradas.length === 1 ? 'item' : 'itens'}</span>
          </>
        )}
      </div>
  );
  return (
    <>
    {faixaFora && faixa}
    <div className="ghf-caixa" onContextMenu={ev => aoMenu(ev, null)}>
      {!faixaFora && faixa}
      {vm.exibicao === 'icones' ? (
        <ul className="ghf-icones" role="listbox" aria-multiselectable>
          {vm.entradas.map(x => (
            <li key={x.id} role="option" tabIndex={0} aria-selected={vm.estaMarcado(x.id)} className={vm.estaMarcado(x.id) ? 'marcado' : undefined}
              title={x.nome} {...linha(x)} onDoubleClick={() => abrir(vm, x)}>
              <button type="button" className="ghf-icone-btn" onClick={ev => { if (!ev.ctrlKey && !ev.metaKey && !ev.shiftKey) abrir(vm, x); }}>
                <IconeDaEntrada x={x} grande /><span className="ghf-icone-nome">{x.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <table className="ghf-tabela">
          <thead>
            <tr>
              {COLUNAS.map(c => (
                <th key={c.id} className={'col-' + c.id} aria-sort={vm.coluna === c.id ? (vm.desc ? 'descending' : 'ascending') : undefined}>
                  <button type="button" onClick={() => vm.ordenarPor(c.id)}>
                    {c.rotulo}{vm.coluna === c.id && <Icone nome="caretDown" className={'ghf-ordem' + (vm.desc ? '' : ' cima')} />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {acima && (
              <tr className="ghf-acima">
                <td colSpan={COLUNAS.length}><button type="button" className="ghf-nome" onClick={vm.subir} title="Pasta de cima">..</button></td>
              </tr>
            )}
            {vm.entradas.map(x => (
              <tr key={x.id} tabIndex={0} aria-selected={vm.estaMarcado(x.id)} className={vm.estaMarcado(x.id) ? 'marcado' : undefined} {...linha(x)}>
                <td className="col-nome">
                  <span className="ghf-celula">
                    <IconeDaEntrada x={x} />
                    <button type="button" className="ghf-nome" title={x.nome} onClick={ev => { if (!ev.ctrlKey && !ev.metaKey && !ev.shiftKey) abrir(vm, x); }}>{x.nome}</button>
                    {x.onde && <span className="fraco ghf-onde">{x.onde}</span>}
                  </span>
                </td>
                <td className="col-tipo fraco">{x.tipo}</td>
                <td className="col-tamanho fraco">{x.pasta ? '' : vm.tamanho(x.bytes)}</td>
                <td className="col-data fraco" title={vm.quando(x.data)}>{relativo(x.data)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!vm.carregando && !vm.entradas.length && <p className="empty">{vm.buscando ? 'Nada com essa busca.' : 'Esta pasta está vazia.'}</p>}
    </div>
    </>
  );
}

/** A árvore do painel, como a do GitHub: só as pastas do cliente aberto (o "repositório"), sem ele mesmo. */
function Arvore({ vm, aoMenu }: { vm: VmDrive; aoMenu: (ev: MouseEvent, no: e.NoDaArvore) => void }) {
  const cliente = vm.pastaCliente?.id || '';
  return (
    <ul className="ghf-arvore" role="tree" aria-label="Pastas">
      {vm.arvore.filter(no => no.cliente === cliente && no.nivel >= 1).map(no => (
        <li key={no.id} role="treeitem" aria-selected={vm.naPasta(no.id)} aria-expanded={no.temFilhos ? no.aberto : undefined}>
          <div className={'ghf-no' + (vm.naPasta(no.id) ? ' atual' : '')} style={{ paddingLeft: 8 + (no.nivel - 1) * 16 }}>
            {no.temFilhos
              ? <button type="button" className="ghf-seta" aria-label={(no.aberto ? 'Fechar ' : 'Abrir ') + no.nome} onClick={() => vm.alternarNo(no.id)}>
                <Icone nome="caretDown" className={no.aberto ? '' : 'fechada'} />
              </button>
              : <span className="ghf-seta" />}
            <button type="button" className="ghf-no-rotulo" title={no.nome} onClick={() => vm.abrirNo(no)} onContextMenu={ev => aoMenu(ev, no)}>
              <Icone nome="pasta" className="ghf-ico pasta" /><span className="ghf-no-nome">{no.nome}</span>
              {no.carregando && <span className="drive-girando" aria-label="carregando" />}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A busca do GitHub ("Go to file" com o T no canto). */
function Busca({ vm, campo }: { vm: VmDrive; campo: React.RefObject<HTMLInputElement | null> }) {
  return (
    <label className="ghf-busca">
      <Icone nome="search" />
      <input ref={campo} type="search" placeholder={vm.naRaiz ? 'Ir para o cliente' : 'Ir para arquivo'} aria-label={vm.placeholderBusca} value={vm.busca}
        onChange={ev => vm.setBusca(ev.target.value)} onKeyDown={ev => { if (ev.key === 'Escape') { vm.setBusca(''); (ev.target as HTMLInputElement).blur(); } }} />
      <kbd className="ghf-kbd">T</kbd>
    </label>
  );
}

/** O ano, no lugar do "main ▾" do GitHub (hoje, a pasta do ano que o robô mapeia). */
function Ano({ vm }: { vm: VmDrive }) {
  return (
    <button type="button" className="btn btn-outline btn-sm ghf-ano" onClick={vm.irParaRaiz} title={'A pasta ' + vm.ano + ' do Drive'}>
      <Icone nome="calendar" />{vm.ano}
    </button>
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
  const inicio = vm.trilha.length === 0;
  const titulo = vm.trilha.length ? vm.trilha[0].nome : vm.ano;
  const codigo = vm.pastaCliente && 'codigo' in vm.pastaCliente ? String((vm.pastaCliente as { codigo?: unknown }).codigo || '') : '';
  const sobre = vm.pastaCliente
    ? vm.propriedadesDe({ id: vm.pastaCliente.id, nome: vm.pastaCliente.nomePasta, pasta: true, tipo: 'Pasta do cliente', data: null, bytes: 0, onde: '' })
      .filter(l => l.rotulo === 'Tamanho' || l.rotulo === 'Contém')
    : [];
  const mais = (
    <MenuSuspenso rotulo={<Icone nome="mais" />} className="btn btn-outline btn-sm ghf-mais" dica="Mais ações" direita largura={260}
      conteudo={fechar => (
        <div>
          {linhasDoFundo().map((l, i) => l === 'separador' ? <hr key={i} className="popover-sep" />
            : 'titulo' in l ? <p key={i} className="popover-label">{l.titulo}</p>
              : (
                <button key={i} type="button" className="popover-item" role="menuitem" disabled={l.desabilitado} onClick={() => { fechar(); l.onClick(); }}>
                  <span className="popover-marca">{l.marcado && <Icone nome="check" />}</span>
                  {l.icone && <Icone nome={l.icone} />}<span className="popover-texto">{l.rotulo}</span>
                </button>
              ))}
        </div>
      )} />
  );
  const corpo: ReactNode = inicio ? (
    <div className="ghf-inicio">
      <div className="ghf-titulo">
        <span className="ghf-titulo-ico"><Icone nome="pasta" className="ghf-ico pasta" /></span>
        <h2>{titulo}</h2>
        {codigo && <span className="ghf-selo">{codigo}</span>}
        {!vm.pastaCliente && <span className="ghf-selo">pasta do ano</span>}
        <span className="ghf-espaco" />
        <button type="button" className="btn btn-outline btn-sm" disabled={!vm.podeBaixarPasta} onClick={baixarPasta}><Icone nome="download" />Baixar .zip</button>
        {mais}
      </div>
      <div className="ghf-colunas">
        <div className="ghf-principal">
          <div className="ghf-barra">
            <Ano vm={vm} />
            {vm.pastaCliente && <button type="button" className="ghf-link fraco" onClick={vm.irParaRaiz}><Icone nome="chevronLeft" />Clientes</button>}
            <span className="ghf-espaco" />
            <Busca vm={vm} campo={busca} />
            <button type="button" className="btn btn-primary btn-sm" title="Mandar arquivos para a pasta Claudio Secretario (a próxima rodada do arquivamento põe na pasta do cliente)"
              onClick={() => envio.abrir()}><Icone nome="upload" />Enviar</button>
          </div>
          <Lista vm={vm} aoMenu={abrirMenu} acima={false} baixarMarcados={baixarMarcados} />
        </div>
        <aside className="ghf-sobre">
          <h3>Sobre</h3>
          <p>{vm.pastaCliente ? 'A pasta do cliente no Drive do escritório, na pasta ' + vm.ano + '.' : 'A pasta ' + vm.ano + ' do Drive do escritório: uma pasta por cliente.'}</p>
          <ul>
            {sobre.map(l => <li key={l.rotulo}><Icone nome={l.rotulo === 'Tamanho' ? 'arquivo' : 'pasta'} /><span><b>{l.rotulo}</b> {l.valor}</span></li>)}
            {!vm.pastaCliente && <li><Icone nome="pasta" /><span><b>{vm.entradas.length}</b> clientes</span></li>}
            {vm.atualizado && <li><Icone nome="clock" /><span>Mapa do robô de {vm.atualizado}</span></li>}
            <li><Icone nome="upload" /><span>Arraste arquivos para cá para enviar ao Claudio Secretário</span></li>
          </ul>
        </aside>
      </div>
    </div>
  ) : (
    <div className={'ghf-navegador' + (vm.mostrarArvore ? '' : ' sem-painel')}>
      {vm.mostrarArvore && (
        <aside className="ghf-painel">
          <div className="ghf-painel-topo">
            <button type="button" className="ghf-icone-acao" title="Fechar o painel" aria-label="Fechar o painel" onClick={vm.alternarArvore}><Icone nome="painel" /></button>
            <h2>Arquivos</h2>
          </div>
          <div className="ghf-painel-barra">
            <Ano vm={vm} />
            <button type="button" className="ghf-icone-acao com-borda" title="Enviar para o Claudio Secretário" aria-label="Enviar para o Claudio Secretário" onClick={() => envio.abrir()}><Icone nome="plus" /></button>
          </div>
          <Busca vm={vm} campo={busca} />
          <Arvore vm={vm} aoMenu={menuDaArvore} />
        </aside>
      )}
      <div className="ghf-direita">
        <div className="ghf-trilha-linha">
          {!vm.mostrarArvore && <button type="button" className="ghf-icone-acao" title="Abrir o painel" aria-label="Abrir o painel" onClick={vm.alternarArvore}><Icone nome="painel" /></button>}
          <nav className="ghf-trilha" aria-label="Caminho">
            {vm.trilha.map((p, i) => (
              <span key={p.c + '|' + p.p} className="ghf-trilha-item">
                {i > 0 && <span className="ghf-barra-sep">/</span>}
                {i === vm.trilha.length - 1 ? <b>{p.nome}</b> : <button type="button" onClick={() => vm.irPara(p.c, p.p)}>{p.nome}</button>}
              </span>
            ))}
            <span className="ghf-barra-sep">/</span>
          </nav>
          <button type="button" className="ghf-icone-acao" title="Copiar o caminho" aria-label="Copiar o caminho" onClick={() => copiar(caminhoDaPasta, 'Caminho')}><Icone nome="copiar" /></button>
          <span className="ghf-espaco" />
          <button type="button" className="btn btn-outline btn-sm" disabled={!vm.podeBaixarPasta} onClick={baixarPasta}><Icone nome="download" />Baixar .zip</button>
          {mais}
        </div>
        <Lista vm={vm} aoMenu={abrirMenu} acima={vm.podeSubir} baixarMarcados={baixarMarcados} faixaFora />
      </div>
    </div>
  );

  return (
    <section className={'ghf' + (vm.telaCheia ? ' tela-cheia' : '') + (soltando ? ' soltando' : '')}
      onKeyDown={teclas} onDragOver={arrastando} onDragLeave={ev => { if (!ev.currentTarget.contains(ev.relatedTarget as Node | null)) setSoltando(false); }} onDrop={soltar}>
      {vm.erro && <div className="alert"><Icone nome="alert" /><div><p className="alert-text">{vm.erro}</p></div></div>}
      {corpo}
      {vm.pedidos.length + envio.envios.length > 0 && (
        <div className="drive-pedidos" role="status" aria-live="polite">
          {vm.pedidos.map(p => <div key={p.id} className="drive-pedido"><span className="drive-girando" aria-hidden="true" />{p.texto}</div>)}
          {envio.envios.map(p => (
            <div key={p.id} className={'drive-pedido' + (p.erro ? ' com-erro' : '')}>
              {p.erro ? <Icone nome="alert" className="ghf-ico" /> : <span className="drive-girando" aria-hidden="true" />}{p.texto}
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
