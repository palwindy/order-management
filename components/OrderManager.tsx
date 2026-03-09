
import React, { useState, useMemo } from 'react';
import { Order, Customer, Product, OrderStatus } from '../types';
import { Plus, Search, Truck } from 'lucide-react';

interface Props {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  customers: Customer[];
  products: Product[];
  viewType: 'pre' | 'post';
  setViewType: React.Dispatch<React.SetStateAction<'pre' | 'post'>>;
  onEditOrder: (order: Order | null) => void;
  onShipOrder: (orderId: string) => void;
}

const OrderManager: React.FC<Props> = ({ orders, setOrders, customers, products, viewType, onEditOrder, onShipOrder }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const filteredOrders = useMemo(() => {
    return orders
      .filter(o => {
        if (viewType === 'pre' && o.status === 'Shipped') return false;
        if (viewType === 'post' && o.status === 'Pending') return false;
        
        const cust = customers.find(c => c.id === o.customerId);
        const searchStr = `${cust?.name} ${cust?.company}`.toLowerCase();
        return searchStr.includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => new Date(a.shippingDate).getTime() - new Date(b.shippingDate).getTime());
  }, [orders, viewType, searchTerm, customers]);

  const handleMarkAsShipped = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onShipOrder(id);
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

      <div className={`rounded-3xl border shadow-sm overflow-hidden transition-all duration-700 ${viewType === 'post' ? 'bg-slate-100/70 border-slate-300' : 'bg-white border-slate-200'}`}>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className={`font-bold uppercase text-[10px] tracking-widest border-b border-slate-100 ${viewType === 'post' ? 'bg-slate-200/50 text-slate-600' : 'bg-slate-50/80 text-slate-500'}`}>
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
                  
                  return (
                    <tr 
                      key={order.id} 
                      onClick={() => onEditOrder(order)}
                      className={`transition-all group cursor-pointer border-l-4 ${
                        isTodayShipment 
                          ? 'bg-rose-50/60 border-l-rose-500 hover:bg-rose-100/80' 
                          : `border-l-transparent hover:border-l-indigo-400 ${viewType === 'post' ? 'hover:bg-slate-200/50' : 'hover:bg-indigo-50/40'}`
                      }`}
                    >
                      <td className="px-6 py-5">
                        <div className={`text-xs font-black flex items-center gap-1.5 ${isTodayShipment ? 'text-rose-600' : 'text-slate-700'}`}>
                          <Truck className={`w-3.5 h-3.5 ${isTodayShipment ? 'text-rose-500 animate-pulse' : 'text-indigo-400'}`} />
                          {order.shippingDate}
                          {isTodayShipment && <span className="text-[9px] bg-rose-600 text-white px-1.5 rounded-full ml-1">本日</span>}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />{order.deliveryDate}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="font-black text-slate-900 leading-tight mb-0.5 group-hover:text-indigo-700 transition-colors">{customer?.company}</div>
                        <div className="text-[11px] font-bold text-slate-400">{customer?.name} 様</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="font-bold text-slate-800">{firstProduct?.name || '商品なし'}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isTodayShipment ? 'text-rose-600 bg-rose-100' : 'text-indigo-500 bg-indigo-50'}`}>x {firstItem?.quantity}</span>
                          {order.items.length > 1 && (
                            <span className="text-[10px] font-black text-slate-400">他 {order.items.length - 1} 点</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        {order.status === 'Pending' ? (
                          <button 
                            onClick={(e) => handleMarkAsShipped(e, order.id)} 
                            className={`mx-auto w-10 h-10 flex items-center justify-center rounded-full transition-all shadow-sm active:scale-90 group/btn ${
                              isTodayShipment 
                                ? 'bg-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white' 
                                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'
                            }`}
                            title="出荷済みにする"
                          >
                            <Truck className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                          </button>
                        ) : (
                          <div className="mx-auto w-10 h-10 flex items-center justify-center bg-emerald-500 text-white rounded-full shadow-md">
                            <Truck className="w-5 h-5" />
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
    </div>
  );
};

export default OrderManager;
