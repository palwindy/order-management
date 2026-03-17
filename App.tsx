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
  Settings,
  List,
} from 'lucide-react';
import { Customer, Product, Order } from './types';
import { INITIAL_CUSTOMERS, INITIAL_PRODUCTS, INITIAL_ORDERS, CATEGORIES, DEFAULT_CATEGORY } from './constants';
import { sortCustomersById } from './utils';
import Dashboard from './components/Dashboard';
import CustomerManager from './components/CustomerManager';
import ProductManager from './components/ProductManager';
import OrderManager from './components/OrderManager';
import OrderCalendar from './components/OrderCalendar';
import OrderEditModal from './components/OrderEditModal';
import CalendarSettings from './components/CalendarSettings';
import * as XLSX from 'xlsx-js-style';
import { db } from './firebase';
import { collection, doc, setDoc, deleteDoc, getDocs, writeBatch, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import { getAuth, GoogleAuthProvider, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';

const APP_VERSION = "Ver.1.82";
const COMPANY_NAME = "注文管理システム";
const ADMIN_EMAIL = "admin@chumon-kanri.com";

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
  const [isCalendarSettingsOpen, setIsCalendarSettingsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showShipped, setShowShipped] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [deviceName, setDeviceName] = useState(
    localStorage.getItem('chumon_device_name') || ''
  );
  const [inputPassword, setInputPassword] = useState('');
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [accessLogs, setAccessLogs] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getRegion = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      const data = await res.json();
      return `${data.region} (${data.city})`
    } catch {
      return "不明な地域"
    }
  };

  const writeLog = async (name: string, action: string, status: string) => {
    const region = await getRegion();
    try {
      await addDoc(collection(db, 'access_logs'), {
        timestamp: new Date(),
        deviceName: name || "未登録端末",
        region: region,
        action: action,
        status: status
      });
    } catch (error) {
      console.error("Error writing log to Firestore: ", error);
    }
  };

  const fetchLogs = () => {
    const q = query(collection(db, 'access_logs'), orderBy('timestamp', 'desc'));
    onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate().toLocaleString('ja-JP')
      }));
      setAccessLogs(logs);
    });
    setShowLogModal(true);
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthenticated(true);
        if (!sessionStorage.getItem('autoLoginLogged')) {
            const name = localStorage.getItem('chumon_device_name') || '不明な端末';
            await writeLog(name, "ログイン", "自動ログイン");
            sessionStorage.setItem('autoLoginLogged', 'true');
        }
      } else {
        setIsAuthenticated(false);
        sessionStorage.removeItem('autoLoginLogged');
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // After OAuth redirect (Google Calendar linking), reopen the settings modal automatically.
  useEffect(() => {
    if (sessionStorage.getItem('calendar_settings_reopen') === '1') {
      sessionStorage.removeItem('calendar_settings_reopen');
      setIsCalendarSettingsOpen(true);
    }
  }, []);

  // 初回ロード
  useEffect(() => {
    if (!isAuthenticated) return;
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
        toast.error('データの読み込みに失敗しました。');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [isAuthenticated]);

  const handleLogin = async () => {
    if (!deviceName.trim() || !inputPassword.trim()) {
      toast.error("端末名とパスワードを入力してください");
      return;
    }
    try {
      const auth = getAuth();
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, inputPassword);
      localStorage.setItem('chumon_device_name', deviceName);
      await writeLog(deviceName, "ログイン", "成功");
      sessionStorage.setItem('autoLoginLogged', 'true');
      toast.success("認証されました");
    } catch (error) {
      await writeLog(deviceName, "ログイン", "失敗 (誤入力)");
      toast.error("パスワードが違います");
    }
  };

  const requestLogout = () => setIsLogoutModalOpen(true);

  const executeLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
    localStorage.removeItem('chumon_device_name');
    setIsLogoutModalOpen(false);
    toast.success("ログアウトしました。");
  };

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

    } else if (prevOrder?.status === 'Pending' && newOrder.status === 'Shipped') {
      await handleShipOrder(newOrder.id);

    } else {
      setOrdersFS(prev => prev.map(o => o.id === newOrder.id ? newOrder : o));
    }

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
    const toastId = toast.loading('Excelファイルを作成中...');
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
                    const productName = product?.name || item.productId || '';
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
                            '', '', '', '', '', '', '',
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

        const customerHeaders = ['顧客ID', '会社名', '担当者', '郵便番号', '住所', '電話番号', 'FAX番号', 'メール', '備考'];
        const customerRows: any[][] = [customerHeaders];
        const sortedCustomers = sortCustomersById(customers);

        sortedCustomers.forEach(c => {
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
        XLSX.utils.book_append_sheet(wb, wsCustomers, '顧客管理');
        
        const categoryGroups = CATEGORIES.map(cat => ({
          category: cat,
          items: products.filter(p => p.category === cat),
        }));

        const maxRows = Math.max(...categoryGroups.map(g => g.items.length));

        const COL_PER_GROUP = 4;
        const COL_SPACER = 1;

        const headerRow: any[] = [];
        categoryGroups.forEach((group, groupIdx) => {
          const offset = groupIdx * (COL_PER_GROUP + COL_SPACER);
          headerRow[offset]     = '商品ID';
          headerRow[offset + 1] = 'カテゴリー';
          headerRow[offset + 2] = '商品名';
          headerRow[offset + 3] = '在庫数';
        });

        const dataRows: any[][] = [];
        for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
          const row: any[] = [];
          categoryGroups.forEach((group, groupIdx) => {
            const offset = groupIdx * (COL_PER_GROUP + COL_SPACER);
            const item = group.items[rowIdx];
            if (item) {
              row[offset]     = item.id;
              row[offset + 1] = item.category;
              row[offset + 2] = item.name;
              row[offset + 3] = item.stock;
            }
          });
          dataRows.push(row);
        }

        const productAoa = [headerRow, ...dataRows];
        const wsProducts = XLSX.utils.aoa_to_sheet(productAoa);

        const applyBorderStyle = (ws: any, startCol: number, rowCount: number) => {
          for (let R = 0; R <= rowCount; R++) {
            for (let C = startCol; C < startCol + COL_PER_GROUP; C++) {
              const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
              if (!ws[cellAddr]) ws[cellAddr] = { v: '', t: 's' };
              ws[cellAddr].s = {
                border: {
                  top:    { style: 'thin', color: { rgb: '000000' } },
                  bottom: { style: 'thin', color: { rgb: '000000' } },
                  left:   { style: 'thin', color: { rgb: '000000' } },
                  right:  { style: 'thin', color: { rgb: '000000' } },
                },
                font: R === 0 ? { bold: true } : undefined,
                fill: R === 0 ? { fgColor: { rgb: 'E8EAF6' } } : undefined,
              };
            }
          }
        };

        categoryGroups.forEach((_, groupIdx) => {
          const startCol = groupIdx * (COL_PER_GROUP + COL_SPACER);
          applyBorderStyle(wsProducts, startCol, maxRows);
        });

        const colWidths: any[] = [];
        categoryGroups.forEach((_, groupIdx) => {
          const offset = groupIdx * (COL_PER_GROUP + COL_SPACER);
          colWidths[offset]     = { wch: 10 };
          colWidths[offset + 1] = { wch: 14 };
          colWidths[offset + 2] = { wch: 28 };
          colWidths[offset + 3] = { wch:  8 };
          colWidths[offset + 4] = { wch:  2 };
        });
        wsProducts['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, wsProducts, '商品マスタ');

        XLSX.writeFile(wb, fileName);
        toast.success('Excelファイルを出力しました。', { id: toastId });
    } catch (e) {
        console.error(e);
        toast.error('Excelファイルの出力に失敗しました。', { id: toastId });
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
                toast.success(`注文データを ${restoredOrders.length} 件復元しました。`);
            }

            const customerSheet = workbook.Sheets['顧客管理'] ?? workbook.Sheets['顧客マスタ'];
            if (customerSheet) {
                const customerRowData: any[][] = XLSX.utils.sheet_to_json(customerSheet, { header: 1 });
                const newCustomers: Customer[] = customerRowData
                    .slice(1)
                    .filter(row => row[0] && String(row[0]).trim() !== '')
                    .map(row => ({
                        id:      String(row[0] ?? '').trim(),
                        company: String(row[1] ?? '').trim(),
                        name:    String(row[2] ?? '').trim(),
                        zipCode: String(row[3] ?? '').trim(),
                        address: String(row[4] ?? '').trim(),
                        phone:   String(row[5] ?? '').trim(),
                        fax:     String(row[6] ?? '').trim(),
                        email:   String(row[7] ?? '').trim(),
                        notes:   String(row[8] ?? '').trim(),
                    }));
                if (newCustomers.length === 0) {
                    toast.error('顧客データが見つかりませんでした。シート名を確認してください。');
                } else {
                    setCustomersFS(newCustomers);
                    toast.success(`顧客データを ${newCustomers.length} 件復元しました。`);
                }
            } else {
                toast.error('「顧客管理」シートが見つかりません。シート名を確認してください。');
            }

            const productSheet = workbook.Sheets['商品マスタ'];
            if (productSheet) {
              const allRows: any[][] = XLSX.utils.sheet_to_json(productSheet, { header: 1 });
              if (allRows.length < 2) return;

              const headerRow = allRows[0] as any[];
              const dataRows = allRows.slice(1);

              const idColIndices: number[] = [];
              headerRow.forEach((cell, colIdx) => {
                if (cell === '商品ID') idColIndices.push(colIdx);
              });

              const newProducts: Product[] = [];

              dataRows.forEach(row => {
                idColIndices.forEach(startCol => {
                  const id       = row[startCol];
                  const category = row[startCol + 1];
                  const name     = row[startCol + 2];
                  const stock    = row[startCol + 3];

                  if (id && String(id).trim() !== '') {
                    newProducts.push({
                      id:       String(id).trim(),
                      category: String(category ?? '').trim() || DEFAULT_CATEGORY,
                      name:     String(name ?? '').trim(),
                      stock:    Number(stock) || 0,
                    });
                  }
                });
              });

              if (newProducts.length === 0) {
                  toast.error('商品データが見つかりませんでした。');
              } else {
                  setProductsFS(newProducts);
                  toast.success(`商品データを ${newProducts.length} 件復元しました。`);
              }
            }

        } catch (error) {
            console.error("Excel import error:", error);
            toast.error("Excelファイルの読み込みに失敗しました。");
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    reader.readAsArrayBuffer(file);
  };

  const activeNavItem = navItems.find(item => item.id === activeTab)!;

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-100 font-bold text-indigo-600">
        認証確認中...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <Toaster position="top-center" />
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-slate-200">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-6">
            <FileSpreadsheet className="text-white w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-6">注文管理システム</h1>
          <div className="space-y-4 text-left">
            <div>
              <label className="text-xs font-bold text-slate-400 ml-2">端末名 (例: 社長スマホ)</label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="識別用の名前"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 ml-2">パスワード</label>
              <input
                type="password"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="パスワードを入力"
              />
            </div>
            <button
              onClick={handleLogin}
              className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
            >
              認証して利用開始
            </button>
          </div>
          <p className="mt-8 text-[10px] text-slate-300 font-mono italic">{APP_VERSION}</p>
        </div>
      </div>
    );
  }

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
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-2xl max-h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-indigo-50">
              <h3 className="font-black text-indigo-900 flex items-center gap-2">
                <List size={20} /> アクセスログ (最新)
              </h3>
              <button onClick={() => setShowLogModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-2">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="p-2">日時</th>
                    <th className="p-2">端末名</th>
                    <th className="p-2">内容</th>
                    <th className="p-2">地域</th>
                    <th className="p-2">結果</th>
                  </tr>
                </thead>
                <tbody>
                  {accessLogs.map((log: any, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">{log.timestamp}</td>
                      <td className="p-2 font-bold">{log.deviceName}</td>
                      <td className="p-2 font-medium text-slate-600">{log.action}</td>
                      <td className="p-2 text-slate-500">{log.region}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status.includes('失敗')
                            ? 'bg-red-100 text-red-600'
                            : log.status === '自動ログイン'
                            ? 'bg-indigo-100 text-indigo-600'
                            : 'bg-green-100 text-green-600'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[32px] w-full max-w-sm shadow-2xl p-8 text-center animate-in zoom-in-95 duration-200">
            <h4 className="text-lg font-black text-slate-900 mb-3">ログアウトしますか？</h4>
            <p className="text-xs text-slate-400 mb-8 font-bold">
              ログアウトするとパスワードの再入力が必要になります。
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={executeLogout}
                className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-sm hover:bg-red-700 transition-all shadow-xl active:scale-95"
              >
                ログアウト
              </button>
              <button
                onClick={() => setIsLogoutModalOpen(false)}
                className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
      <Toaster position="top-center" />
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
           <button
              onClick={fetchLogs}
              className="w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md text-indigo-200 hover:bg-indigo-500"
            >
              <List className="w-5 h-5 mr-3" />
              <span>アクセスログ</span>
            </button>
           <button
             onClick={requestLogout}
             className="w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md text-red-200 hover:bg-red-500/30"
           >
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
          {activeTab === 'calendar' && (
            <button
              onClick={() => setIsCalendarSettingsOpen(true)}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-all"
              title="カレンダー設定"
            >
              <Settings className="w-5 h-5" />
            </button>
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

      <CalendarSettings
        isOpen={isCalendarSettingsOpen}
        orders={orders}
        customers={customers}
        products={products}
        onClose={() => setIsCalendarSettingsOpen(false)}
      />

    </div>
  );
};

export default App;
