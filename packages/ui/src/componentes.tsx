// Peças pequenas da Conferência, com as mesmas classes do CSS original.
import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useIndicador, useNumeroAnimado } from './animacao';
import { Icone, type NomeIcone } from './icones';

/** Quanto o alerta fica no topo (Vitor, 08/10/2026: "suma depois de 3 segundos"); com o mouse em cima, para. */
export const TEMPO_DO_ALERTA = 3000;

/** O lugar dos alertas: a faixa acima do cabeçalho da Casca; sem ela, uma faixa fixa no alto da página. */
function faixaDosAlertas(): HTMLElement {
  const daCasca = document.getElementById('alertas-topo');
  if (daCasca) return daCasca;
  let solta = document.getElementById('alertas-soltos');
  if (!solta) {
    solta = document.createElement('div');
    solta.id = 'alertas-soltos';
    solta.className = 'acima-do-cabecalho alertas-soltos';
    solta.setAttribute('aria-live', 'polite');
    document.body.appendChild(solta);
  }
  return solta;
}

/**
 * Aviso numa caixa (.alert); tom "ok" = verde. Desde 08/10/2026 (Vitor: "mude esses avisos tudo para o topo da página,
 * acima do cabeçalho, e suma depois de 3 segundos ou um x no final para o usuário fechar, faça uma animação de entrada";
 * "uma barra que ocupe toda a parte superior do cabeçalho, que use apenas uma linha"): vira a faixa de ponta a ponta acima
 * do cabeçalho, numa linha e sem o ícone, entra descendo, some em 3 s (o mouse em cima segura) ou no ×; quando some, chama
 * o onFechar.
 * Aparece de novo quando o título ou o texto mudam, ou quando a tela abre outra vez. naLinha: na própria tela (o catálogo).
 * A pergunta (pergunta, ou o título que acaba em "?") não some nem tem ×: fica até a pessoa responder (Vitor, 08/10/2026).
 */
export function Alerta(p: { titulo: string; texto?: ReactNode; tom?: 'ok'; children?: ReactNode; onFechar?: () => void; naLinha?: boolean; pergunta?: boolean }) {
  if (p.naLinha) return <CaixaDoAlerta {...p} />;
  return <AlertaNoTopo key={p.titulo + '|' + (typeof p.texto === 'string' || typeof p.texto === 'number' ? p.texto : '')} {...p} />;
}

function CaixaDoAlerta({ titulo, texto, tom, children, fechar }: { titulo: string; texto?: ReactNode; tom?: 'ok'; children?: ReactNode; fechar?: () => void }) {
  return (
    <div className={'alert' + (tom === 'ok' ? ' alert-ok' : '')} role="status">
      <Icone nome={tom === 'ok' ? 'checkCircle' : 'alert'} />
      <div>
        <p className="alert-title">{titulo}</p>
        {texto != null && texto !== '' && <p className="alert-text">{texto}</p>}
        {children}
      </div>
      {fechar && <button type="button" className="alert-x" title="Fechar" aria-label="Fechar" onClick={fechar}>×</button>}
    </div>
  );
}

function AlertaNoTopo({ titulo, texto, tom, children, onFechar, pergunta }: { titulo: string; texto?: ReactNode; tom?: 'ok'; children?: ReactNode; onFechar?: () => void; pergunta?: boolean }) {
  const fica = pergunta ?? /\?\s*$/.test(titulo);
  const [fase, setFase] = useState<'aberto' | 'saindo' | 'fechado'>('aberto');
  // o lugar depois de montar (no primeiro desenho a Casca ainda não está na página)
  const [alvo, setAlvo] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => { setAlvo(faixaDosAlertas()); }, []);
  const [segura, setSegura] = useState(false);
  const aoFechar = useRef(onFechar);
  useEffect(() => { aoFechar.current = onFechar; });
  // 3 s e sai (o mouse em cima segura; ao tirar, conta de novo)
  useEffect(() => {
    if (fase !== 'aberto' || segura || fica) return;
    const t = setTimeout(() => setFase('saindo'), TEMPO_DO_ALERTA);
    return () => clearTimeout(t);
  }, [fase, segura, fica]);
  // a saída (sobe e apaga, 200 ms) e só então some da tela
  useEffect(() => {
    if (fase !== 'saindo') return;
    const t = setTimeout(() => { setFase('fechado'); aoFechar.current?.(); }, 200);
    return () => clearTimeout(t);
  }, [fase]);
  if (fase === 'fechado' || !alvo) return null;
  return createPortal(
    <div className={'alerta-linha alerta-no-topo' + (fase === 'saindo' ? ' saindo' : '')} onMouseEnter={() => setSegura(true)} onMouseLeave={() => setSegura(false)}>
      <CaixaDoAlerta titulo={titulo} texto={texto} tom={tom} fechar={fica ? undefined : () => setFase('saindo')}>{children}</CaixaDoAlerta>
    </div>,
    alvo,
  );
}

