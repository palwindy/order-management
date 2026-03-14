import React, { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle2, AlertTriangle, Loader2, UserCircle } from 'lucide-react';

const GOOGLE_CLIENT_ID = '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';
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.events';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CalendarSettings: React.FC<Props> = ({ isOpen, onClose }) => {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [connectedEmail, setConnectedEmail] = useState<string>(
    localStorage.getItem('googleCalendarEmail') || ''
  );
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [pendingEmail, setPendingEmail] = useState<string>('');
  const [pendingToken, setPendingToken] = useState<string>('');

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!(window as any).google?.accounts?.oauth2) {
        console.error('Google Identity Services library failed to load.');
        return;
      }
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            setSyncStatus('error');
            return;
          }
          try {
            const res = await fetch(
              'https://www.googleapis.com/oauth2/v3/userinfo',
              { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
            );
            const userInfo = await res.json();
            setPendingEmail(userInfo.email || '');
            setPendingToken(tokenResponse.access_token);
            setSyncStatus('idle');
          } catch {
            setSyncStatus('error');
          }
        },
      });
      setTokenClient(client);
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleSelectAccount = () => {
    if (!tokenClient) return;
    tokenClient.requestAccessToken();
  };

  const handleSave = async () => {
    const emailToSave = pendingEmail || connectedEmail;
    const tokenToSave = pendingToken;
    if (!emailToSave) {
      tokenClient?.requestAccessToken();
      return;
    }
    setSyncStatus('syncing');
    try {
      if (tokenToSave) {
        localStorage.setItem('googleAccessToken', tokenToSave);
      }
      localStorage.setItem('googleCalendarEmail', emailToSave);
      setConnectedEmail(emailToSave);
      setPendingEmail('');
      setPendingToken('');
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* ヘッダー */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800">カレンダー設定</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Google Calendar Integration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 本文 */}
        <div className="p-6 space-y-5">

          {/* 説明文 */}
          <div className="bg-indigo-50 rounded-2xl p-4 text-sm text-indigo-700 font-bold leading-relaxed">
            Google カレンダーと連携すると、出荷予定を自動で
            Google カレンダーに登録できます。
          </div>

          {/* アカウント選択＋保存ボタン（横並び） */}
          <div className="flex items-center gap-3">
            {/* アカウント表示エリア（左側・flex-1） */}
            <button
              onClick={handleSelectAccount}
              disabled={syncStatus === 'syncing'}
              className="flex-1 flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-left hover:bg-white hover:border-indigo-300 transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <UserCircle className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="min-w-0">
                {pendingEmail ? (
                  <>
                    <p className="text-xs font-black text-amber-600 truncate">{pendingEmail}</p>
                    <p className="text-[10px] text-amber-500 font-bold">未保存 ― 「保存」を押して確定</p>
                  </>
                ) : connectedEmail ? (
                  <>
                    <p className="text-xs font-black text-slate-700 truncate">{connectedEmail}</p>
                    <p className="text-[10px] text-emerald-500 font-bold">連携済み</p>
                  </>
                ) : (
                  <p className="text-sm font-bold text-slate-400">
                    連携するGoogleアカウントを選んでください
                  </p>
                )}
              </div>
            </button>

            {/* 保存ボタン（右側・固定幅） */}
            <button
              onClick={handleSave}
              disabled={syncStatus === 'syncing'}
              className={`px-4 py-3 rounded-2xl text-sm font-black transition-all active:scale-95 flex-shrink-0 flex items-center gap-1.5 ${
                syncStatus === 'syncing' ? 'bg-slate-200 text-slate-500 cursor-not-allowed' :
                syncStatus === 'success' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' :
                syncStatus === 'error'   ? 'bg-red-500 text-white shadow-lg shadow-red-100' :
                'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700'
              }`}
            >
              {syncStatus === 'syncing' && <Loader2 className="w-4 h-4 animate-spin" />}
              {syncStatus === 'success' && <CheckCircle2 className="w-4 h-4" />}
              {syncStatus === 'error'   && <AlertTriangle className="w-4 h-4" />}
              {syncStatus === 'syncing' ? '同期中...' :
               syncStatus === 'success' ? '同期完了' :
               syncStatus === 'error'   ? '同期エラー' : '保存'}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

export default CalendarSettings;
