import React, { useState, useMemo, useEffect } from 'react';
import { Product, Order } from '../types';
import { CATEGORIES, CATEGORY_PREFIX, DEFAULT_CATEGORY } from '../constants';
import { PackagePlus, Trash2, AlertTriangle } from 'lucide-react';

interface Props {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  orders: Order[];
}

const generateProductId = (products: Product[], category: string): string => {
  const prefix = CATEGORY_PREFIX[category] || 'Z';
  const numbers = products
    .filter(p => p.id.startsWith(prefix))
    .map(p => {
      const match = p.id.match(new RegExp(`^${prefix}(\d+)$`, 'i'));
      return match ? parseInt(match[1], 10) : 0;
    });
  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
};

const ProductManager: React.FC<Props> = ({ products, setProducts, orders }) => {
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { name: string; category: string; stock: string }>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newDraft, setNewDraft] = useState({ name: '', category: DEFAULT_CATEGORY, stock: '' });

  const handleEnterBlur = (e: React.KeyboardEvent, onCommit?: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (onCommit) onCommit();
      (e.currentTarget as HTMLElement).blur();
    }
  };

  useEffect(() => {
    const next: Record<string, { name: string; category: string; stock: string }> = {};
    products.forEach(p => {
      next[p.id] = {
        name: p.name,
        category: p.category || DEFAULT_CATEGORY,
        stock: String(p.stock ?? 0),
      };
    });
    setDrafts(next);
  }, [products]);

  const pendingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.filter(o => o.status === 'Pending').forEach(order => {
      order.items.forEach(item => {
        counts[item.productId] = (counts[item.productId] || 0) + item.quantity;
      });
    });
    return counts;
  }, [orders]);

  const filteredProducts = products;

  const confirmDelete = () => {
    if (deletingProduct) {
      setProducts(prev => prev.filter(p => p.id !== deletingProduct.id));
      setIsDeleteConfirmOpen(false);
      setDeletingProduct(null);
    }
  };

  const updateDraft = (id: string, field: 'name' | 'category' | 'stock', value: string) => {
    setDrafts(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const saveDraft = (id: string) => {
    const draft = drafts[id];
    const current = products.find(p => p.id === id);
    if (!draft || !current) return;
    const name = draft.name.trim();
    if (!name) return;
    const category = draft.category || DEFAULT_CATEGORY;
    const stock = parseInt(draft.stock.replace(/,/g, ''), 10);
    const normalizedStock = Number.isNaN(stock) ? 0 : stock;
    if (
      current.name === name &&
      current.category === category &&
      current.stock === normalizedStock
    ) {
      return;
    }
    const updated: Product = {
      ...current,
      name,
      category,
      stock: normalizedStock,
    };
    setProducts(prev => prev.map(p => (p.id === id ? updated : p)));
  };

  const canSaveNew = newDraft.name.trim() !== '';

  const saveNewDraft = () => {
    if (!canSaveNew) return;
    const category = newDraft.category || DEFAULT_CATEGORY;
    const stock = parseInt(newDraft.stock.replace(/,/g, ''), 10);
    const normalizedStock = Number.isNaN(stock) ? 0 : stock;
    const newProduct: Product = {
      id: generateProductId(products, category),
      name: newDraft.name.trim(),
      category,
      stock: normalizedStock,
    };
    setProducts(prev => [newProduct, ...prev]);
    setIsAdding(false);
    setNewDraft({ name: '', category: DEFAULT_CATEGORY, stock: '' });
  };

  const groupedProducts = CATEGORIES.map(cat => ({
    category: cat,
    items: filteredProducts.filter(p => p.category === cat),
  })).filter(group => group.items.length > 0);

  const uncategorized = filteredProducts.filter(
    p => !p.category || !CATEGORIES.includes(p.category)
  );
  if (uncategorized.length > 0) {
    groupedProducts.push({ category: 'その他・未定', items: uncategorized });
  }
  if (isAdding && !groupedProducts.find(g => g.category === newDraft.category)) {
    groupedProducts.unshift({ category: newDraft.category, items: [] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-sm font-bold text-slate-500">商品一覧（直接編集）</div>
        <button
          onClick={() => {
            setIsAdding(true);
            setNewDraft({ name: '', category: DEFAULT_CATEGORY, stock: '' });
          }}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl transition-all text-sm font-bold shadow-lg shadow-indigo-100 active:scale-95"
        >
          <PackagePlus className="w-4 h-4" />
          新規商品登録
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
                <th className="px-3 sm:px-6 py-4">商品名称</th>
                <th className="px-1 py-4 w-[85px] text-right leading-tight whitespace-nowrap">
                  注文総数<br/><span className="text-[8px] opacity-70">(未出荷)</span>
                </th>
                <th className="px-3 sm:px-6 py-4 w-[85px] text-right">在庫数</th>
                <th className="px-3 sm:px-4 py-4 w-[70px] text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">登録されている商品はありません</td>
                </tr>
              ) : (
                groupedProducts.map(({ category, items }) => (
                  <React.Fragment key={category}>
                    <tr className="bg-indigo-50/60">
                      <td colSpan={4} className="px-3 sm:px-6 py-2 text-xs font-black text-indigo-500 tracking-widest">
                        {category}
                      </td>
                    </tr>
                    {isAdding && category === newDraft.category && (
                      <tr className="bg-indigo-50/30">
                        <td className="px-3 sm:px-6 py-4">
                          <input
                            value={newDraft.name}
                            onChange={(e) => setNewDraft(prev => ({ ...prev, name: e.target.value }))}
                            onKeyDown={(e) => handleEnterBlur(e, saveNewDraft)}
                            placeholder="商品名を入力"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                          <select
                            value={newDraft.category}
                            onChange={(e) => setNewDraft(prev => ({ ...prev, category: e.target.value }))}
                            onKeyDown={handleEnterBlur}
                            className="mt-2 w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                          >
                            {CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                            <option value="その他・未定">その他・未定</option>
                          </select>
                        </td>
                        <td className="px-1 py-4 text-right">
                          <span className="text-slate-300 text-xs">—</span>
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-right">
                          <input
                            value={newDraft.stock}
                            onChange={(e) => setNewDraft(prev => ({ ...prev, stock: e.target.value.replace(/,/g, '') }))}
                            onKeyDown={(e) => handleEnterBlur(e, saveNewDraft)}
                            inputMode="numeric"
                            enterKeyHint="done"
                            placeholder="0"
                            className="w-full text-right px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </td>
                        <td className="px-3 sm:px-4 py-4 text-right">
                          <div className="flex flex-col gap-2 items-end">
                            <button
                              type="button"
                              onClick={saveNewDraft}
                              disabled={!canSaveNew}
                              className={`text-xs font-bold px-3 py-2 rounded-lg ${canSaveNew ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                            >
                              保存
                            </button>
                            <button
                              type="button"
                              onClick={() => { setIsAdding(false); setNewDraft({ name: '', category: DEFAULT_CATEGORY, stock: '' }); }}
                              className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                            >
                              取消
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {items.map(product => {
                      const pendingCount = pendingCounts[product.id] || 0;
                      const draft = drafts[product.id] || { name: product.name, category: product.category || DEFAULT_CATEGORY, stock: String(product.stock ?? 0) };
                      return (
                        <tr 
                          key={product.id} 
                          className="hover:bg-indigo-50/50 transition-colors group"
                        >
                          <td className="px-3 sm:px-6 py-4">
                            <input
                              value={draft.name}
                              onChange={(e) => updateDraft(product.id, 'name', e.target.value)}
                              onBlur={() => saveDraft(product.id)}
                              onKeyDown={(e) => handleEnterBlur(e, () => saveDraft(product.id))}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <select
                              value={draft.category}
                              onChange={(e) => updateDraft(product.id, 'category', e.target.value)}
                              onBlur={() => saveDraft(product.id)}
                              onKeyDown={(e) => handleEnterBlur(e, () => saveDraft(product.id))}
                              className="mt-2 w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                              {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                              <option value="その他・未定">その他・未定</option>
                            </select>
                          </td>
                          <td className="px-1 py-4 text-right">
                            <div className="flex items-center justify-end">
                              <span className={`inline-block px-2.5 py-1.5 rounded-lg font-black text-xs sm:text-sm min-w-[45px] text-center ${
                                pendingCount > 0 ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100' : 'text-slate-300'
                              }`}>
                                {pendingCount.toLocaleString()}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-4 text-right">
                            <input
                              value={draft.stock}
                              onChange={(e) => updateDraft(product.id, 'stock', e.target.value.replace(/,/g, ''))}
                              onBlur={() => saveDraft(product.id)}
                              onKeyDown={(e) => handleEnterBlur(e, () => saveDraft(product.id))}
                              inputMode="numeric"
                              enterKeyHint="done"
                              className="w-full text-right px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                          </td>
                          <td className="px-3 sm:px-4 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => { setDeletingProduct(product); setIsDeleteConfirmOpen(true); }}
                              className="text-red-500 hover:text-red-600 text-xs font-bold"
                            >
                              削除
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl w-full max-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              <h4 className="text-xl font-black text-slate-900 mb-2">商品を削除しますか？</h4>
              <p className="text-sm text-slate-500 leading-relaxed mb-8 px-4">
                「{deletingProduct?.name}」を削除すると、この商品のデータは元に戻せません。本当によろしいですか？
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={confirmDelete}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-sm hover:bg-red-700 transition-all shadow-xl shadow-red-100 active:scale-95"
                >
                  削除を実行する
                </button>
                <button 
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductManager;