/**
 * Mensagem flutuante de importação: some sozinha em 3,7 s, tem ×, e fecha ao trocar de tela
 * (o componente sai da tela junto). id = o do CSS original (#planoMsg, #msgEnt, #msgSai, #msgPrest, #msgTom).
 */
export function MensagemFlutuante({ id, children, onFechar, chave, duracao = 3700, className }: {
  id: string; children: ReactNode | null; onFechar: () => void; chave: number;
  /** em ms; null = só fecha no × */
  duracao?: number | null;
  className?: string;
}) {
  useEffect(() => {
    if (!children || duracao === null) return;
    const t = setTimeout(onFechar, duracao);
    return () => clearTimeout(t);
  }, [children, chave, onFechar, duracao]);
  return <div id={id} className={className} style={className ? undefined : { marginBottom: 16 }}>{children}</div>;
}

/** Campo "Escolher arquivo" (.file-picker) com × para tirar. */
export function CampoArquivo({ id, arquivo, onEscolher, aceitar, oculto, abrirAgora }: {
  id: string;
  arquivo: File | null;
  onEscolher: (f: File | null) => void;
  aceitar: string;
  oculto?: boolean;
  /** muda de valor → abre a janela de escolher arquivo (Reimportar) */
  abrirAgora?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (abrirAgora) input.current?.click(); }, [abrirAgora]);
  useEffect(() => { if (!arquivo && input.current) input.current.value = ''; }, [arquivo]);
  return (
    <>
      <label className={'file-picker' + (arquivo ? ' has-file' : '')} htmlFor={id} hidden={oculto}>
        <span><Icone nome="upload" /></span>
        <span className="file-picker-name">{arquivo ? arquivo.name : 'Escolher arquivo'}</span>
        {arquivo && (
          <button type="button" className="file-clear" title="Remover arquivo" onClick={ev => { ev.preventDefault(); ev.stopPropagation(); onEscolher(null); }}>×</button>
        )}
      </label>
      <input ref={input} type="file" id={id} accept={aceitar} className="sr-only" onChange={ev => onEscolher(ev.target.files?.[0] || null)} />
    </>
  );
}

