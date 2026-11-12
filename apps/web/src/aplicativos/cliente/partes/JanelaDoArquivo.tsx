// A pré-visualização de um arquivo da Área do Cliente (12/11/2026: "quero que a pessoa tenha uma pré-visualização"): a
// guia (ou o documento do DP) aberta numa janela grande, sem baixar, com o Baixar e o × no alto. PDF em imagens, uma por
// página (o celular não mostra PDF na página), ou no visualizador do navegador se o desenho falhar; imagem como imagem; o resto (a planilha) só com o Baixar. Esc fecha (useJanela). Peça do catálogo (Janelas).
import { Icone, useJanela } from '@nads/ui';
import { useRef } from 'react';
import { createPortal } from 'react-dom';

export interface ArquivoAberto { nome: string; url: string; tipo: string; /** as páginas do PDF já desenhadas (paginasDoPdf) */ paginas?: string[] }

export function JanelaDoArquivo({ arquivo, onBaixar, onFechar }: { arquivo: ArquivoAberto; onBaixar: () => void; onFechar: () => void }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, onFechar);
  const pdf = arquivo.tipo === 'application/pdf';
  const imagem = arquivo.tipo.startsWith('image/');
  // no body (12/11/2026): aberta de dentro de outra janela (a DANFE do relatório do dia), fica por cima dela
  return createPortal(
    <div className="modal-overlay cli-arquivo-fundo" onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div ref={janela} className="cli-arquivo-janela" role="dialog" aria-modal="true" aria-label={'Visualizar ' + arquivo.nome}>
        <header className="cli-arquivo-topo">
          <b className="cli-arquivo-nome" title={arquivo.nome}>{arquivo.nome}</b>
          <button type="button" className="btn btn-primary" onClick={onBaixar}><Icone nome="download" width={16} height={16} />Baixar</button>
          <button type="button" className="icon-btn" onClick={onFechar} aria-label="Fechar" title="Fechar"><Icone nome="x" width={16} height={16} /></button>
        </header>
        <div className="cli-arquivo-corpo">
          {arquivo.paginas?.length ? (
            <div className="cli-arquivo-paginas">
              {arquivo.paginas.map((src, i) => <img key={i} src={src} alt={'Página ' + (i + 1) + ' de ' + arquivo.nome} />)}
            </div>
          ) : pdf ? <iframe src={arquivo.url + '#toolbar=0&navpanes=0'} title={arquivo.nome} />
            : imagem ? <img src={arquivo.url} alt={arquivo.nome} />
            : <p className="hint">Este arquivo não abre aqui. Use o Baixar.</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
