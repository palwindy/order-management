import React, { useMemo } from 'react';
import { Order, Product, Customer } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { TrendingUp, ShoppingBag, Users, DollarSign, ArrowRight, Package } from 'lucide-react';

interface Props {
  orders: Order[];
  products: Product[];
  customers: Customer[];
  onNavigate: (tab: 'orders' | 'calendar' | 'products' | 'customers' | 'stats') => void;
}

const Dashboard: React.FC<Props> = ({ orders, products, customers, onNavigate }) => {
  const stats = useMemo(() => {
    const totalSales = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const activeOrders = orders.filter(o => o.status === 'Pending').length;
    return {
      totalSales,
      activeOrders,
      customerCount: customers.length,
      productCount: products.length
    };
  }, [orders, customers, products]);

  const productAggregation = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    orders.forEach(o => {
      o.items.forEach(item => {
        const p = products.find(prod => prod.id === item.productId);
        const name = p ? p.name : '不明';
        const current = map.get(item.productId) || { name, total: 0 };
        map.set(item.productId, { ...current, total: current.total + (item.unitPrice * item.quantity) });
      });
    });
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [orders, products]);

  const quantityAggregation = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach(o => {
      o.items.forEach(item => {
        const p = products.find(prod => prod.id === item.productId);
        const name = p ? p.name : '不明';
        map.set(name, (map.get(name) || 0) + item.quantity);
      });
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [orders, products]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const statItems = [
    { label: '総売上金額', value: `¥${stats.totalSales.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', target: 'orders' as const },
    { label: '未出荷の案件', value: stats.activeOrders.toLocaleString(), icon: ShoppingBag, color: 'text-indigo-600', bg: 'bg-indigo-50', target: 'orders' as const },
    { label: '取引先数', value: stats.customerCount.toLocaleString(), icon: Users, color: 'text-amber-600', bg: 'bg-amber-50', target: 'customers' as const },
    { label: 'アイテム数', value: stats.productCount.toLocaleString(), icon: Package, color: 'text-violet-600', bg: 'bg-violet-50', target: 'products' as const },
  ];

  return (
    <div className="space-y-8 pb-10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statItems.map((item, i) => (
          <button 
            key={i} 
            onClick={() => onNavigate(item.target)}
            className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-indigo-300 hover:shadow-xl transition-all active:scale-95 flex flex-col h-full"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`${item.bg} p-3 rounded-xl transition-colors group-hover:bg-indigo-600`}>
                <item.icon className={`w-6 h-6 ${item.color} group-hover:text-white transition-colors`} />
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
            </div>
            <p className="text-slate-500 text-sm font-semibold mb-1">{item.label}</p>
            <p className="text-2xl font-black text-slate-900">{item.value}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-8">商品別 売上高トップ8</h3>
          <div style={{ width: '100%', height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productAggregation}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={11} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis fontSize={11} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => [`¥${value.toLocaleString()}`, '売上']}
                />
                <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-8">商品別 出荷数量比率 (Top 5)</h3>
          <div style={{ width: '100%', height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={quantityAggregation}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={130}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {quantityAggregation.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none' }}
                  formatter={(value) => [`${value.toLocaleString()}個`, '出荷量']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-6 mt-4">
            {quantityAggregation.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                <span className="text-xs text-slate-500 font-bold">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
