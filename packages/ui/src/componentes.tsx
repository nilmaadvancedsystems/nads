// Peças pequenas da Conferência, com as mesmas classes do CSS original.
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icone, type NomeIcone } from './icones';

/** Aviso dentro de uma caixa (.alert). tom "ok" = verde. */
export function Alerta({ titulo, texto, tom, children, onFechar }: { titulo: string; texto?: ReactNode; tom?: 'ok'; children?: ReactNode; onFechar?: () => void }) {
  const estiloOk = tom === 'ok' ? { borderColor: 'var(--success)', background: 'var(--success-soft)', color: 'var(--success-ink)' } : undefined;
  return (
    <div className="alert" style={estiloOk}>
      <Icone nome={tom === 'ok' ? 'checkCircle' : 'alert'} />
      <div>
        <p className="alert-title">{titulo}</p>
        {texto != null && texto !== '' && <p className="alert-text">{texto}</p>}
        {children}
      </div>
      {onFechar && <button type="button" className="alert-x" title="Fechar" aria-label="Fechar" onClick={onFechar}>×</button>}
    </div>
  );
}

/**
 * Mensagem flutuante de importação: some sozinha em 3,7 s, tem ×, e fecha ao trocar de tela
 * (o componente sai da tela junto). id = o do CSS original (#planoMsg, #msgEnt, #msgSai, #msgPrest, #msgTom).
 */
export function MensagemFlutuante({ id, children, onFechar, chave }: { id: string; children: ReactNode | null; onFechar: () => void; chave: number }) {
  useEffect(() => {
    if (!children) return;
    const t = setTimeout(onFechar, 3700);
    return () => clearTimeout(t);
  }, [children, chave, onFechar]);
  return <div id={id} style={{ marginBottom: 16 }}>{children}</div>;
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
  return (
    <div className="steps" id={id}>
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
      <p className={'stat-value' + (cor ? ' cor-' + cor : '')} style={grande ? undefined : { fontSize: 16 }}>{valor}</p>
    </div>
  );
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

/** Estado local que volta ao valor inicial quando a chave muda (ex.: trocar de empresa). */
export function useEstadoPorChave<T>(chave: string, inicial: T): [T, (v: T | ((a: T) => T)) => void] {
  const [estado, setEstado] = useState<{ chave: string; v: T }>({ chave, v: inicial });
  const v = estado.chave === chave ? estado.v : inicial;
  const set = (x: T | ((a: T) => T)) => setEstado(s => ({ chave, v: typeof x === 'function' ? (x as (a: T) => T)(s.chave === chave ? s.v : inicial) : x }));
  return [v, set];
}

/** Campo "Escolher arquivos" (.file-picker) que aceita vários de uma vez; cada escolha soma à lista de quem chama. */
export function CampoArquivos({ id, onEscolher, aceitar, rotulo = 'Escolher arquivos' }: {
  id: string;
  onEscolher: (fs: File[]) => void;
  aceitar: string;
  rotulo?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <label className="file-picker" htmlFor={id}>
        <span><Icone nome="upload" /></span>
        <span className="file-picker-name">{rotulo}</span>
      </label>
      <input ref={input} type="file" id={id} accept={aceitar} multiple className="sr-only"
        onChange={ev => { const fs = Array.from(ev.target.files || []); if (input.current) input.current.value = ''; if (fs.length) onEscolher(fs); }} />
    </>
  );
}

/** Um item do MenuSuspenso. `marcado` (true/false) mostra a coluna do ✓, como os menus do GitHub. */
export type ItemMenu = { rotulo: ReactNode; icone?: NomeIcone; marcado?: boolean; dica?: ReactNode; desabilitado?: boolean; onClick: () => void } | 'separador';

/**
 * Botão com menu suspenso (.popover), como os do GitHub ("main ▾", "Code ▾"). A seta é sempre o triângulo
 * preenchido (padrão do app todo). Fecha ao escolher, ao clicar
 * fora e no Esc. Em vez de `itens`, pode receber `conteudo` (ex.: uma lista com busca), que ganha o `fechar`.
 */
export function MenuSuspenso({ rotulo, icone, titulo, dica, className = 'btn btn-outline', itens, conteudo, direita, largura }: {
  rotulo: ReactNode;
  icone?: NomeIcone;
  titulo?: string;
  dica?: string;
  className?: string;
  itens?: ItemMenu[];
  conteudo?: (fechar: () => void) => ReactNode;
  direita?: boolean;
  largura?: number;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [aberto]);
  const fechar = () => setAberto(false);
  const comMarca = itens?.some(i => i !== 'separador' && i.marcado !== undefined);
  return (
    <div className="popover-wrap" ref={ref}>
      <button type="button" className={className} title={dica} aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto(a => !a)}>
        {icone && <Icone nome={icone} />}{rotulo}<Icone nome="caretDown" className="menu-seta" />
      </button>
      {aberto && (
        <div className={'popover menu-pop' + (direita ? ' direita' : '')} role="menu" style={largura ? { width: largura } : undefined}>
          {titulo && <p className="popover-label">{titulo}</p>}
          {itens?.map((it, i) => it === 'separador' ? <hr key={i} className="popover-sep" /> : (
            <button key={i} type="button" className="popover-item" role="menuitem" disabled={it.desabilitado}
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
