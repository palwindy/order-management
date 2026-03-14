
import React, { useState, useMemo } from 'react';
import { Order, Customer, Product } from '../types';
import { ChevronLeft, ChevronRight, X, Info, ChevronRight as ChevronIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';

interface Props {
  orders: Order[];
  customers: Customer[];
  products: Product[];
  onEditOrder: (order: Order) => void;
}

const OrderCalendar: React.FC<Props> = ({ orders, customers, products, onEditOrder }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const days = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const startPadding = startOfMonth(currentDate).getDay();

  // カレンダーの表示基準を出荷日に変更
  const selectedDayOrders = useMemo(() => {
    if (!selectedDay) return [];
    return orders.filter(o => isSameDay(new Date(o.shippingDate), selectedDay));
  }, [selectedDay, orders]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[calc(100vh-180px)]">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-6">
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">
            {format(currentDate, 'yyyy年 MMMM', { locale: ja })}
          </h3>
          <div className="flex gap-2 bg-slate-50 p-1 rounded-xl">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-500 hover:text-indigo-600">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button onClick={handleNextMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-500 hover:text-indigo-600">
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="px-4 py-2 text-sm font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all active:scale-95"
        >
          今日
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 shrink-0">
        {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
          <div key={d} className={`px-2 py-3 text-center text-xs font-black tracking-widest uppercase ${i === 0 ? 'text-red-400' : i === 6 ? 'text-indigo-400' : 'text-slate-400'}`}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 flex-1 bg-slate-50 gap-px overflow-hidden">
        {Array.from({ length: startPadding }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-slate-50/50 min-h-0"></div>
        ))}

        {days.map(day => {
          // 出荷日基準で集計
          const dayOrders = orders.filter(o => isSameDay(new Date(o.shippingDate), day));
          const isToday = isSameDay(day, new Date());
          
          return (
            <button 
              key={day.toISOString()} 
              onClick={() => setSelectedDay(day)}
              className="bg-white min-h-0 p-1 flex flex-col text-left group hover:bg-indigo-50 transition-all focus:outline-none"
            >
              <div className="flex justify-between items-center mb-0.5">
                <span className={`text-sm font-bold flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                  isToday ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 group-hover:text-indigo-600'
                }`}>
                  {format(day, 'd')}
                </span>
                {dayOrders.length > 0 && (
                  <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1 py-0 rounded-md font-black ring-1 ring-emerald-100">
                    {dayOrders.length}件
                  </span>
                )}
              </div>
              
              <div className="flex-1 overflow-hidden space-y-1 pr-0.5">
                {dayOrders.slice(0, 4).map(order => {
                  const customer = customers.find(c => c.id === order.customerId);
                  const isPending = order.status === 'Pending';
                  return (
                    <div
                      key={order.id}
                      className={`text-[9px] leading-tight truncate font-bold pl-0.5 border-l-2 ${
                        isPending
                          ? 'text-indigo-700 border-indigo-400'
                          : 'text-slate-400 border-slate-300 line-through'
                      }`}
                    >
                      {customer?.company || customer?.name || '不明'}
                    </div>
                  );
                })}
                {dayOrders.length > 4 && (
                  <div className="text-[8px] text-slate-400 font-bold pl-1">
                    +{dayOrders.length - 4}
                  </div>
                )}
              </div>
            </button>
          );
        })}
        
        {Array.from({ length: Math.ceil((startPadding + days.length) / 7) * 7 - (startPadding + days.length) }).map((_, i) => (
          <div key={`trailing-${i}`} className="bg-slate-50/50 min-h-0"></div>
        ))}
      </div>

      {selectedDay && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in duration-300 my-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100"><Info className="w-5 h-5" /></div>
                <div>
                   <h3 className="text-xl font-black text-slate-800 tracking-tight">
                    {format(selectedDay, 'yyyy年 MMMM d日', { locale: ja })}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">納品予定リスト (出荷日: {format(selectedDay, 'MM/dd')})</p>
                </div>
              </div>
              <button onClick={() => setSelectedDay(null)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-4">
              {selectedDayOrders.length === 0 ? (
                <div className="text-center py-12 text-slate-400 italic font-bold">この日の出荷予定はありません</div>
              ) : (
                selectedDayOrders.map(order => {
                  const customer = customers.find(c => c.id === order.customerId);
                  return (
                    <button 
                      key={order.id} 
                      onClick={() => onEditOrder(order)}
                      className="w-full text-left bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 transition-all hover:bg-white hover:border-indigo-300 hover:shadow-md group/card"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="font-black text-slate-900 leading-none group-hover/card:text-indigo-600 transition-colors">{customer?.company}</div>
                          <div className="text-xs font-bold text-slate-400 mt-1">{customer?.name} 様</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-black text-indigo-600">¥{order.totalAmount.toLocaleString()}</div>
                          <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 inline-block ${order.status === 'Shipped' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                            {order.status === 'Shipped' ? '出荷済' : '未出荷'}
                          </div>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-slate-200/50 space-y-1">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-[11px] font-bold text-slate-600">
                            <span className="truncate pr-4">{products.find(p => p.id === item.productId)?.name}</span>
                            <span className="shrink-0">x {item.quantity.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 flex items-center justify-end gap-1 text-[10px] font-black text-indigo-500 opacity-0 group-hover/card:opacity-100 transition-opacity">
                        詳細・編集 <ChevronIcon className="w-3 h-3" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            
            <div className="p-6 bg-slate-50/50 border-t border-slate-100">
              <button 
                onClick={() => setSelectedDay(null)}
                className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderCalendar;
