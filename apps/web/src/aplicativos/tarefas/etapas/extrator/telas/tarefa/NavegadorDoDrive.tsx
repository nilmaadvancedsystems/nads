// O navegador de pastas do "Selecionar no Drive" (Vitor, 17/11/2026: "quero sistemas de pastas e diretórios, tudo bonitinho"):
// abre na pasta do mês (EXTRATOS › 2026 › 09); as pastas primeiro, depois os arquivos; o caminho clicável em cima e o Voltar no
// canto superior esquerdo ("Voltar sempre lado esquerdo superior"). Clicou no arquivo, ele entra no extrato do mês.
import type { creditor } from '@nads/core';
import { BotaoFechar, classeDaJanela, formatoPeloNome, Icone, IconeDeArquivo } from '@nads/ui';

export interface NavegadorAberto { titulo: string; naRaiz: boolean; caminho: creditor.ItemDrive[]; conteudo: creditor.ItemDrive[] }

export function NavegadorDoDrive({ n, abrirPasta, voltar, escolher, fechar, irParaRaiz }: {
  n: NavegadorAberto; abrirPasta: (id: string) => void; voltar: () => void; escolher: (it: creditor.ItemDrive) => void; fechar: () => void; irParaRaiz: () => void;
}) {
  const quando = (m?: string) => (m ? new Date(m).toLocaleDateString('pt-BR') : '');
  const tamanho = (s?: number) => (s == null ? '' : s < 1024 * 1024 ? Math.max(1, Math.round(s / 1024)) + ' KB' : (s / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB');
  return (
    <div className="modal-overlay" role="presentation" onClick={fechar}>
      <div className={classeDaJanela({}) + ' drive-nav'} role="dialog" aria-modal="true" aria-labelledby="tituloNavDrive" onClick={e => e.stopPropagation()}>
        <div className="drive-nav-topo">
          <button type="button" className="btn btn-ghost btn-sm" disabled={n.naRaiz} onClick={voltar} aria-label="Voltar uma pasta"><Icone nome="chevronLeft" />Voltar</button>
          <h3 id="tituloNavDrive">Selecionar no Drive · {n.titulo}</h3>
          <BotaoFechar onClick={fechar} />
        </div>
        <nav className="drive-nav-caminho" aria-label="Caminho">
          <button type="button" className="drive-nav-migalha" onClick={irParaRaiz}><Icone nome="pasta" />Empresa</button>
          {n.caminho.map(p => (
            <span key={p.i} className="drive-nav-passo"><Icone nome="chevronRight" />
              <button type="button" className="drive-nav-migalha" onClick={() => abrirPasta(p.i)}>{p.n}</button>
            </span>
          ))}
        </nav>
        <div className="drive-nav-lista" role="list">
          {!n.conteudo.length && <p className="hint drive-nav-vazio">Pasta vazia.</p>}
          {n.conteudo.map(it => it.t === 'd' ? (
            <button key={it.i} type="button" role="listitem" className="drive-nav-item" onDoubleClick={() => abrirPasta(it.i)} onClick={() => abrirPasta(it.i)}>
              <span className="drive-nav-ico pasta"><Icone nome="pasta" /></span>
              <span className="drive-nav-nome">{it.n}</span>
              <span className="drive-nav-info"><Icone nome="chevronRight" /></span>
            </button>
          ) : (
            <button key={it.i} type="button" role="listitem" className="drive-nav-item arquivo" onClick={() => escolher(it)} title={'Importar ' + it.n + ' como o extrato do mês'}>
              <span className="drive-nav-ico"><IconeDeArquivo formato={formatoPeloNome(it.n) || 'PDF'} tamanho={26} /></span>
              <span className="drive-nav-nome">{it.n}</span>
              <span className="drive-nav-info hint">{[quando(it.m), tamanho(it.s)].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
