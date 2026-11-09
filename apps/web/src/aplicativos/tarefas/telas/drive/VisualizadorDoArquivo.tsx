// A janela de ver o arquivo na tela, sem baixar (09/11/2026: "tem como eu apenas visualizar as coisas do drive sem
// precisar baixar?"). Planilha: uma aba por planilha do arquivo, a tabela com as letras das colunas e o número das
// linhas, como no Excel (o cabeçalho e a 1ª coluna ficam presos ao rolar). Texto (.txt, .xml, .ofx): o texto como está.
// No pé, o Baixar (o arquivo como é) e o Fechar; Esc fecha.
import { entregas as e } from '@nads/core';
import { Alerta, Icone, useJanela } from '@nads/ui';
import { useRef, useState } from 'react';
import type { Visualizacao } from './useExploradorDoDrive';

export function VisualizadorDoArquivo({ vendo, fechar, baixar }: { vendo: Visualizacao; fechar: () => void; baixar: () => void }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar, true);
  const [aba, setAba] = useState(0);
  const atual = vendo.abas[Math.min(aba, vendo.abas.length - 1)];
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) fechar(); }}>
      <div ref={janela} className="modal ver-arquivo" role="dialog" aria-modal="true" aria-labelledby="verArquivoTitulo">
        <h3 id="verArquivoTitulo">
          <Icone nome={vendo.como === 'planilha' ? 'grade' : 'fileText'} width={16} height={16} />
          <span className="ver-arquivo-nome" title={vendo.nome}>{vendo.nome}</span>
          <button type="button" className="btn btn-ghost btn-sm ver-arquivo-x" aria-label="Fechar" onClick={fechar}><Icone nome="x" width={16} height={16} /></button>
        </h3>
        <div className="ver-arquivo-corpo">
          {vendo.estado === 'lendo' && (
            <p className="ver-arquivo-lendo"><Icone nome="girar" width={16} height={16} />{vendo.passo}</p>
          )}
          {vendo.estado === 'erro' && <Alerta titulo="Não consegui mostrar o arquivo" texto={vendo.erro.charAt(0).toUpperCase() + vendo.erro.slice(1) + '. Dá para baixar e abrir no computador.'} />}
          {vendo.estado === 'pronto' && vendo.como === 'texto' && (
            <>
              {vendo.cortado && <p className="fraco ver-arquivo-aviso">O arquivo é grande: aparece só o começo. Baixe para ver inteiro.</p>}
              <pre className="ver-arquivo-texto">{vendo.texto || '(arquivo vazio)'}</pre>
            </>
          )}
          {vendo.estado === 'pronto' && vendo.como === 'planilha' && atual && (
            <>
              {vendo.abas.length > 1 && (
                <div className="ver-arquivo-abas" role="tablist" aria-label="Planilhas do arquivo">
                  {vendo.abas.map((a, i) => (
                    <button key={a.nome + i} type="button" role="tab" aria-selected={a === atual} className={'ver-arquivo-aba' + (a === atual ? ' ativa' : '')} onClick={() => setAba(i)}>{a.nome}</button>
                  ))}
                </div>
              )}
              {atual.cortada && (
                <p className="fraco ver-arquivo-aviso">
                  A planilha é grande: aparecem {Math.min(atual.totalLinhas, e.VER_MAX_LINHAS).toLocaleString('pt-BR')} de {atual.totalLinhas.toLocaleString('pt-BR')} linhas
                  {atual.colunas >= e.VER_MAX_COLUNAS ? ' e as ' + e.VER_MAX_COLUNAS + ' primeiras colunas' : ''}. Baixe para ver inteira.
                </p>
              )}
              {atual.linhas.length ? (
                <div className="ver-arquivo-tabela">
                  <table>
                    <thead>
                      <tr><th className="ver-arquivo-canto" />{Array.from({ length: atual.colunas }, (_, i) => <th key={i}>{e.letraDaColuna(i)}</th>)}</tr>
                    </thead>
                    <tbody>
                      {atual.linhas.map((l, r) => (
                        <tr key={r}>
                          <th scope="row">{r + 1}</th>
                          {l.map((c, k) => <td key={k} className={/^-?[\d.,]+%?$/.test(c.trim()) ? 'num' : undefined}>{c}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="fraco ver-arquivo-aviso">Esta planilha está vazia.</p>}
            </>
          )}
        </div>
        <div className="modal-actions">
          <span className="fraco ver-arquivo-pe">{vendo.estado === 'pronto' && vendo.como === 'planilha' && atual ? atual.totalLinhas.toLocaleString('pt-BR') + ' linha(s)' + (vendo.abas.length > 1 ? ' · ' + vendo.abas.length + ' planilhas' : '') : ''}</span>
          <button type="button" className="btn btn-outline" onClick={baixar}><Icone nome="download" width={16} height={16} />Baixar</button>
          <button type="button" className="btn btn-primary" onClick={fechar}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
