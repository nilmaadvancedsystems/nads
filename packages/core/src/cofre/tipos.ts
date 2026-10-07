// O cofre de senhas gov.br e certificados digitais (Vitor, 07/10/2026: "um módulo de senhas gov/certificados";
// "algo como a criptografia do WhatsApp"). O que é segredo (a senha gov.br, o arquivo .pfx e a senha dele) só vai para o
// banco embaralhado com a chave do cofre; cada pessoa tem a sua cópia da chave do cofre, trancada com a chave pública
// dela (a privada nunca sai do navegador). Ficam às claras só o que não é segredo: a empresa, se tem senha gov.br, se tem
// certificado e a validade (para avisar do vencimento sem abrir o cofre).

/** A senha do gov.br da empresa (ou do sócio que a representa). */
export interface SenhaGov {
  /** o CPF ou o CNPJ do login */
  login: string;
  senha: string;
  obs?: string;
}

/** O certificado digital A1 (o arquivo .pfx e a senha dele). */
export interface Certificado {
  nomeArquivo: string;
  /** o .pfx em base64 */
  arquivo: string;
  senha: string;
  /** aaaa-mm-dd */
  validade: string;
  /** o titular lido do certificado (o nome e o CPF/CNPJ do CN) */
  titular?: string;
  obs?: string;
}

/** O que é segredo de uma empresa (vai embaralhado). */
export interface SegredosDaEmpresa {
  gov?: SenhaGov;
  certificado?: Certificado;
}

/** O que fica embaralhado: o vetor e os dados, em base64. */
export interface Cifrado { iv: string; dados: string }

/** cofre/{empresa}: o documento de uma empresa no banco. */
export interface DocDoCofre extends Cifrado {
  /** 'gov' = uma conta gov.br de pessoa (CPF), importada da planilha; sem = os segredos de uma empresa */
  tipo?: 'gov';
  /** o nível da conta gov.br (Bronze, Prata, Ouro), às claras */
  nivel?: string;
  /** a empresa (nos documentos de empresa) ou o nome da pessoa (nas contas gov.br) */
  empresa: string;
  codigo: number | null;
  /** a versão da chave do cofre que embaralhou */
  versao: number;
  temGov: boolean;
  temCertificado: boolean;
  /** a validade do certificado (aaaa-mm-dd), às claras para o aviso de vencimento */
  validade?: string;
  atualizadoEm: string;
  atualizadoPor: string;
}

/** cofreChaves/{id}: a chave pública de uma pessoa (de um navegador) e a cópia dela da chave do cofre, quando liberada. */
export interface ChaveDaPessoa {
  id: string;
  nome: string;
  publica: JsonWebKey;
  criadaEm: string;
  /** a chave do cofre trancada com a pública desta pessoa (sem = pediu e espera alguém liberar) */
  trancada?: string;
  /** a versão da chave do cofre trancada */
  versao?: number;
  liberadoPor?: string;
  liberadoEm?: string;
}

/** A chave do cofre trancada com o código de recuperação (PBKDF2 + AES-GCM). */
export interface Recuperacao { sal: string; iv: string; dados: string }

/** cofreConfig/atual: o cofre existe, a versão da chave e a recuperação. */
export interface ConfigDoCofre {
  versao: number;
  criadoEm: string;
  criadoPor: string;
  recuperacao: Recuperacao;
}
