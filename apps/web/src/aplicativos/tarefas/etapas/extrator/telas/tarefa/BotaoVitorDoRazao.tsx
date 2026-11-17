// O robô do PC do Vitor no ⬆ do razão do banco (Vitor, 17/11/2026: "ao clicar nesse botao, desce as opcoes, importar do
// computador e o botao vitor"; "em todas as telas que tem esse botao, apos aprovarmos o robo de cada coisa"). O ComRoboDoRazao
// liga o pedido do razão da conta (useRazaoDaContaPeloRobo) e entrega ao botão de importar o item "Vitor" do menu; o
// MenuDeImportar é o ⬆ com as duas opções, para qualquer tela que ganhar o robô. Só para o dono do robô; os outros veem o ⬆ de sempre.
import { Icone, MenuSuspenso } from '@nads/ui';
import { useRef, type ReactNode } from 'react';
import { MarcaAlterdata } from '../../../conferencia/telas/importacao/partes/MarcaAlterdata';
import { useRazaoDaContaPeloRobo } from './useRazaoDaContaPeloRobo';
import { useDinamicoPeloRobo } from './useDinamicoPeloRobo';

/** O robô para o menu do ⬆: o nome no item, se está puxando e o pedir. */
export interface RoboDoImportar { rotulo: string; andando: boolean; pedir: () => void; titulo?: string; /** a barra (0 a 100) e o Cancelar */ pct?: number; cancelar?: () => void }

export function ComRoboDoRazao(p: { codigo: number | null; empresa: string; conta: string; meses: readonly string[]; importar: (f: File) => unknown; children: (robo: RoboDoImportar | undefined) => ReactNode }) {
  const r = useRazaoDaContaPeloRobo(p);
  const robo = r.disponivel ? { rotulo: r.rotulo, andando: r.andando, pct: r.pct, cancelar: r.cancelar, pedir: () => { void r.pedir(); }, titulo: 'Puxar o razão da conta ' + p.conta + ' do Alterdata' } : undefined;
  return (
    <>
      {p.children(robo)}
      {r.disponivel && r.erro && <span className="ext-neg imp-robo-erro-curto" title={r.erro}>{r.erro}</span>}
    </>
  );
}

/** O ⬆ com o menu: importar do computador ou pelo robô (a marca do Alterdata e o nome). Puxando: só a rodinha. */
export function MenuDeImportar({ titulo, aceitar, travado, onArquivos, robo, grande }: { titulo: string; aceitar: string; travado: boolean; onArquivos: (fs: File[]) => void; robo: RoboDoImportar; grande?: boolean }) {
  const arquivo = useRef<HTMLInputElement>(null);
  // puxando (17/11/2026, Vitor: "coloca a opção de cancelar... coloca uma barra de progresso tbm"): a barra e o ×
  if (robo.andando) {
    return (
      <span className="imp-robo-mini" title={'O robô de ' + robo.rotulo + ' está puxando ' + titulo}>
        <span className="imp-robo-barra"><span style={{ width: Math.max(6, robo.pct || 0) + '%' }} /></span>
        {robo.cancelar && <button type="button" className="icon-btn icon-btn-sm imp-btn" onClick={robo.cancelar} title="Cancelar: o robô para e volta o Alterdata ao ponto de antes" aria-label="Cancelar o robô"><Icone nome="x" /></button>}
      </span>
    );
  }
  return (
    <>
      <MenuSuspenso rotulo="" icone="upload" className={'icon-btn imp-btn' + (grande ? '' : ' icon-btn-sm') + (travado ? ' is-locked' : '')} semSeta direita dica={'Importar ' + titulo}
        conteudo={fechar => (
          <>
            <button type="button" className="popover-item" role="menuitem" disabled={travado} onClick={() => { fechar(); arquivo.current?.click(); }}>
              <Icone nome="upload" /><span className="popover-texto">Importar do computador</span>
            </button>
            <button type="button" className="popover-item" role="menuitem" disabled={travado} title={robo.titulo} onClick={() => { fechar(); robo.pedir(); }}>
              <MarcaAlterdata /><span className="popover-texto">{robo.rotulo}</span>
            </button>
          </>
        )} />
      <input ref={arquivo} type="file" multiple accept={aceitar} className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={ev => { const fs = Array.from(ev.target.files || []); ev.target.value = ''; onArquivos(fs); }} />
    </>
  );
}

/** O mesmo para o Balancete dinâmico do período (17/11/2026). */
export function ComRoboDoDinamico(p: { codigo: number | null; empresa: string; meses: readonly string[]; importar: (f: File) => unknown; children: (robo: RoboDoImportar | undefined) => ReactNode }) {
  const r = useDinamicoPeloRobo(p);
  const robo = r.disponivel ? { rotulo: r.rotulo, andando: r.andando, pct: r.pct, cancelar: r.cancelar, pedir: () => { void r.pedir(); }, titulo: 'Puxar o Balancete Dinâmico do período do Alterdata' } : undefined;
  return (
    <>
      {p.children(robo)}
      {r.disponivel && r.erro && <span className="ext-neg imp-robo-erro-curto" title={r.erro}>{r.erro}</span>}
    </>
  );
}
