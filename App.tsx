import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Package,
  Calendar as CalendarIcon,
  BarChart3,
  ClipboardList,
  FileEdit,
  Truck,
  Tags,
  Menu,
  X,
  Upload,
  Download,
  LogOut,
  Loader2,
  FileSpreadsheet,
  CheckCircle,
  Mail,
  Hash,
  Settings,
  Moon,
  Sun,
  Globe
} from 'lucide-react';
import { Customer, Product, Order } from './types';
import { INITIAL_CUSTOMERS, INITIAL_PRODUCTS, INITIAL_ORDERS } from './constants';
import Dashboard from './components/Dashboard';
import CustomerManager from './components/CustomerManager';
import ProductManager from './components/ProductManager';
import OrderManager from './components/OrderManager';
import OrderCalendar from './components/OrderCalendar';
import OrderEditModal from './components/OrderEditModal';
import * as XLSX from 'xlsx';
import { db } from './firebase';
import { collection, doc, setDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';

const APP_VERSION = "Ver.1.39";
const COMPANY_NAME = "注文管理システム";

// Firestoreへの差分同期ヘルパー
function syncToFirestore<T extends { id: string }>(
  collectionName: string,
  prev: T[],
  next: T[]
) {
  const deletedIds = prev
    .filter(p => !next.find(n => n.id === p.id))
    .map(p => p.id);
  const upserted = next.filter(n => {
    const old = prev.find(p => p.id === n.id);
    return !old || JSON.stringify(old) !== JSON.stringify(n);
  });
  // Firestoreのバッチ処理は500件までなので注意
  if (deletedIds.length > 0) {
    const batch = writeBatch(db);
    deletedIds.forEach(id => batch.delete(doc(db, collectionName, id)));
    batch.commit();
  }
  if (upserted.length > 0) {
    const batch = writeBatch(db);
    upserted.forEach(item => batch.set(doc(db, collectionName, item.id), item));
    batch.commit();
  }
}

const App: React.FC = () => {
  type TabId = 'orders' | 'input' | 'delivery' | 'master' | 'stats';
  const [activeTab, setActiveTab] = useState<TabId>('orders');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初回ロード
  useEffect(() => {
    const loadData = async () => {
      try {
        const [custSnap, prodSnap, ordSnap] = await Promise.all([
          getDocs(collection(db, 'customers')),
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'orders')),
        ]);
        if (custSnap.empty) {
          const batch = writeBatch(db);
          INITIAL_CUSTOMERS.forEach(c => batch.set(doc(db, 'customers', c.id), c));
          await batch.commit();
          setCustomers(INITIAL_CUSTOMERS);
        } else {
          setCustomers(custSnap.docs.map(d => d.data() as Customer));
        }
        if (prodSnap.empty) {
          const batch = writeBatch(db);
          INITIAL_PRODUCTS.forEach(p => batch.set(doc(db, 'products', p.id), p));
          await batch.commit();
          setProducts(INITIAL_PRODUCTS);
        } else {
          setProducts(prodSnap.docs.map(d => d.data() as Product));
        }
        if (ordSnap.empty) {
          const batch = writeBatch(db);
          INITIAL_ORDERS.forEach(o => batch.set(doc(db, 'orders', o.id), o));
          await batch.commit();
          setOrders(INITIAL_ORDERS);
        } else {
          setOrders(ordSnap.docs.map(d => d.data() as Order));
        }
      } catch (error) {
        console.error('Firestoreからのデータ読み込みエラー:', error);
        alert('データの読み込みに失敗しました。');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Firestore対応セッター
  const setCustomersFS = useCallback((updater: React.SetStateAction<Customer[]>) => {
    setCustomers(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      syncToFirestore('customers', prev, next);
      return next;
    });
  }, []);

  const setProductsFS = useCallback((updater: React.SetStateAction<Product[]>) => {
    setProducts(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      syncToFirestore('products', prev, next);
      return next;
    });
  }, []);

  const setOrdersFS = useCallback((updater: React.SetStateAction<Order[]>) => {
    setOrders(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      syncToFirestore('orders', prev, next);
      return next;
    });
  }, []);

  const openOrderModal = (order: Order | null) => {
    setSelectedOrder(order);
    setIsOrderModalOpen(true);
  };
  
  const handleSaveOrder = async (newOrder: Order) => {
    if (selectedOrder) {
      setOrdersFS(prev => prev.map(o => o.id === selectedOrder.id ? newOrder : o));
    } else {
      setOrdersFS(prev => [newOrder, ...prev]);
    }
    setIsOrderModalOpen(false);
  };
  
  const handleDeleteOrder = async (orderId: string) => {
    setOrdersFS(prev => prev.filter(o => o.id !== orderId));
    setIsOrderModalOpen(false);
  };
  
  const handleShipOrder = async (orderId: string) => {
      const order = orders.find(o => o.id === orderId);
      if (!order || order.status === 'Shipped') return;
      
      const batch = writeBatch(db);
      const updatedOrder = { ...order, status: 'Shipped' as const };
      batch.set(doc(db, 'orders', orderId), updatedOrder);
      
      const updatedProducts = [...products];
      let productUpdated = false;
      for (const item of order.items) {
          const productIndex = updatedProducts.findIndex(p => p.id === item.productId);
          if (productIndex !== -1) {
              const newStock = updatedProducts[productIndex].stock - item.quantity;
              updatedProducts[productIndex] = { ...updatedProducts[productIndex], stock: newStock };
              batch.update(doc(db, 'products', item.productId), { stock: newStock });
              productUpdated = true;
          }
      }
      
      await batch.commit();
      
      setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
      if(productUpdated) {
          setProducts(updatedProducts);
      }
  };


  // ナビゲーション定義
  const navItems: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'orders', label: '注文一覧', icon: ClipboardList },
    { id: 'input', label: '注文入力', icon: FileEdit },
    { id: 'delivery', label: '納品・請求', icon: Truck },
    { id: 'master', label: 'マスタ管理', icon: Tags },
    { id: 'stats', label: '集計・レポート', icon: BarChart3 },
  ];

  const handleNavClick = (id: TabId) => {
    setActiveTab(id);
    setIsSidebarOpen(false);
  };
  
  // Excel出力
  const exportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const ordersData = orders.map(o => ({
        '注文ID': o.id, '顧客ID': o.customerId,
        '顧客名': customers.find(c => c.id === o.customerId)?.name || '',
        '合計金額': o.totalAmount, '注文日': o.orderDate, '出荷日': o.shippingDate,
        '納品日': o.deliveryDate, 'ステータス': o.status, '備考': o.memo,
        ...o.items.reduce((acc, item, index) => ({
          ...acc,
          [`商品ID_${index+1}`]: item.productId,
          [`商品名_${index+1}`]: products.find(p => p.id === item.productId)?.name || '',
          [`数量_${index+1}`]: item.quantity,
          [`単価_${index+1}`]: item.unitPrice
        }), {})
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ordersData), '注文一覧');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customers), '顧客マスタ');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products), '商品マスタ');
      XLSX.writeFile(wb, `OrderMaster_Backup_${new Date().toISOString().split('T')[0]}.xlsx`);
      alert("Excelファイルを出力しました。");
    } catch (e) {
      console.error(e);
      alert("Excelファイルの出力に失敗しました。");
    }
  };

  // Excel読込
  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 注文データの復元
        const orderSheet = workbook.Sheets['注文一覧'];
        if (orderSheet) {
          const importedOrders: any[] = XLSX.utils.sheet_to_json(orderSheet);
          const newOrders: Order[] = importedOrders.map(io => {
            const items = [];
            let i = 1;
            while(io[`商品ID_${i}`]) {
              items.push({
                productId: io[`商品ID_${i}`],
                quantity: io[`数量_${i}`],
                unitPrice: io[`単価_${i}`],
              });
              i++;
            }
            return {
              id: io['注文ID'], customerId: io['顧客ID'],
              totalAmount: io['合計金額'], orderDate: io['注文日'],
              shippingDate: io['出荷日'], deliveryDate: io['納品日'],
              status: io['ステータス'], memo: io['備考'], items,
            };
          });
          setOrdersFS(newOrders);
        }

        // 顧客データの復元
        const customerSheet = workbook.Sheets['顧客マスタ'];
        if (customerSheet) {
          const newCustomers: Customer[] = XLSX.utils.sheet_to_json(customerSheet);
          setCustomersFS(newCustomers);
        }
        
        // 商品データの復元
        const productSheet = workbook.Sheets['商品マスタ'];
        if (productSheet) {
          const newProducts: Product[] = XLSX.utils.sheet_to_json(productSheet);
          setProductsFS(newProducts);
        }

        alert("Excelからデータを復元しました。");
      } catch (error) {
        console.error("Excel import error:", error);
        alert("Excelファイルの読み込みに失敗しました。");
      } finally {
        // 同じファイルを連続で選択できるようにvalueをリセット
        if(fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const activeNavItem = navItems.find(item => item.id === activeTab)!;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
            <FileSpreadsheet className="text-white w-7 h-7" />
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>データを読み込んでいます...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans">
      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/40 backdrop-blur-sm md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-48 bg-indigo-600 text-white flex flex-col z-30 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-4 h-16 flex items-center">
          <h1 className="text-lg font-bold tracking-tight">{COMPANY_NAME}</h1>
        </div>
        
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === item.id
                  ? 'bg-indigo-700'
                  : 'text-indigo-200 hover:bg-indigo-500'
              }`}
            >
              <item.icon className="w-5 h-5 mr-3" />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-indigo-500/50">
           <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleExcelImport} className="hidden" />
           <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md text-indigo-200 hover:bg-indigo-500">
             <Upload className="w-5 h-5 mr-3" />
             <span>Excel読込</span>
           </button>
           <button onClick={exportToExcel} className="w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md text-indigo-200 hover:bg-indigo-500">
             <Download className="w-5 h-5 mr-3" />
             <span>Excel出力</span>
           </button>
           <button className="w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md text-red-200 hover:bg-red-500/30">
             <LogOut className="w-5 h-5 mr-3" />
             <span>ログアウト</span>
           </button>
        </div>

        <div className="px-4 py-2 text-center">
          <span className="text-[9px] font-mono opacity-60">{APP_VERSION}</span>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:ml-48">
        <header className="bg-white sticky top-0 h-16 flex items-center justify-between px-4 border-b z-10">
          <div className="flex items-center">
             <button
               className="md:hidden p-2 -ml-2 text-slate-600"
               onClick={() => setIsSidebarOpen(true)}
             >
               <Menu className="w-6 h-6" />
             </button>
             <div className="flex items-center gap-2 md:gap-3 ml-2">
                <activeNavItem.icon className="w-6 h-6 text-indigo-600 hidden sm:block" />
                <h2 className="text-lg font-bold text-slate-800">{activeNavItem.label}</h2>
             </div>
          </div>
          {/* Header content can be added here if needed */}
        </header>

        <main className="flex-1 overflow-y-auto p-3">
            <div className="w-full h-full">
                {activeTab === 'stats' && <Dashboard orders={orders} products={products} customers={customers} onNavigate={(tab) => setActiveTab(tab as TabId)} />}
                {activeTab === 'orders' && <OrderManager orders={orders} setOrders={setOrdersFS} customers={customers} products={products} viewType={'pre'} setViewType={() => {}} onEditOrder={openOrderModal} onShipOrder={handleShipOrder} />}
                {activeTab === 'input' && <OrderManager orders={orders} setOrders={setOrdersFS} customers={customers} products={products} viewType={'pre'} setViewType={() => {}} onEditOrder={openOrderModal} onShipOrder={handleShipOrder} />}
                {activeTab === 'delivery' && <OrderCalendar orders={orders} customers={customers} products={products} onEditOrder={openOrderModal} />}
                {activeTab === 'master' && 
                    <div className="space-y-6">
                        <CustomerManager customers={customers} setCustomers={setCustomersFS} />
                        <ProductManager products={products} setProducts={setProductsFS} orders={orders} />
                    </div>
                }
            </div>
        </main>
      </div>
      
      {/* Shared Edit Modal */}
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
    </div>
  );
};

export default App;