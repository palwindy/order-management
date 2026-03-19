import React, { useState, useMemo, useEffect } from 'react';
import { Product, Order } from '../types';
import { CATEGORIES, CATEGORY_PREFIX } from '../constants';
import { PackagePlus, Trash2, Edit3, AlertTriangle } from 'lucide-react';

interface Props {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  orders: Order[];
}

const DEFAULT_TAB = '裏白';

const generateProductId = (products: Product[], category: string): string => {
  const prefix = CATEGORY_PREFIX[category] || 'Z';
  const numbers = products
    .filter(p => p.id.startsWith(prefix))
    .map(p => {
      const match = p.id.match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => n > 0)
    .sort((a, b) => a - b);

  let nextNum = 1;
  for (const num of numbers) {
    if (num === nextNum) {
      nextNum++;
    } else if (num > nextNum) {
      break;
    }
  }
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
};

const ProductManager: React.FC<Props> = ({ products, setProducts, orders }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [stock, setStock] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_TAB);
  const [category, setCategory] = useState<string>(DEFAULT_TAB);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!editingId) {
      setCategory(activeTab);
    }
  }, [activeTab, editingId]);

  const pendingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.filter(o => o.status === 'Pending').forEach(order => {
      order.items.forEach(item => {
        counts[item.productId] = (counts[item.productId] || 0) + item.quantity;
      });
    });
    return counts;
  }, [orders]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => (p.category || DEFAULT_TAB) === activeTab);
  }, [products, activeTab]);

  const nextAvailableId = useMemo(() => {
    return generateProductId(products, activeTab);
  }, [products, activeTab]);

  const handleSelectProduct = (product: Product) => {
    setEditingId(product.id);
    setName(product.name);
    setStock(String(product.stock ?? 0));
    setCategory(product.category || activeTab);
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setStock('');
    setCategory(activeTab);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const stockNum = parseInt(String(stock).replace(/,/g, ''), 10);
    const normalizedStock = Number.isNaN(stockNum) ? 0 : stockNum;
    const targetId = editingId || generateProductId(products, category);
    const newProduct: Product = {
      id: targetId,
      name: name.trim(),
      category: category,
      stock: normalizedStock,
    };

    if (editingId) {
      setProducts(prev => prev.map(p => (p.id === editingId ? newProduct : p)));
    } else {
      setProducts(prev => [newProduct, ...prev]);
    }
    resetForm();
  };

  const handleDelete = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    setDeletingProduct(product);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (!deletingProduct) return;
    setProducts(prev => prev.filter(p => p.id !== deletingProduct.id));
    if (editingId === deletingProduct.id) resetForm();
    setDeletingProduct(null);
    setIsDeleteConfirmOpen(false);
  };

  const isSubmitDisabled = !name.trim();

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-300 overflow-x-hidden">
      <div className="flex-shrink-0">
        <div className={`bg-white rounded-2xl p-4 shadow-sm border transition-all duration-300 ${editingId ? 'border-amber-200 ring-2 ring-amber-50' : 'border-slate-100'}`}>
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${editingId ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {editingId ? `編集: ${editingId}` : `新規: ${nextAvailableId}`}
              </span>
            </div>
            {editingId ? (
              <button onClick={resetForm} className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                キャンセル
              </button>
            ) : (
              <button
                onClick={() => {
                  resetForm();
                  setCategory(activeTab);
                }}
                className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md"
              >
                新規入力
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 ml-1">商品名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: ゆずり葉 (大)"
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 ml-1">在庫数</label>
                <input
                  type="text"
                  inputMode="numeric"
                  enterKeyHint="done"
                  value={stock}
                  onChange={(e) => setStock(e.target.value.replace(/,/g, ''))}
                  placeholder="0"
                  className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 ml-1">大分類</label>
                <div className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 font-bold text-slate-800">
                  {category}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSubmitDisabled}
            className={`w-full mt-4 py-3 rounded-xl font-black shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 text-sm ${isSubmitDisabled ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : (editingId ? 'bg-amber-500 text-white shadow-amber-100' : 'bg-indigo-600 text-white shadow-indigo-100')}`}>
            {editingId ? <Edit3 className="w-4 h-4" /> : <PackagePlus className="w-4 h-4" />}
            {editingId ? '変更を保存' : '商品を登録'}
          </button>
        </div>
      </div>

      <div className="mt-4 flex-shrink-0 overflow-x-hidden">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`px-4 py-2 rounded-full text-[11px] font-black whitespace-nowrap transition-all duration-300 border-2 ${
                activeTab === cat
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-1 space-y-2 pb-4">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => {
            const pendingCount = pendingCounts[product.id] || 0;
            return (
              <div
                key={product.id}
                onClick={() => handleSelectProduct(product)}
                className={`bg-white rounded-2xl p-4 shadow-sm border flex items-center justify-between transition-all active:scale-[0.98] cursor-pointer ${editingId === product.id ? 'border-amber-300 bg-amber-50/30' : 'border-slate-100 hover:border-indigo-100'}`}
              >
                <div>
                  <div className="font-black text-slate-700 flex items-center gap-2 text-sm">
                    {product.name}
                    {editingId === product.id && <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full animate-bounce">編集中</span>}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                    <span className="bg-slate-50 px-1.5 py-0.5 rounded text-[8px] border border-slate-100">{product.id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-base font-black text-indigo-600">{(product.stock || 0).toLocaleString()}</div>
                    <div className="text-[10px] font-bold text-slate-400">在庫</div>
                    <div className="text-[10px] font-bold text-slate-400">未出荷 {pendingCount.toLocaleString()}</div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, product)}
                    className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-10 text-slate-300 font-bold bg-white/50 rounded-3xl border-2 border-dashed border-slate-100 text-sm">
            このカテゴリは空です
          </div>
        )}
      </div>

      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h4 className="text-lg font-black text-slate-900 mb-2">商品を削除しますか？</h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-6 px-4">
                「{deletingProduct?.name}」を削除すると元に戻せません。
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={confirmDelete}
                  className="w-full py-3 bg-red-600 text-white rounded-xl font-black text-sm hover:bg-red-700 transition-all shadow-md active:scale-95"
                >
                  削除を実行する
                </button>
                <button
                  onClick={() => { setIsDeleteConfirmOpen(false); setDeletingProduct(null); }}
                  className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
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
