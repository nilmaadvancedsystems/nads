// ViewModel dos segredos de uma empresa (a janela do módulo Senhas e a aba Senhas do Cadastro): lê do cofre aberto,
// guarda o que a pessoa edita e grava embaralhado. O certificado: o .pfx em base64, a senha e a validade.
import { cofre as c } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import type { VmCofre } from './useCofre';

const dataIso = (br: string) => (/^\d{2}\/\d{2}\/\d{4}$/.test(br) ? br.slice(6) + '-' + br.slice(3, 5) + '-' + br.slice(0, 2) : '');

export function useSegredos(cofre: VmCofre, empresa: string, codigo: number | null) {
  const { modal } = useRetorno();
  const [carregado, setCarregado] = useState(false);
  const [segredos, setSegredos] = useState<c.SegredosDaEmpresa>({});
  const [gov, setGov] = useState({ login: '', senha: '', obs: '' });
  const [cert, setCert] = useState({ nomeArquivo: '', arquivo: '', senha: '', validade: '', titular: '', obs: '' });
  // a leitura do .pfx com a senha (07/10/2026): a validade e o titular saem do próprio certificado
  const [leitura, setLeitura] = useState<{ lendo: boolean; erro: string }>({ lendo: false, erro: '' });
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
      setCert({ nomeArquivo: v.certificado?.nomeArquivo || '', arquivo: v.certificado?.arquivo || '', senha: v.certificado?.senha || '', validade: c.dataBr(v.certificado?.validade || ''), titular: v.certificado?.titular || '', obs: v.certificado?.obs || '' });
      setCarregado(true);
    }).catch(() => { if (vale) setCarregado(true); });
    return () => { vale = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, empresa, itemVersao]);
  // com o arquivo e a senha, lê o certificado (espera a pessoa parar de digitar a senha)
  useEffect(() => {
    if (!cert.arquivo || !cert.senha) { setLeitura({ lendo: false, erro: '' }); return; }
    let vale = true;
    const t = setTimeout(() => {
      setLeitura({ lendo: true, erro: '' });
      void c.lerCertificado(cert.arquivo, cert.senha).then(r => {
        if (!vale) return;
        if (!r.ok) { setLeitura({ lendo: false, erro: r.erro }); return; }
        setLeitura({ lendo: false, erro: '' });
        const titular = r.titular + (r.documento ? ':' + r.documento : '');
        setCert(x => (x.validade === c.dataBr(r.validade) && x.titular === titular ? x : { ...x, validade: c.dataBr(r.validade), titular }));
      });
    }, 400);
    return () => { vale = false; clearTimeout(t); };
  }, [cert.arquivo, cert.senha]);
  const certSituacao = c.situacaoDoCertificado(dataIso(cert.validade) || segredos.certificado?.validade, new Date());
  return {
    aberto,
    carregado,
    gov, setGov,
    cert, setCert,
    leitura,
    certSituacao,
    temCertificado: !!segredos.certificado?.arquivo,
    mudouGov: gov.login !== (segredos.gov?.login || '') || gov.senha !== (segredos.gov?.senha || '') || gov.obs !== (segredos.gov?.obs || ''),
    mudouCert: cert.arquivo !== (segredos.certificado?.arquivo || '') || cert.senha !== (segredos.certificado?.senha || '')
      || dataIso(cert.validade) !== (segredos.certificado?.validade || '') || cert.titular !== (segredos.certificado?.titular || '') || cert.obs !== (segredos.certificado?.obs || ''),
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
      const novo: c.SegredosDaEmpresa = { ...segredos, certificado: cert.arquivo ? { nomeArquivo: cert.nomeArquivo, arquivo: cert.arquivo, senha: cert.senha, validade, ...(cert.titular ? { titular: cert.titular } : {}), ...(cert.obs.trim() ? { obs: cert.obs.trim() } : {}) } : undefined };
      await cofre.salvar(empresa, codigo, novo);
      setSegredos(novo);
    },
    /** exclui o certificado do cofre, com a confirmação (Vitor, 07/10/2026); a senha gov.br fica */
    async excluirCert() {
      if (!segredos.certificado?.arquivo) return;
      const ok = await modal({ icone: 'alert', titulo: 'Excluir o certificado de ' + empresa + '?',
        texto: (segredos.certificado.nomeArquivo || 'O certificado') + ' sai do cofre. Não dá para desfazer.',
        botoes: [{ rotulo: 'Voltar', valor: false, variante: 'btn-outline' }, { rotulo: 'Excluir', valor: true, variante: 'btn-danger' }] });
      if (!ok) return;
      const novo: c.SegredosDaEmpresa = { ...segredos, certificado: undefined };
      await cofre.salvar(empresa, codigo, novo);
      setSegredos(novo);
      setCert({ nomeArquivo: '', arquivo: '', senha: '', validade: '', titular: '', obs: '' });
    },
    /** o .pfx de volta, para baixar */
    arquivoParaBaixar(): { nome: string; dados: Uint8Array<ArrayBuffer> } | null {
      return segredos.certificado?.arquivo ? { nome: segredos.certificado.nomeArquivo || empresa + '.pfx', dados: c.deBase64(segredos.certificado.arquivo) } : null;
    },
  };
}
