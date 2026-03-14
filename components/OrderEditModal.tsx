
import React, { useState, useMemo } from 'react';
import { Order, Customer, Product, OrderStatus, OrderItem } from '../types';
import { CATEGORIES } from '../constants';
import { X, Info, Trash2, AlertTriangle, MinusCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editingOrder: Order | null;
  customers: Customer[];
  products: Product[];
  onSave: (order: Order) => void;
  onDelete: (orderId: string) => void;
}

const OrderEditModal: React.FC<Props> = ({ isOpen, onClose, editingOrder, customers, products, onSave, onDelete }) => {
  const [tempItems, setTempItems] = useState<any[]>(() => 
    editingOrder 
      ? editingOrder.items.map(item => ({ ...item })) 
      : [{ productId: '', quantity: '', unitPrice: '' }]
  );
  
  const [status, setStatus] = useState<OrderStatus>(editingOrder?.status || 'Pending');
  const [notes, setNotes] = useState<string>(editingOrder?.notes || '');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [focusedCell, setFocusedCell] = useState<string | null>(null);

  const [openSelectorIdx, setOpenSelectorIdx] = useState<number | null>(null);
  const [selectorStep, setSelectorStep] = useState<'category' | 'product'>('category');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isDirectInput, setIsDirectInput] = useState<{ [idx: number]: boolean }>({});
  const [productHistory, setProductHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('productSelectionHistory') || '[]');
    } catch { return []; }
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const [shippingDateVal, setShippingDateVal] = useState<string>(
    editingOrder?.shippingDate || todayStr
  );
  const [deliveryDateVal, setDeliveryDateVal] = useState<string>(
    editingOrder?.deliveryDate || todayStr
  );

  const totalAmount = useMemo(() => {
    return tempItems.reduce((sum, item) => {
      const price = parseFloat(item.unitPrice) || 0;
      const qty = parseInt(item.quantity) || 0;
      return sum + (price * qty);
    }, 0);
  }, [tempItems]);

  const updateProductHistory = (productId: string) => {
    setProductHistory(prev => {
      const newHistory = [productId, ...prev.filter(id => id !== productId)].slice(0, 100);
      localStorage.setItem('productSelectionHistory', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const getProductsByCategory = (category: string) => {
    const categoryProducts = products.filter(p => p.category === category);
    return [
      ...productHistory
        .map(id => categoryProducts.find(p => p.id === id))
        .filter((p): p is Product => !!p),
      ...categoryProducts.filter(p => !productHistory.includes(p.id)),
    ];
  };

  if (!isOpen) return null;

  const addItem = () => {
    if (tempItems.length < 10) {
      setTempItems([...tempItems, { productId: '', quantity: '', unitPrice: '' }]);
    }
  };

  const removeItem = (index: number) => {
    if (tempItems.length > 1) {
      const newItems = [...tempItems];
      newItems.splice(index, 1);
      setTempItems(newItems);
    }
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...tempItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setTempItems(newItems);
    if (errors.length > 0) setErrors([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const currentErrors: string[] = [];
    tempItems.forEach((item, idx) => {
      if (!item.productId || item.productId === '') {
        currentErrors.push(`${idx + 1}行目の商品名が選択されていません。`);
      }
      const q = Number(item.quantity);
      if (item.quantity === '' || isNaN(q) || q <= 0) {
        currentErrors.push(`${idx + 1}行目の数量を正しく入力してください。`);
      }
    });

    if (currentErrors.length > 0) {
      setErrors(currentErrors);
      return;
    }

    const formData = new FormData(e.currentTarget);
    const customerId = editingOrder?.customerId || formData.get('customerId') as string;
    const orderDate = editingOrder?.orderDate || new Date().toISOString().split('T')[0];
    const shippingDate = shippingDateVal;
    const deliveryDate = deliveryDateVal;

    const processedItems: OrderItem[] = tempItems.map(item => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        unitPrice: item.unitPrice === '' ? 0 : Number(item.unitPrice),
    }));

    const generateNewOrderId = () => {
      const datePart = orderDate.replace(/-/g, '');
      const uniquePart = Math.random().toString(36).substring(2, 6).toUpperCase();
      return `${customerId}-${datePart}-${uniquePart}`;
    };

    const newOrder: Order = {
      id: editingOrder?.id || generateNewOrderId(),
      customerId: customerId,
      items: processedItems,
      totalAmount: totalAmount,
      orderDate: orderDate,
      shippingDate: shippingDate,
      deliveryDate: deliveryDate,
      status: status,
      notes: notes.trim() || undefined,
    };

    onSave(newOrder);
  };

  const selectedCustomer = customers.find(c => c.id === (editingOrder?.customerId || ''));
  const isDateInvalid = status === 'Pending' && (shippingDateVal < todayStr || deliveryDateVal < todayStr);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto" onClick={() => openSelectorIdx !== null && setOpenSelectorIdx(null)}>
      <div className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-300 my-auto border border-slate-100" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 sm:p-8 border-b border-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100"><Info className="w-6 h-6" /></div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">{editingOrder ? '注文詳細・編集' : '新規注文登録'}</h3>
              {editingOrder && <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold tracking-widest mt-0.5 uppercase">ORDER ID: {editingOrder.id}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors"><X className="w-6 h-6" /></button>
        </div>
        
        <form onSubmit={handleSave} className="p-6 sm:p-8 space-y-6 sm:space-y-8 text-left">
          <div className="space-y-6 sm:space-y-8">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">顧客（会社名）</label>
              {editingOrder ? (
                <div className="w-full px-5 py-4 bg-slate-100 border border-slate-200 rounded-2xl text-base font-bold text-slate-600 cursor-not-allowed">
                  {selectedCustomer?.company} ({selectedCustomer?.name})
                </div>
              ) : (
                <div className="relative group">
                  <select 
                    name="customerId" 
                    required 
                    onKeyDown={handleKeyDown}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-base font-bold appearance-none focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all group-hover:bg-slate-100 text-slate-900"
                  >
                    <option value="">顧客を選択してください</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.company} ({c.name})</option>)}
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <X className="w-4 h-4 rotate-45" />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">注文商品リスト (最大10件)</label>
                {tempItems.length < 10 && (
                  <button type="button" onClick={addItem} className="text-[10px] sm:text-xs font-black text-white bg-indigo-600 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl hover:bg-indigo-700 shadow-md transition-all active:scale-95">+ 商品を追加</button>
                )}
              </div>
              <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
                {tempItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 sm:gap-3 items-end bg-slate-50 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 relative group/row transition-all hover:bg-white hover:shadow-md">
                    <div className="flex-[4] min-w-0">
                      <label className="block text-[8px] sm:text-[9px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">
                        商品名
                      </label>
                      {isDirectInput[idx] ? (
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={item.productId}
                            onChange={(e) => updateItem(idx, 'productId', e.target.value)}
                            placeholder="商品名を直接入力"
                            className="w-full px-2 sm:px-3 py-2 sm:py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setIsDirectInput(prev => ({ ...prev, [idx]: false }));
                              updateItem(idx, 'productId', '');
                            }}
                            className="text-slate-400 hover:text-slate-600 px-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setOpenSelectorIdx(idx);
                            setSelectorStep('category');
                            setSelectedCategory('');
                          }}
                          className={`w-full px-2 sm:px-3 py-2 sm:py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-bold text-left transition-colors ${
                            item.productId
                              ? 'border-indigo-200 text-slate-900'
                              : 'border-slate-200 text-slate-400'
                          }`}
                        >
                          {item.productId
                            ? (products.find(p => p.id === item.productId)?.name || item.productId)
                            : '商品を選択...'}
                        </button>
                      )}
                    </div>
                    <div className="w-12 sm:w-16">
                      <label className="block text-[8px] sm:text-[9px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">数量</label>
                      <input 
                        type="text" 
                        value={focusedCell === `${idx}-quantity` ? item.quantity : (item.quantity === '' ? '' : Number(item.quantity).toLocaleString())}
                        onFocus={() => setFocusedCell(`${idx}-quantity`)}
                        onBlur={(e) => {
                          setFocusedCell(null);
                          updateItem(idx, 'quantity', e.target.value.replace(/,/g, ''));
                        }}
                        onChange={(e) => updateItem(idx, 'quantity', e.target.value.replace(/,/g, ''))}
                        onKeyDown={handleKeyDown}
                        className={`w-full px-2 py-2 sm:py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-bold outline-none transition-colors text-slate-900 ${errors.some(e => e.includes(`${idx + 1}行目の数量`)) ? 'border-red-300' : 'border-slate-200'}`} 
                        placeholder="0"
                      />
                    </div>
                    <div className="w-16 sm:w-24">
                      <label className="block text-[8px] sm:text-[9px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">単価</label>
                      <input 
                        type="text" 
                        value={focusedCell === `${idx}-unitPrice` ? item.unitPrice : (item.unitPrice === '' ? '' : `¥${Number(item.unitPrice).toLocaleString()}`)}
                        onFocus={() => setFocusedCell(`${idx}-unitPrice`)}
                        onBlur={(e) => {
                          setFocusedCell(null);
                          updateItem(idx, 'unitPrice', e.target.value.replace(/[¥,]/g, ''));
                        }}
                        onChange={(e) => updateItem(idx, 'unitPrice', e.target.value.replace(/[¥,]/g, ''))}
                        onKeyDown={handleKeyDown}
                        className="w-full px-2 py-2 sm:py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold outline-none text-slate-900" 
                        placeholder="0"
                      />
                    </div>
                    {tempItems.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 pb-2 sm:pb-2.5 flex-shrink-0 transition-all active:scale-90"><MinusCircle className="w-5 h-5 sm:w-6 sm:h-6" /></button>
                    )}
                  </div>
                ))}
              </div>
              <div className="text-right font-bold text-sm text-slate-600 pr-4">合計金額: <span className="text-lg text-indigo-700 font-black">¥{totalAmount.toLocaleString()}</span></div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">出荷日</label>
                <input 
                  name="shippingDate" 
                  type="date" 
                  onKeyDown={handleKeyDown}
                  value={shippingDateVal}
                  onChange={(e) => setShippingDateVal(e.target.value)}
                  required 
                  className="w-full px-4 sm:px-5 py-3 sm:py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm sm:text-base font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all hover:bg-slate-100 text-slate-900" 
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">納品日</label>
                <input 
                  name="deliveryDate" 
                  type="date" 
                  onKeyDown={handleKeyDown}
                  value={deliveryDateVal}
                  onChange={(e) => setDeliveryDateVal(e.target.value)}
                  required 
                  className="w-full px-4 sm:px-5 py-3 sm:py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm sm:text-base font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all hover:bg-slate-100 text-slate-900" 
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">配送ステータス</label>
              <div className="flex items-center gap-3 sm:gap-4 bg-slate-50 p-1.5 sm:p-2 rounded-2xl w-fit border border-slate-100">
                <button 
                  type="button"
                  onClick={() => setStatus('Pending')}
                  className={`px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-black transition-all ${status === 'Pending' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  未出荷
                </button>
                <button 
                  type="button"
                  onClick={() => setStatus('Shipped')}
                  className={`px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 ${status === 'Shipped' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {status === 'Shipped' && <CheckCircle2 className="w-4 h-4" />}
                  出荷済
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">備考</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="備考があれば入力してください"
                className="w-full px-4 sm:px-5 py-3 sm:py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all hover:bg-slate-100 text-slate-900 resize-none"
              />
            </div>
          </div>
          
          <div className="pt-4 space-y-6">
            {isDateInvalid && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-700 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                出荷日・納品日は本日以降の日付を指定してください。
              </div>
            )}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 sm:p-5 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 text-red-600 font-black text-xs sm:text-sm mb-3">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" /> 保存できません：以下の項目を修正してください
                </div>
                <ul className="text-[10px] sm:text-xs text-red-500 font-bold list-disc list-inside space-y-1 sm:space-y-1.5 ml-1">
                  {errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}

            <div className="flex gap-4 sm:gap-6">
              <button type="button" onClick={onClose} className="flex-1 px-4 sm:px-8 py-4 sm:py-5 border-2 border-slate-100 rounded-[20px] sm:rounded-[24px] text-sm sm:text-base font-black text-slate-500 hover:bg-slate-50 transition-all">キャンセル</button>
              <button 
                type="submit" 
                disabled={isDateInvalid}
                className={`flex-1 px-4 sm:px-8 py-4 sm:py-5 rounded-[20px] sm:rounded-[24px] text-sm sm:text-base font-black shadow-xl transition-all bg-indigo-600 text-white shadow-indigo-200 ${isDateInvalid ? 'opacity-40 cursor-not-allowed' : 'hover:bg-indigo-700 active:scale-95'}`}
              >
                保存する
              </button>
            </div>
            
            {editingOrder && (
              <button type="button" onClick={() => setIsDeleteConfirmOpen(true)} className="w-full py-2 text-red-400 hover:text-red-600 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors">
                <Trash2 className="w-4 h-4" /> この注文を完全に削除する
              </button>
            )}
          </div>
        </form>
      </div>

      {openSelectorIdx !== null && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[150] p-6" onClick={(e) => { e.stopPropagation(); setOpenSelectorIdx(null);}}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>

            {selectorStep === 'category' ? (
              <>
                <div className="px-6 py-5 border-b border-slate-100">
                  <p className="text-sm font-black text-slate-500">大分類を選択</p>
                </div>
                <div className="overflow-y-auto max-h-[60vh]">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat);
                        setSelectorStep('product');
                      }}
                      className="w-full flex items-center justify-between px-6 py-4 text-sm font-bold text-slate-700 hover:bg-indigo-50 transition-colors border-b border-slate-50"
                    >
                      <span>{cat}</span>
                      <span className="text-slate-300 text-lg">»</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      if (openSelectorIdx !== null) {
                        setIsDirectInput(prev => ({ ...prev, [openSelectorIdx]: true }));
                        updateItem(openSelectorIdx, 'productId', '');
                      }
                      setOpenSelectorIdx(null);
                    }}
                    className="w-full flex items-center justify-between px-6 py-4 text-sm font-bold text-emerald-600 hover:bg-emerald-50 transition-colors"
                  >
                    <span>＋ 直接入力（新規項目）</span>
                    <span className="text-emerald-300 text-lg">»</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectorStep('category')}
                    className="text-indigo-500 font-black text-sm hover:text-indigo-700"
                  >
                    ＜
                  </button>
                  <p className="text-sm font-black text-indigo-600">{selectedCategory}</p>
                </div>
                <div className="overflow-y-auto max-h-[60vh]">
                  {getProductsByCategory(selectedCategory).length === 0 ? (
                    <p className="px-6 py-8 text-center text-slate-400 text-sm font-bold">
                      この大分類に商品がありません
                    </p>
                  ) : (
                    getProductsByCategory(selectedCategory).map(product => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => {
                          if (openSelectorIdx !== null) {
                            updateItem(openSelectorIdx, 'productId', product.id);
                            updateProductHistory(product.id);
                          }
                          setOpenSelectorIdx(null);
                        }}
                        className={`w-full text-left px-6 py-4 text-sm font-bold transition-colors border-b border-slate-50 ${
                          openSelectorIdx !== null && tempItems[openSelectorIdx]?.productId === product.id
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {product.name}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}

            <div className="px-6 py-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOpenSelectorIdx(null)}
                className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[32px] w-full max-w-sm shadow-2xl overflow-hidden p-8 sm:p-10 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6"><AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-red-500" /></div>
            <h4 className="text-lg sm:text-xl font-black text-slate-900 mb-3">注文を削除しますか？</h4>
            <p className="text-xs text-slate-400 mb-8 leading-relaxed font-bold">この操作は取り消せません。<br/>売上データからも除外されます。</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => onDelete(editingOrder!.id)} className="w-full py-3 sm:py-4 bg-red-600 text-white rounded-2xl font-black text-sm hover:bg-red-700 transition-all shadow-xl active:scale-95">削除を実行する</button>
              <button onClick={() => setIsDeleteConfirmOpen(false)} className="w-full py-3 sm:py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all">キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderEditModal;
