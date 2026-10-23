// O visor do arquivo (Admin › Arquivador › Para resolver, 23/10/2026: "coloca um botão para abrir o arquivo direto
// daqui"): por cima da página, o nome com o ícone do formato, Baixar e Fechar (o Esc fecha); embaixo, o arquivo — o PDF no
// visualizador do navegador, a imagem inteira, o XML/TXT como texto; o resto (e o PDF no celular que não mostra PDF na
// página), o Baixar e o Abrir em outra aba. Enquanto o robô do PC lê, a
// mensagem de espera com a barra de carregamento. Peça do catálogo (Janelas). Sem animação.
import { BotaoFechar, Icone, IconeDeArquivo, type FormatoDoArquivo } from '@nads/ui';
import { useEffect } from 'react';

export interface DadosDoVisor {
  nome: string; formato: FormatoDoArquivo; carregando: boolean; erro: string; url: string; texto: string;
  como: 'pdf' | 'imagem' | 'texto' | 'baixar';
  /** a frase de espera ("O robô do PC está lendo o arquivo…") */
  aguardando?: string;
}

export function VisorDoArquivo({ v, onFechar }: { v: DadosDoVisor; onFechar: () => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onFechar]);
  return (
    <div className="arq-visor" role="dialog" aria-modal="true" aria-label={'Arquivo ' + v.nome}>
      <div className="arq-visor-topo">
        <IconeDeArquivo formato={v.formato} tamanho={28} />
        <b className="arq-visor-nome">{v.nome}</b>
        {v.url && <a className="btn btn-outline" href={v.url} download={v.nome}><Icone nome="download" width={16} height={16} />Baixar</a>}
        <BotaoFechar onClick={onFechar} />
      </div>
      <div className="arq-visor-corpo">
        {v.carregando ? (
          <div className="arq-visor-espera">
            <span className="tarefas-barra larga andando" aria-hidden="true"><span style={{ width: '40%' }} /></span>
            <p className="fraco">{v.aguardando || 'Pedido ao robô do PC…'}</p>
          </div>
        ) : v.erro ? (
          <div className="arq-visor-espera"><p><b>Não deu para abrir.</b> {v.erro}</p></div>
        ) : v.como === 'pdf' ? <iframe className="arq-visor-pdf" src={v.url} title={v.nome} />
          : v.como === 'imagem' ? <img className="arq-visor-img" src={v.url} alt={v.nome} />
            : v.como === 'texto' ? <pre className="arq-visor-texto">{v.texto}</pre>
              : (
                <div className="arq-visor-espera">
                  <p>Este arquivo não abre aqui dentro. Use o <b>Baixar</b> ou abra em outra aba.</p>
                  {v.url && <a className="btn btn-outline" href={v.url} target="_blank" rel="noopener"><Icone nome="maximizar" width={16} height={16} />Abrir em outra aba</a>}
                </div>
              )}
      </div>
    </div>
  );
}
