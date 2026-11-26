// ViewModel do modo convidado (26/11/2026): os dois convidados (nome, setor e hierarquia), quem o nads está sendo e as ações.
import { usuarios } from '@nads/core';
import { useModoDesenvolvedor } from '../../../comum/modoDesenvolvedor';
import { usePerfisDeTeste } from '../dados/repo';
import { useOperador } from './operador';

const rotuloDe = <T extends string>(lista: readonly { id: T; rotulo: string }[], id: T) => lista.find(x => x.id === id)?.rotulo || id;

export function useTrocaDeConvidado() {
  const [dev] = useModoDesenvolvedor();
  const t = usePerfisDeTeste();
  const op = useOperador().operador;
  return {
    /** só no modo desenvolvedor */
    ligado: dev,
    eu: op?.nome.split(/[ .]/)[0] || 'Eu',
    sendoEu: !t.agindo,
    convidados: t.perfis.map(p => ({
      ...p, ativo: t.agindo?.uid === p.uid,
      resumo: rotuloDe(usuarios.DEPARTAMENTOS, p.departamento) + ' · ' + rotuloDe(usuarios.NIVEIS, p.nivel),
    })),
    setores: usuarios.DEPARTAMENTOS,
    niveis: usuarios.NIVEIS,
    voltarAEu: () => t.agirComo(null),
    ser: (p: { uid: string; nome: string }) => t.agirComo({ uid: p.uid, nome: p.nome }),
    mudar: t.mudar,
  };
}
