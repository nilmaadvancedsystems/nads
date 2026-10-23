// Peças pequenas da Conferência, com as mesmas classes do CSS original.
import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { animate, cleanInlineStyles, spring, stagger } from 'animejs';
import { animacoesPedidas, useIndicador, useNumeroAnimado } from './animacao';
import { Icone, type NomeIcone } from './icones';

/** Quanto o alerta fica no topo (Vitor, 08/10/2026: "suma depois de 3 segundos"); com o mouse em cima, para. */
export const TEMPO_DO_ALERTA = 3000;

/**
 * O lugar dos alertas: a faixa acima do cabeçalho da Casca de fora (a da página toda: dentro da etapa, a ferramenta tem a
 * dela, no meio da página; Vitor, 13/10/2026: "ponta a ponta da página, no topo"); sem Casca, uma faixa fixa no alto.
 */
function faixaDosAlertas(): HTMLElement {
  const profundidade = (el: Element) => { let n = 0; for (let p = el.parentElement; p; p = p.parentElement) n++; return n; };
  const daCasca = Array.from(document.querySelectorAll<HTMLElement>('.alertas-topo')).filter(el => !el.classList.contains('alertas-soltos'))
    .sort((a, b) => profundidade(a) - profundidade(b))[0];
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
export function Alerta(p: { titulo: string; texto?: ReactNode; tom?: 'ok'; children?: ReactNode; onFechar?: () => void; naLinha?: boolean; pergunta?: boolean; className?: string }) {
  if (p.naLinha) return <CaixaDoAlerta {...p} />;
  return <AlertaNoTopo key={p.titulo + '|' + (typeof p.texto === 'string' || typeof p.texto === 'number' ? p.texto : '')} {...p} />;
}

function CaixaDoAlerta({ titulo, texto, tom, children, fechar, className }: { titulo: string; texto?: ReactNode; tom?: 'ok'; children?: ReactNode; fechar?: () => void; className?: string }) {
  return (
    <div className={'alert' + (tom === 'ok' ? ' alert-ok' : '') + (className ? ' ' + className : '')} role="status">
      <Icone nome={tom === 'ok' ? 'checkCircle' : 'alert'} />
      <div>
        {titulo && <p className="alert-title">{titulo}</p>}
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

/**
 * Campo "Escolher arquivo" (.file-picker) com × para tirar.
 * semCaixa: só o campo escondido, para a tela que desenha o próprio gatilho (um label com htmlFor={id}, um botão que chama
 * ref.current.click() ou a área de soltar); ele limpa a cada escolha, para dar para escolher o mesmo arquivo de novo
 * (revisão da UI, 16/10/2026: eram 25 <input type="file"> feitos à mão, cada um do seu jeito).
 */
export function CampoArquivo({ id, arquivo = null, onEscolher, onEscolherVarios, aceitar, oculto, abrirAgora, semCaixa, multiplo, semFoco, desabilitado, ref }: {
  id?: string;
  arquivo?: File | null;
  onEscolher?: (f: File | null) => void;
  /** com multiplo: todos os escolhidos (lista vazia se a pessoa cancelar) */
  onEscolherVarios?: (fs: File[]) => void;
  aceitar: string;
  oculto?: boolean;
  /** muda de valor → abre a janela de escolher arquivo (Reimportar) */
  abrirAgora?: number;
  semCaixa?: boolean;
  multiplo?: boolean;
  /** fora do Tab (o gatilho da tela é que recebe o foco) */
  semFoco?: boolean;
  desabilitado?: boolean;
  ref?: Ref<HTMLInputElement>;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (abrirAgora) input.current?.click(); }, [abrirAgora]);
  useEffect(() => { if (!arquivo && input.current && !semCaixa) input.current.value = ''; }, [arquivo, semCaixa]);
  const ligar = (el: HTMLInputElement | null) => {
    input.current = el;
    if (typeof ref === 'function') ref(el); else if (ref) (ref as { current: HTMLInputElement | null }).current = el;
  };
  const campo = (
    <input ref={ligar} type="file" id={id} accept={aceitar} multiple={multiplo} className="sr-only" disabled={desabilitado}
      tabIndex={semFoco ? -1 : undefined} aria-hidden={semFoco ? 'true' : undefined}
      onChange={ev => {
        const fs = Array.from(ev.target.files || []);
        if (semCaixa) ev.target.value = '';
        if (multiplo) onEscolherVarios?.(fs); else onEscolher?.(fs[0] || null);
      }} />
  );
  if (semCaixa) return campo;
  return (
    <>
      <label className={'file-picker' + (arquivo ? ' has-file' : '')} htmlFor={id} hidden={oculto}>
        <span><Icone nome="upload" /></span>
        <span className="file-picker-name">{arquivo ? arquivo.name : 'Escolher arquivo'}</span>
        {arquivo && (
          <button type="button" className="file-clear" title="Remover arquivo" aria-label={'Remover o arquivo ' + arquivo.name} onClick={ev => { ev.preventDefault(); ev.stopPropagation(); onEscolher?.(null); }}>×</button>
        )}
      </label>
      {campo}
    </>
  );
}

/** Seletor interno (.steps / .step-pill). Opção travada = apagada, clicar chama onTravada. */
export function Segmentado<T extends string>({ valor, opcoes, onMudar, id }: {
  valor: T;
  /** ponto: o pontinho vermelho de "falta configurar" (o texto vai na dica; Vitor, 08/10/2026) */
  opcoes: { valor: T; rotulo: string; oculta?: boolean; travada?: string | false; ponto?: string }[];
  onMudar: (v: T) => void;
  id?: string;
}) {
  // o fundo da opção escolhida desliza até ela (animejs, do jeito do app)
  const trilho = useIndicador<HTMLDivElement>('.step-pill[aria-current="true"]', [valor, opcoes.length], 'fundo');
  return (
    <div ref={trilho} className="steps com-indicador" id={id}>
      {opcoes.filter(o => !o.oculta).map(o => (
        <button key={o.valor} type="button" className={'step-pill' + (o.travada ? ' is-locked' : '')} aria-current={o.valor === valor ? 'true' : 'false'} aria-pressed={o.valor === valor}
          aria-disabled={o.travada ? 'true' : undefined} title={o.travada || o.ponto || undefined} onClick={() => onMudar(o.valor)}>
          {o.rotulo}{o.ponto && <span className="ponto-vermelho" aria-label={o.ponto} />}
        </button>
      ))}
    </div>
  );
}

/** Um número da faixa (.stat). */
/** sub: a linha de baixo, pequena (a comparação com o período anterior, a Variação; 23/10/2026) */
export function Stat({ rotulo, valor, cor, grande = true, sub }: { rotulo: string; valor: ReactNode; cor?: 'entrada' | 'saida'; grande?: boolean; sub?: ReactNode }) {
  return (
    <div className="stat">
      <p className="stat-label">{rotulo}</p>
      <p className={'stat-value' + (cor ? ' cor-' + cor : '')} style={grande ? undefined : { fontSize: 16 }}>
        {typeof valor === 'string' || typeof valor === 'number' ? <NumeroQueConta texto={String(valor)} /> : valor}
      </p>
      {sub != null && <div className="stat-comparacao">{sub}</div>}
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

/**
 * Chave Sim/Não (.toggle-switch). O texto em pt-BR ((revisão da UI, 18/10/2026): era "On/Off"); as duas palavras ficam uma em cima da
 * outra e só a da vez aparece, então a largura é sempre a da maior e a chave não pula ao trocar.
 */
export function Interruptor({ ligado, onMudar, rotulo }: { ligado: boolean; onMudar: () => void; rotulo: string }) {
  return (
    <button type="button" className="toggle-switch" role="switch" aria-checked={ligado} aria-label={rotulo} onClick={onMudar}>
      <span className="toggle-txt" aria-hidden="true"><span className={ligado ? undefined : 'toggle-txt-fora'}>Sim</span><span className={ligado ? 'toggle-txt-fora' : undefined}>Não</span></span>
      <span className="toggle-track"><span className="toggle-knob" /></span>
    </button>
  );
}

/**
 * Botão de ação que mostra spinner + texto no gerúndio enquanto trabalha. O `disabled` de quem chama vai por último junto
 * com o carregando (revisão da UI, 16/10/2026: o {...resto} vinha depois e um disabled={false} destravava o botão no meio
 * do trabalho, deixando o clique duplo mandar duas vezes).
 */
export function BotaoAcao({ carregando, textoCarregando, className = 'btn btn-primary', children, disabled, ...resto }: {
  carregando?: boolean; textoCarregando?: string; className?: string; children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={className} {...resto} disabled={carregando || disabled} aria-busy={carregando || undefined}>
      {carregando ? <><span className="btn-spinner" />{textoCarregando}</> : children}
    </button>
  );
}

/**
 * A dica (Vitor, 13/10/2026: "as explicações são desnecessárias ficarem aparecendo; um ícone de interrogação que, quando
 * passa o mouse, mostra"): o "?" ao lado do rótulo e o balão com o texto ao passar o mouse ou ao focar pelo teclado.
 * Perto da borda direita o balão abre para a esquerda (revisão da UI, 16/10/2026: no Cadastro › Sistema ele saía cortado
 * e a página ganhava rolagem de lado).
 */
export function Dica({ texto }: { texto: ReactNode }) {
  const [aEsquerda, setAEsquerda] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const medir = (el: HTMLElement | null) => { if (el) setAEsquerda(el.getBoundingClientRect().left + 336 > document.documentElement.clientWidth); };
  // já ao aparecer: o balão escondido também conta na largura da página
  useLayoutEffect(() => { medir(ref.current); }, []);
  return (
    <span ref={ref} className={'dica' + (aEsquerda ? ' a-esquerda' : '')} tabIndex={0} role="note" aria-label={typeof texto === 'string' ? texto : undefined}
      onMouseEnter={e => medir(e.currentTarget)} onFocus={e => medir(e.currentTarget)}>
      <Icone nome="ajuda" />
      <span className="dica-balao" role="tooltip">{texto}</span>
    </span>
  );
}

/**
 * As configurações no estilo do Notion (Vitor, 14/10/2026: "melhorando a parametrização no estilo do Notion"): a seção é
 * um título com uma linha fina embaixo; cada opção é uma linha solta (sem caixa) com o nome, a descrição curta em cinza e
 * o controle encostado à direita.
 */
export function ConfigSecao({ titulo, acao, children }: { titulo: ReactNode; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="cfg-secao">
      <div className="cfg-secao-topo"><h3>{titulo}</h3>{acao && <span className="cfg-secao-acao">{acao}</span>}</div>
      <div className="cfg-linhas">{children}</div>
    </section>
  );
}

export function ConfigLinha({ titulo, descricao, children, aviso }: { titulo: ReactNode; descricao?: ReactNode; children?: ReactNode; aviso?: ReactNode }) {
  return (
    <div className="cfg-linha">
      <div className="cfg-linha-texto">
        <span className="cfg-linha-titulo">{titulo}</span>
        {descricao && <span className="cfg-linha-desc">{descricao}</span>}
        {aviso && <span className="cfg-linha-aviso">{aviso}</span>}
      </div>
      {children != null && <div className="cfg-linha-controle">{children}</div>}
    </div>
  );
}

/**
 * O × de fechar janela, gaveta ou painel: uma peça só (revisão da UI, 16/10/2026: eram cinco desenhos, drawer-x, modal-x,
 * icon-btn-sm, btn-ghost cad-janela-x e gm-fechar). 32 px sem borda, o fundo aparece ao passar o mouse; sempre com nome.
 * canto: preso no canto de cima da janela (o .modal-x das janelas do meio).
 */
export function BotaoFechar({ onClick, rotulo = 'Fechar', canto, className, disabled, autoFocus, ref }: {
  onClick: () => void; rotulo?: string; canto?: boolean; className?: string; disabled?: boolean; autoFocus?: boolean; ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button ref={ref} type="button" className={'janela-x' + (canto ? ' modal-x' : '') + (className ? ' ' + className : '')} aria-label={rotulo} title={rotulo + ' (Esc)'}
      disabled={disabled} autoFocus={autoFocus} onClick={onClick}>
      <Icone nome="x" />
    </button>
  );
}

/**
 * O vazio do catálogo (.gh-blank): o ícone, o título e a explicação, no meio. compacto: dentro de cartões estreitos,
 * células e janelas pequenas (menos espaço, letra menor). Revisão da UI, 16/10/2026: eram ~40 <p class="empty"> soltos.
 */
export function Vazio({ titulo, texto, icone = 'search', compacto, children, onTentarDeNovo }: { titulo?: ReactNode; texto?: ReactNode; icone?: NomeIcone; compacto?: boolean; children?: ReactNode;
  /** o erro (revisão da UI, 18/10/2026: "erro com uma mensagem clara e um botão de tentar de novo") */
  onTentarDeNovo?: () => void }) {
  return (
    <div className={'gh-blank' + (compacto ? ' compacto' : '') + (onTentarDeNovo ? ' erro' : '')} role={onTentarDeNovo ? 'alert' : 'status'}>
      <Icone nome={icone} />
      {titulo != null && titulo !== '' && <h4>{titulo}</h4>}
      {texto != null && texto !== '' && <p>{texto}</p>}
      {(children || onTentarDeNovo) && <div className="gh-blank-acoes">{children}{onTentarDeNovo && <button type="button" className="btn btn-outline" onClick={onTentarDeNovo}><Icone nome="repeat" />Tentar de novo</button>}</div>}
    </div>
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
export function CampoArquivos({ id, onEscolher, aceitar, rotulo = 'Escolher arquivos', compacto, desabilitado, camera }: {
  id: string;
  onEscolher: (fs: File[]) => void;
  aceitar: string;
  rotulo?: string;
  /** só o ícone de importar no lugar da caixa tracejada (listas); o rótulo vira a dica (Vitor, 02/10/2026) */
  compacto?: boolean;
  desabilitado?: boolean;
  /** a foto da entrega (16/10/2026, como o Entregas): um arquivo só, e no celular abre a câmera de trás */
  camera?: boolean;
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
          <span><Icone nome={camera ? 'camera' : 'upload'} /></span>
          <span className="file-picker-name">{rotulo}</span>
        </label>
      )}
      <input ref={input} type="file" id={id} accept={aceitar} multiple={!camera} capture={camera ? 'environment' : undefined} className="sr-only" disabled={desabilitado}
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
export function MenuSuspenso({ rotulo, icone, titulo, dica, className = 'btn btn-outline', classeAberto, itens, conteudo, direita, acima, largura, setaAntes, semSeta, animado, flutuante }: {
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
  /** abre com mola e os itens em cascata (animejs; 14/10/2026: o menu do avatar, "do clique ao perfil") */
  animado?: boolean;
  /**
   * o menu abre por cima da página, fixo na tela e fora da caixa que rola ((revisão da UI, 18/10/2026): no celular, o do comprovante do
   * Mandei saía cortado dentro da tabela). Acompanha o botão ao rolar; perto da borda de baixo, abre para cima.
   */
  flutuante?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const [lugar, setLugar] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  useLayoutEffect(() => {
    if (!aberto || !flutuante) { setLugar(null); return; }
    const medir = () => {
      const b = botao.current?.getBoundingClientRect(); if (!b) return;
      const w = Math.min(largura || pop.current?.offsetWidth || 200, window.innerWidth - 16);
      const h = pop.current?.offsetHeight || 0;
      const left = Math.max(8, Math.min(direita ? b.right - w : b.left, window.innerWidth - w - 8));
      const cabeEmbaixo = b.bottom + 4 + h <= window.innerHeight - 8;
      setLugar(acima || !cabeEmbaixo ? { left, bottom: window.innerHeight - b.top + 4 } : { left, top: b.bottom + 4 });
    };
    medir();
    window.addEventListener('scroll', medir, true);
    window.addEventListener('resize', medir);
    return () => { window.removeEventListener('scroll', medir, true); window.removeEventListener('resize', medir); };
  }, [aberto, flutuante, direita, acima, largura]);
  useLayoutEffect(() => {
    const el = pop.current;
    if (!aberto || !animado || !el || !animacoesPedidas()) return;
    // terminou: tira o estilo que ficou (o animador global não mexe neste menu: data-entrada-propria, abaixo)
    animate(el, { opacity: [0, 1], scale: [0.9, 1], translateY: [-6, 0], ease: spring({ bounce: 0.3, duration: 380 }), onComplete: a => { cleanInlineStyles(a); } });
    animate(el.querySelectorAll('.popover-item, .popover-sep'), { opacity: [0, 1], translateX: [direita ? 8 : -8, 0], duration: 300, delay: stagger(35, { start: 60 }), ease: 'outQuint', onComplete: a => { cleanInlineStyles(a); } });
  }, [aberto, animado, direita]);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { const t = e.target as Node; if (ref.current && !ref.current.contains(t) && !pop.current?.contains(t)) setAberto(false); };
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
      <button ref={botao} type="button" className={className + (aberto && classeAberto ? ' ' + classeAberto : '')} title={dica} aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto(a => !a)}
        // só o ícone (sem rótulo): o nome vem do título ou da dica (revisão da UI, 16/10/2026: o leitor de tela não tinha o que ler)
        aria-label={rotulo === '' || rotulo == null ? titulo || dica : undefined}>
        {setaAntes && !semSeta && <Icone nome="caretDown" className="menu-seta antes" />}
        {icone && <Icone nome={icone} />}{rotulo}
        {!setaAntes && !semSeta && <Icone nome="caretDown" className="menu-seta" />}
      </button>
      {aberto && (() => {
        const menu = (
        <div ref={pop} className={'popover menu-pop' + (direita ? ' direita' : '') + (acima ? ' acima' : '') + (animado ? ' animado' : '') + (flutuante ? ' flutuante' : '')} data-entrada-propria={animado ? '' : undefined} role="menu" aria-label={titulo}
          style={{ ...(largura ? { width: largura } : {}), ...(flutuante ? { position: 'fixed', right: 'auto', left: lugar?.left ?? -9999, top: lugar?.top ?? 'auto', bottom: lugar?.bottom ?? 'auto', visibility: lugar ? undefined : 'hidden' } : {}) }}>
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
        );
        return flutuante ? createPortal(menu, document.body) : menu;
      })()}
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

/** O quadro da assinatura pronto para desenhar (no tamanho da tela e com o traço do Entregas). */
function quadroDaAssinatura(c: HTMLCanvasElement | null, altura: number) {
  const ctx = c?.getContext('2d');
  if (!c || !ctx) return null;
  const escala = window.devicePixelRatio || 1;
  // o tamanho de verdade na tela (dentro da borda): o desenho não estica
  const largura = c.clientWidth || 320;
  const alto = c.clientHeight || altura;
  if (c.width !== Math.round(largura * escala) || c.height !== Math.round(alto * escala)) {
    c.width = Math.round(largura * escala);
    c.height = Math.round(alto * escala);
  }
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#16211E';
  return { ctx, largura, alto };
}
function limparAssinatura(c: HTMLCanvasElement | null, altura: number) {
  const q = quadroDaAssinatura(c, altura);
  if (!q) return;
  q.ctx.fillStyle = '#FFFFFF';
  q.ctx.fillRect(0, 0, q.largura, q.alto);
}

/**
 * A assinatura com o dedo, a caneta ou o mouse (16/10/2026, a entrega de documentos no nads: "quero integrar no app … o
 * entregas"): o quadro branco (é papel: fica branco também no tema escuro), "Assine aqui" apagado no meio enquanto vazio, e
 * o Limpar. A cada traço devolve a imagem (PNG em data URL, fundo branco e traço escuro, como o Entregas grava); ao
 * limpar, null. Com `valor` vindo de fora (a assinatura já colhida), desenha ela.
 */
export function CampoAssinatura({ valor, onMudar, rotulo = 'Assinatura', altura: alturaNormal = 160, telaCheia, textoPronta = 'Assinatura colhida.' }: {
  valor: string | null; onMudar: (dataUrl: string | null) => void; rotulo?: string; altura?: number;
  /** o botão "Tela cheia" (16/10/2026, como o Entregas: o quadro ocupa a tela, em pé, sem girar o aparelho) */
  telaCheia?: boolean;
  /** o texto do estado com a assinatura (ex.: "Assinado no celular do cliente.") */
  textoPronta?: string;
}) {
  const quadro = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  /** o que este quadro devolveu por último (para não redesenhar a própria assinatura) */
  const devolvido = useRef<string | null | undefined>(undefined);
  const [vazio, setVazio] = useState(!valor);
  const [cheia, setCheia] = useState(false);
  // na tela cheia, o quadro vai até embaixo (sobra o espaço do estado e dos botões)
  const altura = cheia ? Math.max(320, Math.round((window.visualViewport?.height || window.innerHeight) - 130)) : alturaNormal;
  // trocou de tamanho: a assinatura que já estava é redesenhada no quadro novo (esticada, como o Entregas)
  useLayoutEffect(() => {
    const atual = devolvido.current;
    limparAssinatura(quadro.current, altura);
    if (!atual) return;
    const img = new Image();
    img.onload = () => { const q = quadroDaAssinatura(quadro.current, altura); if (q) q.ctx.drawImage(img, 0, 0, q.largura, q.alto); };
    img.src = atual;
  }, [altura]);

  // a assinatura de fora (ou o "limpar" de fora): redesenha só quando o valor não é o que este quadro acabou de devolver
  useEffect(() => {
    if (valor === devolvido.current) return;
    devolvido.current = valor;
    limparAssinatura(quadro.current, altura);
    setVazio(!valor);
    if (!valor) return;
    const img = new Image();
    img.onload = () => { const q = quadroDaAssinatura(quadro.current, altura); if (q) q.ctx.drawImage(img, 0, 0, q.largura, q.alto); };
    img.src = valor;
  }, [valor, altura]);

  const ponto = (ev: { clientX: number; clientY: number; currentTarget: HTMLCanvasElement }) => {
    const r = ev.currentTarget.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  return (
    <div className={'assinatura' + (cheia ? ' assinatura-cheia' : '')}>
      <div className="assinatura-quadro" style={{ height: altura }}>
        <canvas ref={quadro} aria-label={rotulo} role="img"
          onPointerDown={ev => {
            const q = quadroDaAssinatura(quadro.current, altura);
            if (!q) return;
            ev.currentTarget.setPointerCapture(ev.pointerId);
            desenhando.current = true;
            const { x, y } = ponto(ev);
            q.ctx.beginPath();
            q.ctx.moveTo(x, y);
            q.ctx.lineTo(x + 0.1, y + 0.1);
            q.ctx.stroke();
            setVazio(false);
          }}
          onPointerMove={ev => {
            if (!desenhando.current) return;
            const ctx = quadro.current?.getContext('2d');
            if (!ctx) return;
            const { x, y } = ponto(ev);
            ctx.lineTo(x, y);
            ctx.stroke();
          }}
          onPointerUp={() => {
            if (!desenhando.current) return;
            desenhando.current = false;
            const url = quadro.current?.toDataURL('image/png') || null;
            devolvido.current = url;
            onMudar(url);
          }}
          onPointerCancel={() => { desenhando.current = false; }} />
        {vazio && <span className="assinatura-vazia" aria-hidden="true"><Icone nome="lapis" />Assine aqui</span>}
      </div>
      <div className="assinatura-pe">
        <span className={'assinatura-status' + (vazio ? '' : ' ok')}>{vazio ? 'Sem assinatura ainda.' : <><Icone nome="checkCircle" />{textoPronta}</>}</span>
        {telaCheia && (
          <button type="button" className="btn btn-ghost" onClick={() => setCheia(c => !c)}>
            <Icone nome={cheia ? 'minimizar' : 'maximizar'} />{cheia ? 'Sair da tela cheia' : 'Tela cheia'}
          </button>
        )}
        <button type="button" className="btn btn-ghost" disabled={vazio}
          onClick={() => { devolvido.current = null; limparAssinatura(quadro.current, altura); setVazio(true); onMudar(null); }}>
          <Icone nome="x" />Limpar
        </button>
      </div>
    </div>
  );
}
