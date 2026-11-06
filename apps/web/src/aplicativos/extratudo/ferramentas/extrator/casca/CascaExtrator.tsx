// View: o Extrator dentro da casca do Extratudo.
import type { ReactNode } from 'react';
import { CascaExtratudo } from '../../../casca/CascaExtratudo';
import { useCascaExtrator } from './useCascaExtrator';

export function CascaExtrator({ children }: { children: ReactNode }) {
  const vm = useCascaExtrator();
  return <CascaExtratudo {...vm}>{children}</CascaExtratudo>;
}
