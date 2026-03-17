import React, { useState, useMemo } from 'react';
import { Order, Customer, Product, OrderStatus } from '../types';
import { Plus, Search, Truck, PackageCheck } from 'lucide-react';
import { getPrefectureFromAddress } from '../utils';

interface Props {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  customers: Customer[];
  products: Product[];
  viewType: 'pre' | 'post';
  setViewType: React.Dispatch<React.SetStateAction<'pre' | 'post'>>;
  onEditOrder: (order: Order | null) => void;
  onShipOrder: (orderId: string) => void;
  showShipped: boolean;
}

const OrderManager: React.FC<Props> = ({ orders, setOrders, customers, products, viewType, setViewType, onEditOrder, onShipOrder, showShipped }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmShipId, setConfirmShipId] = useState<string | null>(null);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const filteredOrders = useMemo(() => {
    return orders
      .filter(o => {
        if (!showShipped && o.status === 'Shipped') return false;
        if (showShipped && o.status === 'Pending') return false;
        
        const cust = customers.find(c => c.id === o.customerId);
        const searchStr = `${cust?.name} ${cust?.company}`.toLowerCase();
        return searchStr.includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => {
        const aMissing = !a.shippingDate || !a.deliveryDate;
        const bMissing = !b.shippingDate || !b.deliveryDate;
        if (aMissing && bMissing) return 0;
        if (aMissing) return 1;
        if (bMissing) return -1;
        const byShip = a.shippingDate.localeCompare(b.shippingDate);
        if (byShip !== 0) return byShip;
        return a.orderDate.localeCompare(b.orderDate);
      });
  }, [orders, showShipped, searchTerm, customers]);

  const handleConfirmShip = () => {
    if (confirmShipId) {
      onShipOrder(confirmShipId);
      setConfirmShipId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="会社名、顧客名などで検索..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => onEditOrder(null)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 active:scale-95 transition-all whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          新規注文登録
        </button>
      </div>

      {/* --- テーブル（PC用） --- */}
      <div className="hidden md:block rounded-3xl border shadow-sm overflow-hidden transition-all duration-700 bg-white border-slate-200">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className={`font-bold uppercase text-[10px] tracking-widest border-b border-slate-100 ${showShipped ? 'bg-slate-200/50 text-slate-600' : 'bg-slate-50/80 text-slate-500'}`}>
                <th className="px-6 py-5 whitespace-nowrap w-[130px]">出荷日</th>
                <th className="px-6 py-5 whitespace-nowrap w-[130px]">納品日</th>
                <th className="px-6 py-5 whitespace-nowrap">顧客・会社名</th>
                <th className="px-6 py-5 whitespace-nowrap">注文内容 (代表商品他)</th>
                <th className="px-6 py-5 whitespace-nowrap text-center">出荷済</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-slate-400 font-bold italic">該当する注文はありません</td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const customer = customers.find(c => c.id === order.customerId);
                  const firstItem = order.items[0];
                  const firstProduct = products.find(p => p.id === firstItem?.productId);
                  const isTodayShipment = order.shippingDate === todayStr && order.status === 'Pending';
                  const isDateUndecided = order.status === 'Pending' && (!order.shippingDate || !order.deliveryDate);
                  const prefecture = getPrefectureFromAddress(customer?.address);
                  
                  return (
                    <tr 
                      key={order.id} 
                      onClick={() => onEditOrder(order)}
                      className={`transition-all group cursor-pointer border-l-4 ${
                        isTodayShipment 
                          ? 'bg-rose-50/60 border-l-rose-500 hover:bg-rose-100/80' 
                          : isDateUndecided
                            ? `bg-amber-50/60 border-l-amber-400 hover:bg-amber-100/70 ${showShipped ? 'hover:bg-amber-100/70' : ''}`
                            : `border-l-transparent hover:border-l-indigo-400 ${showShipped ? 'hover:bg-slate-200/50' : 'hover:bg-indigo-50/40'}`
                      }`}
                    >
                      <td className="px-6 py-5">
                        <div className={`text-xs font-black flex items-center gap-1.5 ${isTodayShipment ? 'text-rose-600' : 'text-slate-700'}`}>
                          <Truck className={`w-3.5 h-3.5 ${isTodayShipment ? 'text-rose-500 animate-pulse' : 'text-indigo-400'}`} />
                          {order.shippingDate || '未定'}
                          {isTodayShipment && <span className="text-[9px] bg-rose-600 text-white px-1.5 rounded-full ml-1">本日</span>}
                          {isDateUndecided && !isTodayShipment && (
                            <span className="text-[9px] bg-amber-500 text-white px-1.5 rounded-full ml-1">日付未定</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                          <PackageCheck className="w-3.5 h-3.5 text-slate-400" />
                          {order.deliveryDate || '未定'}
                          {prefecture && (
                            <span className="text-[9px] font-black text-slate-500 ml-1">{prefecture}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="font-black text-slate-900 leading-tight mb-0.5 group-hover:text-indigo-700 transition-colors">{customer?.company}</div>
                        <div className="text-[11px] font-bold text-slate-400">{customer?.name} 様</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="font-bold text-slate-800">{firstProduct?.name || firstItem?.productId || '商品なし'}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isTodayShipment ? 'text-rose-600 bg-rose-100' : 'text-indigo-500 bg-indigo-50'}`}>x {(firstItem?.quantity ?? 0).toLocaleString()}</span>
                          {order.items.length > 1 && (
                            <span className="text-[10px] font-black text-slate-400">他 {order.items.length - 1} 点</span>
                          )}
                          {order.notes && (
                            <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                              備考あり
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        {order.status === 'Pending' ? (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setConfirmShipId(order.id); }}
                            className={`mx-auto w-12 h-12 flex flex-col items-center justify-center rounded-2xl transition-all shadow-sm active:scale-90 group/btn ${
                              isTodayShipment 
                                ? 'bg-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white' 
                                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'
                            }`}
                            title="出荷済みにする"
                          >
                            <Truck className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                            <span className="text-[9px] font-black mt-0.5">未出荷</span>
                          </button>
                        ) : (
                          <div className="mx-auto w-12 h-12 flex flex-col items-center justify-center bg-emerald-500 text-white rounded-2xl shadow-md">
                            <Truck className="w-5 h-5" />
                            <span className="text-[9px] font-black mt-0.5">出荷済み</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- カードリスト（スマホ用） --- */}
      <div className="md:hidden space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center text-slate-400 font-bold italic py-16">
            該当する注文はありません
          </div>
        ) : (
          filteredOrders.map(order => {
            const customer = customers.find(c => c.id === order.customerId);
            const firstItem = order.items[0];
            const firstProduct = products.find(p => p.id === firstItem?.productId);
            const isTodayShipment = order.shippingDate === todayStr && order.status === 'Pending';
            const isDateUndecided = order.status === 'Pending' && (!order.shippingDate || !order.deliveryDate);
            const prefecture = getPrefectureFromAddress(customer?.address);

            return (
              <div
                key={order.id}
                onClick={() => onEditOrder(order)}
                className={`bg-white rounded-2xl border shadow-sm p-4 cursor-pointer border-l-4 transition-all active:scale-[0.98] ${
                  isTodayShipment
                    ? 'bg-rose-50/60 border-l-rose-500'
                    : isDateUndecided
                      ? 'bg-amber-50/60 border-l-amber-400'
                      : 'border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`text-xs font-black flex items-center gap-1 ${isTodayShipment ? 'text-rose-600' : 'text-slate-700'}`}>
                      <Truck className={`w-3.5 h-3.5 ${isTodayShipment ? 'text-rose-500 animate-pulse' : 'text-indigo-400'}`} />
                      {order.shippingDate || '未定'}
                      {isTodayShipment && (
                        <span className="text-[9px] bg-rose-600 text-white px-1.5 rounded-full ml-1">本日</span>
                      )}
                      {isDateUndecided && !isTodayShipment && (
                        <span className="text-[9px] bg-amber-500 text-white px-1.5 rounded-full ml-1">日付未定</span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-400 flex items-center gap-1">
                      <PackageCheck className="w-3.5 h-3.5 text-slate-400" />
                      {order.deliveryDate || '未定'}
                      {prefecture && (
                        <span className="text-[9px] font-black text-slate-500 ml-1">{prefecture}</span>
                      )}
                    </div>
                  </div>
                  {order.status === 'Pending' ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmShipId(order.id); }}
                      className={`w-12 h-12 flex flex-col items-center justify-center rounded-2xl transition-all shadow-sm active:scale-90 ${
                        isTodayShipment
                          ? 'bg-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'
                      }`}
                    >
                      <Truck className="w-4 h-4" />
                      <span className="text-[9px] font-black mt-0.5">未出荷</span>
                    </button>
                  ) : (
                    <div className="w-12 h-12 flex flex-col items-center justify-center bg-emerald-500 text-white rounded-2xl shadow-md">
                      <Truck className="w-4 h-4" />
                      <span className="text-[9px] font-black mt-0.5">出荷済み</span>
                    </div>
                  )}
                </div>

                <div className="mb-1">
                  <div className="font-black text-slate-900 leading-tight">{customer?.company}</div>
                  <div className="text-[11px] font-bold text-slate-400">{customer?.name} 様</div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">{firstProduct?.name || firstItem?.productId || '商品なし'}</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isTodayShipment ? 'text-rose-600 bg-rose-100' : 'text-indigo-500 bg-indigo-50'}`}>
                    x {(firstItem?.quantity ?? 0).toLocaleString()}
                  </span>
                  {order.items.length > 1 && (
                    <span className="text-[10px] font-black text-slate-400">他 {order.items.length - 1} 点</span>
                  )}
                  {order.notes && (
                    <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      備考あり
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {confirmShipId && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-[32px] w-full max-w-sm shadow-2xl p-8 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Truck className="w-8 h-8 text-emerald-500" />
            </div>
            <h4 className="text-lg font-black text-slate-900 mb-3">出荷済みにしますか？</h4>
            <p className="text-xs text-slate-400 mb-8 leading-relaxed font-bold">
              この操作を実行すると在庫数が更新されます。
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleConfirmShip}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm hover:bg-emerald-700 transition-all shadow-xl active:scale-95"
              >
                出荷済みにする
              </button>
              <button
                onClick={() => setConfirmShipId(null)}
                className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManager;
