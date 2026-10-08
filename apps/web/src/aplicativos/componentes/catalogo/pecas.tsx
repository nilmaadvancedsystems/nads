// As peças do catálogo, desenhadas com as MESMAS peças do sistema (@nads/ui e as classes do nads.css). A ordem dentro
// de cada tipo dá o código (BT-01, BT-02…): peça nova entra no FIM do tipo, para os códigos não mudarem.
import {
  Alerta, BotaoAcao, MedalhaGov, classeDaJanela, ordemDosBotoes, BotaoIcone, CampoArquivos, CampoData, Esqueleto, Icone, Interruptor, LogoBanco, LogoDrive, LogoGmail,
  LogoWhatsApp, MarcaN, MenuSuspenso, Segmentado, SeletorMes, SeletorTema, Stat, type NomeIcone, type OpcoesModal,
} from '@nads/ui';
import { useState, type ReactNode } from 'react';
import { CONCILIA, EXECUTOR, EXTRATUDO, TAREFAS, TODAS } from './telas';
import type { Peca } from './tipos';
import { BotaoGoogle } from '../../../comum/BotaoGoogle';
import { MenuDaRotina } from '../../tarefas/telas/executor/partes/MenuDaRotina';

const nada = () => undefined;

// ---------------------------------------------------------------------------------------------------------------------
// janelas: o desenho parado (dentro do cartão) e, no ▶, a janela de verdade por cima da tela
// ---------------------------------------------------------------------------------------------------------------------
type Janela = Omit<OpcoesModal<unknown>, 'botoes'> & { botoes: { rotulo: string; variante?: 'btn-primary' | 'btn-outline' | 'btn-danger' }[] };
function JanelaParada({ o }: { o: Janela }) {
  return (
    <div className={classeDaJanela(o) + ' cat-parado'} role="dialog">
      {!o.obrigatoria && <button type="button" className="modal-x" aria-label="Fechar"><Icone nome="x" /></button>}
      <h3>{o.titulo}</h3>
      {o.html ? <p dangerouslySetInnerHTML={{ __html: o.html }} /> : o.texto ? <p>{o.texto}</p> : null}
      <div className="modal-actions">
        {ordemDosBotoes(o.botoes.filter(b => !/^(Cancelar|Voltar)$/.test(b.rotulo))).map(b => <button key={b.rotulo} type="button" className={'btn ' + (b.variante || 'btn-outline')}>{b.rotulo}</button>)}
      </div>
      {o.fecharEm && <div className="modal-ok-barra" />}
    </div>
  );
}
/** O aviso parado (o mesmo desenho do useRetorno().aviso). */
function AvisoParado({ tom, titulo, texto, icone }: { tom: 'ok' | 'erro' | 'info'; titulo: string; texto?: string; icone?: NomeIcone }) {
  return (
    <div className={'imp-aviso-barra aviso-barra ' + tom + ' cat-parado'} role="status">
      <Icone nome={icone || (tom === 'ok' ? 'checkCircle' : tom === 'erro' ? 'alert' : 'ajuda')} />
      <span><b>{titulo}</b>{texto && <span className="hint"> · {texto}</span>}</span>
      <button type="button" aria-label="Fechar">×</button>
    </div>
  );
}
/** A janela que virou aviso (Vitor, 02/10/2026: "são apenas avisos, onde o usuário não precisa ter uma ação"). */
export function virouAviso(p: Peca, por: string): Peca {
  return { ...p, removida: { como: 'substituida', por, em: '02/10/2026', motivo: 'Só informa, sem ação: virou um aviso (a barrinha no topo, com o ×).', sumir: true } };
}
export function janela(id: string, nome: string, telas: string[], o: Janela, descricao?: string): Peca {
  return {
    id, tipo: 'janelas', nome, descricao, telas, componente: 'useRetorno().modal', classes: ['modal-overlay', classeDaJanela(o)],
    demo: () => <JanelaParada o={o} />,
    aoVivo: c => { void c.modal({ ...o, botoes: o.botoes.map(b => ({ ...b, valor: b.rotulo })) }); },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// pedaços que se repetem nos desenhos
// ---------------------------------------------------------------------------------------------------------------------
function Cabecalho({ trilha, direita, abas }: { trilha: string[]; direita?: ReactNode; abas?: { rotulo: string; icone: NomeIcone; ativa?: boolean; contador?: string }[] }) {
  return (
    <div className="cat-moldura">
      <header className="gh-header" style={{ position: 'static' }}>
        <div className="gh-header-top">
          <button className="gh-hamb" type="button" aria-label="Menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="brand-mark" aria-hidden="true"><MarcaN /></span>
          <nav className="gh-crumbs">
            {trilha.map((t, i) => (
              <span key={t} style={{ display: 'contents' }}>
                {i > 0 && <span className="gh-sep">/</span>}
                <span className={i === trilha.length - 1 ? 'gh-crumb gh-crumb-fim' : 'gh-crumb'}>{t}</span>
              </span>
            ))}
          </nav>
          <span className="gh-header-spacer" />
          {direita && <div className="gh-topo-direita">{direita}</div>}
        </div>
        {abas && (
          <nav className="menu">
            {abas.map(a => (
              <button key={a.rotulo} type="button" className={'menu-item' + (a.ativa ? ' active' : '')}>
                <Icone nome={a.icone} /><span>{a.rotulo}</span>{a.contador && <span className="menu-contador">{a.contador}</span>}
              </button>
            ))}
          </nav>
        )}
      </header>
    </div>
  );
}
const Avatar = () => <button type="button" className="gh-avatar">V</button>;

function Lateral({ itens, titulo }: { titulo?: string; itens: { rotulo: string; icone?: NomeIcone; ativa?: boolean; caixa?: 'vazia' | 'marcada' | 'parada'; apagada?: boolean; travada?: boolean }[] }) {
  return (
    <div className="cat-moldura" style={{ maxWidth: 280 }}>
      <nav className="subnav" style={{ position: 'static', height: 'auto' }}>
        <div className="subnav-itens">
          {titulo && <p className="subnav-titulo">{titulo}</p>}
          {itens.map(s => (
            <button key={s.rotulo} type="button" className={'subnav-item' + (s.ativa ? ' active' : '') + (s.travada ? ' is-locked' : '') + (s.apagada ? ' apagada' : '')}>
              {s.caixa ? <span className={'subnav-caixa ' + s.caixa}>{s.caixa === 'marcada' && <Icone nome="check" />}</span> : <Icone nome={s.icone || 'fileText'} />}
              <span>{s.rotulo}</span>
            </button>
          ))}
        </div>
        <div className="subnav-foot"><button type="button" className="subnav-colapsar"><Icone nome="painel" /><span>Ocultar barra lateral</span></button></div>
      </nav>
    </div>
  );
}

function SegmentadoVivo() {
  const [v, setV] = useState('resumido');
  return <Segmentado valor={v} opcoes={[{ valor: 'resumido', rotulo: 'Resumido' }, { valor: 'detalhado', rotulo: 'Detalhado' }]} onMudar={setV} />;
}
function InterruptorVivo() {
  const [v, setV] = useState(true);
  return <Interruptor ligado={v} onMudar={() => setV(x => !x)} rotulo="Mostrar zerados" />;
}
function MesVivo() {
  const [v, setV] = useState('2026-08');
  return <SeletorMes valor={v} onMudar={setV} rotulo="Competência" />;
}
function DataVivo() {
  const [v, setV] = useState('31/08/2026');
  return <CampoData valor={v} onMudar={setV} rotulo="Data" />;
}

export const ICONES: NomeIcone[] = [
  'relatorio', 'checklist', 'briefcase', 'fileDown', 'fileUp', 'zap', 'pasta', 'envelope', 'arquivo', 'robo', 'home', 'landmark', 'link',
  'arrowDown', 'arrowUp', 'check', 'checkCircle', 'scale', 'alert', 'lock', 'unlock', 'x', 'sun', 'moon', 'monitor', 'upload', 'ajuda',
  'olho', 'fileText', 'clock', 'chevronsLeft', 'chevronLeft', 'chevronRight', 'settings', 'logOut', 'barChart', 'caretDown', 'play',
  'camera', 'imagem', 'filtro', 'ordenar', 'copiar', 'search', 'repeat', 'calendar', 'plus', 'fileSearch', 'hash', 'list', 'menu', 'pastaAberta', 'mais',
  'girar', 'maximizar', 'minimizar', 'painel', 'cartao', 'download', 'grade', 'impressora',
];
const BANCOS = ['banco-do-brasil', 'banrisul', 'bradesco', 'btg', 'c6', 'caixa', 'inter', 'itau', 'mercado-pago', 'nubank', 'pagbank', 'safra', 'santander', 'sicoob', 'stone', 'cora', 'sicredi', 'bnb'];
const CORES = [
  '--bg', '--surface', '--surface-2', '--surface-3', '--border', '--border-strong', '--ink', '--ink-muted', '--accent', '--accent-strong', '--accent-soft',
  '--btn-bg', '--btn-primary', '--btn-primary-hover', '--success', '--success-soft', '--danger', '--danger-soft', '--warn', '--warn-soft', '--info', '--info-soft',
  '--destructive', '--destructive-soft', '--header-bg', '--tab-active', '--hover-bg', '--overlay-bg', '--input-bg',
];

// ---------------------------------------------------------------------------------------------------------------------
// o catálogo
// ---------------------------------------------------------------------------------------------------------------------
export const PECAS_BASE: Peca[] = [
  // ─── Botões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'btn', tipo: 'botoes', nome: 'Botão padrão', descricao: '32 px de altura, ícone de 16 px', classes: ['btn'], telas: TODAS,
    uso: '<button className="btn"><Icone nome="plus" />Novo</button>', demo: () => <><button className="btn">Padrão</button><button className="btn"><Icone nome="plus" />Com ícone</button></> },
  { id: 'btn-primary', tipo: 'botoes', nome: 'Botão principal (vermelho)', descricao: 'Uma ação principal por área', classes: ['btn btn-primary'], telas: TODAS,
    uso: '<button className="btn btn-primary">Salvar</button>', demo: () => <><button className="btn btn-primary">Salvar</button><button className="btn btn-primary"><Icone nome="plus" />Adicionar</button><button className="btn btn-primary" disabled>Desligado</button></> },
  { id: 'btn-outline', tipo: 'botoes', nome: 'Botão com borda', classes: ['btn btn-outline'], telas: TODAS,
    uso: '<button className="btn btn-outline">Cancelar</button>', demo: () => <><button className="btn btn-outline">Cancelar</button><button className="btn btn-outline"><Icone nome="download" />Baixar CSV</button></> },
  { id: 'btn-sm', removida: { como: 'substituida', por: 'btn', em: '02/10/2026', motivo: 'Um tamanho de botão só no sistema: o pequeno (28 px, texto de 12 px) virou o padrão em todas as telas.' }, tipo: 'botoes', nome: 'Botão pequeno', descricao: '28 px, texto de 12 px', classes: ['btn btn-sm'], telas: ['e-importacao', 't-exec-importacao', 't-cadastro-janela'],
    demo: () => <><button className="btn btn-sm">Pequeno</button><button className="btn btn-primary btn-sm">Principal</button><button className="btn btn-outline btn-sm"><Icone nome="x" />Remover todos</button></> },
  { id: 'btn-danger', tipo: 'botoes', nome: 'Botão de perigo', descricao: 'Texto vermelho; no passar do mouse, fundo vermelho', classes: ['btn btn-danger'], telas: ['t-cadastro-janela', 'e-importacao'],
    demo: () => <button className="btn btn-danger"><Icone nome="x" />Excluir</button> },
  { id: 'btn-ghost', tipo: 'botoes', nome: 'Botão fantasma', classes: ['btn btn-ghost'], telas: ['c-relatorio'], demo: () => <button className="btn btn-ghost">Ver mais</button> },
  { id: 'btn-acao', tipo: 'botoes', nome: 'Botão que trabalha', descricao: 'Mostra a rodinha e o texto no gerúndio enquanto faz', componente: 'BotaoAcao', telas: ['c-importacao', 'e-importacao'],
    uso: '<BotaoAcao carregando={x} textoCarregando="Importando…">Importar</BotaoAcao>', demo: () => <><BotaoAcao>Importar</BotaoAcao><BotaoAcao carregando textoCarregando="Importando…">Importar</BotaoAcao></> },
  { id: 'icon-btn', tipo: 'botoes', nome: 'Botão de ícone', descricao: '32 px; sempre com título', componente: 'BotaoIcone', classes: ['icon-btn'], telas: TODAS,
    uso: '<BotaoIcone icone="x" titulo="Fechar" />', demo: () => <><BotaoIcone icone="copiar" titulo="Copiar" /><BotaoIcone icone="x" titulo="Fechar" /><BotaoIcone icone="olho" titulo="Ver o PDF" /><button className="icon-btn girando" title="Buscando"><Icone nome="girar" /></button></> },
  { id: 'link-btn', removida: { como: 'substituida', por: 'btn', em: '02/10/2026', motivo: 'Navegar é pela barra de cima (Tarefas / Vitor / Minhas empresas / 292 …), sem "← Voltar" no meio da página; as outras ações em texto viraram o botão padrão.' }, tipo: 'botoes', nome: 'Ação em texto', classes: ['link-btn'], telas: ['c-verificar', 't-empresa'], demo: () => <button className="link-btn">← Voltar para Movimento</button> },
  { id: 'gh-topo', removida: { como: 'substituida', por: 'icon-btn', em: '02/10/2026', motivo: 'Os botões do cabeçalho do executor tinham borda e fundo próprios, com os ícones apagados; agora são iguais ao Botão de ícone.' }, tipo: 'botoes', nome: 'Botões do cabeçalho (executor)', descricao: 'Os grupos (▾), as saídas (⚠ ▾), ✕ Interromper, ? O que falta e → Próximo', classes: ['gh-topo-btn', 'gh-topo-menu', 'gh-topo-forte', 'gh-topo-proximo'], telas: EXECUTOR,
    demo: () => (
      <nav className="gh-topo-acoes">
        <button className="gh-topo-btn gh-topo-menu" type="button"><Icone nome="fileUp" /><Icone nome="caretDown" className="menu-seta" /></button>
        <button className="gh-topo-btn gh-topo-menu" type="button"><Icone nome="alert" /><Icone nome="caretDown" className="menu-seta" /></button>
        <button className="gh-topo-btn gh-topo-forte" type="button" title="Interromper"><Icone nome="x" /></button>
        <button className="gh-topo-btn gh-topo-forte" type="button" title="O que falta"><Icone nome="ajuda" /></button>
        <button className="gh-topo-btn gh-topo-proximo" type="button" title="Próximo"><Icone nome="arrowDown" style={{ transform: 'rotate(-90deg)' }} /></button>
        <span className="gh-topo-sep" /><Avatar />
      </nav>
    ) },
  { id: 'gh-avatar', tipo: 'botoes', nome: 'Perfil (avatar)', classes: ['gh-avatar'], telas: TAREFAS, demo: () => <Avatar /> },
  { id: 'gh-hamb', tipo: 'botoes', nome: 'Menu ☰ (com aviso de versão nova)', classes: ['gh-hamb', 'gh-hamb-ponto'], telas: TODAS,
    demo: () => <><button className="gh-hamb" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button><button className="gh-hamb" type="button"><span className="gh-hamb-ponto" /><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button></> },
  { id: 'imp-btns', tipo: 'botoes', nome: 'Botões da linha do banco', descricao: 'Importar (↑), importado (✓; no mouse vira ×), Drive, Drive importado', classes: ['icon-btn icon-btn-sm imp-btn', 'imp-feito', 'imp-drive', 'imp-feito-drive'], telas: ['e-importacao', 't-exec-importacao', 't-exec-cheque'],
    demo: () => <>
      <span className="icon-btn icon-btn-sm imp-btn"><Icone nome="upload" /></span>
      <button className="icon-btn icon-btn-sm imp-btn imp-feito" type="button"><Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" /></button>
      <button className="icon-btn icon-btn-sm imp-btn imp-drive" type="button"><LogoDrive /></button>
      <button className="icon-btn icon-btn-sm imp-btn imp-feito imp-feito-drive" type="button"><span className="imp-feito-ok"><LogoDrive cor /></span><Icone nome="x" className="imp-feito-x" /></button>
      <span className="icon-btn icon-btn-sm imp-btn"><span className="btn-spinner" /></span>
    </> },
  { id: 'botao-google', tipo: 'botoes', nome: 'Entrar com o Google', componente: 'BotaoGoogle', classes: ['btn btn-outline botao-google'], telas: ['e-importacao', 't-drive'],
    uso: '<BotaoGoogle entrando={x} onClick={entrar} />', demo: () => <><BotaoGoogle onClick={() => undefined} /><BotaoGoogle entrando onClick={() => undefined} /></> },

  // ─── Selos ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'badge-ok', tipo: 'selos', nome: 'Ok', descricao: 'Verde preenchido: bateu (regra do app todo, 05/10/2026)', classes: ['badge badge-ok'], telas: ['c-relatorio', 'e-importacao', 't-exec-importacao', 't-exec-cheque', 't-exec-fiscal', 't-exec-clientes'],
    uso: '<span className="badge badge-ok">Ok</span>', demo: () => <span className="badge badge-ok">Ok</span>, aoVivo: undefined },
  { id: 'badge-conferido', tipo: 'selos', nome: 'Conferido', descricao: 'Cheio: conferido à mão (o banco que bate mas falta o cheque especial agora é o botão principal "Cheque especial")', classes: ['badge badge-conferido'], telas: ['c-relatorio', 't-exec-fiscal-rotina', 't-exec-clientes'],
    demo: () => <span className="badge badge-conferido">Conferido</span> },
  { id: 'badge-bad', tipo: 'selos', nome: 'Diferença', descricao: 'Laranja com borda: o valor da diferença', classes: ['badge badge-bad'], telas: ['c-relatorio', 't-exec-clientes'], demo: () => <><span className="badge badge-bad">89.967,19</span><span className="badge badge-bad">-295,00</span></> },
  { id: 'badge-neutral', tipo: 'selos', nome: 'Neutro', classes: ['badge badge-neutral'], telas: ['c-relatorio', 't-exec-folha', 't-exec-clientes'], demo: () => <><span className="badge badge-neutral">0,00</span><span className="badge badge-neutral">Configure em Cadastro › Configurações</span><span className="badge badge-neutral">Lote não soma</span></> },
  { id: 'cert-a1', tipo: 'campos', nome: 'Certificado A1 (soltar o .pfx e o cartão)', descricao: 'A área grande para soltar o arquivo (pulsa ao passar por cima) e o cartão do certificado lido: titular, CNPJ, validade e situação', classes: ['cert-soltar', 'cert-cartao', 'cert-campos', 'cert-acoes'], telas: ['t-senhas'],
    demo: () => <div style={{ width: '100%' }}><div className="cert-cartao lido ok"><span className="cert-cartao-chip" aria-hidden="true"><Icone nome="lock" /></span><div className="cert-cartao-corpo"><span className="cert-cartao-tipo">Certificado digital A1</span><b className="cert-cartao-nome">EMPRESA EXEMPLO LTDA</b><span className="cert-cartao-doc num">12.345.678/0001-90</span></div><div className="cert-cartao-validade"><span className="fraco">Validade</span><b className="num">10/04/2027</b><span className="badge badge-ok">Em dia</span></div></div></div> },
  { id: 'cert-painel', tipo: 'graficos', nome: 'Painel dos certificados', descricao: 'A rosca das situações com a legenda (clicar filtra), as barras dos vencimentos por mês e o cartão com o anel da contagem regressiva', classes: ['cert-dash', 'cert-rosca', 'cert-legenda', 'cert-barras', 'cert-urgente', 'cert-contagem', 'cert-cor-vence', 'cert-cor-vencido', 'cert-cor-ok', 'cert-cor-sem'], telas: ['t-senhas'], largo: true,
    demo: () => <div style={{ width: '100%', display: 'grid', gap: 12 }}><div className="cert-barras" style={{ minHeight: 160 }}>{[2, 5, 1, 0, 3, 4, 2, 6, 1, 0, 2, 3].map((n, i) => <span key={i} className={'cert-barra' + (i === 0 ? ' logo' : '')}><span className="cert-barra-num num">{n || ''}</span><span className="cert-barra-trilho" style={{ minHeight: 90 }}><span className="cert-barra-cheia" style={{ height: (n / 6) * 100 + '%' }} /></span><span className="cert-barra-mes">{['out', 'nov', 'dez', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set'][i]}</span></span>)}</div><span className="card cert-urgente" style={{ maxWidth: 300 }}><span className="cert-contagem cert-cor-vence"><svg viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r={15.915} className="cert-rosca-fundo" /><circle cx="21" cy="21" r={15.915} className="cert-contagem-arco" strokeDasharray="40 60" strokeDashoffset={25} /></svg><span className="cert-contagem-num num">12</span><span className="cert-contagem-txt">dias</span></span><span className="cert-urgente-texto"><b>EMPRESA EXEMPLO LTDA</b><span className="fraco num">292 · 19/10/2026</span></span></span></div> },
  { id: 'fgts-resumo', tipo: 'cartoes', nome: 'Resumo do mês com a barra (FGTS Digital)', descricao: 'O título do mês, quantas prontas de quantas, a barra de progresso inteira, o robô numa linha (bolinha) e o botão principal; e os passos do robô numa linha do tempo', classes: ['fgts-resumo', 'fgts-resumo-topo', 'fgts-robo-linha', 'fgts-barra', 'fgts-passos', 'fgts-passo-marca'], telas: ['t-dp-fgts'], largo: true,
    demo: () => <div style={{ width: '100%', display: 'grid', gap: 12 }}><section className="card fgts-resumo"><div className="fgts-resumo-topo"><div className="fgts-resumo-titulo"><h3>Guias de Setembro/2026</h3><span className="hint"><b className="num">12</b> de <b className="num">115</b> emitidas · 2 com o robô agora</span></div><span className="fgts-robo-linha"><span className="bolinha-sit concluida" aria-hidden="true" />Robô ligado · certificado até 20/05/2027</span><button type="button" className="btn btn-primary"><Icone nome="fileDown" />Emitir as que faltam · 101</button></div><span className="tarefas-barra fgts-barra"><span style={{ width: '10%' }} /></span></section><ol className="fgts-passos">{['portal', 'gov.br', 'entrou', 'perfil do cliente'].map((n, i) => <li key={n}><span className="fgts-passo-marca" aria-hidden="true">{i + 1}</span><div><b>{n}</b> <span className="fraco">07/10, 14:2{i}</span></div></li>)}</ol></div> },
  { id: 'imp-cert', tipo: 'campos', nome: 'Importar certificados (vários .pfx)', descricao: 'A área de soltar compacta e um cartão por arquivo: a empresa achada pelo CNPJ (ou escolher), a senha e a validade lida', classes: ['imp-cert', 'imp-cert-item', 'imp-cert-senha', 'imp-cert-acoes'], telas: ['t-senhas'],
    demo: () => <div style={{ width: '100%' }}><ul className="imp-cert-lista"><li className="cert-cartao imp-cert-item lido"><span className="cert-cartao-chip" aria-hidden="true"><Icone nome="check" /></span><div className="cert-cartao-corpo"><span className="cert-cartao-tipo">EMPRESA EXEMPLO_12345678000190.pfx</span><b className="cert-cartao-nome"><span className="num fraco">292 · </span>EMPRESA EXEMPLO LTDA</b><span className="cert-cartao-doc num">EMPRESA EXEMPLO LTDA · 12345678000190</span><span className="imp-cert-acoes"><button type="button" className="btn btn-outline">Trocar empresa</button><button type="button" className="btn btn-ghost">Tirar</button></span></div><div className="imp-cert-senha"><span className="badge badge-ok">Até 10/04/2027</span></div></li></ul></div> },
  { id: 'medalha-gov', tipo: 'selos', nome: 'Nível gov.br (medalha)', descricao: 'Bronze, Prata e Ouro: a moeda na cor do metal e o nome (B, P, O)', componente: 'MedalhaGov', classes: ['medalha', 'medalha-moeda', 'medalha-bronze', 'medalha-prata', 'medalha-ouro'], telas: ['t-senhas'],
    demo: () => <><MedalhaGov nivel="B" /><MedalhaGov nivel="P" /><MedalhaGov nivel="O" /></> },
  { id: 'badge-warn', tipo: 'selos', nome: 'Atenção', classes: ['badge badge-warn'], telas: ['t-gmail', 't-exec-fiscal-rotina'], demo: () => <span className="badge badge-warn">Pendente</span> },
  { id: 'badge-falta', tipo: 'selos', nome: 'Falta / duplicado (extrato)', classes: ['badge ext-badge-falta', 'badge ext-badge-dup'], telas: ['e-conferencia'], demo: () => <><span className="badge ext-badge-falta">Faltando</span><span className="badge ext-badge-dup">Duplicado</span></> },
  { id: 'bolinha-sit', tipo: 'selos', nome: 'Bolinha de situação', classes: ['bolinha-sit nao-iniciada', 'em-andamento', 'parada', 'concluida'], telas: ['t-empresas', 't-contabil'],
    demo: () => <>{(['nao-iniciada', 'em-andamento', 'parada', 'concluida'] as const).map(s => <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}><span className={'bolinha-sit ' + s} />{s}</span>)}</> },
  { id: 'caixas-etapa', tipo: 'selos', nome: 'Caixinha da etapa', descricao: 'Vazia, marcada (feita) e parada (interrompida)', classes: ['subnav-caixa vazia', 'subnav-caixa marcada', 'subnav-caixa parada'], telas: EXECUTOR,
    demo: () => <><span className="subnav-caixa vazia" /><span className="subnav-caixa marcada"><Icone nome="check" /></span><span className="subnav-caixa parada" /></> },
  { id: 'emp-cod', tipo: 'selos', nome: 'Código da empresa', classes: ['emp-cod'], telas: ['c-entrada', 'e-entrada', 'z-entrada'], demo: () => <span className="emp-cod">292</span> },
  { id: 'ponto-vermelho', tipo: 'selos', nome: 'Pontinho vermelho (falta configurar)', descricao: 'Ao lado do nome: na aba, no seletor e na linha que falta configurar (a dica diz o quê)', classes: ['ponto-vermelho'], telas: ['c-cadastro'],
    demo: () => <><span>Cadastro<span className="ponto-vermelho" /></span><span>5102, 6102 — Venda de mercadoria<span className="ponto-vermelho" /></span></> },
  { id: 'pill-vazio', tipo: 'selos', nome: 'Pílula vazia', classes: ['pill-vazio'], telas: ['c-cadastro'], demo: () => <span className="pill-vazio">sem conta</span> },
  { id: 'grupo-tag', tipo: 'selos', nome: 'Grupo da conta', classes: ['grupo-tag g-a', 'g-p', 'g-d', 'g-r'], telas: ['c-cadastro', 't-cadastro-janela'],
    demo: () => <><span className="grupo-tag g-a">Ativo</span><span className="grupo-tag g-p">Passivo</span><span className="grupo-tag g-d">Despesa</span><span className="grupo-tag g-r">Receita</span></> },

  // ─── Ícones ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'icones', tipo: 'icones', nome: 'Todos os ícones', descricao: 'SVG 24×24, traço 1,75, na cor do texto', componente: 'Icone', telas: TODAS, largo: true, uso: '<Icone nome="search" />',
    demo: () => <div className="cat-icones">{ICONES.map(n => <span key={n} className="cat-icone"><Icone nome={n} />{n}</span>)}</div> },
  { id: 'marca-n', tipo: 'icones', nome: 'O N da Nilma', componente: 'MarcaN', classes: ['brand-mark', 'auth-mark'], telas: TODAS,
    demo: () => <><span className="brand-mark"><MarcaN /></span><span className="auth-mark"><MarcaN /></span></> },
  { id: 'setas', tipo: 'icones', nome: 'Setas (▾ e ordenar)', descricao: 'O triângulo cheio do GitHub', classes: ['menu-seta', 'th-seta', 'imp-seta'], telas: TODAS,
    demo: () => <><Icone nome="caretDown" className="menu-seta" /><button className="imp-seta" type="button"><Icone nome="caretDown" /></button><button className="imp-seta aberta" type="button"><Icone nome="caretDown" /></button></> },

  // ─── Logos ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'logos-bancos', tipo: 'logos', nome: 'Bancos (cinza e colorido)', componente: 'LogoBanco', telas: ['e-importacao', 't-exec-importacao', 't-exec-cheque', 't-cadastro-janela'], largo: true, uso: '<LogoBanco banco="sicoob" cor />',
    demo: () => <div className="cat-icones">{BANCOS.map(b => <span key={b} className="cat-icone"><span style={{ display: 'flex', gap: 8 }}><span className="imp-logo" style={{ width: 28, height: 28 }}><LogoBanco banco={b} /></span><span className="imp-logo" style={{ width: 28, height: 28 }}><LogoBanco banco={b} cor /></span></span>{b}</span>)}</div> },
  { id: 'logos-apps', tipo: 'logos', nome: 'Aplicativos', componente: 'LogoDrive · LogoGmail · LogoWhatsApp', telas: ['e-importacao', 't-drive', 't-gmail'],
    demo: () => <><span style={{ width: 24, height: 24, display: 'inline-flex' }}><LogoDrive /></span><span style={{ width: 24, height: 24, display: 'inline-flex' }}><LogoDrive cor /></span><span style={{ width: 24, height: 24, display: 'inline-flex' }}><LogoGmail /></span><span style={{ width: 24, height: 24, display: 'inline-flex' }}><LogoWhatsApp /></span></> },

  // ─── Campos ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'busca-curta', tipo: 'campos', nome: 'Busca (com lupa)', classes: ['busca-curta', 'busca-curta larga'], telas: ['t-empresas', 't-cadastro', 't-drive', 'e-importacao', 'c-consulta'],
    uso: '<label className="busca-curta"><Icone nome="search" /><input /></label>', demo: () => <label className="busca-curta"><Icone nome="search" /><input type="text" placeholder="Buscar no extrato" /><kbd>/</kbd></label> },
  { id: 'field', tipo: 'campos', nome: 'Campo de texto', classes: ['field'], telas: ['t-entrar', 't-cadastro-janela', 'c-cadastro'],
    demo: () => <div className="field" style={{ width: 260 }}><label htmlFor="cat-f1">Agência</label><input id="cat-f1" type="text" placeholder="Ex.: 3001" /></div> },
  { id: 'select', tipo: 'campos', nome: 'Seleção', descricao: 'Com o triângulo do GitHub; a compacta tem o mesmo tamanho (só a largura acompanha o texto)', classes: ['field select', 'select-compact'], telas: ['c-cadastro', 'e-conferencia', 'c-relatorio'],
    demo: () => <><select defaultValue="cfop" style={{ width: 180 }}><option value="cfop">CFOP (A-Z)</option><option>Fornecedor (A-Z)</option></select><select className="select-compact" defaultValue="a"><option value="a">Todas</option></select></> },
  { id: 'checkbox', tipo: 'campos', nome: 'Checkbox', descricao: '18 px; o ✓ é desenhado para 18 px', classes: ['input[type=checkbox]', 'chk-auto'], telas: ['c-naturezas', 'c-relatorio', 't-exec-folha'],
    demo: () => <><input type="checkbox" /><input type="checkbox" defaultChecked /><input type="checkbox" disabled /><input type="checkbox" className="chk-auto" defaultChecked /></> },
  { id: 'interruptor', tipo: 'campos', nome: 'Interruptor', componente: 'Interruptor', classes: ['toggle-switch'], telas: ['c-consulta', 't-cadastro-config'], demo: () => <InterruptorVivo /> },
  { id: 'data', tipo: 'campos', nome: 'Data (dd/mm/aaaa)', componente: 'CampoData', classes: ['data-mask'], telas: ['c-consulta', 'e-cheque'], demo: () => <DataVivo /> },
  { id: 'mes', tipo: 'campos', nome: 'Seletor de mês', componente: 'SeletorMes', classes: ['seletor-mes'], telas: ['t-empresas', 't-contabil'], demo: () => <MesVivo /> },
  { id: 'arquivos', tipo: 'campos', nome: 'Escolher arquivos', componente: 'CampoArquivos', classes: ['file-picker'], telas: ['c-importacao', 'e-cheque', 'e-creditor'],
    demo: () => <><CampoArquivos id="cat-arq" onEscolher={nada} aceitar=".xls,.xlsx" /><CampoArquivos id="cat-arq2" onEscolher={nada} aceitar=".xls" compacto rotulo="Importar todos os meses" /></> },

  // ─── Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'tabela', tipo: 'tabelas', nome: 'Tabela padrão', descricao: 'Cabeçalho grudado; números à direita (.num); a conta com o código em negrito e o nome normal', componente: 'TituloDaConta', classes: ['table-wrap', 'table-compact', 'th-sort', 'num'], telas: ['c-relatorio', 'c-consulta', 'e-conferencia', 't-empresas'], largo: true,
    demo: () => (
      <div className="table-wrap"><table className="table-compact"><thead><tr><th className="th-sort">Conta</th><th>Descrição</th><th className="num">Notas</th><th className="num">Soma das notas</th><th className="num">Saldo do balancete</th><th>Situação</th></tr></thead>
        <tbody>
          <tr><td><b>81009</b> — Honorários Contábeis</td><td>Honorário</td><td className="num">8</td><td className="num">13.470,00</td><td className="num">13.470,00</td><td><span className="badge badge-ok">Ok</span></td></tr>
          <tr><td><b>81016</b> — Despesas com Serviços Tomados</td><td>Serviços Gerais</td><td className="num">41</td><td className="num">178.236,94</td><td className="num">88.269,75</td><td><span className="badge badge-bad">89.967,19</span></td></tr>
          <tr><td><b>81003</b> — Água e Esgoto</td><td>CFOP 1949</td><td className="num">7</td><td className="num">871,12</td><td className="num">1.166,12</td><td><span className="badge badge-conferido">Conferido</span></td></tr>
        </tbody></table></div>
    ) },
  { id: 'planilha', tipo: 'tabelas', nome: 'Planilha (pendências do banco)', descricao: 'Grade completa; a Situação diz o problema (o certo é sempre o do banco); o lote quebrado vira um grupo', classes: ['imp-planilha', 'imp-planilha-parte'], telas: ['e-importacao', 't-exec-importacao'], largo: true,
    demo: () => (
      <div className="table-wrap"><table className="table-compact imp-planilha"><thead><tr><th>Data</th><th>Situação</th><th>Lançamento</th><th className="num">Banco</th><th className="num">Razão</th><th className="num">Diferença</th></tr></thead>
        <tbody>
          <tr><td className="imp-planilha-dia" rowSpan={2}>18/05/2026</td><td className="imp-planilha-sit" rowSpan={2}>Os 130,96 que faltam parecem estar lançados em 06/03/2026</td><td className="imp-planilha-lanc"><b>CRÉD.LIQ.COBRANÇA DOC.: 2096255</b></td><td className="num"><b>8.398,18</b></td><td className="num"><b>8.267,22</b></td><td className="num ext-neg">−130,96</td></tr>
          <tr className="imp-planilha-parte"><td>SUPERMERCADO QUEBA LTDA</td><td className="num" /><td className="num">5.109,72</td><td /></tr>
          <tr><td className="imp-planilha-dia">16/04/2026</td><td className="imp-planilha-sit">Razão: 17/04 · Correto: 16/04</td><td className="imp-planilha-lanc"><b>SUPERMERCADO DONA BEIJA LTDA</b></td><td className="num"><b>947,30</b></td><td className="num"><b>947,30</b></td><td className="num" /></tr>
        </tbody></table></div>
    ) },
  { id: 'linhas', tipo: 'tabelas', nome: 'Linhas especiais', descricao: 'Feita (riscada), a atual, a do Passivo, a excluída', classes: ['tr.feito', 'tr.linha-atual', 'tr.linha-passivo', 'tr.linha-excluida', 'tr.ok', 'tr.bad'], telas: ['c-naturezas', 'c-relatorio', 'e-arquivos'], largo: true,
    demo: () => (
      <div className="table-wrap"><table className="table-compact"><tbody>
        <tr className="feito"><td><input type="checkbox" defaultChecked /></td><td className="risco">5101, 5401 — Venda de produção do estabelecimento</td><td className="num">2.810.822,09</td></tr>
        <tr className="linha-atual"><td><input type="checkbox" /></td><td>2910 — Entrada de bonificação, doação ou brinde</td><td className="num">10.194,82</td></tr>
        <tr className="linha-passivo"><td /><td>21401 — Telefone a Pagar (vínculo no Passivo)</td><td className="num">312,00</td></tr>
        <tr className="linha-excluida"><td /><td>extrato-julho.pdf (excluído)</td><td className="num">—</td></tr>
      </tbody></table></div>
    ) },

  // ─── Menus suspensos ────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'menu-suspenso', tipo: 'menus', nome: 'Menu suspenso (▾)', componente: 'MenuSuspenso', classes: ['popover menu-pop', 'popover-item', 'popover-sep'], telas: TODAS,
    uso: "<MenuSuspenso rotulo=\"Ações\" itens={[{ rotulo: 'Copiar', icone: 'copiar', onClick }, 'separador']} />",
    demo: () => <MenuSuspenso rotulo="Pedir extratos" setaAntes itens={[{ rotulo: 'E-mail', icone: 'envelope', onClick: nada }, { rotulo: 'Histórico', icone: 'clock', dica: '3', onClick: nada }, 'separador', { rotulo: 'Desligado', icone: 'lock', desabilitado: true, onClick: nada }]} /> },
  { id: 'menu-grupos', tipo: 'menus', nome: 'Menu suspenso sem nome', descricao: 'Só o ícone e o ▾: os grupos da rotina e as saídas da etapa; o dos grupos tem as abas Tarefas e Em lote (alterar e cancelar), como o Code ▾ do GitHub', componente: 'MenuSuspenso', classes: ['gh-topo-btn gh-topo-menu'], telas: EXECUTOR,
    demo: () => <MenuSuspenso rotulo="" icone="fileUp" className="gh-topo-btn gh-topo-menu" largura={260} conteudo={fechar => <MenuDaRotina fechar={fechar} grupos={[{ rotulo: 'Preparação', icone: 'fileUp', marcado: true, onClick: nada }, 'separador', { rotulo: 'Ativo', icone: 'landmark', desabilitado: true, onClick: nada }, { rotulo: 'Passivo', icone: 'relatorio', desabilitado: true, onClick: nada }, { rotulo: 'Resultado', icone: 'barChart', desabilitado: true, onClick: nada }, 'separador', { rotulo: 'Fechamento', icone: 'checkCircle', desabilitado: true, onClick: nada }]} emLote={{ rotulo: 'Janeiro a Setembro/2026 · 9 meses', onAlterar: nada, onCancelar: nada }} />} /> },
  { id: 'menu-saidas', removida: { como: 'substituida', por: 'menu-grupos', em: '02/10/2026', motivo: 'Era o mesmo padrão dos Grupos da rotina: os dois viraram uma peça só, o "Menu suspenso sem nome".' }, tipo: 'menus', nome: 'Saídas da etapa (⚠ ▾)', componente: 'MenuSuspenso', telas: ['t-exec-folha'],
    demo: () => <MenuSuspenso rotulo="" icone="alert" className="gh-topo-btn gh-topo-menu" titulo="Se não der para concluir" itens={[{ rotulo: 'Não tem funcionários', icone: 'checkCircle', onClick: nada }]} /> },
  { id: 'menu-perfil', tipo: 'menus', nome: 'Perfil', componente: 'MenuSuspenso', classes: ['gh-avatar'], telas: TAREFAS,
    demo: () => <MenuSuspenso rotulo="V" className="gh-avatar" titulo="Vitor" itens={[{ rotulo: 'Voltar às empresas', icone: 'home', onClick: nada }, { rotulo: 'Sair', icone: 'logOut', onClick: nada }]} /> },
  { id: 'menu-dados-teste', tipo: 'menus', nome: 'Dados de teste (Personaly)', componente: 'MenuSuspenso', telas: ['e-importacao', 't-exec-importacao'],
    demo: () => <MenuSuspenso rotulo="Dados de teste" icone="zap" titulo="Personaly Company · só neste navegador" itens={[{ rotulo: 'Extratos do período', icone: 'landmark', onClick: nada }, 'separador', { rotulo: 'Razão batendo', icone: 'check', onClick: nada }, { rotulo: 'Razão com o cheque especial', icone: 'checkCircle', onClick: nada }, { rotulo: 'Razão com erros', icone: 'alert', onClick: nada }, 'separador', { rotulo: 'Apagar os dados de teste', icone: 'x', onClick: nada }]} /> },
  { id: 'menu-parado', tipo: 'menus', nome: 'O menu aberto (desenho)', descricao: 'Sem título em cima: só os itens', classes: ['popover', 'popover-item', 'popover-dica', 'popover-sep'], telas: TODAS,
    demo: () => (
      <div className="popover menu-pop cat-parado" role="menu" style={{ minWidth: 220 }}>
        <button className="popover-item" type="button"><Icone nome="envelope" /><span className="popover-texto">E-mail</span></button>
        <button className="popover-item" type="button"><Icone nome="clock" /><span className="popover-texto">Histórico</span><span className="popover-dica">3</span></button>
        <hr className="popover-sep" />
        <button className="popover-item perigo" type="button"><Icone nome="x" /><span className="popover-texto">Excluir</span></button>
      </div>
    ) },

  // ─── Janelas (popups) ───────────────────────────────────────────────────────────────────────────────────────────────
  virouAviso(janela('jn-tudo-certo', 'Tudo certo! (banco Ok / conta sem pendências)', ['e-importacao', 't-exec-importacao'], { tom: 'ok', icone: 'checkCircle', titulo: 'Tudo certo!', html: '<b>Sicoob</b> Ag. 3144-5 · C/C 52.166-3', botoes: [{ rotulo: 'Ok', variante: 'btn-primary' }], fecharEm: { ms: 3500, valor: true } }, 'Fecha sozinha em 3,5 s'), 'av-tudo-certo'),
  janela('jn-saldo-negativo', 'Saldo negativo no banco (clique em Cheque especial)', ['e-importacao', 't-exec-importacao', 't-exec-cheque'], { icone: 'alert', titulo: 'Saldo negativo no banco', html: '<b>Sicoob</b> Ag. 3144-5 · C/C 52.166-3', botoes: [{ rotulo: 'Fazer Cheque Especial', variante: 'btn-primary' }] }),
  { id: 'menu-falta', tipo: 'menus', nome: 'O que falta (o sino do executor)', descricao: 'O sino com o número de pendências; abre suspenso, como o Code ▾ do GitHub, com o Resolver em cada uma', componente: 'MenuSuspenso + ListaDoQueFalta', classes: ['falta-btn', 'falta-qtd', 'falta-pop', 'falta-lista'], telas: EXECUTOR,
    demo: () => (
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <button type="button" className="gh-topo-btn gh-topo-menu falta-btn"><Icone nome="sino" /><span className="falta-qtd">3</span><Icone nome="caretDown" className="menu-seta" /></button>
        <div className="popover menu-pop cat-parado" style={{ position: 'static', width: 380 }}>
          <div className="falta-pop">
            <p className="falta-pop-titulo">Para seguir, falta</p>
            <ul className="falta-lista">
              {['Sicoob: extrato e razão batendo', 'Saídas', 'Tomados'].map(t => <li key={t}><span className="falta-texto">{t}</span><button type="button" className="btn">Resolver</button></li>)}
            </ul>
          </div>
        </div>
      </div>
    ) },
  { id: 'jn-falta', removida: { como: 'substituida', por: 'menu-falta', em: '02/10/2026', motivo: 'Não é mais janela: fica suspensa no sino do cabeçalho (com o número de pendências), como o Code ▾ do GitHub.' }, tipo: 'janelas', nome: 'Para seguir, falta (o ? do executor)', descricao: 'Uma tabelinha: cada item com o Resolver, que leva até o problema e o destaca', componente: 'JanelaOQueFalta', classes: ['modal modal-centro falta-janela', 'falta-tabela', 'nads-destaque'], telas: EXECUTOR,
    demo: () => (
      <div className={classeDaJanela({ icone: 'ajuda' }) + ' falta-janela cat-parado'} role="dialog">
        <h3>Para seguir, falta</h3>
        <div className="table-wrap falta-tabela"><table className="table-compact"><tbody>
          {['Sicoob: extrato e razão batendo', 'Saídas', 'Tomados'].map(t => <tr key={t}><td className="wrap">{t}</td><td className="num"><button type="button" className="btn">Resolver</button></td></tr>)}
        </tbody></table></div>
        <div className="modal-actions"><button type="button" className="btn btn-outline">Fechar</button></div>
      </div>
    ) },
  janela('jn-excluir', 'Excluir a importação?', ['e-importacao', 't-exec-importacao'], { icone: 'alert', titulo: 'Excluir a importação?', botoes: [{ rotulo: 'Excluir', variante: 'btn-danger' }, { rotulo: 'Cancelar' }] }),
  janela('jn-desmarcar', 'Desmarcar Conferência fiscal?', EXECUTOR, { icone: 'checkCircle', titulo: 'Desmarcar Conferência fiscal?', texto: 'A etapa volta a ficar pendente em todos os meses do período.', botoes: [{ rotulo: 'Cancelar' }, { rotulo: 'Desmarcar', variante: 'btn-primary' }] }),
  janela('jn-presta', 'Esta empresa presta serviço?', ['c-relatorio', 'c-importacao'], { icone: 'briefcase', titulo: 'Esta empresa presta serviços?', texto: 'Decide a aba Prestados e os serviços prestados na conferência.', botoes: [{ rotulo: 'Não' }, { rotulo: 'Sim', variante: 'btn-primary' }], obrigatoria: true }),
  virouAviso(janela('jn-orientacao', 'Como resolver (orientação de uma saída)', EXECUTOR, { icone: 'alert', titulo: 'O razão da conta ainda não foi gerado no sistema', texto: 'Gere o razão da conta do banco no Alterdata (Excel ou PDF) e importe na linha "Lançamentos contábeis".', botoes: [{ rotulo: 'Entendi', variante: 'btn-primary' }] }), 'av-orientacao'),
  { id: 'jn-interromper', tipo: 'janelas', nome: 'Por que interromper?', descricao: 'O ✕ do executor, ou sair da etapa por qualquer lugar do app: os motivos em cartões e a observação', componente: 'JanelaInterromper', classes: ['interromper-janela', 'interromper-opcao', 'interromper-obs'], telas: EXECUTOR,
    demo: () => (
      <div className={classeDaJanela({}) + ' interromper-janela cat-parado'} role="dialog">
        <button type="button" className="modal-x" aria-label="Fechar"><Icone nome="x" /></button>
        <h3>Por que interromper?</h3>
        <p className="interromper-etapa">Importação</p>
        <div className="interromper-opcoes">
          {['O cliente não enviou o extrato', 'O extrato está no Drive do cliente', 'O razão da conta ainda não foi gerado no sistema', 'Outro motivo'].map((m, k) => (
            <label key={m} className={'interromper-opcao' + (k === 0 ? ' on' : '')}><input type="radio" name="cat-motivo" defaultChecked={k === 0} /><span>{m}</span></label>
          ))}
        </div>
        <label className="interromper-obs"><span>Observação (opcional)</span><textarea rows={3} /></label>
        <div className="modal-actions"><button className="btn btn-danger" type="button">Interromper</button></div>
      </div>
    ) },
  { id: 'jn-cadastro', tipo: 'janelas', nome: 'Janela da empresa (Cadastro)', descricao: 'A janela grande, com abas', classes: ['cad-janela-fundo', 'cad-janela', 'cad-janela-topo', 'cad-janela-abas', 'cad-janela-aba'], telas: ['t-cadastro', 't-cadastro-janela'], largo: true,
    demo: () => (
      <div className="cad-janela cat-parado" style={{ maxWidth: 760, width: '100%' }}>
        <div className="cad-janela-topo"><span className="cad-janela-empresa"><span className="emp-cod">292</span><span className="cad-janela-nome">FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA</span></span><button className="icon-btn cad-janela-x" type="button" title="Fechar"><Icone nome="x" /></button></div>
        <div className="cad-janela-corpo">
          <nav className="cad-janela-abas">{['Empresa', 'Bancos', 'Plano de contas', 'Contas padrão', 'Histórico'].map((a, i) => <button key={a} type="button" className={'cad-janela-aba' + (i === 1 ? ' ativa' : '')}>{a}</button>)}</nav>
          <div className="cad-janela-conteudo"><p className="hint">O conteúdo da aba (bancos, plano de contas…).</p></div>
        </div>
      </div>
    ) },

  // ─── Avisos ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'alerta', tipo: 'avisos', nome: 'Alerta (amarelo)', componente: 'Alerta', classes: ['alert', 'alert-title', 'alert-text'], telas: ['t-exec-cheque', 'c-verificar', 'e-importacao', 't-exec-fiscal-rotina'], largo: true,
    demo: () => <Alerta naLinha titulo="Saldo negativo: faça o cheque especial" texto="Gere os lançamentos no Cheque especial, lance no Alterdata e importe o razão de novo." /> },
  { id: 'alerta-ok', tipo: 'avisos', nome: 'Alerta (verde)', componente: 'Alerta', classes: ['alert alert-ok'], telas: ['c-verificar', 't-exec-fiscal-rotina'], largo: true, demo: () => <Alerta naLinha tom="ok" titulo="Tudo bate neste período" texto="Nenhuma pendência." /> },
  { id: 'toast', tipo: 'avisos', nome: 'Aviso rápido (toast)', descricao: 'No canto de baixo, some em 4 s', componente: 'useRetorno().toast', classes: ['toast-region', 'toast'], telas: TODAS,
    demo: () => <div className="toast cat-parado">Etapa interrompida: Importação.</div>, aoVivo: c => c.toast('Etapa interrompida: Importação.') },
  { id: 'imp-aviso', tipo: 'avisos', nome: 'Barrinha no topo (importou / Drive)', descricao: 'Por cima da tela: o que deu certo some em 2,7 s; o erro (ex.: nada no Drive) fica até o ×', classes: ['imp-aviso', 'imp-aviso-barra', 'erro', 'info'], telas: ['e-importacao', 't-exec-importacao'],
    demo: () => {
      const barra = (tom: 'ok' | 'erro' | 'info', titulo: string, texto?: string) => (
        <div className={'imp-aviso-barra ' + tom + ' cat-parado'} role="status">
          <Icone nome={tom === 'erro' ? 'alert' : tom === 'info' ? 'clock' : 'checkCircle'} />
          <span><b>{titulo}</b>{texto && <span className="hint"> · {texto}</span>}</span>
          <button type="button" aria-label="Fechar" title="Fechar">×</button>
        </div>
      );
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
          {barra('ok', 'Sicoob: extratos trazidos do Drive', '01/2026, 02/2026')}
          {barra('erro', 'Sicoob: nada no Drive', 'Não achei no Drive: 09/2026.')}
          {barra('info', 'Buscando no Drive…', 'Sicoob, 03/2026')}
        </div>
      );
    } },
  { id: 'msg-balao', tipo: 'avisos', nome: 'Mensagem para o cliente (balão)', descricao: 'A observação que vai para o cliente, num balão de conversa; ao lado, o check que vira × e apaga (Vitor, 07/10/2026)', classes: ['msg-balao'], telas: ['t-exec-clientes', 'm-formulario'],
    demo: () => <span className="msg-balao"><Icone nome="mensagem" />No meu sistema, está em aberto: 25/08/2026 - NF 10111 - R$ 1.514,65</span> },
  { id: 'parity', tipo: 'avisos', nome: 'Faixa verde (bate)', classes: ['parity'], telas: ['c-relatorio'], largo: true, demo: () => <div className="parity"><Icone nome="checkCircle" />Tudo bate com o balancete.</div> },
  { id: 'welcome', tipo: 'avisos', nome: 'Faixa de dados de exemplo', classes: ['welcome-banner'], telas: ['c-entrada', 'e-entrada'], largo: true, demo: () => <div className="welcome-banner">Dados de exemplo (901, 902, 903) · nada é gravado em banco</div> },

  // ─── Abas ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'av-tudo-certo', tipo: 'avisos', nome: 'Tudo certo! (banco Ok / conta sem pendências)', descricao: 'useRetorno().aviso: a barrinha no topo; some em 3,7 s (ou no ×)', componente: 'useRetorno().aviso', classes: ['imp-aviso-barra aviso-barra ok'], telas: ['e-importacao', 't-exec-importacao'],
    demo: () => <AvisoParado tom="ok" titulo="Tudo certo!" texto="Sicoob Ag. 3144-5 · C/C 52.166-3" />, aoVivo: c => c.aviso({ tom: 'ok', titulo: 'Tudo certo!', texto: 'Sicoob Ag. 3144-5 · C/C 52.166-3' }) },
  { id: 'av-orientacao', tipo: 'avisos', nome: 'Como resolver (orientação de uma saída)', descricao: 'useRetorno().aviso: a barrinha no topo; some em 8 s (ou no ×)', componente: 'useRetorno().aviso', classes: ['imp-aviso-barra aviso-barra info'], telas: EXECUTOR,
    demo: () => <AvisoParado tom="info" titulo="O Fiscal ainda não fechou as notas" texto="Peça ao Fiscal para fechar o mês antes de conferir." />, aoVivo: c => c.aviso({ tom: 'info', titulo: 'O Fiscal ainda não fechou as notas', texto: 'Peça ao Fiscal para fechar o mês antes de conferir.' }) },
  { id: 'av-propriedades', tipo: 'avisos', nome: 'Propriedades (Drive)', descricao: 'useRetorno().aviso: a barrinha no topo; some em 8 s (ou no ×)', componente: 'useRetorno().aviso', classes: ['imp-aviso-barra aviso-barra info'], telas: ['t-drive'],
    demo: () => <AvisoParado tom="info" titulo="extrato-agosto.pdf" texto="Tipo: PDF · Tamanho: 182 KB · Pasta: 292 › 2026 › Bancos" icone="fileText" />, aoVivo: c => c.aviso({ tom: 'info', titulo: 'extrato-agosto.pdf', texto: 'Tipo: PDF · Tamanho: 182 KB · Pasta: 292 › 2026 › Bancos', icone: 'fileText' }) },
  { id: 'av-falta-plano', tipo: 'avisos', nome: 'Falta importar o plano de contas', descricao: 'useRetorno().aviso: a barrinha no topo; some em 8 s (ou no ×)', componente: 'useRetorno().aviso', classes: ['imp-aviso-barra aviso-barra erro'], telas: ['c-cadastro'],
    demo: () => <AvisoParado tom="erro" titulo="Falta importar o plano de contas" texto="Vá em Plano de contas e leia um balancete primeiro." />, aoVivo: c => c.aviso({ tom: 'erro', titulo: 'Falta importar o plano de contas', texto: 'Vá em Plano de contas e leia um balancete primeiro.' }) },
  { id: 'av-falta-preencher', tipo: 'avisos', nome: 'Falta preencher antes de conferir', descricao: 'useRetorno().aviso: a barrinha no topo; some em 8 s (ou no ×)', componente: 'useRetorno().aviso', classes: ['imp-aviso-barra aviso-barra erro'], telas: ['c-verificar'],
    demo: () => <AvisoParado tom="erro" titulo="Falta preencher antes de conferir" texto="Escolha a conta · Importe o relatório da conta" />, aoVivo: c => c.aviso({ tom: 'erro', titulo: 'Falta preencher antes de conferir', texto: 'Escolha a conta · Importe o relatório da conta' }) },
  { id: 'abas-menu', tipo: 'abas', nome: 'Abas sublinhadas', classes: ['menu', 'menu-item', 'menu-contador'], telas: TODAS, largo: true,
    demo: () => <nav className="menu">{([['Bancos', 'landmark', true], ['Balancete', 'scale'], ['Entradas', 'arrowDown'], ['Saídas', 'arrowUp'], ['Tomados', 'fileDown']] as [string, NomeIcone, boolean?][]).map(([r, i, a]) => <button key={r} type="button" className={'menu-item' + (a ? ' active' : '')}><Icone nome={i} /><span>{r}</span></button>)}</nav> },
  { id: 'segmentado', tipo: 'abas', nome: 'Segmentado', componente: 'Segmentado', classes: ['steps', 'step-pill'], telas: ['c-relatorio', 'c-cadastro', 'c-consulta'], demo: () => <SegmentadoVivo /> },
  { id: 'imp-meses', tipo: 'abas', nome: 'Meses do período (Em lote)', descricao: 'Uma tabela: meses em cima (clicar abre), Extrato e Razão nas linhas, um ícone por mês', classes: ['imp-meses', 'imp-meses-mes', 'atual', 'imp-mes-sem'], telas: ['e-importacao', 't-exec-importacao'], largo: true,
    demo: () => {
      const ok = <button className="icon-btn icon-btn-sm imp-btn imp-feito" type="button"><Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" /></button>;
      const drive = <button className="icon-btn icon-btn-sm imp-btn imp-feito imp-feito-drive" type="button"><span className="imp-feito-ok"><LogoDrive cor /></span><Icone nome="x" className="imp-feito-x" /></button>;
      const falta = <button className="gh-topo-btn gh-topo-menu imp-mes-menu" type="button" title="Importar o extrato"><Icone nome="upload" /><Icone nome="caretDown" className="menu-seta" /></button>;
      const razao = <button className="icon-btn icon-btn-sm imp-btn" type="button" title="Importar o razão"><Icone nome="upload" /></button>;
      const meses = ['01/2026', '02/2026', '03/2026', '04/2026'];
      return (
        <div className="imp-periodo-linha" style={{ width: '100%', padding: 0, border: 'none' }}>
          <table className="imp-meses">
            <thead><tr><th scope="col" />{meses.map((m, i) => <th key={m} scope="col" className={i === 0 ? 'atual' : undefined}><button type="button" className="imp-meses-mes">{m}</button></th>)}</tr></thead>
            <tbody>
              <tr><th scope="row">Extrato</th><td className="atual">{drive}</td><td>{ok}</td><td>{falta}</td><td><button type="button" className="imp-mes-sem">s/ mov.</button></td></tr>
              <tr><th scope="row">Razão</th><td className="atual">{ok}</td><td>{ok}</td><td>{razao}</td><td><button type="button" className="imp-mes-sem">s/ mov.</button></td></tr>
            </tbody>
          </table>
        </div>
      );
    } },
  { id: 'faixas', tipo: 'abas', nome: 'Faixas que abrem (Lançamentos / Pendências)', classes: ['imp-faixa', 'imp-faixa-barra', 'imp-faixa-qtd', 'imp-faixa aviso'], telas: ['e-importacao', 't-exec-importacao', 't-exec-fiscal-rotina'], largo: true,
    demo: () => <div className="cat-moldura"><div className="imp-faixa"><button className="imp-faixa-barra" type="button"><Icone nome="caretDown" className="imp-faixa-seta" /><b>Lançamentos</b><span className="imp-faixa-qtd">131</span></button></div><div className="imp-faixa aviso"><button className="imp-faixa-barra" type="button"><Icone nome="caretDown" className="imp-faixa-seta" /><b>Pendências</b><span className="imp-faixa-qtd">4</span></button></div></div> },
  { id: 'trilha', tipo: 'abas', nome: 'Trilha (onde estou)', classes: ['gh-crumbs', 'gh-crumb', 'gh-sep'], telas: TODAS,
    demo: () => <nav className="gh-crumbs"><span className="gh-crumb">Tarefas</span><span className="gh-sep">/</span><span className="gh-crumb gh-crumb-fim">292 · FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA</span></nav> },

  // ─── Cabeçalhos ─────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'cb-executor', tipo: 'cabecalhos', nome: 'Tarefas › Executor', classes: ['gh-header'], telas: EXECUTOR, largo: true,
    demo: () => <Cabecalho trilha={['Tarefas', '292 · FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA']} direita={<nav className="gh-topo-acoes"><button className="gh-topo-btn gh-topo-menu" type="button"><Icone nome="fileUp" /><Icone nome="caretDown" className="menu-seta" /></button><button className="gh-topo-btn gh-topo-forte" type="button"><Icone nome="x" /></button><button className="gh-topo-btn gh-topo-proximo" type="button"><Icone nome="arrowDown" style={{ transform: 'rotate(-90deg)' }} /></button><span className="gh-topo-sep" /><Avatar /></nav>} /> },
  { id: 'cb-executor-fiscal', tipo: 'cabecalhos', nome: 'Tarefas › Executor › Conferência fiscal (as abas sobem)', classes: ['gh-header', 'menu'], telas: ['t-exec-fiscal'], largo: true,
    demo: () => <Cabecalho trilha={['Tarefas', '292 · FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA']} direita={<Avatar />} abas={[{ rotulo: 'Relatório', icone: 'relatorio', ativa: true }, { rotulo: 'Naturezas', icone: 'checklist' }, { rotulo: 'Consulta', icone: 'search' }, { rotulo: 'Cadastro', icone: 'settings' }, { rotulo: 'Auditoria', icone: 'clock' }]} /> },
  { id: 'cb-tarefas', tipo: 'cabecalhos', nome: 'Tarefas (listas)', classes: ['gh-header'], telas: ['t-empresas', 't-insights', 't-contabil', 't-cadastro', 't-drive', 't-gmail'], largo: true,
    demo: () => <Cabecalho trilha={['Tarefas', 'Vitor']} direita={<Avatar />} abas={[{ rotulo: 'Empresas', icone: 'briefcase', ativa: true }, { rotulo: 'Insights', icone: 'barChart' }]} /> },
  { id: 'cb-extrator', tipo: 'cabecalhos', nome: 'Extratudo › Extrator', classes: ['gh-header'], telas: ['e-importacao', 'e-arquivos', 'e-conferencia', 'e-historico'], largo: true,
    demo: () => <Cabecalho trilha={['Extratudo', '292 FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA']} abas={[{ rotulo: 'Arquivos', icone: 'fileUp', ativa: true }, { rotulo: 'Lançamentos', icone: 'list' }, { rotulo: 'Extrato × sistema', icone: 'checkCircle' }, { rotulo: 'Histórico', icone: 'clock' }]} /> },
  { id: 'cb-concilia', tipo: 'cabecalhos', nome: 'Concilia aí', classes: ['gh-header'], telas: CONCILIA, largo: true,
    demo: () => <Cabecalho trilha={['Concilia aí', '292 FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA']} abas={[{ rotulo: 'Relatório', icone: 'relatorio', ativa: true }, { rotulo: 'Naturezas', icone: 'checklist' }, { rotulo: 'Verificar', icone: 'fileSearch' }]} /> },
  { id: 'cb-componentes', tipo: 'cabecalhos', nome: 'Componentes (este site)', classes: ['gh-header'], telas: [], largo: true,
    demo: () => <Cabecalho trilha={['Componentes', 'Catálogo do nads']} abas={[{ rotulo: 'Botões', icone: 'zap', ativa: true, contador: '15' }, { rotulo: 'Selos', icone: 'checkCircle' }, { rotulo: 'Janelas', icone: 'maximizar' }]} /> },

  // ─── Menus laterais ─────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'lt-executor', tipo: 'laterais', nome: 'Tarefas › Executor (o checklist das etapas)', descricao: 'Caixinhas: feita, a da vez, as da frente apagadas', classes: ['subnav', 'subnav-item', 'subnav-caixa', 'apagada'], telas: EXECUTOR,
    demo: () => <Lateral titulo="Preparação" itens={[{ rotulo: 'Importação', caixa: 'marcada' }, { rotulo: 'Cheque especial', caixa: 'marcada' }, { rotulo: 'Conferência fiscal', caixa: 'vazia', ativa: true }, { rotulo: 'Contabilização da Folha', caixa: 'vazia', apagada: true }]} /> },
  { id: 'lt-extratudo', tipo: 'laterais', nome: 'Extratudo (as ferramentas)', classes: ['subnav', 'subnav-item'], telas: EXTRATUDO,
    demo: () => <Lateral itens={[{ rotulo: 'Extrator', icone: 'scale', ativa: true }, { rotulo: 'Cheque especial', icone: 'landmark' }, { rotulo: 'Creditor', icone: 'fileText' }]} /> },
  { id: 'lt-concilia', tipo: 'laterais', nome: 'Concilia aí (as seções)', classes: ['subnav', 'subnav-item', 'is-locked'], telas: CONCILIA,
    demo: () => <Lateral itens={[{ rotulo: 'Importação', icone: 'fileUp' }, { rotulo: 'Movimento', icone: 'relatorio', ativa: true }, { rotulo: 'Cadastro', icone: 'settings' }, { rotulo: 'Auditoria', icone: 'clock', travada: true }]} /> },
  { id: 'lt-gaveta', tipo: 'laterais', nome: 'Gaveta ☰ (todos os aplicativos)', classes: ['drawer', 'drawer-item', 'drawer-foot'], telas: TODAS,
    demo: () => (
      <div className="cat-moldura" style={{ maxWidth: 300 }}>
        <aside className="drawer cat-parado" style={{ position: 'static', height: 'auto', width: '100%' }}>
          <div className="drawer-head"><span className="brand-mark"><MarcaN /></span><button className="drawer-x" type="button"><Icone nome="x" /></button></div>
          <button className="drawer-item" type="button"><Icone nome="home" />Início</button>
          <hr className="drawer-sep" />
          {([['Minhas empresas', 'briefcase'], ['Contábil', 'checklist'], ['Cadastro', 'landmark'], ['Fiscal', 'fileText'], ['Drive', 'pasta'], ['Gmail', 'envelope']] as [string, NomeIcone][]).map(([n, i]) => <button key={n} className="drawer-item" type="button"><Icone nome={i} />{n}</button>)}
          <div className="drawer-foot"><SeletorTema /><button className="drawer-item" type="button"><Icone nome="envelope" />Feedbacks<span className="menu-contador drawer-contador">2</span></button><p>Versão do sistema: 0.0.44 · <button type="button" className="drawer-atualizar">Atualizar para 0.0.45</button></p></div>
        </aside>
      </div>
    ) },

  // ─── Cartões ────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'card', tipo: 'cartoes', nome: 'Cartão', descricao: 'O h3 vira a faixa cinza do topo', classes: ['card', 'card-head'], telas: TODAS,
    demo: () => <div className="card" style={{ width: '100%' }}><h3>Contabilização da Folha</h3><p style={{ padding: '0 16px' }} className="hint">O conteúdo do cartão.</p></div> },
  { id: 'painel-numero', tipo: 'cartoes', nome: 'Números em painéis coloridos', descricao: 'Cada número no tom do que ele é, com o ícone (Sávio, 07/10/2026): azul o total, verde o feito, amarelo o que falta, o vermelho do nads o destaque; laranja, roxo e ciano para os outros (08/10: "quero que colora todos")', classes: ['stat painel-numero', 'painel-info', 'painel-ok', 'painel-aviso', 'painel-marca', 'painel-laranja', 'painel-roxo', 'painel-ciano', 'painel-neutro', 'painel-numero-icone'], telas: ['t-dp-resumo'], largo: true,
    demo: () => <div className="stat-grid dp-numeros" style={{ width: '100%' }}>{([['Clientes', 115, 'info', 'briefcase'], ['Concluídos', 48, 'ok', 'check'], ['Pendentes', 67, 'aviso', 'clock'], ['Com folha', 82, 'marca', 'usuario'], ['Pró-labore', 44, 'laranja', 'usuario'], ['Sem movimento', 21, 'roxo', 'list'], ['REINF autorizada', 19, 'ciano', 'fileUp']] as [string, number, string, NomeIcone][]).map(([r, v, tom, ic]) => <div key={r} className={'stat painel-numero painel-' + tom}><span className="painel-numero-icone" aria-hidden="true"><Icone nome={ic} /></span><p className="stat-label">{r}</p><p className="stat-value">{v}</p></div>)}</div> },
  { id: 'stat', tipo: 'cartoes', nome: 'Números (stat)', componente: 'Stat', classes: ['stat-grid', 'stat', 'stat-label', 'stat-value'], telas: ['c-relatorio', 't-insights', 'e-conferencia', 'c-verificar', 't-exec-fiscal-rotina'], largo: true,
    demo: () => <div className="stat-grid" style={{ width: '100%' }}><Stat rotulo="Notas" valor="462" /><Stat rotulo="Valor total" valor="1.622.422,77" /><Stat rotulo="Entradas no período" valor="63.390,44" cor="entrada" /><Stat rotulo="Saídas no período" valor="63.734,30" cor="saida" /></div> },
  { id: 'banco', tipo: 'cartoes', nome: 'Linha do banco (Importação)', classes: ['imp-bloco', 'imp-linha'], telas: ['e-importacao', 't-exec-importacao', 't-exec-cheque'], largo: true,
    demo: () => (
      <div className="imp-bloco" style={{ width: '100%' }}>
        <div className="imp-linha">
          <span className="imp-seta"><Icone nome="caretDown" /></span>
          <span className="imp-ico imp-logo"><LogoBanco banco="sicoob" cor /></span>
          <div className="imp-txt"><span><b>Sicoob</b><span className="imp-conta">Ag. 3144-5 · C/C 52.166-3</span></span></div>
          <div className="imp-resumo" />
          <div className="imp-grupos"><span className="badge badge-ok">Ok</span></div>
        </div>
      </div>
    ) },
  { id: 'folha', tipo: 'cartoes', nome: 'Checklist da folha', classes: ['card folha-check', 'folha-check-lista'], telas: ['t-exec-folha', 't-exec-fiscal-rotina'], largo: true,
    demo: () => (
      <div className="card folha-check">
        <div className="folha-check-topo"><h3>Contabilização da Folha</h3><span className="folha-check-qtd">1/3</span></div>
        <ul className="folha-check-lista">
          <li className="feito"><label><input type="checkbox" defaultChecked /><span className="folha-check-texto"><b>Folha de pagamento (Salários)</b><span className="hint">40001 — Salários a Pagar</span></span></label></li>
          <li><label><input type="checkbox" /><span className="folha-check-texto"><b>Pró-labore</b><span className="hint">36006 — Pro Labore a Pagar</span></span></label></li>
          <li className="travado"><label><input type="checkbox" disabled /><span className="folha-check-texto"><b>Férias</b><span className="hint">40002 — Férias a Pagar</span></span></label></li>
        </ul>
      </div>
    ) },
  { id: 'vazio', tipo: 'cartoes', nome: 'Vazio (nada aqui)', classes: ['gh-blank'], telas: TODAS,
    demo: () => <div className="gh-blank"><Icone nome="search" /><h4>Nenhum pedido</h4><p>Nenhum pedido feito para esta empresa ainda.</p></div> },
  { id: 'checklist-fiscal', tipo: 'cartoes', nome: 'Checklist disfarçada (rotina do Fiscal)', descricao: 'O cartão com a barra de progresso; cada tarefa uma faixa que abre (caixinha, contador, Importar, Conferido) com o painel dela (Stat, rank, tabela, gráficos)', componente: 'ChecklistDisfarcado', classes: ['card folha-check pt-check', 'imp-faixa pt-tarefa', 'subnav-caixa', 'tarefas-barra'], telas: ['t-exec-fiscal-rotina'], largo: true,
    demo: () => (
      <div className="card folha-check pt-check" style={{ width: '100%' }}>
        <div className="card-head"><h3>Conferência › Saídas</h3><span className="card-head-ctl"><span className="tarefas-barra"><span style={{ width: '50%' }} /></span>1/2</span></div>
        <div className="imp-faixa pt-tarefa"><div className="imp-faixa-barra pt-tarefa-barra"><span className="pt-tarefa-abrir"><span className="subnav-caixa marcada"><Icone nome="check" /></span><Icone nome="caretDown" className="imp-faixa-seta" /><b>Sequência de Saídas</b></span><span className="pt-tarefa-acoes"><span className="badge badge-conferido">Conferido</span></span></div></div>
        <div className="imp-faixa pt-tarefa aberta da-vez"><div className="imp-faixa-barra pt-tarefa-barra"><span className="pt-tarefa-abrir"><span className="subnav-caixa vazia" /><Icone nome="caretDown" className="imp-faixa-seta" /><b>Conferência das Notas Fiscais</b><span className="imp-faixa-qtd">24</span></span><span className="pt-tarefa-acoes"><button className="btn btn-outline" type="button"><Icone nome="upload" />Importar Saídas</button><button className="btn btn-primary" type="button"><Icone nome="check" />Conferido</button></span></div>
          <div className="imp-faixa-corpo"><div className="stat-grid"><Stat rotulo="Notas de saída" valor="24" /><Stat rotulo="Valor contábil" valor="58.076,76" cor="saida" /><Stat rotulo="CFOPs" valor="5" /></div></div></div>
      </div>
    ) },

  // ─── Listas ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'chips', tipo: 'listas', nome: 'Chips de filtro', classes: ['chip-row', 'chip-lbl', 'chip-f', 'on'], telas: ['c-consulta', 'c-naturezas'],
    demo: () => <div className="chip-row"><span className="chip-lbl">Tipo</span><button className="chip-f on" type="button">Todos</button><button className="chip-f" type="button">Entradas</button><button className="chip-f" type="button">Saídas</button></div> },
  { id: 'contadores', tipo: 'listas', nome: 'Contadores', classes: ['tarefas-contador', 'menu-contador', 'imp-faixa-qtd'], telas: ['t-empresas', 'e-importacao', 't-exec-fiscal-rotina'],
    demo: () => <><button className="tarefas-contador" type="button"><Icone nome="briefcase" /><b>235</b> empresas</button><span className="menu-contador">12</span><span className="imp-faixa-qtd">4</span></> },
  { id: 'emp-list', tipo: 'listas', nome: 'Lista de empresas (entrar)', classes: ['emp-list', 'emp-item'], telas: ['c-entrada', 'e-entrada', 'z-entrada'],
    demo: () => <div className="emp-list" style={{ width: 320 }}>{[[292, 'FITO INDUSTRIA E COMERCIO'], [9999, 'PERSONALY COMPANY']].map(([c, n]) => <button key={c} className="emp-item" type="button"><span className="emp-cod">{c}</span><span className="emp-txt"><span className="emp-nome">{n}</span></span></button>)}</div> },

  // ─── Carregamento ───────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'spinner', tipo: 'carregamento', nome: 'Rodinha', classes: ['btn-spinner'], telas: TODAS, demo: () => <><span className="btn-spinner" /><button className="btn btn-primary" disabled type="button"><span className="btn-spinner" />Salvando…</button></> },
  { id: 'barra-topo', tipo: 'carregamento', nome: 'Barra do topo', descricao: 'Vermelha, 2 px, no alto da página', componente: 'BarraDeCarregamento · useCarregando', classes: ['barra-carregamento'], telas: TODAS,
    demo: () => <div className="cat-moldura" style={{ height: 24, position: 'relative' }}><div style={{ position: 'absolute', left: 0, top: 0, height: 2, width: '60%', background: 'var(--accent)' }} /></div> },
  { id: 'esqueleto', tipo: 'carregamento', nome: 'Esqueleto', componente: 'Esqueleto', classes: ['esqueleto'], telas: ['c-relatorio'], largo: true, demo: () => <Esqueleto linhas={3} numeros={3} /> },
  { id: 'abertura', tipo: 'carregamento', nome: 'Abertura (logo completa)', descricao: 'Ao abrir o app: o N se monta e revela "Nilma CONTABILIDADE"', componente: 'AberturaN', classes: ['abertura', 'abertura-logo'], telas: ['t-entrar'],
    demo: () => <p className="hint">Use o ▶ para ver na tela inteira.</p>, aoVivo: c => c.abertura('completa') },
  { id: 'abertura-vidro', tipo: 'carregamento', nome: 'Carregando (o N no vidro, tela inteira)', componente: 'AberturaN vidro', classes: ['abertura vidro'], telas: [...EXECUTOR],
    demo: () => <p className="hint">Use o ▶ para ver na tela inteira.</p>, aoVivo: c => c.abertura('vidro') },

  // ─── Gráficos ───────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'progresso', tipo: 'graficos', nome: 'Barra de progresso', classes: ['tarefas-barra', 'parada'], telas: ['t-empresas', 't-contabil', 't-exec-fiscal-rotina'],
    demo: () => <><span className="tarefas-barra"><span style={{ width: '40%' }} /></span><span className="tarefas-barra"><span className="parada" style={{ width: '70%' }} /></span></> },
  { id: 'rank', tipo: 'graficos', nome: 'Ranking', classes: ['rank', 'rank-item', 'rank-barra'], telas: ['c-relatorio', 't-exec-fiscal-rotina'], largo: true,
    demo: () => <div className="rank" style={{ width: '100%' }}>{[['5101 — Venda de produção', 72], ['1101 — Compra para industrialização', 41], ['2910 — Bonificação', 9]].map(([n, v]) => <button key={n} className="rank-item" type="button"><span className="rank-nome">{n}</span><span className="rank-val">{v}%</span><span className="rank-barra"><span style={{ width: v + '%', background: 'var(--accent)' }} /></span></button>)}</div> },

  { id: 'barras-dia', removida: { como: 'excluida', em: '06/10/2026', motivo: 'Vitor: "não curti nenhum dos gráficos novos"; a composição voltou para o Ranking e o resto para os Números (Stat).', sumir: true }, tipo: 'graficos', nome: 'Barras por dia do mês', descricao: 'Uma barra por dia; o dia, as notas e o valor ao passar o mouse (as barras sobem ao aparecer)', componente: 'BarrasPorDia', classes: ['graf-dias', 'graf-dia'], telas: ['t-exec-fiscal-rotina'], largo: true,
    demo: () => null },
  { id: 'rosca', removida: { como: 'excluida', em: '06/10/2026', motivo: 'Vitor: "não curti nenhum dos gráficos novos"; a composição voltou para o Ranking e o resto para os Números (Stat).', sumir: true }, tipo: 'graficos', nome: 'Rosca (composição)', descricao: 'O total no meio e a legenda com a fatia e o valor; cada classe de CFOP sempre com a mesma cor (--cat-1 a --cat-7)', componente: 'Rosca', classes: ['graf-rosca', 'graf-legenda'], telas: ['t-exec-fiscal-rotina'], largo: true,
    demo: () => null },
  { id: 'faixa-100', removida: { como: 'excluida', em: '06/10/2026', motivo: 'Vitor: "não curti nenhum dos gráficos novos"; a composição voltou para o Ranking e o resto para os Números (Stat).', sumir: true }, tipo: 'graficos', nome: 'Faixa 100% (composição)', descricao: 'A composição numa barra só, com a legenda embaixo', componente: 'Faixa', classes: ['graf-faixa', 'graf-legenda em-linha'], telas: ['t-exec-fiscal-rotina'], largo: true,
    demo: () => null },

  // ─── Cores ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'cores', tipo: 'cores', nome: 'As cores do sistema', descricao: 'Mude o tema no ☰ para ver o escuro', telas: TODAS, largo: true,
    demo: () => <div className="cat-cores">{CORES.map(c => <span key={c} className="cat-cor"><i style={{ background: 'var(' + c + ')' }} />{c}</span>)}</div> },
  { id: 'tema', tipo: 'cores', nome: 'Seletor de tema', componente: 'SeletorTema', classes: ['theme-toggle'], telas: TODAS, demo: () => <SeletorTema /> },
];
