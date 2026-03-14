import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Package,
  Calendar as CalendarIcon,
  BarChart3,
  ClipboardList,
  Menu,
  X,
  Upload,
  Download,
  LogOut,
  Loader2,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react';
import { Customer, Product, Order } from './types';
import { INITIAL_CUSTOMERS, INITIAL_PRODUCTS, INITIAL_ORDERS } from './constants';
import Dashboard from './components/Dashboard';
import CustomerManager from './components/CustomerManager';
import ProductManager from './components/ProductManager';
import OrderManager from './components/OrderManager';
import OrderCalendar from './components/OrderCalendar';
import OrderEditModal from './components/OrderEditModal';
import * as XLSX from 'xlsx-js-style';
import { db } from './firebase';
import { collection, doc, setDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';

const APP_VERSION = "Ver.1.50";
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
  type TabId = 'orders' | 'calendar' | 'products' | 'customers' | 'stats';
  const [activeTab, setActiveTab] = useState<TabId>('orders');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showShipped, setShowShipped] = useState(false);

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
          setProducts(prodSnap.docs.map(d => {
            const data = d.data() as Product;
            return { ...data, category: data.category || '' };
          }));
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
    const prevOrder = orders.find(o => o.id === newOrder.id);

    // 出荷済 → 未出荷 に戻す場合：在庫を元に戻す
    if (prevOrder?.status === 'Shipped' && newOrder.status === 'Pending') {
      const batch = writeBatch(db);
      batch.set(doc(db, 'orders', newOrder.id), newOrder);

      const updatedProducts = [...products];
      for (const item of prevOrder.items) {
        const idx = updatedProducts.findIndex(p => p.id === item.productId);
        if (idx !== -1) {
          const restoredStock = updatedProducts[idx].stock + item.quantity;
          updatedProducts[idx] = { ...updatedProducts[idx], stock: restoredStock };
          batch.update(doc(db, 'products', item.productId), { stock: restoredStock });
        }
      }
      await batch.commit();
      setOrders(prev => prev.map(o => o.id === newOrder.id ? newOrder : o));
      setProducts(updatedProducts);

    // 未出荷 → 出荷済 に変更して保存する場合：在庫を減らす
    } else if (prevOrder?.status === 'Pending' && newOrder.status === 'Shipped') {
      await handleShipOrder(newOrder.id);
      // handleShipOrder 内で保存済みのため、追加の setOrders は不要

    // ステータス変更なし（通常の編集保存）
    } else {
      setOrdersFS(prev => prev.map(o => o.id === newOrder.id ? newOrder : o));
    }

    // 新規登録の場合
    if (!prevOrder) {
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
    { id: 'orders',    label: '注文管理',       icon: ClipboardList },
    { id: 'calendar',  label: 'カレンダー',     icon: CalendarIcon },
    { id: 'products',  label: '商品管理',       icon: Package },
    { id: 'customers', label: '顧客管理',       icon: Users },
    { id: 'stats',     label: '集計・レポート', icon: BarChart3 },
  ];

  const handleNavClick = (id: TabId) => {
    setActiveTab(id);
    setIsSidebarOpen(false);
  };
  
  const exportToExcel = () => {
    try {
        const today = new Date();
        const year = today.getFullYear();
        const dateStr = today.toISOString().split('T')[0];
        const fileName = `${year}年注文管理（${dateStr}）.xlsx`;

        const wb = XLSX.utils.book_new();
        
        const statusLabel: Record<string, string> = {
            'Pending': '未出荷',
            'Shipped': '出荷済',
        };

        // --- 注文一覧シート ---
        const headers = ['注文ID', '顧客ID', '顧客名', '注文日', '出荷日', '納品日', 'ステータス', '商品ID', '商品名', '数量', '単価', '小計'];
        const rows: any[][] = [headers];

        orders.forEach(order => {
            const customer = customers.find(c => c.id === order.customerId);
            const customerName = customer?.name || '';

            if (order.items.length === 0) {
                rows.push([
                    order.id, order.customerId, customerName,
                    order.orderDate, order.shippingDate, order.deliveryDate,
                    statusLabel[order.status] ?? order.status,
                    '', '', '', '', ''
                ]);
            } else {
                order.items.forEach((item, index) => {
                    const product = products.find(p => p.id === item.productId);
                    const productName = product?.name || '';
                    const subtotal = item.quantity * item.unitPrice;

                    if (index === 0) {
                        rows.push([
                            order.id, order.customerId, customerName,
                            order.orderDate, order.shippingDate, order.deliveryDate,
                            statusLabel[order.status] ?? order.status,
                            item.productId, productName, item.quantity, item.unitPrice, subtotal
                        ]);
                    } else {
                        rows.push([
                            '', '', '', '', '', '',
                            '',
                            item.productId, productName, item.quantity, item.unitPrice, subtotal
                        ]);
                    }
                });
            }
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);

        const range = XLSX.utils.decode_range(ws['!ref']!)
        for (let R = range.s.r; R <= range.e.r; R++) {
            for (let C = range.s.c; C <= range.e.c; C++) {
                const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[cellAddr]) ws[cellAddr] = { v: '', t: 's' };
                ws[cellAddr].s = {
                    border: {
                        top: { style: 'thin', color: { rgb: '000000' } },
                        bottom: { style: 'thin', color: { rgb: '000000' } },
                        left: { style: 'thin', color: { rgb: '000000' } },
                        right: { style: 'thin', color: { rgb: '000000' } },
                    },
                    font: R === 0 ? { bold: true } : undefined,
                    fill: R === 0 ? { fgColor: { rgb: 'E8EAF6' } } : undefined,
                };
            }
        }

        ws['!cols'] = [
            { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, 
            { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 8 }, { wch: 10 }, { wch: 12 },
        ];

        XLSX.utils.book_append_sheet(wb, ws, '注文一覧');

        // --- 顧客マスタシート ---
        const customerHeaders = ['顧客ID', '会社名', '担当者', '郵便番号', '住所', '電話番号', 'FAX番号', 'メール', '備考'];
        const customerRows: any[][] = [customerHeaders];
        customers.forEach(c => {
            customerRows.push([
                c.id,
                c.company,
                c.name,
                c.zipCode ?? '',
                c.address,
                c.phone,
                c.fax,
                c.email,
                c.notes ?? '',
            ]);
        });
        const wsCustomers = XLSX.utils.aoa_to_sheet(customerRows);
        const customerRange = XLSX.utils.decode_range(wsCustomers['!ref']!)
        for (let R = customerRange.s.r; R <= customerRange.e.r; R++) {
            for (let C = customerRange.s.c; C <= customerRange.e.c; C++) {
                const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
                if (!wsCustomers[cellAddr]) wsCustomers[cellAddr] = { v: '', t: 's' };
                wsCustomers[cellAddr].s = {
                    border: {
                        top: { style: 'thin', color: { rgb: '000000' } },
                        bottom: { style: 'thin', color: { rgb: '000000' } },
                        left: { style: 'thin', color: { rgb: '000000' } },
                        right: { style: 'thin', color: { rgb: '000000' } },
                    },
                    font: R === 0 ? { bold: true } : undefined,
                    fill: R === 0 ? { fgColor: { rgb: 'E8EAF6' } } : undefined,
                };
            }
        }
        wsCustomers['!cols'] = [
            { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 30 },
            { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 30 },
        ];
        XLSX.utils.book_append_sheet(wb, wsCustomers, '顧客マスタ');
        
        // --- 商品マスタシート ---
        const productHeaders = ['商品ID', '商品名', 'カテゴリー', '在庫数'];
        const productRows: any[][] = [productHeaders];
        products.forEach(p => {
            productRows.push([p.id, p.name, p.category || '', p.stock]);
        });
        const wsProducts = XLSX.utils.aoa_to_sheet(productRows);
        const productRange = XLSX.utils.decode_range(wsProducts['!ref']!)
        for (let R = productRange.s.r; R <= productRange.e.r; R++) {
            for (let C = productRange.s.c; C <= productRange.e.c; C++) {
                const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
                if (!wsProducts[cellAddr]) wsProducts[cellAddr] = { v: '', t: 's' };
                wsProducts[cellAddr].s = {
                    border: {
                        top: { style: 'thin', color: { rgb: '000000' } },
                        bottom: { style: 'thin', color: { rgb: '000000' } },
                        left: { style: 'thin', color: { rgb: '000000' } },
                        right: { style: 'thin', color: { rgb: '000000' } },
                    },
                    font: R === 0 ? { bold: true } : undefined,
                    fill: R === 0 ? { fgColor: { rgb: 'E8EAF6' } } : undefined,
                };
            }
        }
        wsProducts['!cols'] = [
            { wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 10 },
        ];
        XLSX.utils.book_append_sheet(wb, wsProducts, '商品マスタ');

        XLSX.writeFile(wb, fileName);
        alert("Excelファイルを出力しました。");
    } catch (e) {
        console.error(e);
        alert("Excelファイルの出力に失敗しました。");
    }
  };

  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });

            const statusReverse: Record<string, string> = {
                '未出荷': 'Pending',
                '出荷済': 'Shipped',
            };

            // --- 注文一覧シート ---
            const orderSheet = workbook.Sheets['注文一覧'];
            if (orderSheet) {
                const rows: any[][] = XLSX.utils.sheet_to_json(orderSheet, { header: 1 });
                const dataRows = rows.slice(1);
                const ordersMap = new Map<string, Order>();

                dataRows.forEach(row => {
                    const [orderId, customerId, , orderDate, shippingDate, deliveryDate, statusJa, productId, , quantity, unitPrice] = row;
                    const hasOrderInfo = orderId && String(orderId).trim() !== '';

                    if (hasOrderInfo) {
                        const newOrder: Order = {
                            id: String(orderId), customerId: String(customerId),
                            orderDate: String(orderDate || ''), shippingDate: String(shippingDate || ''),
                            deliveryDate: String(deliveryDate || ''),
                            status: (statusReverse[String(statusJa)] ?? 'Pending') as Order['status'],
                            totalAmount: 0, items: [],
                        };
                        if (productId) {
                            newOrder.items.push({
                                productId: String(productId), quantity: Number(quantity) || 0,
                                unitPrice: Number(unitPrice) || 0,
                            });
                        }
                        ordersMap.set(String(orderId), newOrder);
                    } else {
                        const lastOrder = [...ordersMap.values()].at(-1);
                        if (lastOrder && productId) {
                            lastOrder.items.push({
                                productId: String(productId), quantity: Number(quantity) || 0,
                                unitPrice: Number(unitPrice) || 0,
                            });
                        }
                    }
                });

                const restoredOrders: Order[] = [...ordersMap.values()].map(o => ({
                    ...o,
                    totalAmount: o.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
                }));
                setOrdersFS(restoredOrders);
            }

            // --- 顧客マスタシート ---
            const customerSheet = workbook.Sheets['顧客マスタ'];
            if (customerSheet) {
                const customerRowData: any[][] = XLSX.utils.sheet_to_json(customerSheet, { header: 1 });
                const customerDataRows = customerRowData.slice(1);
                const newCustomers: Customer[] = customerDataRows
                    .filter(row => row[0])
                    .map(row => ({
                        id: String(row[0] ?? ''),
                        company: String(row[1] ?? ''),
                        name: String(row[2] ?? ''),
                        zipCode: String(row[3] ?? ''),
                        address: String(row[4] ?? ''),
                        phone: String(row[5] ?? ''),
                        fax: String(row[6] ?? ''),
                        email: String(row[7] ?? ''),
                        notes: String(row[8] ?? ''),
                    }));
                setCustomersFS(newCustomers);
            }

            // --- 商品マスタシート ---
            const productSheet = workbook.Sheets['商品マスタ'];
            if (productSheet) {
                const productRowData: any[][] = XLSX.utils.sheet_to_json(productSheet, { header: 1 });
                const productDataRows = productRowData.slice(1);
                const newProducts: Product[] = productDataRows
                    .filter(row => row[0])
                    .map(row => ({
                        id:       String(row[0] ?? ''),
                        name:     String(row[1] ?? ''),
                        category: String(row[2] ?? ''),
                        stock:    Number(row[3]) || 0,
                    }));
                setProductsFS(newProducts);
            }

            alert("Excelからデータを復元しました。");
        } catch (error) {
            console.error("Excel import error:", error);
            alert("Excelファイルの読み込みに失敗しました。");
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
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
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/40 backdrop-blur-sm md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

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
          {activeTab === 'orders' && (
            <div className="flex items-center gap-2">
              <span className={`text-xs font-black transition-colors ${!showShipped ? 'text-indigo-600' : 'text-slate-400'}`}>
                未出荷
              </span>
              <button
                type="button"
                onClick={() => setShowShipped(prev => !prev)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none ${
                  showShipped ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${
                  showShipped ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
              <span className={`text-xs font-black transition-colors ${showShipped ? 'text-indigo-600' : 'text-slate-400'}`}>
                出荷済
              </span>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-3">
            <div className="w-full h-full">
                {activeTab === 'stats' && <Dashboard orders={orders} products={products} customers={customers} onNavigate={(tab) => setActiveTab(tab as TabId)} />}
                {activeTab === 'orders' && <OrderManager orders={orders} setOrders={setOrdersFS} customers={customers} products={products} showShipped={showShipped} viewType={'pre'} setViewType={() => {}} onEditOrder={openOrderModal} onShipOrder={handleShipOrder} />}
                {activeTab === 'calendar' && <OrderCalendar orders={orders} customers={customers} products={products} onEditOrder={openOrderModal} />}
                {activeTab === 'products'  && <ProductManager products={products} setProducts={setProductsFS} orders={orders} />}
                {activeTab === 'customers' && <CustomerManager customers={customers} setCustomers={setCustomersFS} />}
            </div>
        </main>
      </div>
      
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
