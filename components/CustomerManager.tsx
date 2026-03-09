
import React, { useState, useRef, useEffect } from 'react';
import { Customer } from '../types';
import { UserPlus, Search, Mail, Phone, Printer, Trash2, X, AlertTriangle, MapPin } from 'lucide-react';

interface Props {
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
}

const CustomerManager: React.FC<Props> = ({ customers, setCustomers }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [zipInput, setZipInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.company.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (editingCustomer) {
      setZipInput(editingCustomer.zipCode || '');
      setAddressInput(editingCustomer.address || '');
    } else {
      setZipInput('');
      setAddressInput('');
    }
    setZipError(null);
  }, [editingCustomer, isModalOpen]);

  // Formatter for Zip Code: handles 1234567 -> 123-4567
  const handleZipChange = (val: string) => {
    setZipError(null);
    const clean = val.replace(/[^\d]/g, '').slice(0, 7);
    if (clean.length > 3) {
      setZipInput(`${clean.slice(0, 3)}-${clean.slice(3)}`);
    } else {
      setZipInput(clean);
    }
  };

  const searchAddressFromZip = async () => {
    const cleanZip = zipInput.replace(/[^\d]/g, '');
    if (cleanZip.length !== 7) {
      setZipError('郵便番号は7桁で入力してください');
      return;
    }
    
    setIsSearchingAddress(true);
    setZipError(null);
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleanZip}`);
      const data = await res.json();
      if (data.results && data.results[0]) {
        const result = data.results[0];
        const newAddress = `${result.address1}${result.address2}${result.address3}`;
        setAddressInput(newAddress);
      } else {
        setZipError('該当する住所が見つかりませんでした');
      }
    } catch (err) {
      setZipError('住所検索中にエラーが発生しました');
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const confirmDelete = () => {
    if (editingCustomer) {
      setCustomers(prev => prev.filter(c => c.id !== editingCustomer.id));
      setIsDeleteConfirmOpen(false);
      setIsModalOpen(false);
      setEditingCustomer(null);
    }
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newCustomer: Customer = {
      id: editingCustomer?.id || `c${Date.now()}`,
      name: formData.get('name') as string,
      company: formData.get('company') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      fax: formData.get('fax') as string,
      zipCode: zipInput,
      address: addressInput,
      notes: formData.get('notes') as string,
    };

    if (editingCustomer) {
      setCustomers(customers.map(c => c.id === editingCustomer.id ? newCustomer : c));
    } else {
      setCustomers([...customers, newCustomer]);
    }
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="会社名、名前、メールで検索..."
            className="w-full pl-10 pr-4 py-2 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all bg-slate-50 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => { setEditingCustomer(null); setIsModalOpen(true); }}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl transition-all text-sm font-bold shadow-lg shadow-indigo-100 active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          新規顧客登録
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredCustomers.map(customer => (
          <div 
            key={customer.id} 
            onClick={() => { setEditingCustomer(customer); setIsModalOpen(true); }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-lg transition-all cursor-pointer group flex flex-col h-full"
          >
            <h4 className="text-xl font-black text-slate-900 mb-1 leading-tight">{customer.company}</h4>
            <div className="text-sm font-bold text-slate-500 mb-4">担当者: {customer.name} 様</div>
            
            <div className="space-y-2.5 pt-4 border-t border-slate-50 mt-auto">
              <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                <Mail className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                <span className="truncate">{customer.email}</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                <Phone className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                <span>TEL: {customer.phone}</span>
              </div>
              {customer.fax && (
                <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                  <Printer className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                  <span>FAX: {customer.fax}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 my-auto">
             <div className="px-6 py-4 sm:px-8 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="text-lg font-black text-slate-800 tracking-tight">{editingCustomer ? '顧客情報の編集' : '新規顧客登録'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3.5">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 mb-1">会社名</label>
                  <input name="company" defaultValue={editingCustomer?.company} required className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 mb-1">担当者名</label>
                  <input name="name" defaultValue={editingCustomer?.name} required className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 mb-1">メールアドレス</label>
                  <input name="email" type="email" defaultValue={editingCustomer?.email} required className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">電話番号</label>
                  <input name="phone" defaultValue={editingCustomer?.phone} required className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">FAX番号</label>
                  <input name="fax" defaultValue={editingCustomer?.fax} className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 mb-1">郵便番号</label>
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <input 
                        value={zipInput} 
                        onChange={(e) => handleZipChange(e.target.value)}
                        placeholder="000-0000"
                        className={`w-full px-4 py-2 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${zipError ? 'border-red-300' : 'border-slate-100'}`} 
                      />
                      {zipError && <p className="text-[10px] text-red-500 font-bold mt-1 ml-1">{zipError}</p>}
                    </div>
                    <button 
                      type="button" 
                      onClick={searchAddressFromZip}
                      disabled={isSearchingAddress}
                      className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold border border-indigo-100 hover:bg-indigo-100 transition-all flex items-center gap-2 disabled:opacity-50 shrink-0 h-[38px]"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      住所検索
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 mb-1">住所</label>
                  <input 
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 mb-1">備考</label>
                  <textarea 
                    name="notes" 
                    rows={2} 
                    defaultValue={editingCustomer?.notes} 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                    placeholder="特記事項..."
                  ></textarea>
                </div>
              </div>
              
              <div className="pt-2 flex flex-col gap-3">
                <div className="flex gap-3 w-full">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">キャンセル</button>
                  <button type="submit" className="flex-1 px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100/50 transition-all active:scale-95">保存</button>
                </div>
                
                {editingCustomer && (
                  <button 
                    type="button" 
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    className="w-fit mx-auto flex items-center justify-center gap-2 py-1.5 text-red-500 hover:text-red-600 rounded-xl text-xs font-bold transition-all border-b border-transparent hover:border-red-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    この顧客情報を完全に削除する
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h4 className="text-lg font-black text-slate-900 mb-2">顧客を削除しますか？</h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-6 px-4">
                「{editingCustomer?.company}」のデータを削除すると元に戻せません。
              </p>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={confirmDelete}
                  className="w-full py-3 bg-red-600 text-white rounded-xl font-black text-sm hover:bg-red-700 transition-all shadow-md active:scale-95"
                >
                  削除を実行する
                </button>
                <button 
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
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

export default CustomerManager;
