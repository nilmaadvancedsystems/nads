// O ViewModel da aba Fila: a fila do robô, ao vivo, e os clientes para o "Pedir para um cliente" (lidos só se o robô aceita).
import { useClientesDaCentral, useFilaDoRobo } from '../dados/repo';

export function useFila(robo: string, comClientes: boolean) {
  return { fila: useFilaDoRobo(robo), clientes: useClientesDaCentral(comClientes) };
}