/** Seletor interno (.steps / .step-pill). Opção travada = apagada, clicar chama onTravada. */
export function Segmentado<T extends string>({ valor, opcoes, onMudar, id }: {
  valor: T;
  opcoes: { valor: T; rotulo: string; oculta?: boolean; travada?: string | false }[];
  onMudar: (v: T) => void;
  id?: string;
}) {
  // o fundo da opção escolhida desliza até ela (animejs, do jeito do app)
  const trilho = useIndicador<HTMLDivElement>('.step-pill[aria-current="true"]', [valor, opcoes.length], 'fundo');
  return (
    <div ref={trilho} className="steps com-indicador" id={id}>
      {opcoes.filter(o => !o.oculta).map(o => (
        <button key={o.valor} type="button" className={'step-pill' + (o.travada ? ' is-locked' : '')} aria-current={o.valor === valor ? 'true' : 'false'}
          aria-disabled={o.travada ? 'true' : undefined} title={o.travada || undefined} onClick={() => onMudar(o.valor)}>
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Um número da faixa (.stat). */
export function Stat({ rotulo, valor, cor, grande = true }: { rotulo: string; valor: ReactNode; cor?: 'entrada' | 'saida'; grande?: boolean }) {
  return (
    <div className="stat">
      <p className="stat-label">{rotulo}</p>
      <p className={'stat-value' + (cor ? ' cor-' + cor : '')} style={grande ? undefined : { fontSize: 16 }}>
        {typeof valor === 'string' || typeof valor === 'number' ? <NumeroQueConta texto={String(valor)} /> : valor}
      </p>
    </div>
  );
}

/**
 * Esqueleto de carregamento: o desenho do que vai chegar (linhas, ou os cartões dos números), em cinza, com um brilho
 * que passa — no lugar de "Lendo…" ou da tela vazia. Menos movimento: fica parado.
 */
export function Esqueleto({ linhas = 3, numeros = 0, className }: { linhas?: number; numeros?: number; className?: string }) {
  const larguras = [92, 74, 84, 58, 68];
  return (
    <div className={'esqueleto' + (className ? ' ' + className : '')} role="status" aria-label="Carregando">
      {numeros > 0 && (
        <div className="esqueleto-numeros">
          {Array.from({ length: numeros }, (_, i) => <span key={i} className="esqueleto-cartao"><span className="esqueleto-linha" style={{ width: '50%' }} /><span className="esqueleto-linha grande" style={{ width: '35%' }} /></span>)}
        </div>
      )}
      {Array.from({ length: linhas }, (_, i) => <span key={i} className="esqueleto-linha" style={{ width: larguras[i % larguras.length] + '%' }} />)}
    </div>
  );
}

/** Um número que conta até o valor quando aparece e quando muda (texto que não é número fica como está). */
export function NumeroQueConta({ texto }: { texto: string }) {
  const ref = useNumeroAnimado(texto);
  return <span ref={ref} className="numero-que-conta" />;
}

/** Chave On/Off (.toggle-switch). */
export function Interruptor({ ligado, onMudar, rotulo }: { ligado: boolean; onMudar: () => void; rotulo: string }) {
  return (
    <button type="button" className="toggle-switch" role="switch" aria-checked={ligado} aria-label={rotulo} onClick={onMudar}>
      <span className="toggle-txt">{ligado ? 'On' : 'Off'}</span>
      <span className="toggle-track"><span className="toggle-knob" /></span>
    </button>
  );
}

/** Botão de ação que mostra spinner + texto no gerúndio enquanto trabalha. */
export function BotaoAcao({ carregando, textoCarregando, className = 'btn btn-primary', children, ...resto }: {
  carregando?: boolean; textoCarregando?: string; className?: string; children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={className} disabled={carregando || resto.disabled} {...resto}>
      {carregando ? <><span className="btn-spinner" />{textoCarregando}</> : children}
    </button>
  );
}

/** Ícone clicável (.icon-btn). */
export function BotaoIcone({ icone, titulo, pequeno, className, ...resto }: { icone: NomeIcone; titulo: string; pequeno?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={'icon-btn' + (pequeno ? ' icon-btn-sm' : '') + (className ? ' ' + className : '')} title={titulo} aria-label={titulo} {...resto}>
      <Icone nome={icone} />
    </button>
  );
}

/** Campo de data dd/mm/aaaa com máscara. */
export function CampoData({ valor, onMudar, rotulo, id, onEnter }: { valor: string; onMudar: (v: string) => void; rotulo: string; id?: string; onEnter?: () => void }) {
  return (
    <input type="text" className="data-mask" id={id} value={valor} placeholder="dd/mm/aaaa" inputMode="numeric" maxLength={10} aria-label={rotulo}
      onChange={ev => {
        let v = ev.target.value.replace(/\D/g, '').slice(0, 8);
        if (v.length > 4) v = v.slice(0, 2) + '/' + v.slice(2, 4) + '/' + v.slice(4);
        else if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
        onMudar(v);
      }}
      onKeyDown={ev => { if (ev.key === 'Enter' && onEnter) onEnter(); }} />
  );
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/**
 * Escolha de mês ("AAAA-MM"), no lugar do <input type="month"> do navegador (que no tema escuro fica
 * cinza e sem jeito): ‹ e › andam um mês; o meio mostra "Agosto de 2026" e abre a grade dos 12 meses,
 * com o ano ao lado. Mês depois de `max` fica travado.
 */
export function SeletorMes({ valor, onMudar, id, rotulo, max }: { valor: string; onMudar: (v: string) => void; id?: string; rotulo: string; max?: string }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const m = /^(\d{4})-(\d{2})$/.exec(valor);
  const ano = m ? Number(m[1]) : new Date().getFullYear();
  const mes = m ? Number(m[2]) : new Date().getMonth() + 1;
  const [anoGrade, setAnoGrade] = useState(ano);
  const chave = (a: number, n: number) => a + '-' + String(n).padStart(2, '0');
  const passou = (v: string) => !!max && v > max;
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    // clicou na ferramenta da etapa (outra página, num iframe): o clique não chega aqui, mas esta janela perde o foco
    // (Vitor, 02/10/2026: "quando clicar na aplicação, ele sai, sem precisar clicar no botão de novo")
    const saiu = () => setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    window.addEventListener('blur', saiu);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); window.removeEventListener('blur', saiu); };
  }, [aberto]);
  return (
    <div className="seletor-mes popover-wrap" ref={ref}>
      {/* sem as setas dos lados (Vitor, 02/10/2026): o mês se escolhe abrindo o seletor */}
      <button type="button" id={id} className="btn btn-outline seletor-mes-atual" aria-label={rotulo + ': ' + MESES[mes - 1] + ' de ' + ano} aria-haspopup="dialog" aria-expanded={aberto}
        onClick={() => { setAnoGrade(ano); setAberto(a => !a); }}>
        <Icone nome="calendar" /><span>{MESES[mes - 1]} de {ano}</span><Icone nome="caretDown" className="menu-seta" />
      </button>
      {aberto && (
        <div className="popover seletor-mes-pop" role="dialog" aria-label={rotulo}>
          <div className="seletor-mes-ano">
            <button type="button" className="btn btn-ghost" aria-label="Ano anterior" onClick={() => setAnoGrade(a => a - 1)}><Icone nome="chevronLeft" /></button>
            <b>{anoGrade}</b>
            <button type="button" className="btn btn-ghost" aria-label="Próximo ano" disabled={passou(chave(anoGrade + 1, 1))} onClick={() => setAnoGrade(a => a + 1)}><Icone nome="chevronRight" /></button>
          </div>
          <div className="seletor-mes-grade">
            {MESES.map((nome, i) => {
              const v = chave(anoGrade, i + 1);
              return (
                <button key={nome} type="button" className={'seletor-mes-item' + (v === valor ? ' active' : '')} aria-pressed={v === valor} disabled={passou(v)}
                  onClick={() => { onMudar(v); setAberto(false); }}>
                  {nome.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Estado local que volta ao valor inicial quando a chave muda (ex.: trocar de empresa). */
export function useEstadoPorChave<T>(chave: string, inicial: T): [T, (v: T | ((a: T) => T)) => void] {
  const [estado, setEstado] = useState<{ chave: string; v: T }>({ chave, v: inicial });
  const v = estado.chave === chave ? estado.v : inicial;
  const set = (x: T | ((a: T) => T)) => setEstado(s => ({ chave, v: typeof x === 'function' ? (x as (a: T) => T)(s.chave === chave ? s.v : inicial) : x }));
  return [v, set];
}

/** Campo "Escolher arquivos" (.file-picker) que aceita vários de uma vez; cada escolha soma à lista de quem chama. */
export function CampoArquivos({ id, onEscolher, aceitar, rotulo = 'Escolher arquivos', compacto, desabilitado }: {
  id: string;
  onEscolher: (fs: File[]) => void;
  aceitar: string;
  rotulo?: string;
  /** só o ícone de importar no lugar da caixa tracejada (listas); o rótulo vira a dica (Vitor, 02/10/2026) */
  compacto?: boolean;
  desabilitado?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      {compacto ? (
        <label className={'icon-btn' + (desabilitado ? ' is-locked' : '')} htmlFor={id} title={rotulo} aria-label={rotulo} aria-disabled={desabilitado || undefined}>
          <Icone nome="upload" />
        </label>
      ) : (
        <label className="file-picker" htmlFor={id} aria-disabled={desabilitado || undefined}>
          <span><Icone nome="upload" /></span>
          <span className="file-picker-name">{rotulo}</span>
        </label>
      )}
      <input ref={input} type="file" id={id} accept={aceitar} multiple className="sr-only" disabled={desabilitado}
        onChange={ev => { const fs = Array.from(ev.target.files || []); if (input.current) input.current.value = ''; if (fs.length) onEscolher(fs); }} />
    </>
  );
}

/** Um item do MenuSuspenso. `marcado` (true/false) mostra a coluna do ✓, como os menus do GitHub. */
export type ItemMenu = { rotulo: ReactNode; icone?: NomeIcone; marcado?: boolean; dica?: ReactNode; desabilitado?: boolean; /** em vermelho (apagar, cancelar) */ perigo?: boolean; onClick: () => void } | 'separador';

/**
 * Botão com menu suspenso (.popover), como os do GitHub ("main ▾", "Code ▾"). A seta é sempre o triângulo
 * preenchido (padrão do app todo). Fecha ao escolher, ao clicar
 * fora e no Esc. Em vez de `itens`, pode receber `conteudo` (ex.: uma lista com busca), que ganha o `fechar`.
 */
export function MenuSuspenso({ rotulo, icone, titulo, dica, className = 'btn btn-outline', classeAberto, itens, conteudo, direita, acima, largura, setaAntes, semSeta }: {
  rotulo: ReactNode;
  icone?: NomeIcone;
  titulo?: string;
  dica?: string;
  className?: string;
  itens?: ItemMenu[];
  conteudo?: (fechar: () => void) => ReactNode;
  direita?: boolean;
  /** abre para cima (botão no pé da tela) */
  acima?: boolean;
  /** a setinha à esquerda do texto (no lugar do ícone), em vez de à direita */
  setaAntes?: boolean;
  /** sem a setinha: só o ícone (Vitor, 08/10/2026: o comprovante do Mandei) */
  semSeta?: boolean;
  /** classe a mais no botão enquanto o menu está aberto (ex.: apagar o botão de cima) */
  classeAberto?: string;
  largura?: number;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    // clicou na ferramenta da etapa (outra página, num iframe): o clique não chega aqui, mas esta janela perde o foco
    const saiu = () => setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    window.addEventListener('blur', saiu);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); window.removeEventListener('blur', saiu); };
  }, [aberto]);
  const fechar = () => setAberto(false);
  const comMarca = itens?.some(i => i !== 'separador' && i.marcado !== undefined);
  return (
    <div className="popover-wrap" ref={ref}>
      <button type="button" className={className + (aberto && classeAberto ? ' ' + classeAberto : '')} title={dica} aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto(a => !a)}>
        {setaAntes && !semSeta && <Icone nome="caretDown" className="menu-seta antes" />}
        {icone && <Icone nome={icone} />}{rotulo}
        {!setaAntes && !semSeta && <Icone nome="caretDown" className="menu-seta" />}
      </button>
      {aberto && (
        <div className={'popover menu-pop' + (direita ? ' direita' : '') + (acima ? ' acima' : '')} role="menu" aria-label={titulo} style={largura ? { width: largura } : undefined}>
          {/* sem título em cima (Vitor, 02/10/2026): o título fica só para o leitor de tela */}
          {itens?.map((it, i) => it === 'separador' ? <hr key={i} className="popover-sep" /> : (
            <button key={i} type="button" className={'popover-item' + (it.perigo ? ' perigo' : '')} role="menuitem" disabled={it.desabilitado}
              onClick={() => { fechar(); it.onClick(); }}>
              {comMarca && <span className="popover-marca">{it.marcado && <Icone nome="check" />}</span>}
              {it.icone && <Icone nome={it.icone} />}
              <span className="popover-texto">{it.rotulo}</span>
              {it.dica != null && <span className="popover-dica">{it.dica}</span>}
            </button>
          ))}
          {conteudo?.(fechar)}
        </div>
      )}
    </div>
  );
}

/**
 * O nome de uma conta na tabela: o código em negrito e o nome normal (Vitor, 02/10/2026), ex.: **81009** — Honorários
 * Contábeis; com várias contas ("81009 + 81010 — …"), cada código em negrito.
 */
export function TituloDaConta({ titulo }: { titulo: string }) {
  const partes = titulo.split(/(\b\d{4,6}\b)/);
  return <>{partes.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p))}</>;
}

/**
 * O nível da conta gov.br como medalha (Vitor, 07/10/2026: "os níveis como medalhas: P = prata, B = bronze, O = ouro"):
 * a moeda na cor do metal e o nome. Aceita a letra ou o nome; sem nível, o traço.
 */
export function MedalhaGov({ nivel }: { nivel: string }) {
  const n = nivel.trim().toUpperCase().charAt(0);
  const m = n === 'O' ? { classe: 'ouro', rotulo: 'Ouro' } : n === 'P' ? { classe: 'prata', rotulo: 'Prata' } : n === 'B' ? { classe: 'bronze', rotulo: 'Bronze' } : null;
  if (!m) return <span className="fraco">{nivel.trim() || '—'}</span>;
  return <span className={'medalha medalha-' + m.classe} title={'Nível ' + m.rotulo + ' (gov.br)'}><span className="medalha-moeda" aria-hidden="true">{m.rotulo.charAt(0)}</span>{m.rotulo}</span>;
}
