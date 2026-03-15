import React, { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle2, AlertTriangle, Loader2, UserCircle } from 'lucide-react';
import { getAuth, GoogleAuthProvider, signInWithRedirect } from 'firebase/auth';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CalendarSettings: React.FC<Props> = ({ isOpen, onClose }) => {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [connectedEmail, setConnectedEmail] = useState<string>(
    localStorage.getItem('googleCalendarEmail') || ''
  );
  const [pendingEmail, setPendingEmail] = useState<string>('');
  const [pendingToken, setPendingToken] = useState<string>('');
  const [isCheckingRedirect, setIsCheckingRedirect] = useState(true);

  useEffect(() => {
    // App.tsx側で保存済みのメールアドレスを読み込む
    const savedEmail = localStorage.getItem('googleCalendarEmail') || '';
    const pendingRedirect = localStorage.getItem('calendarSettingsRedirectPending');
    
    if (pendingRedirect && savedEmail) {
      // リダイレクト後の復帰：メールを表示して保存待ち状態に
      setPendingEmail(savedEmail);
      localStorage.removeItem('calendarSettingsRedirectPending');
    } else {
      setConnectedEmail(savedEmail);
    }
    setIsCheckingRedirect(false);
  }, []);

  const handleSelectAccount = async () => {
    try {
      const auth = getAuth();
      const provider = new GoogleAuthProvider();
      provider.addScope(CALENDAR_SCOPE);
      provider.setCustomParameters({
        prompt: 'select_account consent',
      });

      // カレンダー設定モーダルを開いていたことを記憶
      localStorage.setItem('calendarSettingsRedirectPending', '1');

      console.log('★ signInWithRedirect 開始');
      await signInWithRedirect(auth, provider);
      // ↑ここでページ遷移するため以降は実行されない
    } catch (error: any) {
      console.error('★ エラー:', error.code, error.message);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const handleSave = async () => {
    const emailToSave = pendingEmail || connectedEmail;
    const tokenToSave = pendingToken;

    if (!emailToSave) {
      await handleSelectAccount();
      return;
    }

    setSyncStatus('syncing');
    try {
      if (tokenToSave) {
        localStorage.setItem('googleAccessToken', tokenToSave);
      }
      localStorage.setItem('googleCalendarEmail', emailToSave);
      localStorage.removeItem('calendarSettingsRedirectPending');
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
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-indigo-50 rounded-2xl p-4 text-sm text-indigo-700 font-bold leading-relaxed">
            Google カレンダーと連携すると、出荷予定を自動で Google カレンダーに登録できます。
          </div>

          {isCheckingRedirect && (
            <div className="flex items-center gap-2 text-slate-400 text-sm font-bold">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>認証状態を確認中...</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAccount}
              disabled={syncStatus === 'syncing' || isCheckingRedirect}
              className="flex-1 flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-left hover:bg-white hover:border-indigo-300 transition-all disabled:opacity-60"
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

            <button
              onClick={handleSave}
              disabled={syncStatus === 'syncing' || isCheckingRedirect || (!pendingEmail && !connectedEmail)}
              className={`px-4 py-3 rounded-2xl text-sm font-black transition-all active:scale-95 flex-shrink-0 flex items-center gap-1.5 ${
                (!pendingEmail && !connectedEmail) ? 'bg-slate-100 text-slate-300 cursor-not-allowed' :
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

          <p className="text-[10px] text-slate-400 font-bold text-center">
            ※ アカウント選択時はGoogleの認証ページに移動します
          </p>
        </div>
      </div>
    </div>
  );
};

export default CalendarSettings;