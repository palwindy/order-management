
import React, { useState, useMemo } from 'react';
import { Product, Order } from '../types';
import { PackagePlus, Search, Trash2, AlertTriangle, X, ShoppingCart } from 'lucide-react';

interface Props {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  orders: Order[];
}

const ProductManager: React.FC<Props> = ({ products, setProducts, orders }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // 未出荷（Pending）の注文から各商品の需要数を計算
  const pendingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.filter(o => o.status === 'Pending').forEach(order => {
      order.items.forEach(item => {
        counts[item.productId] = (counts[item.productId] || 0) + item.quantity;
      });
    });
    return counts;
  }, [orders]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const confirmDelete = () => {
    if (editingProduct) {
      setProducts(prev => prev.filter(p => p.id !== editingProduct.id));
      setIsDeleteConfirmOpen(false);
      setIsModalOpen(false);
      setEditingProduct(null);
    }
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newProduct: Product = {
      id: editingProduct?.id || `p${Date.now()}`,
      name: formData.get('name') as string,
      stock: parseInt(formData.get('stock') as string),
    };

    if (editingProduct) {
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? newProduct : p));
    } else {
      setProducts(prev => [...prev, newProduct]);
    }
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="商品名で検索..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-400 font-medium">登録されている商品はありません</td>
                </tr>
              ) : (
                filteredProducts.map(product => {
                  const pendingCount = pendingCounts[product.id] || 0;
                  return (
                    <tr 
                      key={product.id} 
                      onClick={() => { setEditingProduct(product); setIsModalOpen(true); }}
                      className="hover:bg-indigo-50/50 transition-colors group cursor-pointer"
                    >
                      <td className="px-3 sm:px-6 py-4 font-bold text-slate-800 text-sm sm:text-base leading-snug">
                        <div className="line-clamp-2 group-hover:text-indigo-600 transition-colors break-words">
                          {product.name}
                        </div>
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
                        <div className="flex items-center justify-end">
                          <span className={`inline-block min-w-[65px] px-2.5 py-1.5 rounded-lg font-black text-xs sm:text-sm text-right ${
                            product.stock <= 0 ? 'bg-red-50 text-red-600 ring-1 ring-red-100' : 
                            product.stock < 10 ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-100' : 
                            'bg-slate-50 text-slate-900 ring-1 ring-slate-100'
                          }`}>
                            {product.stock.toLocaleString()}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">{editingProduct ? '商品の編集' : '商品の登録'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">商品名称</label>
                <input name="name" defaultValue={editingProduct?.name} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">現在の在庫数</label>
                <input name="stock" type="number" defaultValue={editingProduct?.stock} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
              </div>
              
              <div className="pt-6 space-y-3">
                <div className="flex gap-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">閉じる</button>
                  <button type="submit" className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg transition-all active:scale-95">保存する</button>
                </div>
                {editingProduct && (
                  <button 
                    type="button" 
                    onClick={(e) => { e.preventDefault(); setIsDeleteConfirmOpen(true); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl text-sm font-bold transition-all border border-transparent hover:border-red-100"
                  >
                    <Trash2 className="w-4 h-4" />
                    この商品を削除する
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl w-full max-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              <h4 className="text-xl font-black text-slate-900 mb-2">商品を削除しますか？</h4>
              <p className="text-sm text-slate-500 leading-relaxed mb-8 px-4">
                「{editingProduct?.name}」を削除すると、この商品のデータは元に戻せません。本当によろしいですか？
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
