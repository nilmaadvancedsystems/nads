// O certificado A1 da empresa (Vitor, 07/10/2026: "aumente isso, a UI tá feia e muito pequena, quero uma importação
// bonitinha e animada"): sem certificado, a área grande para soltar o .pfx (pulsa quando o arquivo passa por cima); com o
// arquivo, a senha — e, lido o certificado, o cartão dele (o titular, o CNPJ, a validade e a situação) entrando animado.
import { Icone } from '@nads/ui';
import { useRef, useState } from 'react';
import { Senha } from './SegredosDaEmpresa';
import type { useSegredos } from './useSegredos';

type Vm = ReturnType<typeof useSegredos>;

const cnpj = (d: string) => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

export function CertificadoA1({ vm, ocupado, baixar }: { vm: Vm; ocupado: boolean; baixar: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);
  const escolher = (f: File | null | undefined) => { if (f) void vm.escolherArquivo(f); };
  const [nome, doc] = vm.cert.titular ? vm.cert.titular.split(':') : ['', ''];
  const sit = vm.certSituacao;
  const lido = !!vm.cert.titular && !vm.leitura.erro;
  return (
    <section className="cert">
      <input ref={input} type="file" accept=".pfx,.p12" hidden onChange={e => { escolher(e.target.files?.[0]); e.target.value = ''; }} />
      {!vm.cert.arquivo ? (
        <button type="button" className={'cert-soltar' + (sobre ? ' sobre' : '')} onClick={() => input.current?.click()}
          onDragOver={e => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)}
          onDrop={e => { e.preventDefault(); setSobre(false); escolher(e.dataTransfer.files?.[0]); }}>
          <span className="cert-soltar-icone"><Icone nome="upload" /></span>
          <b>Solte o certificado aqui</b>
          <span className="fraco">ou clique para escolher o arquivo .pfx</span>
        </button>
      ) : (
        <>
          <div className={'cert-cartao' + (lido ? ' lido' : '') + (vm.leitura.lendo ? ' lendo' : '') + ' ' + sit.situacao}>
            <span className="cert-cartao-chip" aria-hidden="true"><Icone nome="lock" /></span>
            <div className="cert-cartao-corpo">
              <span className="cert-cartao-tipo">Certificado digital A1</span>
              <b className="cert-cartao-nome">{nome || vm.cert.nomeArquivo}</b>
              <span className="cert-cartao-doc num">{doc ? cnpj(doc) : vm.leitura.lendo ? 'Lendo o certificado…' : 'Digite a senha para ler o certificado'}</span>
            </div>
            <div className="cert-cartao-validade">
              <span className="fraco">Validade</span>
              <b className="num">{vm.cert.validade || '—'}</b>
              {sit.situacao === 'vencido' && <span className="badge badge-danger">Vencido</span>}
              {sit.situacao === 'vence' && <span className="badge badge-warn">Vence em {sit.dias} dias</span>}
              {sit.situacao === 'ok' && <span className="badge badge-ok">Em dia</span>}
            </div>
            {vm.leitura.lendo && <span className="cert-cartao-brilho" aria-hidden="true" />}
          </div>
          <div className="cert-campos">
            <label className="cert-campo">
              <span>Senha do certificado</span>
              <Senha valor={vm.cert.senha} onMudar={v => vm.setCert({ ...vm.cert, senha: v })} rotulo="Senha do certificado" />
              {vm.leitura.erro && <span className="cert-erro"><Icone nome="alert" />{vm.leitura.erro}</span>}
            </label>
            <label className="cert-campo">
              <span>Observação</span>
              <input type="text" className="pessoal-select" value={vm.cert.obs} onChange={e => vm.setCert({ ...vm.cert, obs: e.target.value })} aria-label="Observação do certificado" />
            </label>
          </div>
          <div className="cert-acoes">
            {vm.temCertificado && <button type="button" className="btn btn-outline" onClick={baixar}><Icone nome="download" />Baixar .pfx</button>}
            <button type="button" className="btn btn-outline" onClick={() => input.current?.click()}><Icone nome="repeat" />Trocar arquivo</button>
            {vm.temCertificado && <button type="button" className="btn btn-danger" disabled={ocupado} onClick={() => void vm.excluirCert()}>Excluir certificado</button>}
            <span className="tarefas-barra-espaco" />
            {vm.mudouCert && <button type="button" className="btn btn-primary" disabled={ocupado} onClick={() => void vm.salvarCert()}><Icone nome="check" />Salvar</button>}
          </div>
          <p className="fraco cert-arquivo"><Icone nome="arquivo" />{vm.cert.nomeArquivo}</p>
        </>
      )}
    </section>
  );
}
