// As peças do catálogo, desenhadas com as MESMAS peças do sistema (@nads/ui e as classes do nads.css). A ordem dentro
// de cada tipo dá o código (BT-01, BT-02…): peça nova entra no FIM do tipo, para os códigos não mudarem.
import {
  Alerta, AnelDeContagem, BarrasEmColuna, BotaoAcao, BotaoFechar, Vazio, CartaoComAnel, RoscaComLegenda, ConfigLinha, ConfigSecao, Dica, MedalhaGov, classeDaJanela, ordemDosBotoes, BotaoIcone, CampoArquivos, CampoData, Esqueleto, Icone, Interruptor, LogoBanco, LogoDrive, LogoGmail, MapaDeCalor, Variacao,
  LogoFgts, LogoGovernoMinas, LogoInss, LogoReceitaFederal, LogoSimplesNacional, LogoWhatsApp, MarcaN, MenuSuspenso, Segmentado, SeletorMes, SeletorTema, Stat, type NomeIcone, type OpcoesModal,
} from '@nads/ui';
import { useState, type ReactNode } from 'react';
import { CampoAssinatura, FORMATOS_DE_ARQUIVO, IconeDeArquivo } from '@nads/ui';
import { entregas, financeiro } from '@nads/core';
import { CONCILIA, EXECUTOR, EXTRATUDO, TAREFAS, TODAS } from './telas';
import type { Peca } from './tipos';
import { BotaoGoogle } from '../../../comum/BotaoGoogle';
import { MenuDaRotina } from '../../tarefas/telas/executor/partes/MenuDaRotina';
import { AreaDeSoltar } from '../../cliente/partes/AreaDeSoltar';
import { Avatar as AvatarDoCliente } from '../../cliente/partes/Avatar';
import { CartaoDeAtendimento } from '../../cliente/partes/CartaoDeAtendimento';
import { CartaoDeGuia } from '../../cliente/partes/CartaoDeGuia';
import { CartaoDoVeredito } from '../../cliente/partes/CartaoDoVeredito';
import { ConversaDoChamado } from '../../cliente/partes/ConversaDoChamado';
import { EsqueletoDaArea } from '../../cliente/partes/EsqueletoDaArea';
import { LinhaDaAgenda } from '../../cliente/partes/LinhaDaAgenda';
import { LinhaDaAtividade } from '../../cliente/partes/LinhaDaAtividade';
import { LinhaDeGuia } from '../../cliente/partes/LinhaDeGuia';
import { LinhaDePaga } from '../../cliente/partes/LinhaDePaga';
import { MarcaDoEscritorio } from '../../cliente/partes/MarcaDoEscritorio';
import { ResumoDoPagamento } from '../../cliente/partes/ResumoDoPagamento';
import { SiglaDaGuia } from '../../cliente/partes/SiglaDaGuia';
import { Vazio as VazioDoCliente } from '../../cliente/partes/Vazio';
import { BlocoDoLink } from '../../tarefas/telas/area-cliente/partes/BlocoDoLink';
import { ValorEditavel } from '../../tarefas/telas/financeiro/partes/ValorEditavel';
import { Calculadora } from '../../tarefas/telas/financeiro/partes/Calculadora';
import { ContadorDeCedulas } from '../../tarefas/telas/financeiro/partes/ContadorDeCedulas';
import { LinhaDoPlano } from '../../tarefas/telas/financeiro/partes/LinhaDoPlano';
import { ValorDoCaixa } from '../../tarefas/telas/financeiro/partes/ValorDoCaixa';
import { BotoesDoLink } from '../../tarefas/telas/area-cliente/partes/BotoesDoLink';
import { ConversaDoEscritorio } from '../../tarefas/telas/area-cliente/partes/ConversaDoEscritorio';
import { CartaoDoRobo } from '../../tarefas/telas/cadastro/painel-robo/partes/CartaoDoRobo';
import { LinhaDoTempoDoRobo } from '../../tarefas/telas/cadastro/painel-robo/partes/LinhaDoTempoDoRobo';
import { docsDeExemplo } from '../../tarefas/dados/painelRobo';
import { ListaDaSaude } from '../../tarefas/telas/cadastro/configuracoes/ListaDaSaude';
import { resumoDeExemplo } from '../../admin/dados/saudeBanco';
import '../../admin/admin.css';
import '../../cliente/cliente.css';

