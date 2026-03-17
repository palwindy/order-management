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

export const getPrefectureFromAddress = (address?: string): string => {
  if (!address) return '';
  const match = address.match(/(東京都|北海道|大阪府|京都府|.{2,3}県)/);
  return match ? match[1] : '';
};
