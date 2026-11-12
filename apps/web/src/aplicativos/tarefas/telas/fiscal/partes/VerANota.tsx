// O "Ver" de uma nota, igual em todas as telas (11/11/2026: "quero que todas as maneiras de puxar danfe saia igual"): a
// NF-e e a NFC-e abrem na DANFE idêntica à original (JanelaDaDanfe, o PDF desenhado do XML que o robô traz); a NFS-e no
// espelho do serviço (EspelhoDoServico); o CT-e e a nota sem a chave, no espelho (EspelhoDaNota). codigo e competencia: a
// empresa e o mês, para o robô buscar o XML.
import type { tarefas as t } from '@nads/core';
import { EspelhoDaNota } from './EspelhoDaNota';
import { EspelhoDoServico } from './EspelhoDoServico';
import { JanelaDaDanfe } from './JanelaDaDanfe';
import { useVerANota } from './useVerANota';

export function VerANota({ nota, codigo, competencia, fechar }: { nota: t.sieg.NotaDoSieg; codigo?: string | number | null; competencia?: string; fechar: () => void }) {
  const como = useVerANota(nota);
  if (como === 'danfe') return <JanelaDaDanfe nota={nota} codigo={codigo} competencia={competencia} fechar={fechar} />;
  if (como === 'servico') return <EspelhoDoServico nota={nota} fechar={fechar} />;
  return <EspelhoDaNota nota={nota} fechar={fechar} />;
}
