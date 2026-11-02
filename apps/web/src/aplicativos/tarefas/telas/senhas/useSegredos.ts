// ViewModel dos segredos de uma empresa (a janela do módulo Senhas e a aba Senhas do Cadastro): lê do cofre aberto,
// guarda o que a pessoa edita e grava embaralhado. O certificado: o .pfx em base64, a senha e a validade.
// O documento acompanha o banco (30/10/2026, revisão dos dados): antes os segredos eram lidos uma vez só e cada Salvar
// gravava {segredos lidos ao abrir + a parte editada}; quem salvava por último voltava a senha que o outro tinha trocado.
// Agora cada Salvar relê e desembaralha o documento na hora de gravar e muda só a parte editada (cofre.mudar), e a tela
// segue o banco nas partes que a pessoa não está editando.
import { cofre as c, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import type { VmCofre } from './useCofre';

// cada parte do formulário como os segredos gravados a mostram
const formGov = (v: c.SegredosDaEmpresa) => ({ login: v.gov?.login || '', senha: v.gov?.senha || '', obs: v.gov?.obs || '' });
const formSimples = (v: c.SegredosDaEmpresa) => ({ codigo: v.simples?.codigo || '', cpf: v.simples?.cpf || '', obs: v.simples?.obs || '' });
const formCert = (v: c.SegredosDaEmpresa) => ({ nomeArquivo: v.certificado?.nomeArquivo || '', arquivo: v.certificado?.arquivo || '', senha: v.certificado?.senha || '',
  validade: c.dataBr(v.certificado?.validade || ''), titular: v.certificado?.titular || '', obs: v.certificado?.obs || '' });
const igual = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);
type Parte = 'gov' | 'simples' | 'cert';

const dataIso = (br: string) => (/^\d{2}\/\d{2}\/\d{4}$/.test(br) ? br.slice(6) + '-' + br.slice(3, 5) + '-' + br.slice(0, 2) : '');

export function useSegredos(cofre: VmCofre, empresa: string, codigo: number | null) {
  const codigoDaEmpresa = codigo;
  const { modal } = useRetorno();
  const [carregado, setCarregado] = useState(false);
  const [segredos, setSegredos] = useState<c.SegredosDaEmpresa>({});
  const [gov, setGov] = useState({ login: '', senha: '', obs: '' });
  // o código de acesso do Simples Nacional (Heverton, 20/10/2026): só no cofre
  const [simples, setSimples] = useState({ codigo: '', cpf: '', obs: '' });
  const [cert, setCert] = useState({ nomeArquivo: '', arquivo: '', senha: '', validade: '', titular: '', obs: '' });
  // a leitura do .pfx com a senha (07/10/2026): a validade e o titular saem do próprio certificado
  const [leitura, setLeitura] = useState<{ lendo: boolean; erro: string }>({ lendo: false, erro: '' });
  const aberto = cofre.estado === 'aberto';
  // a versão do documento no banco (o cofre é guardado pelo slug do nome; antes procurava pelo nome e quase nunca achava)
  const doc = cofre.itens.get(formatos.slug(empresa));
  const itemVersao = doc ? doc.versao + '|' + doc.atualizadoEm : '';
  // o que está na tela agora (para seguir o banco sem desfazer o que a pessoa está editando)
  const agora = useRef({ empresa: '', segredos, gov, simples, cert });
  useEffect(() => { agora.current = { ...agora.current, segredos, gov, simples, cert }; });
  /** os segredos novos do banco: a parte que a pessoa não mexeu (ou a de `forcar`) passa a mostrar o que está lá */
  function seguir(v: c.SegredosDaEmpresa, forcar: readonly Parte[] = []) {
    const { segredos: antes, gov: g, simples: si, cert: ce } = agora.current;
    if (forcar.includes('gov') || igual(g, formGov(antes))) setGov(formGov(v));
    if (forcar.includes('simples') || igual(si, formSimples(antes))) setSimples(formSimples(v));
    if (forcar.includes('cert') || igual(ce, formCert(antes))) setCert(formCert(v));
    setSegredos(v);
    agora.current = { ...agora.current, segredos: v };
  }
  useEffect(() => {
    if (!aberto) return;
    let vale = true;
    void cofre.ler(empresa).then(s => {
      if (!vale) return;
      // outra empresa: o formulário inteiro é o dela
      const outra = agora.current.empresa !== empresa;
      agora.current = { ...agora.current, empresa };
      seguir(s || {}, outra ? ['gov', 'simples', 'cert'] : []);
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
    simples, setSimples,
    mudouSimples: simples.codigo !== (segredos.simples?.codigo || '') || simples.cpf !== (segredos.simples?.cpf || '') || simples.obs !== (segredos.simples?.obs || ''),
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
    // cada Salvar muda só a sua parte, sobre os segredos como estão no banco na hora de gravar (30/10/2026)
    async salvarSimples() {
      const codigo = simples.codigo.replace(/\s/g, '');
      const cpf = simples.cpf.replace(/\D/g, '');
      const parte = codigo ? { codigo, ...(cpf ? { cpf } : {}), ...(simples.obs.trim() ? { obs: simples.obs.trim() } : {}) } : undefined;
      const novo = await cofre.mudar(empresa, codigoDaEmpresa, atuais => ({ ...atuais, simples: parte }));
      if (novo) seguir(novo, ['simples']);
    },
    async salvarGov() {
      const parte = gov.login || gov.senha ? { login: gov.login.trim(), senha: gov.senha, ...(gov.obs.trim() ? { obs: gov.obs.trim() } : {}) } : undefined;
      const novo = await cofre.mudar(empresa, codigo, atuais => ({ ...atuais, gov: parte }));
      if (novo) seguir(novo, ['gov']);
    },
    async salvarCert() {
      const validade = dataIso(cert.validade);
      const parte = cert.arquivo ? { nomeArquivo: cert.nomeArquivo, arquivo: cert.arquivo, senha: cert.senha, validade, ...(cert.titular ? { titular: cert.titular } : {}), ...(cert.obs.trim() ? { obs: cert.obs.trim() } : {}) } : undefined;
      const novo = await cofre.mudar(empresa, codigo, atuais => ({ ...atuais, certificado: parte }));
      if (novo) seguir(novo, ['cert']);
    },
    /** exclui o certificado do cofre, com a confirmação (Vitor, 07/10/2026); a senha gov.br fica */
    async excluirCert() {
      if (!segredos.certificado?.arquivo) return;
      const ok = await modal({ icone: 'alert', titulo: 'Excluir o certificado de ' + empresa + '?',
        texto: (segredos.certificado.nomeArquivo || 'O certificado') + ' sai do cofre. Não dá para desfazer.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Excluir', valor: true, variante: 'btn-danger' }] });
      if (!ok) return;
      // depois da janela: relido na hora de gravar (o que chegou com ela aberta fica)
      const novo = await cofre.mudar(empresa, codigo, atuais => ({ ...atuais, certificado: undefined }));
      if (novo) seguir(novo, ['cert']);
    },
    /** o .pfx de volta, para baixar */
    arquivoParaBaixar(): { nome: string; dados: Uint8Array<ArrayBuffer> } | null {
      return segredos.certificado?.arquivo ? { nome: segredos.certificado.nomeArquivo || empresa + '.pfx', dados: c.deBase64(segredos.certificado.arquivo) } : null;
    },
  };
}
