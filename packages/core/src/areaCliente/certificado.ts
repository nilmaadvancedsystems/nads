// O certificado digital A1 na Área do Cliente (plano do Acessórias, 17/11/2026, ficha certificado-digital; frase do dono:
// "Seguir"). A tela (o sino e o "Pedir renovação") já existia e o banco nunca a preenchia: o robô do PC passa a gravar
// areasCliente/{token}/resumo/certificado com a validade do A1 que está no cofre do escritório.
// Só sai a validade: nunca o .pfx, a senha nem o titular do cofre (cifrado, com CPF/CNPJ). O titular que o cliente vê é a
// razão social do cadastro. O certificado .gov (a conta gov.br) não conta. Num link de várias empresas, vale o que vence
// primeiro. O A3, ou o A1 fora do cofre, não aparece (a tela não diz "tudo em ordem": só não mostra nada). Só a lógica.

/** O que o cofre tem de cada empresa, só o que a conta precisa (cofre/{empresa}, lido pelo robô com o Admin SDK). */
export interface CertificadoNoCofre {
  codigo: number | null;
  empresa: string;
  /** 'aaaa-mm-dd' */
  validade: string;
  temCertificado: boolean;
  /** 'gov' = a conta gov.br, que não é certificado */
  tipo?: string;
}

/** O que vai para o espelho (resumo/certificado): lista branca. */
export interface CertificadoDoLink {
  tipo: 'A1';
  /** a razão social do cadastro (nunca o titular do cofre) */
  titular: string;
  /** 'aaaa-mm-dd' */
  validoAte: string;
}

const normal = (s: string) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const dataValida = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d + 'T00:00:00Z'));

/**
 * O certificado A1 do link: o do cofre de cada empresa do link (pelo código; sem código no cofre, pela razão social),
 * o que vence primeiro. null = nenhuma empresa do link tem A1 no cofre.
 */
export function certificadoDoLink(docsDoCofre: readonly CertificadoNoCofre[], empresas: readonly { codigo: number; nome: string }[]): CertificadoDoLink | null {
  const achados: CertificadoDoLink[] = [];
  for (const e of empresas) {
    const doc = docsDoCofre.find(d => d && d.tipo !== 'gov' && d.temCertificado === true && dataValida(String(d.validade || ''))
      && (d.codigo != null ? Number(d.codigo) === e.codigo : normal(d.empresa) === normal(e.nome)));
    if (doc) achados.push({ tipo: 'A1', titular: e.nome, validoAte: doc.validade });
  }
  achados.sort((a, b) => a.validoAte.localeCompare(b.validoAte));
  return achados[0] ?? null;
}
