// O quadradinho colorido ao lado do título de cada tela (15/11/2026: "Sim, mais visíveis", escolhida a "cor por seção"):
// o mesmo ícone e a mesma cor do menu e da barra de baixo do celular, para a pessoa saber onde está. A Área diz pelo
// contexto qual é a tela aberta; a cor vem do CSS (a classe sec-<tela>).
import { Icone, type NomeIcone } from '@nads/ui';
import { createContext, useContext } from 'react';

export const TelaAbertaContexto = createContext<{ id: string; icone: NomeIcone } | null>(null);

export function MarcaDaTela() {
  const tela = useContext(TelaAbertaContexto);
  if (!tela) return null;
  return <span className={'cli-sec-ico cli-marca-tela sec-' + tela.id} aria-hidden="true"><Icone nome={tela.icone} width={18} height={18} /></span>;
}
