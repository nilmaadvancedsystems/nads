// A última gravação de cada robô e de cada medição no banco (a Visão geral e a Saúde do banco): de onde vem cada data e de
// quanto em quanto tempo ela deveria mudar. Só junta o que já chega pelos repositórios (o painel do robô, a saúde do robô
// e o resumo diário); a regra do tom fica no core (entregas.sinaisNoBanco).
import { entregas } from '@nads/core';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const txt = (v: unknown) => (v == null ? '' : String(v));

export function sinaisDoBanco(painel: entregas.DocsDoPainelRobo, saude: entregas.DocsDaSaude | null, resumo: entregas.ResumoDaSaudeDoBanco | null, agora: number) {
  const estado = obj(saude?.estado);
  return entregas.sinaisNoBanco([
    // o batimento de cada robô (a cada minuto); sem o painel, o sinal antigo (robo/estado.vigia e robo/arquivador)
    { id: 'vm', rotulo: 'Robô da nuvem', em: painel.vm?.em || painel.sinais.vm?.em || '', esperadoMin: 3 },
    { id: 'pc', rotulo: 'Robô do PC', em: painel.pc?.em || painel.sinais.pc?.em || '', esperadoMin: 3 },
    // a medição do uso do banco (robo/uso, a cada 15 min)
    { id: 'uso', rotulo: 'Medição do uso do banco', em: txt(obj(saude?.uso).em), esperadoMin: 20 },
    // a leitura do Gmail (automática a cada 2 h; o cartão do robô já avisa depois de 26 h)
    { id: 'gmail', rotulo: 'Leitura do Gmail', em: txt(estado.ultimaExecucao), esperadoMin: 26 * 60 },
    { id: 'drive', rotulo: 'Mapa do Drive', em: txt(obj(saude?.raiz).atualizadoEm), esperadoMin: 26 * 60 },
    { id: 'backup', rotulo: 'Backup do banco', em: txt(obj(estado.backup).em), esperadoMin: 30 * 60 },
    // o resumo diário (robo/saudeBanco)
    { id: 'resumo', rotulo: 'Resumo diário do banco', em: resumo?.em || '', esperadoMin: 26 * 60 },
  ], agora);
}
