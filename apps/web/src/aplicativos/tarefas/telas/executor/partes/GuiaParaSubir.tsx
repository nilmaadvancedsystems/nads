// Subir a guia do mês (Vitor, 13/10/2026: "coloca a etapa de upar o DAS e DAE em alguma das partes"): o PDF do DAS ou do
// DAE vai para a pasta do cliente pelo Claudio Secretario (useGuiaParaSubir). A área de soltar é a dos XMLs do cliente.
import { CampoArquivo, Icone } from '@nads/ui';
import { useRef, useState } from 'react';
import { useGuiaParaSubir } from '../useGuiaParaSubir';

export function GuiaParaSubir({ guia, codigo, competencia, enviadas, marcar }: {
  guia: 'DAS' | 'DAE'; codigo: string; competencia: string;
  /** quantas guias deste tipo já subiram no mês (o que a execução guardou) */
  enviadas: number;
  marcar?: (n: number) => void;
}) {
  const { lista, soltar } = useGuiaParaSubir(guia, codigo, competencia, enviadas, marcar);
  const input = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);
  return (
    <div className="xmls-cliente">
      {enviadas > 0 && <p className="hint" style={{ margin: 0 }}><span className="badge badge-ok">{enviadas === 1 ? '1 guia enviada' : enviadas + ' guias enviadas'}</span></p>}
      <CampoArquivo semCaixa semFoco multiplo ref={input} aceitar=".pdf,application/pdf" onEscolherVarios={soltar} />
      <button type="button" className={'cert-soltar compacto' + (sobre ? ' sobre' : '')} onClick={() => input.current?.click()}
        onDragOver={ev => { ev.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)}
        onDrop={ev => { ev.preventDefault(); setSobre(false); soltar(ev.dataTransfer.files); }}>
        <span className="cert-soltar-icone"><Icone nome="upload" /></span>
        <b>Solte aqui o PDF do {guia}</b>
        <span className="fraco">ou clique para escolher</span>
      </button>
      {lista.length > 0 && (
        <ol className="fgts-passos sieg-andamento-passos">
          {lista.map(s => (
            <li key={s.id} className={s.pronto ? 'feito' : s.erro ? undefined : 'atual'}>
              <span className="fgts-passo-marca" aria-hidden="true"><Icone nome={s.pronto ? 'check' : s.erro ? 'alert' : 'upload'} /></span>
              <div>
                <b>{s.nome}</b> <span className="hint">{s.texto}</span>
                {s.lido && <div className="hint">Li: {s.lido}</div>}
                {s.semLeitura && <div className="hint">Não li os dados da guia ({s.semLeitura}); ela sobe do mesmo jeito.</div>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
