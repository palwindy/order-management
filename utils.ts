import { Customer } from './types';

export const sortCustomersById = (customers: Customer[]): Customer[] => {
  return [...customers].sort((a, b) => {
    // C001-01 → ['C001', '01'] に分解してソート
    const parseId = (id: string) => {
      const match = id.match(/^(C\d+)(?:-(\d+))?$/i);
      if (!match) return [id, ''];
      return [match[1], match[2] || ''];
    };
    const [aParent, aSub] = parseId(a.id);
    const [bParent, bSub] = parseId(b.id);
    if (aParent !== bParent) return aParent.localeCompare(bParent);
    return aSub.localeCompare(bSub);
  });
};
