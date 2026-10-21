// Cadastro › a empresa › Senhas (07/10/2026: "que apareça na janela da empresa também"): a senha gov.br e o certificado
// da empresa, os mesmos do módulo Senhas.
import { empresaDaRota } from '../../../../comum/empresaDaRota';
import { SegredosDaEmpresa } from './SegredosDaEmpresa';
import { useCofre } from './useCofre';

/** parte: o que mostra (a aba Senhas mostra tudo; Fiscal › Código do Simples, só o do Simples; 21/10/2026) */
export function SenhasNoCadastro({ rota, parte = 'tudo' }: { rota: string; parte?: 'simples' | 'tudo' }) {
  const vm = useCofre();
  const e = empresaDaRota(rota);
  if (!e) return null;
  return <SegredosDaEmpresa vm={vm} empresa={e.nome} codigo={e.codigo} parte={parte} />;
}
