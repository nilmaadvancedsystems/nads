// Subir a guia do mês (Vitor, 13/10/2026: "coloca a etapa de upar o DAS e DAE em alguma das partes"): o PDF do DAS ou do
// DAE vai para a pasta do cliente pelo Claudio Secretario (useGuiaParaSubir). A área de soltar é a dos XMLs do cliente.
import { Icone } from '@nads/ui';
import { useRef, useState } from 'react';
import { useGuiaParaSubir } from '../useGuiaParaSubir';

export function GuiaParaSubir({ guia, codigo, competencia, enviadas, marcar }: {
  guia: 'DAS' | 'DAE'; codigo: string; competencia: string;
  /** quantas guias deste tipo já subiram no mês (o que a execução guardou) */
  enviadas: number;
  marcar?: (n: number) => void;
}) {
  const { lista, soltar } = useGuiaParaSubir(codigo, competencia, enviadas, marcar);
  const input = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);
  return (
    <div className="xmls-cliente">
      <p className="hint" style={{ margin: 0 }}>
        O PDF do {guia} do mês vai para a pasta do cliente no Drive (pelo Claudio Secretario: o arquivamento leva para o lugar certo).
        {enviadas > 0 && <> <span className="badge badge-ok">{enviadas === 1 ? '1 guia enviada' : enviadas + ' guias enviadas'}</span></>}
      </p>
      <input ref={input} type="file" accept=".pdf,application/pdf" multiple hidden onChange={ev => { soltar(ev.target.files); ev.target.value = ''; }} />
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
              <div><b>{s.nome}</b> <span className="hint">{s.texto}</span></div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
