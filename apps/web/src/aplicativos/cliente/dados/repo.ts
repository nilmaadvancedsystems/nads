// De onde a Área do Cliente tira os dados. Por enquanto só a versão de exemplo; a do banco (areasCliente) entra aqui
// quando o robô começar a espelhar.
import type { RepoAreaCliente } from './areaCliente';
import { criarRepoAreaClienteMemoria } from './areaCliente.memoria';

export const repoAreaCliente: RepoAreaCliente = criarRepoAreaClienteMemoria();
