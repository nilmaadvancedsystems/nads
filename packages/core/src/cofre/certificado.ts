// Ler o certificado A1 (Vitor, 07/10/2026: "não tem como o sistema ler o certificado e saber a data de vencimento?"): o
// .pfx é trancado com a senha do certificado; com ela, abre (node-forge, no navegador) e devolve a validade e o titular
// (o nome e o CPF/CNPJ que vêm no "CN", ex.: "EMPRESA LTDA:12345678000190"). A biblioteca só carrega quando é usada.
export type LeituraDoCertificado =
  | { ok: true; validade: string; titular: string; documento: string }
  | { ok: false; erro: string };

type Cert = import('node-forge').pki.Certificate;

/** O CNPJ no nome do arquivo (ex.: "EMPRESA LTDA_27872981000113.pfx" ou com pontos e barra), só os dígitos; '' se não tem. */
export function cnpjDoNomeDoArquivo(nome: string): string {
  const m = nome.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
  return m ? m[0].replace(/\D/g, '') : '';
}

const dataLocal = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

export async function lerCertificado(arquivoBase64: string, senha: string): Promise<LeituraDoCertificado> {
  const forge = (await import('node-forge')).default;
  let p12: import('node-forge').pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.decode64(arquivoBase64)), senha);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return { ok: false, erro: /password|mac|decrypt|invalid/i.test(m) ? 'A senha não abre o certificado.' : 'Não consegui ler este arquivo como certificado (.pfx).' };
  }
  const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []).map((b: { cert?: Cert }) => b.cert).filter((x: Cert | undefined): x is Cert => !!x);
  if (!certs.length) return { ok: false, erro: 'O arquivo não tem certificado.' };
  // o do titular: o que não é de autoridade (sem cA); entre eles, o que vence primeiro
  const daPessoa = certs.filter((x: Cert) => !(x.getExtension('basicConstraints') as { cA?: boolean } | null)?.cA);
  const cert = (daPessoa.length ? daPessoa : certs).sort((a: Cert, b: Cert) => a.validity.notAfter.getTime() - b.validity.notAfter.getTime())[0];
  const cn = String(cert.subject.getField('CN')?.value || '');
  const [nome, doc] = cn.includes(':') ? [cn.slice(0, cn.lastIndexOf(':')), cn.slice(cn.lastIndexOf(':') + 1)] : [cn, ''];
  return { ok: true, validade: dataLocal(cert.validity.notAfter), titular: nome.trim(), documento: doc.replace(/\D/g, '') };
}
