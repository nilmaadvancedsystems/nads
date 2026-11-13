// O Administrativo (Vitor, 13/11/2026: "Coloca um botão Admistrativo. Quem vai ter acesso só diretor e dono. Dentro dessa pagina
// vai ter funcoes do administrativo, contratos, fichar pre cadastrais etc"): a Entrada de clientes; os Contratos vêm depois.
import { EmDesenvolvimento } from '../em-desenvolvimento/EmDesenvolvimento';
import { EntradaDeClientes } from './EntradaDeClientes';

export function Administrativo({ pagina }: { pagina: string }) {
  if (pagina === 'contratos') return <EmDesenvolvimento nome="Contratos" />;
  return <EntradaDeClientes />;
}
