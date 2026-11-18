// Os robôs do Alterdata em PCs de pessoas (17/11/2026, Vitor: "esse robo de agora ta no pc de vitor... seria so pra ele usar";
// "se todo mundo for usar meu pc, lascou"). Cada um atende só o dono: o nads mostra o botão do Fiscal, com o nome, só para a
// conta dele, e o robô do PC (robo/alterdata-no-pc.js, que lê o mesmo robosDePc.json) só pega os pedidos dessa conta. Para outra
// pessoa ter o robô no PC: instala (robo/pc-alterdata) e acrescenta a máquina (pc-<nome do computador>), a conta e o rótulo aqui.
import lista from './robosDePc.json';

export interface RoboDePc { maquina: string; uid: string; rotulo: string }

export const ROBOS_DE_PC: readonly RoboDePc[] = lista;

/** O robô de PC da conta (pelo uid), ou null. */
export const roboDePcDaConta = (uid: string | null | undefined): RoboDePc | null => (uid ? ROBOS_DE_PC.find(r => r.uid === uid) || null : null);
