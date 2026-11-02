// O painel Anexos da tarefa (28/10/2026, como o do Toriba: anexar, ver, apagar e baixar): o Escolher arquivos (vários de uma
// vez), o limite e a lista — o ícone do formato, o nome e, embaixo, a extensão, o tamanho, quando e quem; à direita Baixar e
// Tirar. Na tarefa nova, os arquivos esperam o Salvar.
import { BotaoIcone, CampoArquivos, IconeDeArquivo, Vazio, formatoPeloNome } from '@nads/ui';

export interface AnexoNaLista { id: string; nome: string; detalhe: string }

export function AnexosDaTarefa({ id, anexos, limite, podeMudar, anexando, anexar, baixar, tirar }: {
  id: string; anexos: readonly AnexoNaLista[]; limite: string; podeMudar: boolean; anexando: boolean;
  anexar: (fs: File[]) => void; baixar: (id: string) => void; tirar: (id: string) => void;
}) {
  return (
    <section className="tdl-anexos" aria-label="Anexos">
      <div className="tdl-anexos-topo">
        <h3 className="tdl-secao">Anexos{anexos.length > 0 && <span className="fraco"> · {anexos.length}</span>}</h3>
        {podeMudar && <CampoArquivos id={id} aceitar="*/*" rotulo={anexando ? 'Enviando…' : 'Anexar arquivos'} desabilitado={anexando} onEscolher={anexar} />}
      </div>
      <p className="hint">{limite}</p>
      {!anexos.length ? <Vazio compacto icone="clipe" titulo="Nenhum arquivo anexado" /> : (
        <ul className="tdl-anexos-lista">
          {anexos.map(a => (
            <li key={a.id} className="tdl-anexo">
              <IconeDeArquivo formato={formatoPeloNome(a.nome)} tamanho={28} />
              <span className="tdl-anexo-texto">
                <span className="tdl-anexo-nome">{a.nome}</span>
                <span className="hint">{a.detalhe}</span>
              </span>
              <BotaoIcone icone="download" titulo={'Baixar ' + a.nome} pequeno onClick={() => baixar(a.id)} />
              {podeMudar && <BotaoIcone icone="lixeira" titulo={'Tirar ' + a.nome} pequeno onClick={() => tirar(a.id)} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
