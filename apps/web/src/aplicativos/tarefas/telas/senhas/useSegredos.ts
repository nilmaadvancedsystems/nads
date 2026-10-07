// ViewModel dos segredos de uma empresa (a janela do módulo Senhas e a aba Senhas do Cadastro): lê do cofre aberto,
// guarda o que a pessoa edita e grava embaralhado. O certificado: o .pfx em base64, a senha e a validade.
import { cofre as c } from '@nads/core';
import { useEffect, useState } from 'react';
import type { VmCofre } from './useCofre';

const dataIso = (br: string) => (/^\d{2}\/\d{2}\/\d{4}$/.test(br) ? br.slice(6) + '-' + br.slice(3, 5) + '-' + br.slice(0, 2) : '');

export function useSegredos(cofre: VmCofre, empresa: string, codigo: number | null) {
  const [carregado, setCarregado] = useState(false);
  const [segredos, setSegredos] = useState<c.SegredosDaEmpresa>({});
  const [gov, setGov] = useState({ login: '', senha: '', obs: '' });
  const [cert, setCert] = useState({ nomeArquivo: '', arquivo: '', senha: '', validade: '', obs: '' });
  const aberto = cofre.estado === 'aberto';
  const itemVersao = cofre.itens.get(empresa) ? 1 : 0;
  useEffect(() => {
    if (!aberto) return;
    let vale = true;
    void cofre.ler(empresa).then(s => {
      if (!vale) return;
      const v = s || {};
      setSegredos(v);
      setGov({ login: v.gov?.login || '', senha: v.gov?.senha || '', obs: v.gov?.obs || '' });
      setCert({ nomeArquivo: v.certificado?.nomeArquivo || '', arquivo: v.certificado?.arquivo || '', senha: v.certificado?.senha || '', validade: c.dataBr(v.certificado?.validade || ''), obs: v.certificado?.obs || '' });
      setCarregado(true);
    }).catch(() => { if (vale) setCarregado(true); });
    return () => { vale = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, empresa, itemVersao]);
  const certSituacao = c.situacaoDoCertificado(segredos.certificado?.validade, new Date());
  return {
    aberto,
    carregado,
    gov, setGov,
    cert, setCert,
    certSituacao,
    temCertificado: !!segredos.certificado?.arquivo,
    mudouGov: gov.login !== (segredos.gov?.login || '') || gov.senha !== (segredos.gov?.senha || '') || gov.obs !== (segredos.gov?.obs || ''),
    mudouCert: cert.arquivo !== (segredos.certificado?.arquivo || '') || cert.senha !== (segredos.certificado?.senha || '')
      || dataIso(cert.validade) !== (segredos.certificado?.validade || '') || cert.obs !== (segredos.certificado?.obs || ''),
    /** lê o .pfx escolhido (em base64; nada sai do navegador sem embaralhar) */
    async escolherArquivo(f: File | null) {
      if (!f) { setCert(x => ({ ...x, nomeArquivo: '', arquivo: '' })); return; }
      const arquivo = c.paraBase64(await f.arrayBuffer());
      setCert(x => ({ ...x, nomeArquivo: f.name, arquivo }));
    },
    async salvarGov() {
      const novo: c.SegredosDaEmpresa = { ...segredos, gov: gov.login || gov.senha ? { login: gov.login.trim(), senha: gov.senha, ...(gov.obs.trim() ? { obs: gov.obs.trim() } : {}) } : undefined };
      await cofre.salvar(empresa, codigo, novo);
      setSegredos(novo);
    },
    async salvarCert() {
      const validade = dataIso(cert.validade);
      const novo: c.SegredosDaEmpresa = { ...segredos, certificado: cert.arquivo ? { nomeArquivo: cert.nomeArquivo, arquivo: cert.arquivo, senha: cert.senha, validade, ...(cert.obs.trim() ? { obs: cert.obs.trim() } : {}) } : undefined };
      await cofre.salvar(empresa, codigo, novo);
      setSegredos(novo);
    },
    /** o .pfx de volta, para baixar */
    arquivoParaBaixar(): { nome: string; dados: Uint8Array<ArrayBuffer> } | null {
      return segredos.certificado?.arquivo ? { nome: segredos.certificado.nomeArquivo || empresa + '.pfx', dados: c.deBase64(segredos.certificado.arquivo) } : null;
    },
  };
}
