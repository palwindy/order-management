
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Package, 
  ShoppingCart, 
  Calendar as CalendarIcon, 
  LayoutDashboard, 
  FileSpreadsheet, 
  Download,
  Settings,
  BrainCircuit,
  ChevronRight,
  Moon,
  Sun,
  Globe,
  LogOut,
  X,
  Loader2,
  CheckCircle,
  Mail,
  Hash
} from 'lucide-react';
import { Customer, Product, Order } from './types';
import { INITIAL_CUSTOMERS, INITIAL_PRODUCTS, INITIAL_ORDERS } from './constants';
import Dashboard from './components/Dashboard';
import CustomerManager from './components/CustomerManager';
import ProductManager from './components/ProductManager';
import OrderManager from './components/OrderManager';
import OrderCalendar from './components/OrderCalendar';
import GeminiInsights from './components/GeminiInsights';
import OrderEditModal from './components/OrderEditModal';
import * as XLSX from 'xlsx';

const APP_VERSION = "Ver.1.34";
const COMPANY_NAME = "裏白本舗";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'customers' | 'calendar' | 'dashboard' | 'insights'>('orders');
  const [viewType, setViewType] = useState<'pre' | 'post'>('pre');
  const [isContentVisible, setIsContentVisible] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  
  // Googleカレンダー設定用のステート
  const [googleAccount, setGoogleAccount] = useState(() => {
    return localStorage.getItem('googleAccount') || 'example@gmail.com';
  });
  const [googleCalendarId, setGoogleCalendarId] = useState(() => {
    return localStorage.getItem('googleCalendarId') || '出荷用';
  });
  const [isGoogleLinked, setIsGoogleLinked] = useState(() => {
    const saved = localStorage.getItem('isGoogleLinked');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // 注文編集用グローバルステート
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('customers');
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('orders');
    return saved ? JSON.parse(saved) : INITIAL_ORDERS;
  });

  useEffect(() => {
    localStorage.setItem('customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('orders', JSON.stringify(orders));
  }, [orders]);

  // 設定の永続化
  useEffect(() => {
    localStorage.setItem('googleAccount', googleAccount);
    localStorage.setItem('googleCalendarId', googleCalendarId);
    localStorage.setItem('isGoogleLinked', JSON.stringify(isGoogleLinked));
  }, [googleAccount, googleCalendarId, isGoogleLinked]);

  const handleSync = () => {
    setIsSyncing(true);
    setSyncDone(false);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncDone(true);
      setTimeout(() => setSyncDone(false), 3000);
    }, 2000);
  };

  const openOrderModal = (order: Order | null) => {
    setSelectedOrder(order);
    setIsOrderModalOpen(true);
  };

  const handleSaveOrder = (newOrder: Order) => {
    const oldOrder = selectedOrder;
    // ステータスが「未出荷」から「出荷済」になった場合、在庫を減らす
    const isTransitioningToShipped = newOrder.status === 'Shipped' && (!oldOrder || oldOrder.status === 'Pending');

    if (isTransitioningToShipped) {
      setProducts(prev => prev.map(p => {
        const item = newOrder.items.find(i => i.productId === p.id);
        return item ? { ...p, stock: p.stock - item.quantity } : p;
      }));
    }

    if (selectedOrder) {
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? newOrder : o));
    } else {
      setOrders(prev => [newOrder, ...prev]);
    }
    setIsOrderModalOpen(false);
  };

  const handleShipOrder = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status === 'Shipped') return;

    // 在庫減算
    setProducts(prev => prev.map(p => {
      const item = order.items.find(i => i.productId === p.id);
      return item ? { ...p, stock: p.stock - item.quantity } : p;
    }));

    // ステータス更新
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Shipped' } : o));
  };

  const handleDeleteOrder = (orderId: string) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
    setIsOrderModalOpen(false);
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const ordersData = orders.map(o => ({
      '注文ID': o.id,
      '顧客名': customers.find(c => c.id === o.customerId)?.name || '不明',
      '会社名': customers.find(c => c.id === o.customerId)?.company || '不明',
      '商品名': products.find(p => p.id === o.productId)?.name || '不明',
      '数量': o.items.reduce((sum, item) => sum + item.quantity, 0),
      '合計金額': o.totalAmount,
      '注文日': o.orderDate,
      '出荷日': o.shippingDate,
      '納品日': o.deliveryDate,
      'ステータス': o.status
    }));
    const wsOrders = XLSX.utils.json_to_sheet(ordersData);
    XLSX.utils.book_append_sheet(wb, wsOrders, '注文一覧');

    const customersData = customers.map(c => ({
      '名前': c.name,
      '会社名': c.company,
      'メール': c.email,
      '電話番号': c.phone,
      'FAX番号': c.fax,
      '郵便番号': c.zipCode || '',
      '住所': c.address,
      '備考': c.notes || ''
    }));
    const wsCustomers = XLSX.utils.json_to_sheet(customersData);
    XLSX.utils.book_append_sheet(wb, wsCustomers, '顧客一覧');

    XLSX.writeFile(wb, `${COMPANY_NAME}_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const navItems = [
    { id: 'orders', label: '注文管理', icon: ShoppingCart },
    { id: 'calendar', label: 'カレンダー', icon: CalendarIcon },
    { id: 'products', label: '商品管理', icon: Package },
    { id: 'customers', label: '顧客管理', icon: Users },
    { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
    { id: 'insights', label: 'AI分析', icon: BrainCircuit },
  ] as const;

  const handleNavClick = (id: typeof activeTab) => {
    setActiveTab(id);
    setIsContentVisible(true);
  };

  const toggleSidebar = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (isContentVisible) {
      setIsContentVisible(false);
    }
  };

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-950 text-slate-900'}`}>
      <aside 
        onClick={toggleSidebar}
        className={`border-r flex flex-col shadow-2xl z-20 transition-all duration-500 ease-in-out cursor-pointer relative shrink-0 ${
          isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        } ${
          isContentVisible ? 'w-[15%]' : 'w-[99%]'
        }`}
      >
        <div className={`flex items-center transition-all duration-500 ${isContentVisible ? 'justify-center py-4 px-2' : 'justify-start p-6 mb-2 gap-4'}`}>
          <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-100/20">
            <FileSpreadsheet className="text-white w-6 h-6" />
          </div>
          {!isContentVisible && (
            <div className="flex-1 flex items-center justify-between animate-in fade-in slide-in-from-left-4 duration-700 min-w-0">
              <div className="min-w-0">
                <h1 className={`text-3xl font-black tracking-tight whitespace-nowrap overflow-hidden text-ellipsis ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>注文管理システム</h1>
                <p className="text-sm text-indigo-400 font-bold tracking-widest uppercase">Smart Management</p>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(true); }}
                className={`p-3 rounded-2xl transition-all ml-4 ${isDarkMode ? 'bg-slate-700 text-slate-300 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
              >
                <Settings className="w-8 h-8" />
              </button>
            </div>
          )}
        </div>
        
        <nav className={`flex-1 flex flex-col overflow-y-auto custom-scrollbar ${isContentVisible ? 'mt-2 px-1 space-y-2 items-center' : 'justify-center max-w-2xl mx-auto w-full px-6 space-y-1.5 pb-6'}`}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`group w-full flex items-center rounded-xl transition-all duration-300 ${
                isContentVisible 
                ? `justify-center w-11 h-11 ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100/20' : isDarkMode ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-50'}` 
                : `px-8 py-3.5 text-2xl font-bold bg-slate-50 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:scale-[1.01] border border-transparent hover:border-indigo-100 shadow-sm ${isDarkMode ? 'bg-slate-700 text-slate-100 hover:bg-slate-600' : ''}`
              }`}
            >
              <div className={`flex items-center justify-center shrink-0 ${isContentVisible ? 'w-full h-full' : 'w-12 h-12'}`}>
                <item.icon className={`transition-transform group-hover:scale-110 ${isContentVisible ? 'w-5 h-5' : 'w-10 h-10'}`} />
              </div>
              {!isContentVisible && (
                <>
                  <span className="truncate flex-1 text-left whitespace-nowrap ml-1 text-2xl font-black">{item.label}</span>
                  <ChevronRight className="w-8 h-8 opacity-20 group-hover:opacity-100 group-hover:translate-x-2 transition-all" />
                </>
              )}
            </button>
          ))}
        </nav>

        <div className={`p-4 border-t flex flex-col items-center gap-3 ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'} ${!isContentVisible ? 'pb-8' : ''}`}>
          {!isContentVisible ? (
            <div className="w-full flex items-center justify-start gap-12 overflow-hidden pl-2">
              <span className="text-sm font-black text-slate-300 opacity-60 tracking-widest whitespace-nowrap">{APP_VERSION}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); exportToExcel(); }}
                className="flex-1 max-w-sm flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-2xl transition-all font-bold shadow-lg shadow-emerald-100/10 active:scale-95 py-5 text-xl whitespace-nowrap"
              >
                <Download className="w-6 h-6" />
                Excel出力
              </button>
              <span className="text-sm font-black text-slate-400 opacity-80 tracking-widest whitespace-nowrap">{COMPANY_NAME}</span>
            </div>
          ) : (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(true); }}
                className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all shadow-sm ${isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
              >
                <Settings className="w-5 h-5" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); exportToExcel(); }}
                className="w-11 h-11 flex items-center justify-center bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-xl transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
              >
                <Download className="w-5 h-5" />
              </button>
              <div className="flex flex-col items-start gap-0.5 w-full pt-2">
                <span className="text-[9px] font-black text-slate-400 tracking-wider whitespace-nowrap opacity-60 text-left">{APP_VERSION}</span>
                <span className={`text-[10px] font-black tracking-tighter whitespace-nowrap border-t w-full text-left pt-1 ${isDarkMode ? 'text-slate-300 border-slate-700' : 'text-slate-500 border-slate-200'}`}>
                  {COMPANY_NAME}
                </span>
              </div>
            </>
          )}
        </div>
      </aside>

      <main 
        className={`flex flex-col min-w-0 overflow-hidden transition-all duration-500 ease-in-out ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'} ${
          isContentVisible ? 'w-[85%]' : 'w-[1%]'
        }`}
      >
        {isContentVisible ? (
          <>
            <header className={`h-16 border-b flex items-center justify-between px-6 sm:px-10 shrink-0 transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 pr-4">
                <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${isDarkMode ? 'bg-slate-700' : 'bg-indigo-50'}`}>
                   {React.createElement(navItems.find(n => n.id === activeTab)?.icon || LayoutDashboard, { className: "w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" })}
                </div>
                <h2 className={`text-base sm:text-xl font-black tracking-tight whitespace-nowrap overflow-hidden text-ellipsis ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  {navItems.find(n => n.id === activeTab)?.label}
                </h2>
              </div>
              
              <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                 {activeTab === 'orders' && (
                   <div className="flex items-center gap-2 sm:gap-3 bg-slate-50/80 p-1.5 rounded-xl border border-slate-200">
                     <span className={`text-[9px] sm:text-[10px] font-black tracking-widest uppercase transition-colors ${viewType === 'pre' ? 'text-indigo-600' : 'text-slate-400'}`}>未出荷</span>
                     <button 
                       onClick={() => setViewType(viewType === 'pre' ? 'post' : 'pre')}
                       className={`relative inline-flex h-5 w-10 sm:h-6 sm:w-12 items-center rounded-full transition-all duration-300 focus:outline-none shadow-inner ${viewType === 'post' ? 'bg-indigo-600' : 'bg-slate-300'}`}
                       aria-label="出荷ステータス切り替え"
                     >
                       <span
                         className={`inline-block h-3.5 w-3.5 sm:h-4 sm:w-4 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${viewType === 'post' ? 'translate-x-5 sm:translate-x-7' : 'translate-x-1'}`}
                       />
                     </button>
                     <span className={`text-[9px] sm:text-[10px] font-black tracking-widest uppercase transition-colors ${viewType === 'post' ? 'text-indigo-600' : 'text-slate-400'}`}>出荷済</span>
                   </div>
                 )}

                 {activeTab === 'calendar' && (
                   <button 
                     onClick={handleSync}
                     disabled={isSyncing}
                     className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95 disabled:opacity-70 ${
                       syncDone ? 'bg-emerald-500 text-white shadow-emerald-100' : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'
                     }`}
                   >
                     {isSyncing ? (
                       <Loader2 className="w-3.5 h-3.5 animate-spin" />
                     ) : syncDone ? (
                       <CheckCircle className="w-3.5 h-3.5" />
                     ) : (
                       <CalendarIcon className="w-3.5 h-3.5" />
                     )}
                     <span className="hidden sm:inline">{isSyncing ? '同期中...' : syncDone ? '同期完了' : 'Google同期'}</span>
                     <span className="sm:hidden">{isSyncing ? '...' : syncDone ? '完了' : '同期'}</span>
                   </button>
                 )}

                 <div className="hidden md:flex flex-col items-end">
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">System Active</div>
                    <div className="text-xs font-bold text-emerald-500 flex items-center gap-1.5 whitespace-nowrap">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                 </div>
              </div>
            </header>

            <div className={`flex-1 overflow-auto custom-scrollbar p-4 sm:p-8 transition-colors ${isDarkMode ? 'bg-slate-900/50' : 'bg-slate-50/50'}`}>
              <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-right-8 duration-500 pb-12">
                {activeTab === 'dashboard' && <Dashboard orders={orders} products={products} customers={customers} onNavigate={setActiveTab} />}
                {activeTab === 'orders' && <OrderManager orders={orders} setOrders={setOrders} customers={customers} products={products} viewType={viewType} setViewType={setViewType} onEditOrder={openOrderModal} onShipOrder={handleShipOrder} />}
                {activeTab === 'customers' && <CustomerManager customers={customers} setCustomers={setCustomers} />}
                {activeTab === 'products' && <ProductManager products={products} setProducts={setProducts} orders={orders} />}
                {activeTab === 'calendar' && <OrderCalendar orders={orders} customers={customers} products={products} onEditOrder={openOrderModal} />}
                {activeTab === 'insights' && <GeminiInsights orders={orders} products={products} />}
              </div>
            </div>
          </>
        ) : (
          <div className="h-full w-full bg-slate-900 flex items-center justify-center opacity-10">
          </div>
        )}
      </main>

      {/* 共通の注文編集モーダル */}
      {isOrderModalOpen && (
        <OrderEditModal 
          isOpen={isOrderModalOpen}
          onClose={() => setIsOrderModalOpen(false)}
          editingOrder={selectedOrder}
          customers={customers}
          products={products}
          onSave={handleSaveOrder}
          onDelete={handleDeleteOrder}
        />
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className={`rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className={`p-6 border-b flex justify-between items-center ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
                  <Settings className="w-6 h-6" />
                </div>
                <h3 className={`text-xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>システム設定</h3>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-8 space-y-10 overflow-y-auto max-h-[75vh] custom-scrollbar">
              {/* 外観設定 */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">外観設定</h4>
                <div className={`flex items-center justify-between p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-white text-indigo-600 shadow-sm'}`}>
                      {isDarkMode ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
                    </div>
                    <div>
                      <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>ダークモード</div>
                      <div className="text-[10px] text-slate-500 font-medium leading-relaxed">画面全体の配色を切り替えます</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`w-14 h-7 rounded-full relative transition-all duration-300 ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${isDarkMode ? 'left-8' : 'left-1'}`}></div>
                  </button>
                </div>
              </div>

              {/* Googleカレンダー設定 */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Googleカレンダー連携</h4>
                <div className={`p-5 rounded-2xl border space-y-5 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-rose-500/10 text-rose-400' : 'bg-white text-rose-500 shadow-sm'}`}>
                        <CalendarIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>連携ステータス</div>
                        <div className="text-[10px] text-slate-500 font-medium leading-relaxed">出荷予定の自動同期設定</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsGoogleLinked(!isGoogleLinked)}
                      className={`w-14 h-7 rounded-full relative transition-all duration-300 ${isGoogleLinked ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${isGoogleLinked ? 'left-8' : 'left-1'}`}></div>
                    </button>
                  </div>

                  {isGoogleLinked && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-2">
                        <label className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          <Mail className="w-3 h-3" /> 連携中のアカウント
                        </label>
                        <input 
                          type="email"
                          value={googleAccount}
                          onChange={(e) => setGoogleAccount(e.target.value)}
                          className={`w-full px-4 py-3 rounded-xl text-sm font-bold outline-none border transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500 text-slate-800'}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          <Hash className="w-3 h-3" /> カレンダーID
                        </label>
                        <input 
                          type="text"
                          value={googleCalendarId}
                          onChange={(e) => setGoogleCalendarId(e.target.value)}
                          placeholder="出荷用"
                          className={`w-full px-4 py-3 rounded-xl text-sm font-bold outline-none border transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 focus:border-indigo-500 text-white' : 'bg-white border-slate-200 focus:border-indigo-500 text-slate-800'}`}
                        />
                        <p className="text-[9px] text-slate-400 font-bold px-1 italic">特定のカレンダーに同期したい場合はIDを入力してください</p>
                      </div>
                      <button className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black border border-indigo-100 hover:bg-indigo-100 transition-all flex items-center justify-center gap-2">
                        <Globe className="w-4 h-4" />
                        アカウント認証を再実行
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* その他 */}
              <div className="pt-6">
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className={`w-full py-4 rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95 ${isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 shadow-slate-900/40' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200'}`}
                >
                  設定を保存して閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