const nada = () => undefined;
/** A calculadora do catálogo, funcionando pelas teclas da tela. */
function DemoDaCalculadora() {
  const [e, setE] = useState<financeiro.EstadoDaCalculadora>(financeiro.CALCULADORA_INICIAL);
  return <div style={{ width: '100%', maxWidth: 300 }}><Calculadora estado={e} aoTecla={t => setE(x => financeiro.calcular(x, t))} /></div>;
}
/** A contagem de cédulas do catálogo, com a conta funcionando. */
function DemoDeCedulas() {
  const [q, setQ] = useState<Record<string, string>>({ '100': '1', '50': '2', '0.5': '3' });
  return <div style={{ width: '100%', maxWidth: 420 }}><ContadorDeCedulas quantidades={q} onMudar={(v, n) => setQ(x => ({ ...x, [v]: n }))} /></div>;
}
// as telas da Área do Cliente e a "foto" de exemplo do avatar (um retrato desenhado, sem pessoa de verdade)
const CLI_TELAS = ['c-cliente', 'c-cliente-documentos', 'c-cliente-guias', 'c-cliente-dp', 'c-cliente-chamados'];
const FOTO_DE_EXEMPLO = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%23C9B8A6'/%3E%3Ccircle cx='32' cy='26' r='12' fill='%238A6E58'/%3E%3Cpath d='M10 64a22 22 0 0 1 44 0Z' fill='%238A6E58'/%3E%3C/svg%3E";

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
function AssinaturaViva() {
  const [v, setV] = useState<string | null>(null);
  return <div style={{ width: '100%', maxWidth: 420 }}><CampoAssinatura valor={v} onMudar={setV} telaCheia rotulo="Assinatura de quem recebeu" /></div>;
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
  'girar', 'maximizar', 'minimizar', 'painel', 'cartao', 'download', 'grade', 'impressora', 'dinheiro', 'caminhao',
  'arrastar', 'lixeira', 'mapaPin', 'qrCode', 'codigoBarras', 'telefone', 'celular', 'trofeu', 'alvo', 'lampada', 'predio', 'escudo', 'seta', 'aviao', 'clipe',
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
  { id: 'btn-danger', tipo: 'botoes', nome: 'Botão de perigo', descricao: 'Texto vermelho; no passar do mouse, fundo vermelho', classes: ['btn btn-danger'], telas: ['t-cadastro-janela', 'e-importacao', 'c-cliente-dp'],
    demo: () => <button className="btn btn-danger"><Icone nome="x" />Excluir</button> },
  { id: 'texto-copiavel', tipo: 'botoes', nome: 'Texto que copia ao clicar', descricao: 'O próprio número é o botão (CNPJ/CPF, código): sem ícone de copiar ao lado; o mouse vira "copiar" e o texto sublinha', classes: ['texto-copiavel'], telas: ['t-dp-config'],
    uso: '<button type="button" className="texto-copiavel num" title="Clique para copiar" onClick={…}>27872981000113</button>', demo: () => <button type="button" className="texto-copiavel num" title="Clique para copiar">27872981000113</button> },
  { id: 'btn-ghost', tipo: 'botoes', nome: 'Botão fantasma', classes: ['btn btn-ghost'], telas: ['c-relatorio', 'c-cliente', 'c-cliente-documentos', 'c-cliente-guias'], demo: () => <button className="btn btn-ghost">Ver mais</button> },
  { id: 'btn-acao', tipo: 'botoes', nome: 'Botão que trabalha', descricao: 'Mostra a rodinha e o texto no gerúndio enquanto faz', componente: 'BotaoAcao', telas: ['c-importacao', 'e-importacao'],
    uso: '<BotaoAcao carregando={x} textoCarregando="Importando…">Importar</BotaoAcao>', demo: () => <><BotaoAcao>Importar</BotaoAcao><BotaoAcao carregando textoCarregando="Importando…">Importar</BotaoAcao></> },
  { id: 'icon-btn', tipo: 'botoes', nome: 'Botão de ícone', descricao: '32 px; sempre com título', componente: 'BotaoIcone', classes: ['icon-btn'], telas: TODAS,
    uso: '<BotaoIcone icone="x" titulo="Fechar" />', demo: () => <><BotaoIcone icone="copiar" titulo="Copiar" /><BotaoIcone icone="x" titulo="Fechar" /><BotaoIcone icone="olho" titulo="Ver o PDF" /><button className="icon-btn girando" title="Buscando"><Icone nome="girar" /></button></> },
  { id: 'config', tipo: 'botoes', nome: 'Configuração (estilo Notion)', descricao: 'A seção com o título e a linha fina; cada opção numa linha solta: o nome, a descrição curta e o controle à direita', componente: 'ConfigSecao + ConfigLinha', classes: ['cfg-secao', 'cfg-linha'], telas: ['t-empresa-lcdpr', 't-cadastro-janela'],
    uso: '<ConfigSecao titulo="Contábil"><ConfigLinha titulo="Cartão empresarial" descricao="A etapa Cartões quebra a fatura."><Interruptor … /></ConfigLinha></ConfigSecao>',
    demo: () => <div style={{ width: '100%' }}><ConfigSecao titulo="Parâmetros"><ConfigLinha titulo="Cartão empresarial" descricao="A etapa Cartões quebra a fatura no razão do cartão."><Interruptor ligado onMudar={() => {}} rotulo="Cartão empresarial" /></ConfigLinha><ConfigLinha titulo="Regime tributário" descricao="Define as etapas da rotina do Fiscal."><span className="hint">Presumido</span></ConfigLinha></ConfigSecao></div> },
  { id: 'registro-novo', tipo: 'botoes', nome: 'Criar registro (Attio + Notion)', descricao: 'A janela de criar: o campo principal em destaque (o CNPJ), o cartão da Receita, as propriedades em linhas (ícone e nome à esquerda, valor sem caixa) e o rodapé com "Cadastrar outra"', classes: ['registro-novo', 'registro-busca', 'registro-receita', 'registro-prop', 'registro-pe'], telas: ['t-empresa-lcdpr', 't-cadastro-janela'],
    demo: () => (
      <div className="registro-novo" style={{ width: '100%', maxWidth: 520 }}>
        <div className="registro-busca"><Icone nome="search" /><input type="text" placeholder="CNPJ da empresa" readOnly /></div>
        <div className="registro-props">
          <div className="registro-prop"><span className="registro-prop-nome"><Icone nome="fileText" />Nome</span><div className="registro-prop-valor"><input type="text" placeholder="Razão social" readOnly /></div></div>
          <div className="registro-prop"><span className="registro-prop-nome"><Icone nome="hash" />Código no ERP</span><div className="registro-prop-valor"><input type="text" placeholder="Vazio" readOnly /></div></div>
        </div>
      </div>
    ) },
  { id: 'busca-cliente', tipo: 'botoes', nome: 'Busca de cliente com lista (Nova nota)', descricao: 'O campo em destaque do registro vira uma busca: digitou o código ou parte do nome, a lista logo abaixo (código em negrito, nome, CNPJ); ↑↓ e Enter escolhem, Esc fecha. Escolhido, o campo mostra "código · nome" com o ✕ para trocar', classes: ['registro-busca', 'nf-achados', 'nf-ativo', 'nf-achado-codigo', 'nf-escolhido'], telas: ['t-cadastro-janela'],
    uso: 'registro-busca (input) + ul.nf-achados > li > button.popover-item (.nf-achado-codigo, .popover-texto, .popover-dica)',
    demo: () => (
      <div className="registro-novo" style={{ width: '100%', maxWidth: 520 }}>
        <div className="registro-busca"><Icone nome="search" /><input type="text" defaultValue="462" readOnly aria-label="Buscar o cliente" /></div>
        <ul className="nf-achados" style={{ marginTop: 6 }}>
          <li><button type="button" className="popover-item nf-ativo"><span className="nf-achado-codigo">462</span><span className="popover-texto">EXEMPLO COMERCIO LTDA</span><span className="popover-dica">11.222.333/0001-81</span></button></li>
          <li><button type="button" className="popover-item"><span className="nf-achado-codigo">1462</span><span className="popover-texto">OUTRA EMPRESA EXEMPLO</span></button></li>
        </ul>
      </div>
    ) },
  { id: 'comp-meses', tipo: 'botoes', nome: 'Calendário de meses (competência)', descricao: 'O ano com ‹ › no alto, os 12 meses em 3 × 4: o escolhido cheio, o de hoje com um pontinho, os que não começaram apagados; Abrir embaixo. Anima (animejs): a janela entra em 200 ms com os meses em cascata, a pílula do escolhido desliza até o mês clicado, a grade escorrega para o lado da seta ao trocar de ano e o texto do rodapé acende ao mudar; sem movimento se o computador pedir', classes: ['comp-meses', 'comp-mes'], telas: ['t-empresas'],
    demo: () => (
      <div className="modal modal-centro competencia-janela" style={{ position: 'static', boxShadow: 'none' }}>
        <div className="comp-topo"><span className="comp-titulo">Competência</span><div className="comp-ano"><button type="button" className="icon-btn icon-btn-sm"><Icone nome="chevronLeft" /></button><b className="num">2026</b><button type="button" className="icon-btn icon-btn-sm" disabled><Icone nome="chevronRight" /></button></div></div>
        <div className="comp-meses">{['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m, k) => <button key={m} type="button" className={'comp-mes' + (k === 8 ? ' on' : '') + (k === 9 ? ' hoje' : '')} disabled={k > 9}>{m}</button>)}</div>
      </div>
    ) },
  { id: 'dica', tipo: 'botoes', nome: 'Dica (?)', descricao: 'O "?" de 14 px ao lado do rótulo: a explicação aparece ao passar o mouse ou ao focar', componente: 'Dica', classes: ['dica'], telas: ['t-cadastro-janela'],
    uso: '<span>Presta serviços<Dica texto="Mostra a aba Prestados na Importação." /></span>', demo: () => <span>Presta serviços<Dica texto="Mostra a aba Prestados na Importação e os serviços prestados na Conferência." /></span> },
  { id: 'link-btn', removida: { como: 'substituida', por: 'btn', em: '02/10/2026', motivo: 'Navegar é pela barra de cima (Tarefas / Vitor / Minhas empresas / 292 …), sem "← Voltar" no meio da página; as outras ações em texto viraram o botão padrão.' }, tipo: 'botoes', nome: 'Ação em texto', classes: ['link-btn'], telas: ['c-verificar', 't-empresa'], demo: () => <button className="link-btn">← Voltar para Movimento</button> },
  // de volta ao catálogo (revisão da UI, 18/10/2026): estava como substituída pelo Botão de ícone desde 02/10, mas o
  // cabeçalho do executor, o Importar dos meses (Extrator e Creditor) e o ⚡ dos dados de teste seguem com ela. A base é a
  // do Botão de ícone (32 px, a mesma borda e o mesmo fundo); o que ela tem a mais são as variantes do cabeçalho.
  { id: 'gh-topo', tipo: 'botoes', nome: 'Botões do cabeçalho (executor)', descricao: 'A base do Botão de ícone com as variantes do cabeçalho: o menu sem nome (ícone e ▾, largura automática), o sino do que falta, o → Próximo (na cor do botão principal; o Avançar do modo desenvolvedor, em azul) e o ✕ Interromper (no tom de perigo, sempre o último)', componente: 'MenuSuspenso (className) · button',
    classes: ['gh-topo-btn', 'gh-topo-menu', 'gh-topo-proximo', 'gh-topo-fechar', 'gh-topo-acoes', 'gh-topo-sep'], telas: [...EXECUTOR, 'e-importacao'],
    uso: '<MenuSuspenso rotulo="" icone="upload" className="gh-topo-btn gh-topo-menu" direita itens={...} />  ·  <button className="gh-topo-btn gh-topo-proximo" aria-label="Próximo">  ·  <button className="gh-topo-btn gh-topo-fechar" aria-label="Interromper">',
    demo: () => (
      <nav className="gh-topo-acoes" aria-label="Etapa">
        <MenuSuspenso rotulo="" icone="fileUp" className="gh-topo-btn gh-topo-menu" dica="Grupos da rotina" itens={[{ rotulo: 'Preparação', icone: 'fileUp', marcado: true, onClick: nada }]} />
        <button type="button" className="gh-topo-btn gh-topo-menu falta-btn" title="Para seguir, falta: 3"><Icone nome="sino" /><span className="falta-qtd">3</span><Icone nome="caretDown" className="menu-seta" /></button>
        <button type="button" className="gh-topo-btn gh-topo-proximo" title="Próximo" aria-label="Próximo"><Icone nome="arrowDown" style={{ transform: 'rotate(-90deg)' }} /></button>
        <button type="button" className="gh-topo-btn gh-topo-proximo" disabled title="Conferindo…" aria-label="Próximo"><span className="btn-spinner" /></button>
        <span className="gh-topo-sep" aria-hidden="true" /><Avatar />
        <button type="button" className="gh-topo-btn gh-topo-fechar" title="Interromper a etapa" aria-label="Interromper"><Icone nome="x" /></button>
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
  // o × de fechar (revisão da UI, 16/10/2026: eram cinco desenhos; agora todas as janelas, gavetas e painéis usam este)
  { id: 'janela-x', tipo: 'botoes', nome: 'Fechar janela (×)', descricao: '32 px sem borda, o fundo aparece ao passar o mouse; o nome "Fechar" e a dica com o Esc. canto: preso no canto de cima da janela do meio', componente: 'BotaoFechar', classes: ['janela-x', 'modal-x'], telas: TODAS,
    uso: '<BotaoFechar onClick={fechar} />  ·  <BotaoFechar canto onClick={fechar} />  ·  <BotaoFechar rotulo="Fechar menu" onClick={fechar} />', demo: () => <><BotaoFechar onClick={nada} /><BotaoFechar rotulo="Fechar menu" onClick={nada} /><BotaoFechar disabled onClick={nada} /></> },

  // ─── Selos ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'badge-ok', tipo: 'selos', nome: 'Ok', descricao: 'Verde preenchido: bateu (regra do app todo, 05/10/2026)', classes: ['badge badge-ok'], telas: ['c-relatorio', 'e-importacao', 't-exec-importacao', 't-exec-cheque', 't-exec-fiscal', 't-exec-clientes', 'c-cliente', 'c-cliente-guias', 'c-cliente-dp', 'c-cliente-chamados'],
    uso: '<span className="badge badge-ok">Ok</span>', demo: () => <span className="badge badge-ok">Ok</span>, aoVivo: undefined },
  { id: 'badge-conferido', tipo: 'selos', nome: 'Conferido', descricao: 'Cheio: conferido à mão (o banco que bate mas falta o cheque especial agora é o botão principal "Cheque especial")', classes: ['badge badge-conferido'], telas: ['c-relatorio', 't-exec-fiscal-rotina', 't-exec-clientes'],
    demo: () => <span className="badge badge-conferido">Conferido</span> },
  { id: 'badge-bad', tipo: 'selos', nome: 'Diferença', descricao: 'Laranja com borda: o valor da diferença', classes: ['badge badge-bad'], telas: ['c-relatorio', 't-exec-clientes', 'c-cliente', 'c-cliente-guias'], demo: () => <><span className="badge badge-bad">89.967,19</span><span className="badge badge-bad">-295,00</span></> },
  { id: 'badge-neutral', tipo: 'selos', nome: 'Neutro', classes: ['badge badge-neutral'], telas: ['c-relatorio', 't-exec-folha', 't-exec-clientes', 'c-cliente', 'c-cliente-documentos', 'c-cliente-dp', 'c-cliente-chamados'], demo: () => <><span className="badge badge-neutral">0,00</span><span className="badge badge-neutral">Configure em Cadastro › Configurações</span><span className="badge badge-neutral">Lote não soma</span></> },
  { id: 'cert-a1', tipo: 'campos', nome: 'Certificado A1 (soltar o .pfx e o cartão)', descricao: 'A área grande para soltar o arquivo (pulsa ao passar por cima) e o cartão do certificado lido: titular, CNPJ, validade e situação', classes: ['cert-soltar', 'cert-cartao', 'cert-campos', 'cert-acoes'], telas: ['t-senhas'],
    demo: () => <div style={{ width: '100%' }}><div className="cert-cartao lido ok"><span className="cert-cartao-chip" aria-hidden="true"><Icone nome="lock" /></span><div className="cert-cartao-corpo"><span className="cert-cartao-tipo">Certificado digital A1</span><b className="cert-cartao-nome">EMPRESA EXEMPLO LTDA</b><span className="cert-cartao-doc num">12.345.678/0001-90</span></div><div className="cert-cartao-validade"><span className="fraco">Validade</span><b className="num">10/04/2027</b><span className="badge badge-ok">Em dia</span></div></div></div> },
  { id: 'cert-painel', tipo: 'graficos', nome: 'Painel dos certificados', descricao: 'A rosca das situações com a legenda (clicar filtra), as barras dos vencimentos por mês e o cartão com o anel da contagem regressiva', classes: ['cert-dash', 'cert-rosca', 'cert-legenda', 'cert-barras', 'cert-urgente', 'cert-contagem', 'cert-cor-vence', 'cert-cor-vencido', 'cert-cor-ok', 'cert-cor-sem'], telas: ['t-senhas'], largo: true,
    demo: () => <div style={{ width: '100%', display: 'grid', gap: 12 }}><div className="cert-barras" style={{ minHeight: 160 }}>{[2, 5, 1, 0, 3, 4, 2, 6, 1, 0, 2, 3].map((n, i) => <span key={i} className={'cert-barra' + (i === 0 ? ' logo' : '')}><span className="cert-barra-num num">{n || ''}</span><span className="cert-barra-trilho" style={{ minHeight: 90 }}><span className="cert-barra-cheia" style={{ height: (n / 6) * 100 + '%' }} /></span><span className="cert-barra-mes">{['Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set'][i]}</span></span>)}</div><span className="card cert-urgente" style={{ maxWidth: 300 }}><span className="cert-contagem cert-cor-vence"><svg viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r={15.915} className="cert-rosca-fundo" /><circle cx="21" cy="21" r={15.915} className="cert-contagem-arco" strokeDasharray="40 60" strokeDashoffset={25} /></svg><span className="cert-contagem-num num">12</span></span><span className="cert-urgente-texto"><b>EMPRESA EXEMPLO LTDA</b><span className="cert-urgente-prazo vence">Vence em 12 dias</span><span className="fraco num">292 · 19/10/2026</span></span></span></div> },
  { id: 'fgts-resumo', tipo: 'cartoes', nome: 'Resumo do mês com a barra (FGTS Digital)', descricao: 'O título do mês, quantas prontas de quantas, a barra de progresso inteira, o robô numa linha (bolinha) e o botão principal; e os passos do robô numa linha do tempo', classes: ['fgts-resumo', 'fgts-resumo-topo', 'fgts-robo-linha', 'fgts-barra', 'fgts-passos', 'fgts-passo-marca'], telas: ['t-empresa-lcdpr', 't-dp-fgts', 't-exec-fiscal-rotina'], largo: true,
    demo: () => <div style={{ width: '100%', display: 'grid', gap: 12 }}><section className="card fgts-resumo"><div className="fgts-resumo-topo"><div className="fgts-resumo-titulo"><h3>Guias de Setembro/2026</h3><span className="hint"><b className="num">12</b> de <b className="num">115</b> emitidas · 2 com o robô agora</span></div><span className="fgts-robo-linha"><span className="bolinha-sit concluida" aria-hidden="true" />Robô ligado · certificado até 20/05/2027</span><button type="button" className="btn btn-primary"><Icone nome="fileDown" />Emitir as que faltam · 101</button></div><span className="tarefas-barra fgts-barra"><span style={{ width: '10%' }} /></span></section><ol className="fgts-passos">{['portal', 'gov.br', 'entrou', 'perfil do cliente'].map((n, i) => <li key={n}><span className="fgts-passo-marca" aria-hidden="true">{i + 1}</span><div><b>{n}</b> <span className="fraco">07/10, 14:2{i}</span></div></li>)}</ol></div> },
  { id: 'imp-recebidos', tipo: 'avisos', nome: 'Extratos que chegaram por e-mail', descricao: 'Na tarefa de extratos (08/10/2026: "ele já jogue o extrato para o nads"): os que não entraram sozinhos, um por linha, com o banco a escolher, Importar e Ignorar (dentro do Alerta na linha)', classes: ['imp-recebidos', 'imp-recebidos-nome'], telas: ['t-empresa-lcdpr', 'e-importacao', 't-exec-importacao'], largo: true,
    demo: () => <div style={{ width: '100%' }}><Alerta naLinha titulo="2 extratos chegaram por e-mail" texto="Escolha em qual banco entra cada um. Se o banco já tiver extrato no mês, o Extrator pergunta se importa só o que é novo."><ul className="imp-recebidos">{[['extrato setembro.pdf', 'Sicoob · 12345-6'], ['EXTRATO_CC.ofx', '']].map(([n, c]) => <li key={n}><span className="imp-recebidos-nome"><b>{n}</b><span className="hint">08/10/2026 · cliente@empresa.com.br</span></span><select className="select-compact" defaultValue={c}><option value="">Escolha o banco…</option>{c && <option value={c}>{c}</option>}</select><button type="button" className="btn btn-primary" disabled={!c}><Icone nome="upload" />Importar</button><button type="button" className="btn btn-ghost">Ignorar</button></li>)}</ul></Alerta></div> },
  { id: 'sieg-andamento', tipo: 'cartoes', nome: 'Andamento do robô (janela flutuante)', descricao: 'No canto da tela enquanto o robô trabalha (o Baixar XMLs do SIEG; 08/10/2026: "uma porcentagem melhor e uma tela mais bem produzida"): o título com o tempo e o que falta, a porcentagem grande, a barra, a linha do robô, os números em painéis e os passos que vão ficando verdes', classes: ['sieg-andamento', 'sieg-andamento-pct', 'sieg-andamento-numeros', 'sieg-andamento-passos'], telas: ['t-exec-fiscal-rotina'],
    demo: () => <div className="card gmail-andamento sieg-andamento" style={{ position: 'static' }}><div className="fgts-resumo-topo"><div className="fgts-resumo-titulo"><h3>Baixando os XMLs do SIEG</h3><span className="hint">42 s · falta uns 18 s</span></div><b className="sieg-andamento-pct num">68%</b></div><span className="tarefas-barra fgts-barra andando"><span style={{ width: '68%' }} /></span><span className="fgts-robo-linha"><span className="bolinha-sit em-andamento" aria-hidden="true" />Baixando CT-e do portal (519 XMLs até agora)</span><div className="stat-grid sieg-andamento-numeros">{([['XMLs', 519, 'info', 'arquivo'], ['Já no Drive', 60, 'roxo', 'pasta'], ['Novos salvos', 0, 'ok', 'check']] as [string, number, string, NomeIcone][]).map(([r, v, tom, ic]) => <div key={r} className={'stat painel-numero painel-' + tom}><span className="painel-numero-icone" aria-hidden="true"><Icone nome={ic} /></span><p className="stat-label">{r}</p><p className="stat-value num">{v}</p></div>)}</div><ol className="fgts-passos sieg-andamento-passos">{['Pedido enviado ao robô', 'O robô pegou o pedido', 'Baixando os XMLs do SIEG', 'O .zip no seu computador'].map((t, i) => <li key={t} className={i < 2 ? 'feito' : i === 2 ? 'atual' : undefined}><span className="fgts-passo-marca" aria-hidden="true">{i < 2 ? <Icone nome="check" /> : i + 1}</span><div>{i === 2 ? <b>{t}</b> : t}</div></li>)}</ol></div> },
  { id: 'cofre-bloqueio', tipo: 'avisos', nome: 'Tela de bloqueio (cofre)', descricao: 'Sem acesso ao cofre, a página inteira é o cadeado, o que falta (pedir acesso, aguardar ou criar) e o código de recuperação', classes: ['cofre-bloqueio', 'cofre-bloqueio-cartao', 'cofre-bloqueio-icone', 'cofre-bloqueio-codigo'], telas: ['t-senhas'], largo: true,
    demo: () => <div className="cofre-bloqueio" style={{ minHeight: 0 }}><div className="cofre-bloqueio-cartao"><span className="cofre-bloqueio-icone" aria-hidden="true"><Icone nome="lock" /></span><h2>Acesso bloqueado</h2><p className="cofre-bloqueio-texto">As senhas gov.br e os certificados ficam no cofre. Peça acesso a quem já tem.</p><button type="button" className="btn btn-primary"><Icone nome="unlock" />Pedir acesso</button><div className="cofre-bloqueio-codigo"><span className="hint">ou abra com o código de recuperação</span><span className="cofre-bloqueio-linha"><input type="text" className="field" placeholder="Código de recuperação" aria-label="Código de recuperação" /><button type="button" className="btn btn-outline">Abrir</button></span></div></div></div> },
  { id: 'cofre-pessoa', tipo: 'listas', nome: 'Pessoas com acesso (cofre)', descricao: 'Um cartão por usuário (foto ou iniciais, o nome, "você", quantos logins); clicar abre os logins ativos dele com Tirar o acesso; os pedidos numa lista com Liberar / Recusar', classes: ['cofre-pessoas', 'cofre-pessoa', 'cofre-pessoa-texto', 'cofre-logins', 'cofre-login-icone', 'cofre-pedidos-lista', 'cofre-bloqueio-quem'], telas: ['t-senhas'], largo: true,
    demo: () => <ul className="cofre-pessoas" style={{ width: '100%' }}>{[['Sávio', true], ['Gustavo Santos', false]].map(([n, eu]) => <li key={String(n)}><button type="button" className={'cofre-pessoa' + (eu ? ' eu' : '')}><span className="usuarios-foto usuarios-iniciais foto-mini" aria-hidden="true">{String(n).slice(0, 1)}</span><span className="cofre-pessoa-texto"><b>{n}{eu && <span className="badge badge-ok">você</span>}</b><span className="fraco">{eu ? '1 login ativo' : '3 logins ativos'} · desde 07/10/2026</span></span></button></li>)}</ul> },
  { id: 'cofre-acesso-topo', tipo: 'avisos', nome: 'Estado do cofre / código de recuperação', descricao: 'O selo redondo, o estado em negrito e o detalhe; à direita, a ação', classes: ['cofre-acesso-topo', 'cofre-acesso-selo', 'cofre-acesso-estado', 'cofre-codigo', 'cofre-codigo-icone'], telas: ['t-senhas'], largo: true,
    demo: () => <section className="card cofre-acesso-topo" style={{ width: '100%' }}><span className="cofre-acesso-selo" aria-hidden="true"><Icone nome="unlock" /></span><span className="cofre-acesso-estado"><b>Cofre aberto neste computador</b><span className="fraco">3 pessoas têm acesso · criado por Sávio em 13/10/2026</span></span><span className="badge badge-warn">1 pedido</span></section> },
  { id: 'imp-cert', tipo: 'campos', nome: 'Importar certificados (vários .pfx)', descricao: 'A área de soltar compacta e um cartão por arquivo: a empresa achada pelo CNPJ (ou escolher), a senha e a validade lida', classes: ['imp-cert', 'imp-cert-item', 'imp-cert-senha', 'imp-cert-acoes'], telas: ['t-senhas'],
    demo: () => <div style={{ width: '100%' }}><ul className="imp-cert-lista"><li className="cert-cartao imp-cert-item lido"><span className="cert-cartao-chip" aria-hidden="true"><Icone nome="check" /></span><div className="cert-cartao-corpo"><span className="cert-cartao-tipo">EMPRESA EXEMPLO_12345678000190.pfx</span><b className="cert-cartao-nome"><span className="num fraco">292 · </span>EMPRESA EXEMPLO LTDA</b><span className="cert-cartao-doc num">EMPRESA EXEMPLO LTDA · 12345678000190</span><span className="imp-cert-acoes"><button type="button" className="btn btn-outline">Trocar empresa</button><button type="button" className="btn btn-ghost">Tirar</button></span></div><div className="imp-cert-senha"><span className="badge badge-ok">Até 10/04/2027</span></div></li></ul></div> },
  { id: 'medalha-gov', tipo: 'selos', nome: 'Nível gov.br (medalha)', descricao: 'Bronze, Prata e Ouro: a moeda na cor do metal e o nome (B, P, O)', componente: 'MedalhaGov', classes: ['medalha', 'medalha-moeda', 'medalha-bronze', 'medalha-prata', 'medalha-ouro'], telas: ['t-senhas'],
    demo: () => <><MedalhaGov nivel="B" /><MedalhaGov nivel="P" /><MedalhaGov nivel="O" /></> },
  { id: 'sieg-numero', tipo: 'cartoes', nome: 'Número do SIEG (com a proporção por tipo)', descricao: 'O rótulo em cima, o número grande e a barrinha da proporção de cada tipo de nota (NF-e, NFS-e, CT-e), com a legenda; zero fica em amarelo', classes: ['sieg-numero', 'sieg-proporcao', 'sieg-legenda', 'sieg-tipo-0', 'sieg-tipo-1', 'sieg-tipo-2'], telas: ['t-exec-fiscal-rotina'],
    demo: () => <div className="sieg-numero" style={{ maxWidth: 260 }}><span>Notas recebidas</span><b>104</b><span className="sieg-proporcao"><i className="sieg-tipo-0" style={{ flexGrow: 87 }} /><i className="sieg-tipo-1" style={{ flexGrow: 5 }} /><i className="sieg-tipo-2" style={{ flexGrow: 12 }} /></span><small><span className="sieg-legenda"><i className="sieg-tipo-0" />NF-e 87</span><span className="sieg-legenda"><i className="sieg-tipo-1" />NFS-e 5</span><span className="sieg-legenda"><i className="sieg-tipo-2" />CT-e 12</span></small></div> },
  { id: 'gm-tipo', tipo: 'selos', nome: 'Tipo do anexo (e-mail)', descricao: 'A extensão do anexo na cor do tipo (PDF, XML, planilha, extrato) e quantos; vê o que veio sem abrir o e-mail', classes: ['gm-tipos', 'gm-tipo', 'gm-tipo-pdf', 'gm-tipo-xml', 'gm-tipo-xlsx', 'gm-tipo-ofx'], telas: ['t-gmail'],
    demo: () => <span className="gm-tipos"><span className="gm-tipo gm-tipo-pdf">PDF<small>×2</small></span><span className="gm-tipo gm-tipo-xml">XML</span><span className="gm-tipo gm-tipo-xlsx">XLSX</span><span className="gm-tipo gm-tipo-ofx">OFX</span></span> },
  { id: 'gm-pilula', tipo: 'selos', nome: 'Pílula do anexo (e-mail)', descricao: 'Como no Gmail: o tipo colorido e o nome do arquivo numa pílula, embaixo do assunto; até 3 e "+N"', classes: ['gm-pilulas', 'gm-pilula', 'gm-pilula-nome', 'gm-pilula-mais'], telas: ['t-gmail'],
    demo: () => <span className="gm-pilulas"><span className="gm-pilula"><span className="gm-tipo gm-tipo-pdf">PDF</span><span className="gm-pilula-nome">extrato-sicoob-08</span></span><span className="gm-pilula"><span className="gm-tipo gm-tipo-xml">XML</span><span className="gm-pilula-nome">NFe31261045</span></span><span className="gm-pilula gm-pilula-mais">+2</span></span> },
  { id: 'gm-grupo', tipo: 'listas', nome: 'Grupo do dia (lista de e-mails)', descricao: 'O rótulo fixo no alto de cada grupo (Hoje, Ontem, Esta semana, Este mês, Mais antigos) com a contagem', classes: ['gm-grupo', 'gm-grupo-rotulo'], telas: ['t-gmail'], largo: true,
    demo: () => <div style={{ width: '100%' }}><p className="gm-grupo-rotulo">Hoje<span>3</span></p><p className="gm-grupo-rotulo">Ontem<span>5</span></p></div> },
  { id: 'badge-warn', tipo: 'selos', nome: 'Atenção', classes: ['badge badge-warn'], telas: ['t-gmail', 't-exec-fiscal-rotina', 'c-cliente', 'c-cliente-guias', 'c-cliente-documentos', 'c-cliente-dp', 'c-cliente-chamados'], demo: () => <span className="badge badge-warn">Pendente</span> },
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
  { id: 'busca-curta', tipo: 'campos', nome: 'Busca (com lupa)', classes: ['busca-curta', 'busca-curta larga'], telas: ['t-empresa-lcdpr', 't-empresas', 't-cadastro', 't-drive', 'e-importacao', 'c-consulta', 't-senhas', 'a-arquivador'],
    uso: '<label className="busca-curta"><Icone nome="search" /><input /></label>', demo: () => <label className="busca-curta"><Icone nome="search" /><input type="text" placeholder="Buscar no extrato" /><kbd>/</kbd></label> },
  { id: 'field', tipo: 'campos', nome: 'Campo de texto', classes: ['field'], telas: ['t-entrar', 't-cadastro-janela', 'c-cadastro', 'c-cliente-dp', 'c-cliente-chamados'],
    demo: () => <div className="field" style={{ width: 260 }}><label htmlFor="cat-f1">Agência</label><input id="cat-f1" type="text" placeholder="Ex.: 3001" /></div> },
  { id: 'select', tipo: 'campos', nome: 'Seleção', descricao: 'Com o triângulo do GitHub; a compacta tem o mesmo tamanho (só a largura acompanha o texto)', classes: ['field select', 'select-compact'], telas: ['t-empresa-lcdpr', 'c-cadastro', 'e-conferencia', 'c-relatorio', 'a-arquivador'],
    demo: () => <><select defaultValue="cfop" style={{ width: 180 }}><option value="cfop">CFOP (A-Z)</option><option>Fornecedor (A-Z)</option></select><select className="select-compact" defaultValue="a"><option value="a">Todas</option></select></> },
  { id: 'checkbox', tipo: 'campos', nome: 'Checkbox', descricao: '18 px; o ✓ é desenhado para 18 px', classes: ['input[type=checkbox]', 'chk-auto'], telas: ['c-naturezas', 'c-relatorio', 't-exec-folha'],
    demo: () => <><input type="checkbox" /><input type="checkbox" defaultChecked /><input type="checkbox" disabled /><input type="checkbox" className="chk-auto" defaultChecked /></> },
  { id: 'interruptor', tipo: 'campos', nome: 'Interruptor', componente: 'Interruptor', classes: ['toggle-switch'], telas: ['c-consulta', 'a-sistema'], demo: () => <InterruptorVivo /> },
  { id: 'data', tipo: 'campos', nome: 'Data (dd/mm/aaaa)', componente: 'CampoData', classes: ['data-mask'], telas: ['c-consulta', 'e-cheque', 'c-cliente-dp'], demo: () => <DataVivo /> },
  { id: 'mes', tipo: 'campos', nome: 'Seletor de mês', componente: 'SeletorMes', classes: ['seletor-mes'], telas: ['t-empresas', 't-contabil', 'c-cliente-guias'], demo: () => <MesVivo /> },
  { id: 'arquivos', tipo: 'campos', nome: 'Escolher arquivos', componente: 'CampoArquivos', classes: ['file-picker'], telas: ['t-empresa-lcdpr', 'c-importacao', 'e-cheque', 'e-creditor', 'c-cliente-chamados'],
    demo: () => <><CampoArquivos id="cat-arq" onEscolher={nada} aceitar=".xls,.xlsx" /><CampoArquivos id="cat-arq2" onEscolher={nada} aceitar=".xls" compacto rotulo="Importar todos os meses" /></> },
  // a assinatura e os documentos com valor da entrega de documentos (16/10/2026, trazida do Entregas)
  { id: 'assinatura', tipo: 'campos', nome: 'Assinatura (dedo, caneta ou mouse)', descricao: 'O quadro branco (é papel: branco também no tema escuro) com "Assine aqui" apagado enquanto vazio, o estado embaixo, "Tela cheia" (o quadro ocupa a tela, em pé; 16/10/2026, como o Entregas) e o Limpar; devolve o PNG em data URL a cada traço (fundo branco e traço escuro, como o Entregas grava)', componente: 'CampoAssinatura', classes: ['assinatura', 'assinatura-quadro', 'assinatura-pe', 'assinatura-cheia'], telas: ['t-entregas'],
    uso: '<CampoAssinatura valor={assinatura} onMudar={setAssinatura} altura={200} telaCheia rotulo="Assinatura de quem recebeu" />', demo: () => <AssinaturaViva /> },
  { id: 'ent-docs', tipo: 'campos', nome: 'Documentos com valor (Nova entrega)', descricao: 'Uma linha por documento: o nome, o funcionário (quando pede), o valor em R$ à direita (ou "sem valor") e o ✕; para ler, a mesma lista sem as caixas e com o Total tracejado', classes: ['ent-docs', 'ent-doc', 'ent-doc-tipo', 'ent-doc-valor', 'ent-doc-total'], telas: ['t-entregas'],
    demo: () => (
      <div style={{ width: '100%', maxWidth: 520 }}>
        <ul className="ent-docs">
          <li className="ent-doc"><span className="ent-doc-tipo">DAS</span><input type="text" className="ent-doc-valor num" defaultValue="480,90" aria-label="Valor" /><BotaoIcone icone="x" titulo="Tirar o documento" pequeno /></li>
          <li className="ent-doc"><span className="ent-doc-tipo">Honorário</span><span className="fraco ent-doc-valor">sem valor</span><BotaoIcone icone="x" titulo="Tirar o documento" pequeno /></li>
        </ul>
        <ul className="ent-docs ent-docs-ler">
          <li className="ent-doc"><span className="ent-doc-tipo">FGTS</span><span className="ent-doc-valor num">R$ 210,00</span></li>
          <li className="ent-doc ent-doc-total"><span className="ent-doc-tipo">Total</span><span className="ent-doc-valor num">R$ 690,90</span></li>
        </ul>
      </div>
    ) },
  // a planilha de "Adicionar documento" da Nova entrega (16/10/2026, a cópia fiel do Entregas)
  { id: 'ent-planilha', tipo: 'campos', nome: 'Planilha de documentos (Adicionar documento)', descricao: 'Flutua embaixo de "Adicionar documento": uma linha por documento com o valor ao lado (repetir e tirar); a última é a escolha do próximo — escolheu, o cursor vai para o valor; Enter volta para a escolha; Esc ou Pronto fecham', classes: ['popover ent-planilha', 'ent-planilha-nova', 'ent-planilha-x', 'ent-planilha-pe'], telas: ['t-entregas'],
    demo: () => (
      <div className="popover ent-planilha" style={{ position: 'static', width: '100%' }}>
        <h4>Documentos da entrega</h4>
        <div className="table-wrap ent-planilha-rolagem"><table className="table-compact"><thead><tr><th>Documento</th><th>Valor</th><th /></tr></thead><tbody>
          <tr><td>DAS</td><td><input type="text" className="num" defaultValue="480,90" aria-label="Valor" /></td><td className="ent-planilha-x"><BotaoIcone icone="copiar" titulo="Repetir" pequeno /><BotaoIcone icone="x" titulo="Tirar" pequeno /></td></tr>
          <tr><td>Honorário</td><td><span className="fraco">sem valor</span></td><td className="ent-planilha-x"><BotaoIcone icone="x" titulo="Tirar" pequeno /></td></tr>
          <tr className="ent-planilha-nova"><td colSpan={3}><select defaultValue="" aria-label="Próximo documento"><option value="">+ clique pra escolher o documento</option></select></td></tr>
        </tbody></table></div>
        <div className="ent-planilha-pe"><button type="button" className="btn btn-primary">Pronto</button></div>
      </div>
    ) },

  // ─── Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'tabela', tipo: 'tabelas', nome: 'Tabela padrão', descricao: 'Cabeçalho grudado; números à direita (.num); a conta com o código em negrito e o nome normal', componente: 'TituloDaConta', classes: ['table-wrap', 'table-compact', 'th-sort', 'num'], telas: ['c-relatorio', 'c-consulta', 'e-conferencia', 't-empresas', 'c-cliente-documentos', 'c-cliente-dp', 'a-robo'], largo: true,
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
          <tr><td className="imp-planilha-dia">16/04/2026</td><td className="imp-planilha-sit">Data errada: no banco foi 16/04, no razão está 17/04</td><td className="imp-planilha-lanc"><b>SUPERMERCADO DONA BEIJA LTDA</b></td><td className="num"><b>947,30</b></td><td className="num"><b>947,30</b></td><td className="num" /></tr>
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
  // o LCDPR dentro da empresa (16/10/2026: "quero integrar no app o importador lcpr … que fique tudo no visual igual")
  { id: 'lcdpr-lancamentos', tipo: 'tabelas', nome: 'Lançamentos do LCDPR', descricao: 'A lista do Cadastro com a marcação estreita, os selos numa linha (NF/CT-e, REVISAR ou como foi classificado), a categoria trocada na própria linha (a seleção compacta) e o fornecedor cortado; clicar na linha abre o lançamento', classes: ['lcdpr-tabela', 'lcdpr-marca', 'lcdpr-selos', 'lcdpr-corta'], telas: ['t-empresa-lcdpr'], largo: true,
    demo: () => (
      <div className="table-wrap lcdpr-tabela" style={{ marginBottom: 0 }}><table className="cad-lista"><thead><tr><th className="lcdpr-marca"><input type="checkbox" aria-label="Selecionar" /></th><th>Situação</th><th>Categoria</th><th>Data</th><th>Fornecedor</th><th>Documento</th><th className="num">Valor</th></tr></thead>
        <tbody>
          <tr className="linha-abre"><td className="lcdpr-marca"><input type="checkbox" aria-label="Selecionar" /></td><td><span className="lcdpr-selos"><span className="badge badge-neutral">NF</span><span className="badge badge-ok">NCM</span></span></td><td><select className="select-compact lanc-sel preenchido" defaultValue="c"><option value="c">Combustíveis e Lubrificantes</option></select></td><td className="num fraco">15/01/2025</td><td><span className="lcdpr-corta">POSTO FICTICIO DE COMBUSTIVEIS LTDA</span></td><td className="num">123</td><td className="num">1.000,00</td></tr>
          <tr className="linha-abre"><td className="lcdpr-marca"><input type="checkbox" defaultChecked aria-label="Selecionar" /></td><td><span className="lcdpr-selos"><span className="badge badge-neutral">NF</span><span className="badge badge-warn">REVISAR</span></span></td><td><select className="select-compact lanc-sel" defaultValue=""><option value="">— nenhuma —</option></select></td><td className="num fraco">20/01/2025</td><td><span className="lcdpr-corta">LOJA FICTICIA</span></td><td className="num">9/2</td><td className="num">89,90</td></tr>
          <tr className="linha-abre"><td className="lcdpr-marca"><input type="checkbox" aria-label="Selecionar" /></td><td><span className="lcdpr-selos"><span className="badge badge-neutral">CT-e</span><span className="badge badge-neutral">padrão CT-e</span></span></td><td><select className="select-compact lanc-sel preenchido" defaultValue="f"><option value="f">Fretes e Carretos</option></select></td><td className="num fraco">22/01/2025</td><td><span className="lcdpr-corta">TRANSPORTADORA FICTICIA</span></td><td className="num">77/2</td><td className="num">1.234,56</td></tr>
        </tbody></table></div>
    ) },

  // ─── Menus suspensos ────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'menu-suspenso', tipo: 'menus', nome: 'Menu suspenso (▾)', componente: 'MenuSuspenso', classes: ['popover menu-pop', 'popover-item', 'popover-sep'], telas: TODAS,
    uso: "<MenuSuspenso rotulo=\"Ações\" itens={[{ rotulo: 'Copiar', icone: 'copiar', onClick }, 'separador']} />  ·  dentro de uma tabela que rola (o celular): flutuante — o menu abre por cima da página (revisão da UI, 18/10/2026)",
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
  // os filtros da barra em menus (revisão da UI, 16/10/2026: o DP tinha 8 <select> com rótulo em cima)
  { id: 'menu-filtro', tipo: 'menus', nome: 'Filtro da barra (menu)', descricao: 'O MenuSuspenso com o nome do filtro; escolhido, mostra "Nome: valor" e fica marcado (.ativo). "Todos" volta ao vazio. Na barra, ao lado da competência e da busca de lupa', componente: 'MenuDeFiltro (Tarefa › DP)', classes: ['tarefas-barra-topo', 'btn btn-outline ativo'], telas: ['t-dp-resumo', 't-dp-obrigacoes', 't-dp-fgts', 't-dp-config'],
    uso: '<MenuDeFiltro rotulo="Responsável" valor={f.responsavel} mudar={f.setResponsavel} opcoes={f.responsaveis} />',
    demo: () => <div className="tarefas-barra-topo" style={{ margin: 0 }}><MenuSuspenso rotulo="Responsável" itens={[{ rotulo: 'Todos', marcado: true, onClick: nada }, { rotulo: 'Fabiana', marcado: false, onClick: nada }]} /><MenuSuspenso rotulo="Movimento: Folha" className="btn btn-outline ativo" itens={[{ rotulo: 'Todos', marcado: false, onClick: nada }, { rotulo: 'Folha', marcado: true, onClick: nada }]} /></div> },
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
  { id: 'jn-etiquetas', tipo: 'janelas', nome: 'Parâmetros das etiquetas da folha (DP › Obrigações)', descricao: 'Savio, 15/10/2026: a janela do gerador de etiquetas. Os dois textos que saem impressos (a competência, que já vem da tela, e a data de pagamento, sugerida no 5º dia útil do mês seguinte) e a quantidade de etiquetas (uma página cheia por padrão); embaixo, quantas páginas A4 saem. Imprimir abre a impressão', componente: 'JanelaDasEtiquetas', classes: ['modal etq-janela', 'etq-campo', 'etq-dica', 'etq-total'], telas: ['t-dp-obrigacoes'],
    demo: () => (
      <div className="modal etq-janela cat-parado" role="dialog" style={{ position: 'static', boxShadow: 'none' }}>
        <h3><Icone nome="fileText" />Etiquetas da folha</h3>
        <div className="etq-corpo">
          <p className="etq-dica">Informe os dois textos que saem em cada etiqueta. A data sugerida é o 5º dia útil do mês seguinte (sábado conta); pode trocar.</p>
          <label className="etq-campo"><span>Informe a competência</span><input type="text" defaultValue="10/2026" /></label>
          <label className="etq-campo"><span>Informe data de pagamento</span><input type="text" defaultValue="07/11/2026" /></label>
          <label className="etq-campo"><span>Quantidade de etiquetas</span><input type="number" defaultValue={8} /></label>
          <p className="hint etq-total">8 etiquetas em 1 página A4 (cabem 8 por página, nenhuma cortada)</p>
          <div className="modal-actions"><button type="button" className="btn btn-outline">Cancelar</button><button type="button" className="btn btn-primary"><Icone nome="printer" />Imprimir</button></div>
        </div>
      </div>
    ) },

  // ─── Avisos ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'alerta', tipo: 'avisos', nome: 'Alerta (amarelo)', componente: 'Alerta', classes: ['alert', 'alert-title', 'alert-text'], telas: ['t-exec-cheque', 'c-verificar', 'e-importacao', 't-exec-fiscal-rotina'], largo: true,
    demo: () => <Alerta naLinha titulo="Saldo negativo: faça o cheque especial" texto="Gere os lançamentos no Cheque especial, lance no Alterdata e importe o razão de novo." /> },
  { id: 'alerta-ok', tipo: 'avisos', nome: 'Alerta (verde)', componente: 'Alerta', classes: ['alert alert-ok'], telas: ['c-verificar', 't-exec-fiscal-rotina', 'a-robo'], largo: true, demo: () => <Alerta naLinha tom="ok" titulo="Tudo bate neste período" texto="Nenhuma pendência." /> },
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
  { id: 'segmentado', tipo: 'abas', nome: 'Segmentado', componente: 'Segmentado', classes: ['steps', 'step-pill'], telas: ['c-relatorio', 'c-cadastro', 'c-consulta', 'a-arquivador'], demo: () => <SegmentadoVivo /> },
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
          <div className="drawer-foot"><SeletorTema /><button className="drawer-item" type="button"><Icone nome="escudo" />Admin</button><p>Versão do sistema: 0.0.44 · <button type="button" className="drawer-atualizar">Atualizar para 0.0.45</button></p></div>
        </aside>
      </div>
    ) },

  // ─── Cartões ────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'card', tipo: 'cartoes', nome: 'Cartão', descricao: 'O h3 vira a faixa cinza do topo', classes: ['card', 'card-head'], telas: TODAS,
    demo: () => <div className="card" style={{ width: '100%' }}><h3>Contabilização da Folha</h3><p style={{ padding: '0 16px' }} className="hint">O conteúdo do cartão.</p></div> },
  { id: 'sieg-cupons', tipo: 'cartoes', nome: 'Cupons do mês (NFC-e)', descricao: 'Na Sequência de saídas: quantos cupons, o valor, a numeração (primeiro a último, por série) e os faltando/cancelados, nos painéis coloridos', classes: ['sieg-cupons', 'sieg-cupons-faixa'], telas: ['t-exec-fiscal-rotina'], largo: true,
    demo: () => <div className="stat-grid sieg-cupons" style={{ width: '100%' }}><div className="stat painel-numero painel-info"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="recibo" /></span><p className="stat-label">Cupons (NFC-e)</p><p className="stat-value num">1.284</p></div><div className="stat painel-numero painel-ok"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="dinheiro" /></span><p className="stat-label">Valor dos cupons</p><p className="stat-value num">R$ 86.412,90</p></div><div className="stat painel-numero painel-neutro"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="hash" /></span><p className="stat-label">Numeração</p><p className="stat-value num sieg-cupons-faixa"><span>40.112 a 41.398</span></p></div><div className="stat painel-numero painel-aviso"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="alert" /></span><p className="stat-label">Faltando · canceladas</p><p className="stat-value num">2 · 3</p></div></div> },
  { id: 'sieg-situacao', tipo: 'cartoes', nome: 'Situação na SEFAZ (pela VM)', descricao: 'Na Sequência de saídas: o botão de consultar, o andamento, as contagens em pílulas (autorizadas em verde, o que pede atenção em amarelo) e a tabela das notas que não batem com o SIEG', classes: ['sieg-situacao', 'sieg-situacao-topo', 'sieg-situacao-chips', 'sieg-situacao-chip'], telas: ['t-exec-fiscal-rotina'], largo: true,
    demo: () => <div className="sieg-situacao" style={{ width: '100%' }}><div className="sieg-situacao-topo"><b>Situação na SEFAZ</b><span className="fraco">Consultada em 15/10 14:20</span><span className="tarefas-barra-espaco" /><button type="button" className="btn btn-outline"><Icone nome="checkCircle" />Consultar de novo</button></div><div className="sieg-situacao-chips"><span className="sieg-situacao-chip ok"><b className="num">1.281</b> Autorizadas</span><span className="sieg-situacao-chip neutro"><b className="num">3</b> Canceladas</span><span className="sieg-situacao-chip aviso"><b className="num">1</b> Não constam</span></div></div> },
  { id: 'painel-numero', tipo: 'cartoes', nome: 'Números em painéis coloridos', descricao: 'Cada número no tom do que ele é, com o ícone (Sávio, 07/10/2026): azul o total, verde o feito, amarelo o que falta, o vermelho do nads o destaque; laranja, roxo e ciano para os outros (08/10: "quero que colora todos")', classes: ['stat painel-numero', 'painel-info', 'painel-ok', 'painel-aviso', 'painel-marca', 'painel-laranja', 'painel-roxo', 'painel-ciano', 'painel-neutro', 'painel-numero-icone'], telas: ['t-dp-resumo', 't-exec-fiscal-rotina', 't-fiscal-painel', 'a-robo', 'a-visao-geral'], largo: true,
    demo: () => <div className="stat-grid dp-numeros" style={{ width: '100%' }}>{([['Clientes', 115, 'info', 'briefcase'], ['Concluídos', 48, 'ok', 'check'], ['Pendentes', 67, 'aviso', 'clock'], ['Com folha', 82, 'marca', 'usuario'], ['Pró-labore', 44, 'laranja', 'usuario'], ['Sem movimento', 21, 'roxo', 'list'], ['REINF autorizada', 19, 'ciano', 'fileUp']] as [string, number, string, NomeIcone][]).map(([r, v, tom, ic]) => <div key={r} className={'stat painel-numero painel-' + tom}><span className="painel-numero-icone" aria-hidden="true"><Icone nome={ic} /></span><p className="stat-label">{r}</p><p className="stat-value">{v}</p></div>)}</div> },
  { id: 'stat', tipo: 'cartoes', nome: 'Números (stat)', componente: 'Stat', classes: ['stat-grid', 'stat', 'stat-label', 'stat-value'], telas: ['c-relatorio', 't-insights', 'e-conferencia', 'c-verificar', 't-exec-fiscal-rotina', 'c-cliente', 'c-cliente-dp'], largo: true,
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
  { id: 'vazio', tipo: 'cartoes', nome: 'Vazio (nada aqui)', descricao: 'O ícone, o título e a explicação no meio. Compacto (revisão da UI, 16/10/2026) dentro de cartões estreitos, células e janelas pequenas', componente: 'Vazio', classes: ['gh-blank', 'gh-blank compacto'], telas: TODAS,
    uso: '<Vazio titulo="Nenhum pedido" texto="…" />  ·  <Vazio compacto texto="…" />  ·  com a saída: <Vazio …><button …>Limpar a busca</button></Vazio>  ·  o erro: <Vazio icone="alert" titulo="…" texto={erro} onTentarDeNovo={…} />',
    demo: () => <div style={{ display: 'grid', gap: 12, width: '100%' }}><Vazio titulo="Nenhum pedido" texto="Nenhum pedido feito para esta empresa ainda." /><div className="card" style={{ margin: 0 }}><Vazio compacto icone="checkCircle" texto="Nenhuma objeção registrada nesta competência." /></div><Vazio titulo="Nenhuma empresa com isso" texto="A busca não achou nada."><button type="button" className="btn btn-outline">Limpar a busca</button></Vazio><Vazio icone="alert" titulo="Esta tela não abriu" texto="O banco não respondeu." onTentarDeNovo={nada} /></div> },
  { id: 'checklist-fiscal', tipo: 'cartoes', nome: 'Checklist disfarçada (rotina do Fiscal)', descricao: 'O cartão com a barra de progresso; cada tarefa uma faixa que abre (caixinha, contador, Importar, Conferido) com o painel dela (Stat, rank, tabela, gráficos)', componente: 'ChecklistDisfarcado', classes: ['card folha-check pt-check', 'imp-faixa pt-tarefa', 'subnav-caixa', 'tarefas-barra'], telas: ['t-exec-fiscal-rotina'], largo: true,
    demo: () => (
      <div className="card folha-check pt-check" style={{ width: '100%' }}>
        <div className="card-head"><h3>Conferência › Saídas</h3><span className="card-head-ctl"><span className="tarefas-barra"><span style={{ width: '50%' }} /></span>1/2</span></div>
        <div className="imp-faixa pt-tarefa"><div className="imp-faixa-barra pt-tarefa-barra"><span className="pt-tarefa-abrir"><span className="subnav-caixa marcada"><Icone nome="check" /></span><Icone nome="caretDown" className="imp-faixa-seta" /><b>Sequência de Saídas</b></span><span className="pt-tarefa-acoes"><span className="badge badge-conferido">Conferido</span></span></div></div>
        <div className="imp-faixa pt-tarefa aberta da-vez"><div className="imp-faixa-barra pt-tarefa-barra"><span className="pt-tarefa-abrir"><span className="subnav-caixa vazia" /><Icone nome="caretDown" className="imp-faixa-seta" /><b>Conferência das Notas Fiscais</b><span className="imp-faixa-qtd">24</span></span><span className="pt-tarefa-acoes"><button className="btn btn-outline" type="button"><Icone nome="upload" />Importar Saídas</button><button className="btn btn-primary" type="button"><Icone nome="check" />Conferido</button></span></div>
          <div className="imp-faixa-corpo"><div className="stat-grid"><Stat rotulo="Notas de saída" valor="24" /><Stat rotulo="Valor contábil" valor="58.076,76" cor="saida" /><Stat rotulo="CFOPs" valor="5" /></div></div></div>
      </div>
    ) },
  { id: 'ag-conversa', tipo: 'cartoes', nome: 'Conversas do Claude por computador', descricao: 'Em Sistema e agentes (só admin, 14/10/2026): o cartão do computador (o nome é a faixa do topo) com uma linha por conversa (o nome, a pasta, o estado, o nível do porteiro e há quanto tempo; o pedido e o agora; os subagentes em selos), as inativas na faixa que abre; e o cadastro do computador (o campo e o botão na mesma linha)', classes: ['ag-conversa', 'ag-conversa-topo', 'ag-conversa-linha', 'ag-conversa-agentes', 'ag-novo', 'ag-novo-linha', 'ag-chave-caixa', 'ag-chave', 'ag-acoes'], telas: ['a-sistema'], largo: true,
    demo: () => (
      <div style={{ width: '100%' }}>
        <div className="card">
          <h3>PC do Fiscal</h3>
          <div className="ag-conversa" role="button" tabIndex={0}>
            <div className="ag-conversa-topo"><b className="ag-conversa-titulo">nads · Fiscal › Painel</b><span className="ag-conversa-pasta">nads-dp</span><span className="badge badge-ok">Trabalhando</span><span className="badge badge-neutral">difícil</span><span className="ag-conversa-ha">há 4 s</span></div>
            <p className="ag-conversa-linha"><b>Pedido:</b> monte a rotina do lucro presumido e real</p>
            <p className="ag-conversa-linha"><b>Agora:</b> Delega · planejador (opus) Plano da rotina</p>
            <div className="ag-conversa-agentes"><span className="badge badge-ok">planejador · opus</span><span className="badge badge-neutral">1 terminou</span></div>
          </div>
          <div className="ag-conversa" role="button" tabIndex={0}>
            <div className="ag-conversa-topo"><b className="ag-conversa-titulo">Entregas › Nova entrega</b><span className="ag-conversa-pasta">Entregas</span><span className="badge badge-warn">Esperando você</span><span className="badge badge-neutral">fácil</span><span className="ag-conversa-ha">há 5 min</span></div>
            <p className="ag-conversa-linha"><b>Pedido:</b> tudo pronto?</p>
            <p className="ag-conversa-linha"><b>Esperando você:</b> Claude precisa da sua permissão para usar Bash</p>
          </div>
          <div className="imp-faixa"><button className="imp-faixa-barra" type="button"><Icone nome="caretDown" className="imp-faixa-seta" /><b>Inativas</b><span className="imp-faixa-qtd">3</span></button></div>
        </div>
        <form className="ag-novo" onSubmit={e => e.preventDefault()}>
          <div className="field"><label htmlFor="cat-ag-novo">Cadastrar computador</label>
            <div className="ag-novo-linha"><input id="cat-ag-novo" type="text" placeholder="Ex.: PC do Fiscal" /><button type="submit" className="btn btn-primary"><Icone nome="plus" />Cadastrar</button></div>
          </div>
        </form>
      </div>
    ) },

  // ─── Listas ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'chips', tipo: 'listas', nome: 'Chips de filtro', classes: ['chip-row', 'chip-lbl', 'chip-f', 'on'], telas: ['c-consulta', 'c-naturezas', 't-gmail', 'c-cliente-documentos', 'a-robo'],
    demo: () => <div className="chip-row"><span className="chip-lbl">Tipo</span><button className="chip-f on" type="button">Todos</button><button className="chip-f" type="button">Entradas</button><button className="chip-f" type="button">Saídas</button></div> },
  { id: 'contadores', tipo: 'listas', nome: 'Contadores', classes: ['tarefas-contador', 'menu-contador', 'imp-faixa-qtd'], telas: ['t-empresas', 'e-importacao', 't-exec-fiscal-rotina'],
    demo: () => <><button className="tarefas-contador" type="button"><Icone nome="briefcase" /><b>235</b> empresas</button><span className="menu-contador">12</span><span className="imp-faixa-qtd">4</span></> },
  { id: 'emp-list', tipo: 'listas', nome: 'Lista de empresas (entrar)', classes: ['emp-list', 'emp-item'], telas: ['c-entrada', 'e-entrada', 'z-entrada'],
    demo: () => <div className="emp-list" style={{ width: 320 }}>{[[292, 'FITO INDUSTRIA E COMERCIO'], [9999, 'PERSONALY COMPANY']].map(([c, n]) => <button key={c} className="emp-item" type="button"><span className="emp-cod">{c}</span><span className="emp-txt"><span className="emp-nome">{n}</span></span></button>)}</div> },
  // a rota, as linhas e os dados da entrega de documentos (16/10/2026, a cópia fiel do Entregas)
  { id: 'ent-rota', tipo: 'listas', nome: 'Rota de entregas (as paradas na ordem)', descricao: 'A tabela da rota: o puxador (arrastar, ou Alt com as setas), a posição, o cliente com o sino do lembrete, a linha de apoio (competência · documentos · total · região) e o aviso que faz desviar; à direita "2ª vez", Assinar e "Assinar as N" (a parada com várias entregas)', classes: ['ent-rota', 'ent-puxador', 'ent-pos', 'ent-rota-sub', 'ent-sino', 'ent-aviso', 'ent-acoes'], telas: ['t-entregas'], largo: true,
    demo: () => (
      <div className="table-wrap ent-rota-wrap" style={{ width: '100%' }}><table className="cad-lista ent-rota"><tbody>
        <tr className="linha-abre"><td className="ent-puxa-td"><button type="button" className="icon-btn icon-btn-sm ent-puxador" aria-label="Mover"><Icone nome="arrastar" /></button></td><td className="num fraco ent-pos">1</td>
          <td><span className="cad-empresa-nome">102 - BETA SERVICOS EXEMPLO ME</span><span className="ent-sino"><Icone nome="sino" width={14} height={14} /></span><span className="fraco ent-rota-sub">outubro/2026 · DARF · R$ 132,50 · Parte superior</span><span className="ent-aviso"><Icone nome="alert" width={12} height={12} />atende 08:00–11:30</span></td>
          <td className="ent-acoes"><button type="button" className="btn btn-outline"><Icone nome="lapis" />Assinar</button><button type="button" className="btn btn-outline"><Icone nome="checklist" />Assinar as 3</button></td></tr>
        <tr className="linha-abre"><td className="ent-puxa-td"><button type="button" className="icon-btn icon-btn-sm ent-puxador" aria-label="Mover"><Icone nome="arrastar" /></button></td><td className="num fraco ent-pos">2</td>
          <td><span className="cad-empresa-nome">104 - DELTA EXEMPLO PADARIA</span><span className="fraco ent-rota-sub">outubro/2026 · DAS · R$ 95,30 · Parte inferior</span></td>
          <td className="ent-acoes"><span className="badge badge-danger">2ª vez</span><button type="button" className="btn btn-outline"><Icone nome="lapis" />Assinar</button></td></tr>
      </tbody></table></div>
    ) },
  { id: 'ent-linhas', tipo: 'listas', nome: 'Linhas com selo (cartões da entrega)', descricao: 'Nos cartões da Rota (Vencendo, Atestados, Obrigações, Protocolos, Qualidade) e na página do cliente: o nome em negrito e o apoio ao lado, o selo e a ação à direita; a linha inteira pode abrir', classes: ['ent-linhas', 'ent-linha-abre'], telas: ['t-entregas', 'a-robo'], largo: true,
    demo: () => (
      <ul className="ent-linhas" style={{ width: '100%' }}>
        <li><button type="button" className="ent-linha-abre"><div><b>102 - BETA SERVICOS EXEMPLO ME</b><span className="fraco">DARF · outubro/2026</span></div><span className="badge badge-warn">vence em 2 dias</span></button></li>
        <li><div><b>DAS do Simples</b><span className="fraco">20/10 · 3 guias na rota</span></div><span className="badge badge-neutral">vence em 4 dias</span></li>
      </ul>
    ) },
  { id: 'ent-dados', tipo: 'listas', nome: 'Dados em linhas (rótulo e valor)', descricao: 'O cadastro, a Receita e a entrega feita: o rótulo apagado à esquerda e o valor à direita; linha sem valor não aparece', classes: ['ent-dados'], telas: ['t-entregas', 'a-robo', 'a-arquivador'],
    demo: () => <dl className="ent-dados" style={{ width: '100%', maxWidth: 420 }}><div><dt>Recebido por</dt><dd>João (exemplo)</dd></div><div><dt>Entregue por</dt><dd>Maria (exemplo)</dd></div><div><dt>Data/hora</dt><dd>15/10/2026, 12:48</dd></div></dl> },

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
  { id: 'progresso', tipo: 'graficos', nome: 'Barra de progresso', classes: ['tarefas-barra', 'parada'], telas: ['t-empresas', 't-contabil', 't-exec-fiscal-rotina', 'a-arquivador'],
    demo: () => <><span className="tarefas-barra"><span style={{ width: '40%' }} /></span><span className="tarefas-barra"><span className="parada" style={{ width: '70%' }} /></span></> },
  // a empresa aberta em Minhas empresas (27/10/2026): o cartão no cabeçalho e a escolha no topo da barra lateral
  { id: 'cartao-empresa', tipo: 'cabecalhos', nome: 'Cartão da empresa (cabeçalho)', descricao: 'O prédio, o nome e, embaixo, o código e o CNPJ; o clique abre a janela da empresa do Cadastro por cima da tela (quem não mexe no Cadastro: só os dados)', classes: ['gh-cartao-topo', 'cartao-empresa', 'cartao-empresa-icone', 'cartao-empresa-nome', 'cartao-empresa-doc'], telas: ['t-empresa'],
    demo: () => <button type="button" className="cartao-empresa"><span className="cartao-empresa-icone" aria-hidden="true"><Icone nome="predio" width={18} height={18} /></span><span className="cartao-empresa-texto"><span className="cartao-empresa-nome">FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA</span><span className="cartao-empresa-doc num">Código 292 · CNPJ 19.449.248/0001-62</span></span></button> },
  { id: 'empresa-na-lateral', tipo: 'laterais', nome: 'Seletor da empresa (no alto do menu ☰)', descricao: 'No jeito do seletor de equipe do Vercel: o ícone, em cima o código e o setor, embaixo o nome em até duas linhas, e o ▾; abre a busca, o setor (Contábil ou Fiscal) e o Abrir', classes: ['subnav-topo', 'seletor-empresa', 'com-empresa', 'seletor-empresa-icone', 'seletor-empresa-rotulo', 'seletor-empresa-nome', 'escolher-empresa-painel', 'escolher-empresa-escolhida', 'escolher-empresa-pe'], telas: ['t-empresas', 't-empresa', 't-inicio'],
    demo: () => <div className="subnav-topo" style={{ width: 230 }}><button type="button" className="seletor-empresa com-empresa"><span className="seletor-empresa-icone" aria-hidden="true"><Icone nome="predio" width={16} height={16} /></span><span className="seletor-empresa-texto"><span className="seletor-empresa-rotulo">62 · Contábil</span><span className="seletor-empresa-nome">CARLOS LUCAS MENDES - FAZ. TABATINGA</span></span><Icone nome="caretDown" width={12} height={12} /></button></div> },
  { id: 'mural-avisos', tipo: 'listas', nome: 'Mural de avisos (Início)', descricao: 'Os avisos do escritório, os fixados em cima, com quem e quando; o admin e o diretor fixam, apagam e escrevem no pé', classes: ['mural-lista', 'mural-aviso', 'mural-aviso-texto', 'mural-novo', 'mural-novo-pe'], telas: ['t-inicio'], largo: true,
    demo: () => <div className="card" style={{ width: '100%' }}><ul className="mural-lista"><li className="mural-aviso"><div className="mural-aviso-corpo"><p className="mural-aviso-texto">Sexta-feira o escritório fecha às 16h.</p><p className="hint">Vitor · há 4 horas</p></div><button type="button" className="icon-btn" title="Fixar no alto"><Icone nome="mapaPin" width={16} height={16} /></button></li></ul></div> },
  { id: 'stat-filtro', tipo: 'graficos', nome: 'Número que filtra (painel de Minhas empresas)', descricao: 'O número da situação que, clicado, filtra a lista (de novo, mostra todas)', classes: ['stat stat-filtro', 'ativo'], telas: ['t-empresas'],
    demo: () => <div className="stat-grid" style={{ width: 360 }}><button type="button" className="stat stat-filtro ativo"><p className="stat-label"><span className="bolinha-sit parada" />Paradas</p><p className="stat-value">3</p></button><button type="button" className="stat stat-filtro"><p className="stat-label"><span className="bolinha-sit concluida" />Concluídas</p><p className="stat-value">12</p></button></div> },
  { id: 'rank', tipo: 'graficos', nome: 'Ranking', classes: ['rank', 'rank-item', 'rank-barra'], telas: ['c-relatorio', 't-exec-fiscal-rotina', 'a-uso', 'a-cota', 'a-arquivador'], largo: true,
    demo: () => <div className="rank" style={{ width: '100%' }}>{[['5101 — Venda de produção', 72], ['1101 — Compra para industrialização', 41], ['2910 — Bonificação', 9]].map(([n, v]) => <button key={n} className="rank-item" type="button"><span className="rank-nome">{n}</span><span className="rank-val">{v}%</span><span className="rank-barra"><span style={{ width: v + '%', background: 'var(--accent)' }} /></span></button>)}</div> },

  { id: 'barras-dia', removida: { como: 'excluida', em: '06/10/2026', motivo: 'Vitor: "não curti nenhum dos gráficos novos"; a composição voltou para o Ranking e o resto para os Números (Stat).', sumir: true }, tipo: 'graficos', nome: 'Barras por dia do mês', descricao: 'Uma barra por dia; o dia, as notas e o valor ao passar o mouse (as barras sobem ao aparecer)', componente: 'BarrasPorDia', classes: ['graf-dias', 'graf-dia'], telas: ['t-exec-fiscal-rotina'], largo: true,
    demo: () => null },
  { id: 'rosca', removida: { como: 'excluida', em: '06/10/2026', motivo: 'Vitor: "não curti nenhum dos gráficos novos"; a composição voltou para o Ranking e o resto para os Números (Stat).', sumir: true }, tipo: 'graficos', nome: 'Rosca (composição)', descricao: 'O total no meio e a legenda com a fatia e o valor; cada classe de CFOP sempre com a mesma cor (--cat-1 a --cat-7)', componente: 'Rosca', classes: ['graf-rosca', 'graf-legenda'], telas: ['t-exec-fiscal-rotina'], largo: true,
    demo: () => null },
  { id: 'faixa-100', removida: { como: 'excluida', em: '06/10/2026', motivo: 'Vitor: "não curti nenhum dos gráficos novos"; a composição voltou para o Ranking e o resto para os Números (Stat).', sumir: true }, tipo: 'graficos', nome: 'Faixa 100% (composição)', descricao: 'A composição numa barra só, com a legenda embaixo', componente: 'Faixa', classes: ['graf-faixa', 'graf-legenda em-linha'], telas: ['t-exec-fiscal-rotina'], largo: true,
    demo: () => null },

  // as três peças do painel com gráfico (Savio, 15/10/2026: o Painel do DP "semelhante ao do Certificados"): Senhas › Certificados e DP › Resumo usam estas
  { id: 'rosca-legenda', tipo: 'graficos', nome: 'Rosca com legenda (filtra)', descricao: 'A rosca das situações com o total no meio e a legenda ao lado; clicar na fatia ou na legenda escolhe (o painel filtra a lista)', componente: 'RoscaComLegenda', classes: ['cert-rosca', 'cert-legenda', 'cert-cor-ok', 'cert-cor-vence', 'cert-cor-vencido', 'cert-cor-sem'], telas: ['t-senhas', 't-dp-resumo', 'a-arquivador'],
    uso: "<RoscaComLegenda fatias={[{ id, rotulo, valor, tom: 'ok'|'aviso'|'perigo'|'neutro' }]} total={n} subtitulo=\"clientes\" ativa={id|null} onEscolher={...} />",
    demo: () => <div className="card" style={{ width: '100%', maxWidth: 520, margin: 0 }}><RoscaComLegenda total={40} subtitulo="clientes" ativa="pendente" onEscolher={nada}
      fatias={[{ id: 'atrasada', rotulo: 'Atrasados', valor: 6, tom: 'perigo' }, { id: 'pendente', rotulo: 'Pendentes', valor: 14, tom: 'aviso' }, { id: 'feita', rotulo: 'Concluídos', valor: 17, tom: 'ok' }, { id: 'sem', rotulo: 'Sem movimento', valor: 3, tom: 'neutro' }]} /></div> },
  { id: 'barras-coluna', tipo: 'graficos', nome: 'Barras em coluna (a barra filtra)', descricao: 'Uma coluna por mês ou por etapa, com o número em cima; a altura é proporcional à maior; clicar na barra escolhe (de novo, desfaz). Verde ou âmbar (aviso)', componente: 'BarrasEmColuna', classes: ['cert-barras', 'cert-barra', 'cert-barra-cheia'], telas: ['t-senhas', 't-dp-resumo', 'a-cota'],
    uso: '<BarrasEmColuna colunas={[{ chave, rotulo, total, sub?, aviso?, leitura }]} ativa={chave|null} onEscolher={...} />',
    demo: () => <div className="card" style={{ width: '100%', margin: 0 }}><BarrasEmColuna ativa="esocial" onEscolher={nada}
      colunas={[['folha', 'Folha', 9], ['esocial', 'eSocial', 14], ['guias', 'Guias', 7], ['reinf', 'REINF', 0], ['entrega', 'Entrega', 11]].map(([chave, rotulo, total]) => ({ chave: String(chave), rotulo: String(rotulo), total: Number(total), aviso: true, leitura: rotulo + ': ' + total }))} /></div> },
  { id: 'cartao-anel', tipo: 'graficos', nome: 'Cartão com anel de contagem', descricao: 'Quem pede atenção: o anel com os dias (cheio = 30; atrasado = anel inteiro vermelho), o nome, o prazo colorido e uma linha de apoio; clicar abre', componente: 'CartaoComAnel', classes: ['cert-urgente', 'cert-contagem', 'cert-urgente-prazo'], telas: ['t-senhas', 't-dp-resumo'],
    uso: '<CartaoComAnel dias={n} titulo="…" prazo="Vence em 12 dias" apoio="292 · 19/10/2026" atrasado={dias < 0} onClick={...} />',
    demo: () => <div style={{ width: '100%', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ width: 300 }}><CartaoComAnel dias={12} titulo="EMPRESA EXEMPLO LTDA" prazo="Vence em 12 dias" apoio="292 · 19/10/2026" atrasado={false} onClick={nada} /></div>
      <div style={{ width: 300 }}><CartaoComAnel dias={-5} titulo="OUTRA EMPRESA LTDA" prazo="Parado há 5 dias" apoio="10 · faltam 3 de 8 · Fabiana" atrasado onClick={nada} /></div>
      <AnelDeContagem dias={20} /></div> },

  // o mapa quente do Uso do sistema (Gustavo, 20/10/2026: "um mapa quente que trackei o que tá sendo usado no sistema")
  { id: 'mapa-calor', tipo: 'graficos', nome: 'Mapa de calor (os cliques na tela)', descricao: 'A grade de 50×50 sobre o contorno da página (o topo e a lateral); quanto mais cliques na célula, mais forte o vermelho; a dica da célula diz quantos', componente: 'MapaDeCalor', classes: ['mapa-calor', 'mapa-calor-celula'], telas: ['a-uso'],
    uso: '<MapaDeCalor grade={{ "x_y": cliques }} maior={n} rotulo="Os cliques em Fiscal › Painel" />',
    demo: () => <div style={{ width: '100%', maxWidth: 520 }}><MapaDeCalor rotulo="Exemplo" maior={9} grade={{ '20_10': 9, '21_10': 6, '22_11': 3, '30_24': 5, '31_25': 2, '40_40': 1, '18_30': 4 }} /></div> },

  // os botões coloridos do Uso do sistema (21/10/2026: "a tela com botões coloridos"): a cor do calor, do frio ao quente
  { id: 'pilula-calor', tipo: 'graficos', nome: 'Pílula de calor (o botão pelos cliques)', descricao: 'O nome do botão com o número de cliques, em três tons: azul = pouco (calor-1 e 2), amarelo = médio (calor-3), vermelho = muito usado (calor-4 e 5); calor-0 tracejado = ninguém clicou. A legenda em palavras é a uso-cor. O nível vem de uso.nivelDoCalor', classes: ['uso-pilula', 'calor-0', 'calor-1', 'calor-5', 'uso-cor'], telas: ['a-uso'],
    uso: '<span className={"uso-pilula calor-" + uso.nivelDoCalor(cliques, maior)}>Exportar Excel<b className="num">89</b></span>',
    demo: () => <div className="uso-botoes">{([['Exportar Excel', 89, 5], ['Filtros', 41, 4], ['Abrir', 23, 3], ['Salvar', 9, 2], ['Imprimir', 2, 1], ['Fechar', 0, 0]] as const).map(([r, n, c]) => <span key={r} className={'uso-pilula calor-' + c}>{r}<b className="num">{n}</b></span>)}</div> },
  // os destaques das despesas no faturamento detalhado (22/10/2026: "fgts, água, dentre outros")
  { id: 'destaque-valor', tipo: 'graficos', nome: 'Destaque de valor (as despesas do mês)', descricao: 'Uma grade de quadrinhos pequenos: o nome em cima, o valor embaixo (e uma nota opcional, como o vencimento). Para vários valores lado a lado, menores que o Stat', classes: ['fat-destaques', 'fat-destaque'], telas: ['t-fiscal-faturamento'],
    uso: '<div className="fat-destaques"><div className="fat-destaque"><span className="fraco">FGTS</span><b className="num">R$ 1.000,00</b></div></div>',
    demo: () => <div className="fat-destaques" style={{ width: '100%' }}>{([['Salários', '12.500,00'], ['FGTS', '1.000,00'], ['Água', '212,40'], ['Energia', '1.350,90']] as const).map(([r, v]) => <div key={r} className="fat-destaque"><span className="fraco">{r}</span><b className="num">R$ {v}</b></div>)}</div> },
  // as notas do mês por comprador ou por CFOP no faturamento detalhado (23/10/2026: "ver todos os clientes / abrir e ver / pesquisar")
  { id: 'grupos-que-abrem', tipo: 'graficos', nome: 'Grupos que abrem (as notas por comprador ou CFOP)', descricao: 'Uma lista com borda: cada linha é um grupo (o nome, quantas notas e a parte do total, o valor e uma barra fina); clicar abre a tabela das notas dele embaixo. Com a busca curta e o Segmentado em cima; de 30 em 30, com o Mostrar mais', classes: ['fat-grupos', 'fat-grupo', 'fat-grupo-linha', 'fat-grupo-barra', 'fat-grupo-notas'], telas: ['t-fiscal-faturamento'],
    uso: '<div className="fat-grupos"><div className="fat-grupo aberto"><button className="fat-grupo-linha">…</button><div className="table-wrap fat-grupo-notas">…</div></div></div>',
    demo: () => (
      <div className="fat-grupos" style={{ width: '100%' }}>
        {([['TELHAS SALINAS LTDA', '4 notas · 4,2%', '65.000,00', 100], ['Consumidor (sem identificação)', '455 notas · 36,8%', '565.427,00', 60]] as const).map(([n, q, v, b]) => (
          <div key={n} className="fat-grupo"><button type="button" className="fat-grupo-linha"><Icone nome="chevronRight" width={14} height={14} /><span className="fat-grupo-nome">{n}</span><span className="fraco">{q}</span><b className="num">{v}</b><span className="fat-grupo-barra"><span style={{ width: b + '%' }} /></span></button></div>
        ))}
      </div>) },
  // o mapa na tela (21/10/2026): por cima da tela de verdade, a moldura de cada controle na cor do calor e a barra de baixo
  { id: 'mapa-na-tela', tipo: 'graficos', nome: 'Mapa na tela (os botões pintados)', descricao: 'Ligado pelo "Ver na tela" do Uso do sistema: cada controle da tela aberta ganha a moldura na cor do calor com o número de cliques (a camada não pega clique); a barra de baixo diz a tela, o que cada cor quer dizer e tem o Sair. Montado uma vez na casca (casca/MapaNaTela.tsx)', classes: ['mapa-tela-caixa', 'mapa-tela-barra'], telas: ['a-uso'],
    uso: '<MapaNaTela /> (na casca; liga com ligarMapaNaTela(periodo))',
    demo: () => (
      <div style={{ position: 'relative', display: 'flex', gap: 16, padding: 12, transform: 'translateZ(0)' }}>
        {([['Exportar Excel', 89, 5], ['Filtros', 23, 3], ['Fechar', 0, 0]] as const).map(([r, n, c]) => (
          <span key={r} style={{ position: 'relative' }}><button type="button" className="btn btn-outline">{r}</button>
            <span className={'mapa-tela-caixa calor-' + c} style={{ position: 'absolute', inset: -3 }} title={n + ' cliques'} /></span>
        ))}
      </div>) },

  // o painel de progresso do arquivador do Drive (22/10/2026: "transforme essa tela apenas um painel de progresso da tarefa")
  { id: 'progresso-tarefa', tipo: 'graficos', nome: 'Painel de progresso de uma tarefa', descricao: 'A janela que só acompanha (sem botão de fazer): no título, o nome e se o PC está ligado; no meio, o ícone, a porcentagem grande, a barra, o lote e o começo, e as fases (feitas em verde, a de agora girando, as que faltam apagadas); parada, a próxima e a última rodada. No pé, só o Fechar', classes: ['modal arquivador-progresso', 'arquivador-hero', 'arquivador-hero-numero', 'arquivador-fases', 'arquivador-progresso-fases'], telas: ['t-drive'],
    uso: '<JanelaDoArquivador vm={vm} fechar={…} />  (no Drive, pelo botão Arquivador)',
    demo: () => (
      <div className="modal arquivador-progresso" style={{ position: 'static', width: '100%', maxWidth: 460, margin: 0 }}>
        <h3><Icone nome="arquivo" width={16} height={16} />Arquivador<span className="arquivador-pc ligado"><span className="arquivador-ponto" aria-hidden="true" />PC do arquivador ligado</span></h3>
        <div className="arquivador-hero">
          <span className="arquivador-hero-icone ativo"><Icone nome="girar" /></span>
          <h3>Organizando a pasta Claudio Secretario</h3>
          <b className="arquivador-hero-numero">45%</b>
          <span className="tarefas-barra larga arquivador-hero-barra"><span style={{ width: '45%' }} /></span>
          <p className="arquivador-hero-texto">3 de 5 agentes prontos</p>
          <ul className="arquivador-fases arquivador-progresso-fases">
            {([['Separando os PDFs', 'feita'], ['Descobrindo o cliente de cada arquivo', 'atual'], ['Conferindo', 'falta']] as const).map(([n, e]) => (
              <li key={n} className={e}><Icone nome={e === 'feita' ? 'checkCircle' : e === 'atual' ? 'girar' : 'clock'} width={15} height={15} /><span>{n}</span></li>
            ))}
          </ul>
        </div>
      </div>
    ) },

  // a variação contra o período anterior (23/10/2026, o Faturamento e o Simples do Fiscal): a seta e o %, verde quando é bom
  { id: 'variacao', tipo: 'graficos', nome: 'Variação (▲ ▼ contra o anterior)', descricao: 'A seta e o % sem sinal: verde quando é bom, vermelho quando é ruim; subirEhRuim para gasto (saídas, despesas, imposto); sem comparação, um traço. No Stat, vai na linha de baixo (sub)', componente: 'Variacao', classes: ['variacao', 'variacao-boa', 'variacao-ruim', 'stat-comparacao'], telas: ['t-fiscal-faturamento', 't-fiscal-simples', 't-financeiro-painel'],
    uso: '<Stat rotulo="Setembro/2026" valor="R$ 205.657,38" sub={<><Variacao pct={38.9} /> sobre ago/26</>} />',
    demo: () => <div className="stat-grid" style={{ width: '100%', maxWidth: 640 }}><Stat rotulo="Setembro/2026" valor="R$ 205.657,38" sub={<><Variacao pct={38.9} /> sobre ago/26</>} /><Stat rotulo="Despesas" valor="R$ 3.936,31" sub={<><Variacao pct={161.2} subirEhRuim /> sobre ago/26</>} /><Stat rotulo="Sem comparação" valor="R$ 10,00" sub={<Variacao pct={null} />} /></div> },

  // ─── Cores ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id: 'cores', tipo: 'cores', nome: 'As cores do sistema', descricao: 'Mude o tema no ☰ para ver o escuro', telas: TODAS, largo: true,
    demo: () => <div className="cat-cores">{CORES.map(c => <span key={c} className="cat-cor"><i style={{ background: 'var(' + c + ')' }} />{c}</span>)}</div> },
  { id: 'tema', tipo: 'cores', nome: 'Seletor de tema', componente: 'SeletorTema', classes: ['theme-toggle'], telas: TODAS, demo: () => <SeletorTema /> },
  // ─── Área do Cliente, o lado do escritório (Vitor, 16/10/2026) ─── (peças novas entram no fim do tipo)

  // ─── Área do Cliente (Vitor, 16 e 17/10/2026): no fim da lista, para os códigos das outras peças não mudarem ──────
  { id: 'selo-suave', tipo: 'selos', nome: 'Selo suave (Área do Cliente)', descricao: 'O único selo da Área do Cliente (versão D, Vitor, 16/10/2026): o badge do nads dentro de .cli-app vira a pílula sem borda, com o pontinho e o fundo suave; a cor só pelo significado — vermelho vencida e férias vencidas, amarelo vence hoje, a fazer e não baixado, verde pago, em dia e respondido; neutro para o resto. Funciona no claro e no escuro', classes: ['badge', 'badge-bad', 'badge-warn', 'badge-ok', 'badge-neutral', 'cli-sem-ponto'], telas: ['c-cliente', 'c-cliente-documentos', 'c-cliente-guias', 'c-cliente-dp', 'c-cliente-chamados'],
    demo: () => (
      <div className="cli-app cli-demo" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <span className="badge badge-bad">Vencida</span><span className="badge badge-warn">Vence hoje</span><span className="badge badge-ok">Pago</span><span className="badge badge-ok">Em dia</span><span className="badge badge-neutral">A vencer</span><span className="badge badge-neutral cli-sem-ponto">Fiscal</span>
      </div>
    ) },
  { id: 'area-soltar', tipo: 'campos', nome: 'Área de soltar arquivos', descricao: 'Da Área do Cliente (Vitor, 16/10/2026): arrastar os arquivos para cima dela ou clicar para escolher; a moldura tracejada do escolher arquivos do nads, maior, com o ícone e a dica do que aceita (PDF, JPG, PNG, XML ou ZIP, até 700 KB cada, o limite das regras do banco); fica avermelhada quando o arquivo está por cima. Os escolhidos aparecem embaixo e só vão no botão Enviar', componente: 'AreaDeSoltar', classes: ['cli-soltar', 'sobre'], telas: ['c-cliente-documentos'], largo: true,
    demo: () => <div className="cli-app cli-demo" style={{ width: '100%' }}><AreaDeSoltar aceitar=".pdf,.jpg,.png,.xml,.zip" dica="PDF, JPG, PNG, XML ou ZIP · até 700 KB cada" onArquivos={nada} /></div> },
  { id: 'lt-cliente', tipo: 'laterais', nome: 'Área do Cliente (o menu lateral)', descricao: 'O menu do protótipo da Área do Cliente (Vitor, 16/10/2026: "quero assim, só que no design do app"): o N e "Nilma Contabilidade", as cinco seções (Visão geral, Central de documentos, Guias e obrigações, Departamento pessoal, Solicitações e chamados) no subnav-item do nads com o contador dos documentos novos e das guias vencidas (vermelho), Administrativo (Dados cadastrais e Fale com o escritório, em janela) e o rodapé do atendimento com o WhatsApp. No celular vira a gaveta do ☰. Versão D: a marca em duas linhas (Nilma e CONTABILIDADE espaçado), o item aberto no fundo carmim suave, os contadores em pílula suave (o das guias vencidas em vermelho) e o N da Nilma no rodapé, no lugar do "NC". No PC ela recolhe como a do app (17/10/2026: "coloca pra esconder a aba lateral assim como no app"): o mesmo "Ocultar barra lateral" (subnav-colapsar, o ícone do painel) e a mesma preferência guardada no navegador; recolhida, 64 px só com os ícones (o nome no title), os contadores viram um pontinho e o rodapé fica só no N', classes: ['cli-lateral', 'cli-marca', 'cli-marca-nome', 'cli-menu', 'subnav-item', 'subnav-title', 'subnav-count', 'cli-lateral-pe', 'cli-marca-escritorio', 'subnav-colapsar', 'cli-recolhida'], telas: ['c-cliente', 'c-cliente-documentos', 'c-cliente-guias', 'c-cliente-dp', 'c-cliente-chamados'],
    demo: () => (
      <div className="cli-app cli-demo" style={{ width: 256, border: '1px solid var(--border)', borderRadius: 6 }}>
        <div className="cli-marca"><span className="brand-mark" aria-hidden="true"><MarcaN /></span><span className="cli-marca-nome"><b>Nilma</b><small>Contabilidade</small></span></div>
        <nav className="cli-menu">
          <button className="subnav-item active" type="button"><Icone nome="home" width={16} height={16} /><span>Visão geral</span></button>
          <button className="subnav-item" type="button"><Icone nome="pastaAberta" width={16} height={16} /><span>Central de documentos</span><span className="subnav-count">3</span></button>
          <button className="subnav-item" type="button"><Icone nome="recibo" width={16} height={16} /><span>Guias e obrigações</span><span className="subnav-count cli-conta-ruim">1</span></button>
          <button className="subnav-item" type="button"><Icone nome="usuario" width={16} height={16} /><span>Departamento pessoal</span></button>
          <button className="subnav-item" type="button"><Icone nome="mensagem" width={16} height={16} /><span>Solicitações e chamados</span></button>
          <p className="subnav-title">Administrativo</p>
          <button className="subnav-item" type="button"><Icone nome="predio" width={16} height={16} /><span>Dados cadastrais</span></button>
          <button className="subnav-item" type="button"><Icone nome="telefone" width={16} height={16} /><span>Fale com o escritório</span></button>
        </nav>
        <div className="cli-lateral-pe"><div className="cli-pessoa"><MarcaDoEscritorio tamanho={36} /><div><span className="hint">Seu atendimento</span><b>Equipe Nilma Contabilidade</b></div></div><p className="hint">Segunda a sexta, das 8h às 18h</p><button className="btn" type="button"><Icone nome="mensagem" width={16} height={16} />WhatsApp do escritório</button></div>
        <div className="cli-menu cli-colapsar"><button className="subnav-item subnav-colapsar" type="button"><Icone nome="painel" width={16} height={16} /><span>Ocultar barra lateral</span></button></div>
      </div>
    ) },
  { id: 'cartao-guia', tipo: 'cartoes', nome: 'Cartão de guia (Área do Cliente)', descricao: 'Dos "Próximos vencimentos" de Guias e obrigações da Área do Cliente (versão D, Vitor, 16/10/2026): no alto o quadradinho claro com a logo do órgão (ou a sigla, enquanto a logo não existe) e o selo suave da situação; o valor grande em número tabular, o nome, a competência e o vencimento com quantos dias faltam; embaixo do fio, Baixar PDF e copiar a linha digitável. Só a guia mais urgente leva o Baixar carmim (destaque); as outras, o secundário', componente: 'CartaoDeGuia', classes: ['card', 'cli-cartao', 'cli-cartao-topo', 'cli-cartao-valor', 'cli-cartao-nome', 'cli-cartao-pe', 'cli-sigla', 'badge'], telas: ['c-cliente-guias'], largo: true,
    uso: '<CartaoDeGuia guia={g} faltam="em 3 dias" destaque={i === 0} onBaixar={baixar} />',
    demo: () => (
      <div className="cli-app cli-demo" style={{ width: '100%' }}><div className="cli-tres">
        <CartaoDeGuia guia={{ id: 'x1', tipo: 'DAS', competencia: '2026-09', vencimento: '11/10/2026', valor: 1284.37, situacao: 'vencida', temPdf: true }} faltam="há 5 dias" codigo="07190.00009" onBaixar={nada} onCopiar={nada} />
        <CartaoDeGuia guia={{ id: 'x2', tipo: 'FGTS', competencia: '2026-09', vencimento: '16/10/2026', valor: 917.42, situacao: 'vence hoje', temPdf: true }} destaque={false} onBaixar={nada} />
        <CartaoDeGuia guia={{ id: 'x3', tipo: 'DAE', competencia: '2026-09', vencimento: '24/10/2026', valor: 432.1, situacao: 'a vencer', temPdf: true }} faltam="em 8 dias" destaque={false} onBaixar={nada} />
      </div></div>
    ) },
  { id: 'linha-agenda', tipo: 'listas', nome: 'Linha da agenda (Área do Cliente)', descricao: 'Do card "O que o escritório entrega no mês" de Guias e obrigações (versão D, Vitor, 16/10/2026): a data numa folhinha (o dia e o mês), a obrigação em português simples e a situação — só o A fazer leva selo (amarelo); Feito fica discreto, com o ✓ verde; Não se aplica com a linha apagada. Na Visão geral (polida de 17/10/2026), sem o selo (semSituacao): só as que o escritório ainda entrega no mês, com a folhinha na largura da logo da guia (40 px) para os textos ficarem em fila', componente: 'LinhaDaAgenda', classes: ['cli-lista', 'cli-linha', 'cli-data', 'cli-linha-txt', 'cli-feito', 'badge badge-warn'], telas: ['c-cliente-guias'], largo: true,
    demo: () => (
      <div className="cli-app cli-demo" style={{ width: '100%' }}><ul className="cli-lista">
        <LinhaDaAgenda item={{ id: 'fgts', nome: 'FGTS', vence: '2026-10-20', situacao: 'feito', feitoEm: '2026-10-14T15:30:00.000Z' }} />
        <LinhaDaAgenda item={{ id: 'das', nome: 'DAS do Simples Nacional', vence: '2026-10-20', situacao: 'a fazer' }} />
        <LinhaDaAgenda item={{ id: 'icms', nome: 'ICMS (imposto estadual)', vence: '2026-10-09', situacao: 'nao se aplica' }} />
        <LinhaDaAgenda item={{ id: 'darf-inss', nome: 'DARF do INSS da folha', vence: '2026-10-20', situacao: 'a fazer' }} semSituacao />
      </ul></div>
    ) },
  { id: 'conversa-chamado', tipo: 'listas', nome: 'Conversa do chamado (Área do Cliente)', descricao: 'Das Solicitações da Área do Cliente (Vitor, 16/10/2026): os balões da conversa em ordem, como o balão do nads — o do cliente à direita (carmim clarinho, sem borda), o do escritório à esquerda (no branco do cartão, com a borda fina); o escritório sempre aparece como "Escritório". A conversa abre embaixo da linha dela, com o campo de responder', componente: 'ConversaDoChamado', classes: ['cli-conversa', 'cli-balao', 'cli-balao-cliente', 'cli-balao-escritorio'], telas: ['c-cliente-chamados'], largo: true,
    demo: () => (
      <div className="cli-app cli-demo" style={{ width: '100%' }}>
        <ConversaDoChamado mensagens={[
          { de: 'cliente', autor: 'Você', texto: 'O João pode tirar 10 dias de férias e vender os outros 20?', em: '2026-10-08T09:40:00.000Z' },
          { de: 'escritorio', autor: 'Escritório', texto: 'Pode tirar 20 dias e vender até 10. Avise com 30 dias de antecedência.', em: '2026-10-08T12:55:00.000Z' },
        ]} />
      </div>
    ) },
  { id: 'linha-guia', tipo: 'listas', nome: 'Linha de guia (Área do Cliente)', descricao: 'Das "Obrigações e guias próximas" da Visão geral da Área do Cliente (versão D, Vitor, 16/10/2026): uma grade de colunas fixas, igual em todas as linhas (17/10/2026: "quero que melhore esse layout") — a logo do órgão solta (40 px), o nome com a competência e o vencimento, o selo da situação (largura fixa, à esquerda), o valor (largura fixa, à direita, tabular) e as ações (copiar e baixar, à direita); no celular o selo, o valor e as ações descem para a segunda linha. Na Visão geral, separadas em A pagar e Pagas (as pagas mais discretas). Nada vira "…": o nome e o detalhe quebram a linha, e cada pedaço do detalhe (o vencimento, a competência) fica inteiro (cli-junto). "Melhora mais" de 17/10/2026: a ação principal com nome — Baixar (carmim só na próxima a pagar) com o copiar o código ao lado; na vencida, Pedir nova (a guia vencida não passa no banco; abre o chamado já com o título), com o PDF antigo no ícone; no celular as ações descem para uma terceira linha', componente: 'LinhaDeGuia', classes: ['cli-lista', 'cli-linha', 'cli-linha-guia', 'cli-g-logo', 'cli-g-txt', 'cli-g-selo', 'cli-g-valor', 'cli-g-acoes', 'cli-grupo', 'badge', 'icon-btn', 'cli-junto'], telas: ['c-cliente', 'c-cliente-guias'], largo: true,
    demo: () => (
      <div className="cli-app cli-demo" style={{ width: '100%' }}><ul className="cli-lista">
        <LinhaDeGuia faltam="há 5 dias" guia={{ id: 'l1', tipo: 'DAS', competencia: '2026-09', vencimento: '11/10/2026', valor: 1284.37, situacao: 'vencida', temPdf: true }} onBaixar={nada} onPedirNova={nada} />
        <LinhaDeGuia codigo="85800000009-1" onCopiar={nada} destaque guia={{ id: 'l2', tipo: 'FGTS', competencia: '2026-09', vencimento: '16/10/2026', valor: 917.42, situacao: 'vence hoje', temPdf: true }} onBaixar={nada} />
        <LinhaDeGuia guia={{ id: 'l3', tipo: 'DAE', competencia: '2026-09', vencimento: '24/10/2026', valor: 432.1, situacao: 'a vencer', temPdf: true }} onBaixar={nada} />
      </ul></div>
    ) },
  { id: 'botoes-link-cliente', tipo: 'botoes', nome: 'Botões do link do cliente', descricao: 'Sem link, "Gerar link" (vermelho); com link, Copiar, WhatsApp (abre com o texto pronto), Trocar e Revogar (estes dois pedem confirmação). Só o admin e os diretores veem (Vitor, 16/10/2026)', classes: ['ac-botoes', 'btn', 'btn-danger'], telas: ['t-cadastro-janela'], largo: true,
    demo: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <BotoesDoLink temLink={false} aoGerar={nada} aoCopiar={nada} aoWhatsApp={nada} aoTrocar={nada} aoRevogar={nada} />
        <BotoesDoLink temLink aoGerar={nada} aoCopiar={nada} aoWhatsApp={nada} aoTrocar={nada} aoRevogar={nada} />
      </div>
    ) },
  { id: 'bloco-link-cliente', tipo: 'cartoes', nome: 'Link do cliente (bloco da janela da empresa)', descricao: 'Na aba Dados da empresa do Cadastro: o endereço do link secreto, de quando é e os botões; sem link, oferece Gerar; para quem não é admin nem diretor, só mostra o estado (Vitor, 16/10/2026)', classes: ['card ac-bloco', 'ac-endereco'], telas: ['t-cadastro-janela'], largo: true,
    demo: () => (
      <BlocoDoLink endereco="https://cliente.nilmacontabilidade.com/cliente/9f2c1a7e4b8d0356ac91e2f7d4b6a80c13e5f792" data="04/10/2026" podeMexer
        aoGerar={nada} aoCopiar={nada} aoWhatsApp={nada} aoTrocar={nada} aoRevogar={nada} />
    ) },
  { id: 'conversa-escritorio', tipo: 'listas', nome: 'Conversa do chamado (visão do escritório)', descricao: 'Os balões do chamado em Área do Cliente › Chamados: o do cliente à esquerda e o do escritório, com o nome de quem respondeu, à direita (Vitor, 16/10/2026)', classes: ['ac-conversa', 'ac-balao', 'ac-balao-cliente', 'ac-balao-escritorio'], telas: ['t-area-chamados'], largo: true,
    demo: () => (
      <ConversaDoEscritorio mensagens={[
        { de: 'cliente', autor: 'Você', texto: 'Vamos contratar o Marcos, começa dia 1º. O que preciso mandar?', em: '2026-10-15T10:20:00' },
        { de: 'escritorio', autor: 'Camila', texto: 'Oi! Precisamos do RG, CPF, comprovante de residência e o exame admissional.', em: '2026-10-15T11:05:00' },
      ]} />
    ) },
  { id: 'icone-arquivo', tipo: 'icones', nome: 'Ícone do arquivo (Área do Cliente)', descricao: 'Da Central de documentos (Vitor, 16/10/2026: "quero um ícone mais bonito, pode ser dependendo do arquivo"): desenhado à mão — a folha com o canto dobrado, a etiqueta com a extensão e um desenho de dentro por tipo (linhas no PDF e no DOC, grade na planilha, </> no XML, zíper no ZIP, montanha com o sol na imagem), cada um na cor clássica pelos tokens do nads. 36 px na tabela; no escuro a folha pega um tom da cor e não apaga. Desde 22/10/2026 no @nads/ui (o CSS no nads.css), com o TXT (SPED, Sintegra) e o OFX (extrato) a mais e o formatoPeloNome(nome): o Arquivador do admin usa na lista dos arquivos (32 px), no detalhe (40 px) e no ranking por tipo (20 px)', componente: 'IconeDeArquivo', classes: ['cli-arquivo', 'cli-arquivo-folha', 'cli-arquivo-canto', 'cli-arquivo-dentro', 'cli-arquivo-etiqueta', 'cli-arquivo-ext'], telas: ['c-cliente-documentos', 'a-arquivador'], largo: true,
    uso: '<IconeDeArquivo formato="PDF" tamanho={36} />',
    demo: () => (
      <div className="cli-app cli-demo" style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        {FORMATOS_DE_ARQUIVO.map(f => <span key={f} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontSize: 12 }}><IconeDeArquivo formato={f} tamanho={36} />{f}</span>)}
      </div>
    ) },
  { id: 'logo-guia', tipo: 'logos', nome: 'Logo da guia (Área do Cliente)', descricao: 'A logo da guia (Vitor, 16 e 17/10/2026: "a logo de cada guia no quadradinho", depois "deixe sem fundo"): a logo do órgão solta, sem fundo, sem borda e sem sombra, numa área de ~40 px — DAS o Simples Nacional, DAE o Governo de Minas, FGTS o FGTS, DARF/INSS/DCTFWeb a Receita Federal, os honorários o N da Nilma; a outra guia fica só com o texto da sigla, em cinza. No escuro, a Receita fica em azul claro (--logo-receita)', componente: 'SiglaDaGuia', classes: ['cli-sigla', 'com-logo', 'cli-sigla-logo'], telas: ['c-cliente', 'c-cliente-guias'],
    uso: '<SiglaDaGuia tipo="DAS" tamanho={44} />',
    demo: () => (
      <div className="cli-app cli-demo" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        {(['DAS', 'DAE', 'FGTS', 'DCTFWeb', 'HON', 'outra'] as const).map(t => <SiglaDaGuia key={t} tipo={t} tamanho={44} />)}
      </div>
    ) },
  { id: 'marca-escritorio', tipo: 'logos', nome: 'Marca do escritório (Área do Cliente)', descricao: 'O N oficial da Nilma (o mesmo do menu) num círculo claro com a borda fina, no lugar do avatar "NC" (Vitor, 16/10/2026): no card Atendimento da Visão geral (44 px) e no rodapé da lateral (36 px)', componente: 'MarcaDoEscritorio', classes: ['cli-marca-escritorio'], telas: CLI_TELAS,
    uso: '<MarcaDoEscritorio tamanho={44} />',
    demo: () => <div className="cli-app cli-demo" style={{ display: 'flex', alignItems: 'center', gap: 12 }}><MarcaDoEscritorio tamanho={44} /><MarcaDoEscritorio tamanho={36} /></div> },
  { id: 'avatar-foto', tipo: 'icones', nome: 'Avatar com foto (Área do Cliente)', descricao: 'O funcionário no Departamento pessoal (Vitor, 16/10/2026: "subir a foto da pessoa que foi contratada"): a foto redonda quando tem; sem foto, as iniciais num dos seis tons suaves (sempre o mesmo para o mesmo nome). Ao passar o mouse aparece a câmera (no celular, num cantinho) e o clique abre o seletor de JPG ou PNG; o navegador recorta o quadrado do meio e reduz para 256×256 em JPEG antes de enviar. 36 px na tabela, 72 px na ficha, 48 px na admissão', componente: 'Avatar', classes: ['cli-avatar', 'cli-avatar-mexe', 'cli-avatar-foto', 'cli-avatar-camera', 'cli-iniciais'], telas: ['c-cliente-dp'],
    uso: '<Avatar nome={e.nome} foto={e.foto} onFoto={f => trocarFoto(e, f)} />',
    demo: () => (
      <div className="cli-app cli-demo" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <AvatarDoCliente nome="Ana Luiza Ferreira" onFoto={nada} />
        <AvatarDoCliente nome="Carlos Eduardo Santos" onFoto={nada} />
        <AvatarDoCliente nome="Mariana Oliveira Silva" foto={FOTO_DE_EXEMPLO} onFoto={nada} />
        <AvatarDoCliente nome="Mariana Oliveira Silva" foto={FOTO_DE_EXEMPLO} tamanho={72} onFoto={nada} />
      </div>
    ) },
  { id: 'vazio-cliente', tipo: 'avisos', nome: 'Estado vazio (Área do Cliente)', descricao: 'Quando a lista não tem nada (versão D, Vitor, 16/10/2026): o ícone num círculo suave, a frase curta e, quando faz sentido, o que fazer (botão secundário, ex.: Limpar os filtros). Polida de 17/10/2026: a frase diz o que importa ("Nada para pagar agora"); no cartão esticado pela grade, o vazio fica no meio da altura; dentro de uma lista com outros grupos, só a linha curta cinza (cli-grupo-vazio)', componente: 'Vazio', classes: ['cli-vazio', 'cli-vazio-ico', 'cli-grupo-vazio'], telas: CLI_TELAS, largo: true,
    uso: '<Vazio icone="search" titulo="Nenhum documento com esse filtro" acao={{ rotulo: "Limpar os filtros", onClick: limpar }} />',
    demo: () => (
      <div className="cli-app cli-demo" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, width: '100%' }}>
        <div className="card" style={{ flex: '1 1 260px' }}><VazioDoCliente icone="search" titulo="Nenhum documento com esse filtro" acao={{ rotulo: 'Limpar os filtros', onClick: nada }} /></div>
        <div className="card" style={{ flex: '1 1 260px' }}><VazioDoCliente icone="mensagem" titulo="Nenhum chamado ainda" texto="Os pedidos que você abrir aparecem aqui." /></div>
        <div className="card" style={{ flex: '1 1 260px' }}><VazioDoCliente icone="recibo" titulo="Nada para pagar agora" texto="Quando o escritório gerar uma guia, ela aparece aqui." /></div>
      </div>
    ) },
  { id: 'esqueleto-cliente', tipo: 'carregamento', nome: 'Esqueleto da Área do Cliente', descricao: 'Enquanto o link carrega (versão D, Vitor, 16/10/2026): o desenho da Visão geral — o veredito no alto (o círculo e a frase) e as duas colunas embaixo ("melhora mais" de 17/10/2026) — com as linhas do Esqueleto do nads, que já têm o brilho passando', componente: 'EsqueletoDaArea', classes: ['cli-esqueleto', 'esqueleto-linha'], telas: ['c-cliente'], largo: true,
    demo: () => <div className="cli-app cli-demo" style={{ width: '100%' }}><EsqueletoDaArea /></div> },
  { id: 'logos-orgaos', tipo: 'logos', nome: 'Órgãos das guias', descricao: 'As logos dos órgãos (Vitor, 17/10/2026, das fontes oficiais), redesenhadas em SVG para ficarem nítidas em qualquer tamanho: o símbolo do Simples Nacional, o triângulo do Governo de Minas, o símbolo da Receita Federal, e as do FGTS e do INSS que o nads já tinha. Sempre coloridas; a da Receita aceita --logo-receita para o fundo escuro (o azul oficial some nele)', componente: 'LogoSimplesNacional · LogoGovernoMinas · LogoReceitaFederal · LogoFgts · LogoInss', telas: ['c-cliente', 'c-cliente-guias', 't-exec-folha'],
    uso: '<LogoReceitaFederal />',
    demo: () => (
      <div className="cli-app cli-demo" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20 }}>
        <span style={{ display: 'inline-flex', width: 40, height: 40 }}><LogoSimplesNacional /></span>
        <span style={{ display: 'inline-flex', width: 46, height: 40 }}><LogoGovernoMinas /></span>
        <span style={{ display: 'inline-flex', width: 56, height: 40 }}><LogoReceitaFederal /></span>
        <span style={{ display: 'inline-flex', width: 72, height: 22 }}><LogoFgts cor /></span>
        <span style={{ display: 'inline-flex', width: 52, height: 36 }}><LogoInss cor /></span>
      </div>
    ) },
  { id: 'linha-paga', tipo: 'listas', nome: 'Linha de guia paga (Área do Cliente)', descricao: 'As guias já pagas (Vitor, 17/10/2026), na mesma grade da linha de guia: a logo do órgão (ou o ✓), o nome e o "Pago em", o selo Pago, o valor mais discreto e o comprovante como ícone. Na Visão geral (em "Pagas") e em Guias e obrigações (em "Pagas no mês")', componente: 'LinhaDePaga', classes: ['cli-lista', 'cli-pagas', 'cli-linha-guia', 'cli-paga'], telas: ['c-cliente', 'c-cliente-guias'], largo: true,
    demo: () => (
      <div className="cli-app cli-demo" style={{ width: '100%' }}><ul className="cli-lista cli-pagas">
        <LinhaDePaga paga={{ id: 'p1', tipo: 'HON', nome: 'Honorários da Nilma Contabilidade', competencia: '2026-10', valor: 1250, pagoEm: '10/10/2026', temComprovante: true }} onComprovante={nada} />
        <LinhaDePaga paga={{ id: 'p2', tipo: 'DCTFWeb', nome: 'INSS da folha (DCTFWeb)', competencia: '2026-08', valor: 1980.3, pagoEm: '18/09/2026', temComprovante: true }} onComprovante={nada} />
      </ul></div>
    ) },
  { id: 'veredito-cliente', tipo: 'cartoes', nome: 'Veredito (Área do Cliente)', descricao: 'O topo da Visão geral da Área do Cliente ("melhora mais" de 17/10/2026, Vitor: "procura na net exemplos de portal de cliente"; o padrão dos portais das contabilidades): a frase da situação ("Tudo em dia", "O DAS venceu em 12/10", "Você tem 2 pendências") com o ícone no círculo suave da cor do significado (verde, amarelo, vermelho) e a sobrelinha com o mês e a hora da atualização. Uma pendência só: a ação dela ao lado da frase, em carmim. Duas ou mais: embaixo do fio, "O que precisamos de você", uma linha por pendência com UMA ação (a primeira em carmim). Nenhuma: só a frase, sem botão. No celular os botões ocupam a largura', componente: 'CartaoDoVeredito', classes: ['card', 'cli-veredito', 'cli-veredito-topo', 'cli-veredito-ico', 'cli-veredito-txt', 'cli-pendencias', 'cli-pendencia', 'cli-tom-ok', 'cli-tom-warn', 'cli-tom-bad'], telas: ['c-cliente'], largo: true,
    uso: '<CartaoDoVeredito sobre="Outubro de 2026 · atualizado hoje, 07:30" tom="bad" titulo="Você tem 2 pendências" texto="1 guia vencida e 1 resposta do escritório." itens={[{ id, tom, icone, titulo, texto, rotulo, onAcao }]} />',
    demo: () => (
      <div className="cli-app cli-demo" style={{ display: 'grid', gap: 16, width: '100%' }}>
        <CartaoDoVeredito sobre="Outubro de 2026 · atualizado hoje, 07:30" tom="ok" titulo="Tudo em dia" texto="Nada pendente com você. A próxima guia, do FGTS, vence em 20/10." itens={[]} />
        <CartaoDoVeredito sobre="Outubro de 2026 · atualizado hoje, 07:30" tom="bad" titulo="Você tem 2 pendências" texto="1 guia vencida e 1 resposta do escritório." itens={[
          { id: 'g', tom: 'bad', icone: 'recibo', titulo: 'O DAS venceu em 12/10', texto: 'R$ 1.284,37. Se ainda não pagou, peça uma guia nova: a vencida não passa no banco.', rotulo: 'Pedir guia nova', onAcao: nada },
          { id: 'c', tom: 'warn', icone: 'mensagem', titulo: 'O escritório respondeu', texto: 'Certidão negativa estadual', rotulo: 'Ver resposta', onAcao: nada },
        ]} />
      </div>
    ) },
  { id: 'resumo-pagamento', tipo: 'cartoes', nome: 'Resumo do pagamento (Área do Cliente)', descricao: 'No alto do cartão "Guias a pagar" da Visão geral ("melhora mais" de 17/10/2026, como o assistente de pagamentos da "Visão do Cliente" do Omie): quanto falta pagar, o próximo vencimento com quantos dias faltam e, quando o escritório sabe, o já pago no mês; os números grandes e tabulares numa faixa de fundo suave. Some quando não tem guia por vencer. Embaixo da lista, a dica de como pagar (cli-como-pagar)', componente: 'ResumoDoPagamento', classes: ['cli-pagar', 'cli-pagar-valor', 'cli-como-pagar'], telas: ['c-cliente'], largo: true,
    uso: '<ResumoDoPagamento aPagar={1349.52} quantas={2} proximo="20/10" faltam="em 3 dias" pago={{ valor: 1250, quantas: 1 }} />',
    demo: () => (
      <div className="cli-app cli-demo" style={{ width: '100%' }}>
        <ResumoDoPagamento aPagar={1349.52} quantas={2} proximo="20/10" faltam="em 3 dias" pago={{ valor: 1250, quantas: 1 }} />
        <p className="cli-como-pagar"><Icone nome="ajuda" width={16} height={16} />Baixe o PDF e pague no app do seu banco até o vencimento.</p>
      </div>
    ) },
  { id: 'linha-atividade', tipo: 'listas', nome: 'Atividade recente (Área do Cliente)', descricao: 'A linha do tempo da Visão geral ("melhora mais" de 17/10/2026): o ícone no círculo suave ligado ao de baixo por um fio fino (a resposta do escritório em carmim suave, o que o escritório concluiu em verde, o resto neutro), o que aconteceu, o detalhe embaixo (o arquivo, o chamado; quebra a linha, nunca corta) e quando à direita ("hoje, 09:12", "ontem", "11/10"). A resposta abre a conversa. Some quando não tem nada', componente: 'LinhaDaAtividade', classes: ['cli-atividades', 'cli-atividade', 'cli-ativ-linha', 'cli-ativ-ico', 'cli-ativ-quando'], telas: ['c-cliente'], largo: true,
    demo: () => (
      <div className="cli-app cli-demo" style={{ width: '100%' }}><ul className="cli-lista cli-atividades">
        <LinhaDaAtividade origem="resposta" titulo="O escritório respondeu" texto="Certidão negativa estadual" quando="hoje, 09:40" onAbrir={nada} />
        <LinhaDaAtividade origem="chamado" titulo="Você abriu um chamado" texto="Certidão negativa estadual" quando="ontem, 10:05" onAbrir={nada} />
        <LinhaDaAtividade origem="feito" titulo="DCTFWeb (declaração da folha)" texto="Concluído pelo escritório" quando="12/10" />
        <LinhaDaAtividade origem="envio" titulo="Recebemos seu arquivo" texto="extrato-banco-do-brasil-setembro.pdf" quando="11/10" />
      </ul></div>
    ) },
  { id: 'cartao-atendimento', tipo: 'cartoes', nome: 'Cartão de atendimento (Área do Cliente)', descricao: 'Na Visão geral da Área do Cliente (polida de 17/10/2026, Vitor: "dê uma polida na tela de clientes"): o N da Nilma com "Seu atendimento" e o nome da equipe; o horário só quando o escritório tem; cada contato numa linha que já faz a ação, com o ícone num círculo suave, o rótulo pequeno em cima e a seta — o WhatsApp abre a conversa, o e-mail abre o programa de e-mail, o telefone liga. Com o banco o robô grava só o WhatsApp e o e-mail: o cartão fica com as duas linhas, sem buraco', componente: 'CartaoDeAtendimento', classes: ['card', 'cli-atendimento', 'cli-pessoa', 'cli-horario', 'cli-contatos', 'cli-contato', 'cli-contato-ico', 'cli-contato-txt'], telas: ['c-cliente'], largo: true,
    uso: '<CartaoDeAtendimento contato={{ equipe, horario?, whatsapp?, email?, telefone? }} onWhatsapp={abrirConversa} />',
    demo: () => (
      <div className="cli-app cli-demo" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, width: '100%' }}>
        <div style={{ flex: '1 1 300px' }}><CartaoDeAtendimento contato={{ equipe: 'Nilma Contabilidade', whatsapp: '(38) 99999-0000', email: 'atendimento@nilma.example' }} onWhatsapp={nada} /></div>
        <div style={{ flex: '1 1 300px' }}><CartaoDeAtendimento contato={{ equipe: 'Equipe Nilma Contabilidade', horario: 'Segunda a sexta, das 8h às 18h', whatsapp: '(38) 99999-0000', email: 'atendimento@nilma.example', telefone: '(38) 3333-0000' }} onWhatsapp={nada} /></div>
      </div>
    ) },
  // Financeiro › Caixa e Plano de contas (19/10/2026: o Movimento de Caixa e o Plano de Contas do Toriba)
  { id: 'valor-do-caixa', tipo: 'tabelas', nome: 'Valor do caixa (entrada e saída)', descricao: 'Na lista do Caixa: a entrada em verde com +, a saída em vermelho com −, em negrito e com os dígitos alinhados', componente: 'ValorDoCaixa', classes: ['fin-valor', 'fin-valor-entrada', 'fin-valor-saida'], telas: ['t-fin-caixa'],
    uso: '<ValorDoCaixa valor={850} tipo="E" />',
    demo: () => (
      <div className="table-wrap" style={{ width: '100%' }}><table className="tabela-empresas cad-lista"><thead><tr><th>Descrição</th><th className="fin-direita">Valor</th></tr></thead><tbody>
        <tr><td>Honorários de setembro</td><td className="num fin-direita"><ValorDoCaixa valor={850} tipo="E" /></td></tr>
        <tr><td>Papel e toner</td><td className="num fin-direita"><ValorDoCaixa valor={212.9} tipo="S" /></td></tr>
      </tbody></table></div>
    ) },
  { id: 'contador-de-cedulas', tipo: 'cartoes', nome: 'Contagem de cédulas', descricao: 'Na janela "Contar cédulas" do Caixa: duas colunas, Cédulas (200 a 2) e Moedas (1 a 0,01), cada linha com o valor, a quantidade e o subtotal; o total geral fica no rodapé da janela', componente: 'ContadorDeCedulas', classes: ['fin-cedulas', 'fin-cedula', 'fin-cedulas-grupo', 'cedulas-total'], telas: ['t-fin-caixa'],
    uso: '<ContadorDeCedulas quantidades={{ "50": "2" }} onMudar={(valor, quantidade) => …} />',
    demo: () => <DemoDeCedulas /> },
  { id: 'arvore-do-plano', tipo: 'listas', nome: 'Árvore do plano de contas', descricao: 'No Plano de contas: cada conta recuada pelo nível, com a classificação, a descrição (em negrito se só agrupa), o tipo em selo e "Inativa" quando saiu de uso', componente: 'LinhaDoPlano', classes: ['fin-arvore', 'fin-conta', 'fin-conta-codigo', 'fin-conta-grupo', 'fin-conta-inativa'], telas: ['t-fin-plano'], largo: true,
    uso: '<LinhaDoPlano conta={conta} fundo={nivel - 1} aoAbrir={abrir} />',
    demo: () => (
      <div className="table-wrap" style={{ width: '100%' }}><ul className="fin-arvore">
        <LinhaDoPlano conta={{ id: 'a', codigo: '4', descricao: 'Receitas', tipo: 'RECEITA', nivel: 1, pai: null, ativo: true, movimentavel: false }} fundo={0} />
        <LinhaDoPlano conta={{ id: 'b', codigo: '4.1', descricao: 'Receitas operacionais', tipo: 'RECEITA', nivel: 2, pai: 'a', ativo: true, movimentavel: false }} fundo={1} />
        <LinhaDoPlano conta={{ id: 'c', codigo: '4.1.01', descricao: 'Honorários contábeis', tipo: 'RECEITA', nivel: 3, pai: 'b', ativo: true, movimentavel: true }} fundo={2} />
        <LinhaDoPlano conta={{ id: 'd', codigo: '4.1.02', descricao: 'Serviços avulsos', tipo: 'RECEITA', nivel: 3, pai: 'b', ativo: false, movimentavel: true }} fundo={2} />
      </ul></div>
    ) },
  { id: 'calculadora', tipo: 'cartoes', nome: 'Calculadora', descricao: 'Na janela "Calculadora" do Caixa (19/10/2026): a conta aberta em cima, o visor grande no jeito brasileiro (1.234,56) e as teclas em grade; as teclas do computador também valem', componente: 'Calculadora', classes: ['fin-calc', 'fin-calc-visor', 'fin-calc-teclas', 'fin-calc-tecla', 'fin-calc-op'], telas: ['t-fin-caixa'],
    uso: '<Calculadora estado={estado} aoTecla={tecla => …} />',
    demo: () => <DemoDaCalculadora /> },
  { id: 'filtro-de-tipo-do-caixa', tipo: 'abas', nome: 'Filtro Todos / Entradas / Saídas', descricao: 'No Caixa (19/10/2026): o seletor que filtra a lista pelo tipo do lançamento; os quatro números de cima não mudam', componente: 'Segmentado', classes: ['steps', 'step-pill'], telas: ['t-fin-caixa'],
    uso: "<Segmentado valor={tipo} opcoes={[{ valor: 'todos', rotulo: 'Todos' }, …]} onMudar={setTipo} />",
    demo: () => <Segmentado valor="E" opcoes={[{ valor: 'todos', rotulo: 'Todos' }, { valor: 'E', rotulo: 'Entradas' }, { valor: 'S', rotulo: 'Saídas' }]} onMudar={nada} /> },
  { id: 'valor-editavel', tipo: 'campos', nome: 'Valor editável na linha', descricao: 'Nos Honorários (19/10/2026): o valor do honorário se digita na própria linha da tabela; grava ao sair do campo ou no Enter, Esc desfaz; sem valor mostra "definir valor" na cor da marca', componente: 'ValorEditavel', classes: ['fin-valor-edita', 'fin-valor-edita-vazio'], telas: ['t-fin-honorarios'],
    uso: '<ValorEditavel valor={850} rotulo="Valor do honorário" aoSalvar={texto => …} />  ·  zeroVale: o zero é um valor e mostra 0,00 (a calculadora do Simples)',
    demo: () => <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}><ValorEditavel valor={850} rotulo="Valor com valor" aoSalvar={nada} /><ValorEditavel valor={0} rotulo="Valor sem valor" aoSalvar={nada} /></div> },
  { id: 'situacao-do-honorario', tipo: 'selos', nome: 'Situação do honorário', descricao: 'Nos Honorários: "Pago em dd/mm · forma" (verde) ou "Em aberto" (amarelo); não há vencimento, então nunca "atrasado"', classes: ['badge', 'badge-ok', 'badge-warn'], telas: ['t-fin-honorarios'],
    demo: () => <div style={{ display: 'flex', gap: 8 }}><span className="badge badge-ok">Pago em 05/10 · PIX</span><span className="badge badge-warn">Em aberto</span></div> },
  { id: 'selo-da-nfse-do-honorario', tipo: 'selos', nome: 'Selo da NFS-e e "Cobrado em" (Honorários)', descricao: 'Na coluna Situação dos Honorários (21/10/2026): a nota que já existe para o cliente no mês — "NFS-e 123" (verde), "NFS-e pedida" (cinza) ou "NFS-e recusada" (vermelho) — e, nos em aberto, o "Cobrado em dd/mm" ao lado', classes: ['badge', 'fin-selo', 'fin-cobrado'], telas: ['t-fin-honorarios'],
    demo: () => <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span className="badge badge-ok">Pago em 05/10 · PIX</span><span className="badge badge-ok fin-selo">NFS-e 123</span><span className="badge badge-warn">Em aberto</span><span className="badge badge-neutral fin-selo">NFS-e pedida</span><span className="badge badge-bad fin-selo">NFS-e recusada</span><span className="fraco fin-cobrado">Cobrado em 20/10</span></div> },
  { id: 'mensagem-de-cobranca', tipo: 'campos', nome: 'Mensagem de cobrança (texto editável)', descricao: 'Na janela Cobrar dos Honorários (21/10/2026): a mensagem pronta do modelo, que se pode mexer antes de abrir o WhatsApp ou copiar', classes: ['fin-cobranca-texto'], telas: ['t-fin-honorarios'],
    demo: () => <textarea className="fin-cobranca-texto" rows={4} readOnly aria-label="Exemplo" value="Olá, ALFA COMERCIO LTDA! Passando para lembrar do honorário contábil de 09/2026, no valor de R$ 850,00. Chave PIX: 11.222.333/0001-81. Qualquer dúvida, estamos à disposição. — Nilma Contabilidade" /> },
  // o selo suave no nads (19/10/2026): a prioridade do feedback do app
  { id: 'selo-suave-nads', tipo: 'selos', nome: 'Selo suave (nads)', descricao: 'O selo suave da Área do Cliente trazido para o nads (badge-suave): a pílula sem borda, com o pontinho e o fundo suave; a cor só pelo significado. Na prioridade do feedback do app (Vitor, 19/10/2026): vermelho Alta, amarelo Média, neutro Baixa', classes: ['badge badge-suave', 'badge-bad', 'badge-warn', 'badge-neutral', 'badge-ok'], telas: TAREFAS,
    demo: () => (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <span className="badge badge-suave badge-bad">Alta</span><span className="badge badge-suave badge-warn">Média</span><span className="badge badge-suave badge-neutral">Baixa</span>
      </div>
    ) },
  // o painel do robô (Vitor, 21/10/2026: "quero um painel para eu saber o que o robô está fazendo, arquivando e afins")
  { id: 'robo-cartao', tipo: 'cartoes', nome: 'Cartão do robô (Painel do robô)', descricao: 'Um por robô (o do PC e o da nuvem): o nome na faixa do topo com o selo suave da situação (Ligado verde, Atrasado amarelo, Desligado/Sem sinal vermelho), os dados em linhas (onde roda e a máquina, o último sinal, ligado desde, a versão do código, os módulos), o que está fazendo agora ("ocioso, esperando pedido" quando nada) e os módulos que não ligaram, com o motivo. Sem o painel publicado, o aviso para atualizar o robô', componente: 'CartaoDoRobo', classes: ['card robo-cartao', 'card-head', 'badge badge-suave', 'ent-dados', 'robo-cartao-agora', 'ag-conversa-linha', 'robo-cartao-modulos'], telas: ['a-robo', 'a-visao-geral'], largo: true,
    uso: "<CartaoDoRobo s={entregas.situacaoDoRobo('pc', batimento, sinalAntigo)} />",
    demo: () => {
      const d = docsDeExemplo();
      const agora = Date.now();
      return (
        <div className="robo-grade" style={{ width: '100%' }}>
          <CartaoDoRobo s={entregas.situacaoDoRobo('pc', d.pc, null, agora)} />
          <CartaoDoRobo s={entregas.situacaoDoRobo('vm', null, { em: new Date(agora - 40 * 60000).toISOString(), maquina: 'robo-nilma', desligadoEm: '' }, agora)} />
        </div>
      );
    } },
  { id: 'robo-linha-do-tempo', tipo: 'listas', nome: 'Linha do tempo do robô (Painel do robô)', descricao: 'Uma linha por coisa que o robô fez, a mais nova em cima: o que aconteceu em negrito, o detalhe e o robô embaixo (quebra a linha, nunca corta), o tipo num selo suave (o erro em vermelho, "Erro · FGTS") e quando à direita ("hoje, 09:12", "ontem, 18:02", "12/10, 07:00"). No celular, o selo e a hora descem para baixo do texto. Com os chips de filtro em cima (o tipo e "Só os erros")', componente: 'LinhaDoTempoDoRobo', classes: ['ent-linhas robo-linhas', 'robo-linha-texto', 'badge badge-suave', 'robo-quando'], telas: ['a-robo', 'a-visao-geral', 'a-banco'], largo: true,
    uso: '<LinhaDoTempoDoRobo itens={atividades} agora={Date.now()} />',
    demo: () => <div className="card" style={{ width: '100%', margin: 0 }}><LinhaDoTempoDoRobo itens={docsDeExemplo().atividades.slice(0, 5)} agora={Date.now()} /></div> },
  // o site do admin (21/10/2026)
  { id: 'saude-lista', tipo: 'listas', nome: 'Lista da saúde (ok / atenção / parado)', descricao: 'Uma linha por item: o ponto colorido (verde ok, âmbar atenção, vermelho parado, cinza sem informação), o rótulo, o texto e o detalhe embaixo (quebra a linha, nunca corta). Com o placar em cima ("Tudo funcionando" ou "N itens precisam de atenção"). Em Sistema e agentes (a saúde do sistema) e no site do admin (a saúde do banco)', componente: 'ListaDaSaude', classes: ['saude-lista', 'saude-ponto', 'saude-rotulo', 'saude-texto', 'cad-placar'], telas: ['a-sistema', 'a-visao-geral', 'a-banco'], largo: true,
    uso: '<ListaDaSaude itens={entregas.saudeDoBanco({ resumo, uso, sinais, filas, errosDaFila })} />',
    demo: () => {
      const agora = Date.now();
      const resumo = resumoDeExemplo(agora);
      const itens = entregas.saudeDoBanco({ resumo, uso: entregas.lerUsoDeHoje({ em: new Date(agora - 6e5).toISOString(), leituras: 38200, gravacoes: 1320, exclusoes: 240 }), sinais: [], filas: [], errosDaFila: [] }, agora);
      return <div className="card" style={{ width: '100%', margin: 0 }}><div className="cad-placar atencao"><span className="saude-ponto" aria-hidden="true" /><b>{itens.filter(i => i.tom === 'aviso' || i.tom === 'erro').length} itens precisam de atenção</b></div><ListaDaSaude itens={itens} /></div>;
    } },
  { id: 'admin-numero', tipo: 'cartoes', nome: 'Número do painel que abre a página (site do admin)', descricao: 'O número em painel colorido (painel-numero) como link: clicar abre a página dele (Robôs ligados → Robô, Feedbacks altos novos → Feedbacks). O tom segue a situação: verde tudo certo, âmbar atenção, laranja erro', classes: ['stat painel-numero admin-numero', 'admin-numeros', 'painel-ok', 'painel-aviso', 'painel-laranja'], telas: ['a-visao-geral', 'a-arquivador'], largo: true,
    demo: () => <div className="stat-grid dp-numeros admin-numeros" style={{ width: '100%' }}>{([['Robôs ligados', '2 de 2', 'ok', 'robo'], ['Erros em 24 h', '3', 'laranja', 'alert'], ['Filas atrasadas', '1', 'aviso', 'clock'], ['Feedbacks altos novos', '0', 'ok', 'mensagem']] as [string, string, string, NomeIcone][]).map(([r, v, tom, ic]) => <a key={r} href="#" onClick={e => e.preventDefault()} className={'stat painel-numero admin-numero painel-' + tom}><span className="painel-numero-icone" aria-hidden="true"><Icone nome={ic} width={16} height={16} /></span><p className="stat-label">{r}</p><p className="stat-value num">{v}</p></a>)}</div> },
];
