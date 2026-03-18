import React, { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle2, AlertTriangle, Loader2, UserCircle } from 'lucide-react';
import {
  getAuth,
  GoogleAuthProvider,
  linkWithPopup,
  linkWithRedirect,
  reauthenticateWithPopup,
  reauthenticateWithRedirect,
  getRedirectResult,
  UserCredential,
} from 'firebase/auth';
import type { Customer, Order, Product } from '../types';
import { syncShippingOrdersToGoogleCalendar } from '../googleCalendar';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

interface Props {
  isOpen: boolean;
  orders: Order[];
  customers: Customer[];
  products: Product[];
  onClose: () => void;
}

const CalendarSettings: React.FC<Props> = ({ isOpen, onClose, orders, customers, products }) => {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [connectedEmail, setConnectedEmail] = useState<string>('');
  const [pendingEmail, setPendingEmail] = useState<string>('');
  const [pendingToken, setPendingToken] = useState<string>('');
  const [calendarName, setCalendarName] = useState<string>(
    localStorage.getItem('googleCalendarName') || '注文管理アプリ'
  );
  const [calendarId, setCalendarId] = useState<string>(
    localStorage.getItem('googleCalendarId') || ''
  );

  useEffect(() => {
    if (isOpen) {
      const savedEmail = localStorage.getItem('googleCalendarEmail') || '';
      const savedCalendarName = localStorage.getItem('googleCalendarName') || '注文管理アプリ';
      const savedCalendarId = localStorage.getItem('googleCalendarId') || '';
      setConnectedEmail(savedEmail);
      setPendingEmail(savedEmail);
      setPendingToken('');
      setCalendarName(savedCalendarName);
      setCalendarId(savedCalendarId);

      const auth = getAuth();
      const user = auth.currentUser;
      const linkedEmail =
        user?.providerData.find(p => p.providerId === 'google.com')?.email || '';
      if (linkedEmail) {
        setConnectedEmail(linkedEmail);
        setPendingEmail(linkedEmail);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    (async () => {
      try {
        await user.reload();
        const linkedEmail =
          user.providerData.find(p => p.providerId === 'google.com')?.email || '';
        if (linkedEmail) {
          localStorage.setItem('googleCalendarEmail', linkedEmail);
          setConnectedEmail(linkedEmail);
          setPendingEmail(linkedEmail);
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, [isOpen]);

  // Handle redirect-based OAuth result (fallback for environments where popups are blocked/broken).
  useEffect(() => {
    if (!isOpen) return;

    const auth = getAuth();
    (async () => {
      try {
        const result = await getRedirectResult(auth);
        sessionStorage.removeItem('calendar_oauth_redirect');

        if (!result) {
          const linkedEmail =
            auth.currentUser?.providerData.find(p => p.providerId === 'google.com')?.email || '';
          if (linkedEmail) setPendingEmail(linkedEmail);
          return;
        }

        const credential = GoogleAuthProvider.credentialFromResult(result);
        const googleEmail =
          result.user.providerData.find(p => p.providerId === 'google.com')?.email ||
          '';

        if (googleEmail) setPendingEmail(googleEmail);
        if (credential?.accessToken) setPendingToken(credential.accessToken);

        // If linking succeeded but we didn't receive an access token, still show the selected account.
        if (!credential?.accessToken) {
          const emailFromUser =
            auth.currentUser?.providerData.find(p => p.providerId === 'google.com')?.email ||
            '';
          if (emailFromUser) setPendingEmail(emailFromUser);
        }
      } catch (err: any) {
        sessionStorage.removeItem('calendar_oauth_redirect');
        console.error(err);
        alert(err?.message || 'リダイレクト認証の結果取得に失敗しました。');
      }
    })();
  }, [isOpen]);

  const handleSelectAccount = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('Starting Popup...');

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      alert('先にシステムへログインしてください。');
      return;
    }

    const provider = new GoogleAuthProvider();
    provider.addScope(CALENDAR_SCOPE);

    try {
      // Firebase Studio / Cloud Workstations preview often breaks popup flows.
      // Use redirect by default there to avoid "popup + main window" double prompts.
      const host = window.location.hostname;
      const preferRedirect =
        localStorage.getItem('calendar_oauth_flow') === 'redirect' ||
        host.includes('cloudworkstations') ||
        host.includes('firebase') ||
        host.includes('studio');

      const isGoogleLinked = user.providerData.some(p => p.providerId === 'google.com');
      if (preferRedirect) {
        localStorage.setItem('calendar_oauth_flow', 'redirect');
        sessionStorage.setItem('calendar_oauth_redirect', '1');
        sessionStorage.setItem('calendar_settings_reopen', '1');
        if (isGoogleLinked) {
          await reauthenticateWithRedirect(user, provider);
        } else {
          await linkWithRedirect(user, provider);
        }
        return;
      }

      // IMPORTANT: Keep the current app session. Using signInWithPopup() swaps the Firebase Auth user,
      // which can momentarily set isAuthenticated=false in App.tsx and unmount this modal (losing state).
      const result: UserCredential = isGoogleLinked
        ? await reauthenticateWithPopup(user, provider)
        : await linkWithPopup(user, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      const googleEmail =
        result.user.providerData.find(p => p.providerId === 'google.com')?.email ||
        '';
      if (googleEmail) setPendingEmail(googleEmail);

      if (credential?.accessToken) {
        setPendingToken(credential.accessToken);
      }
    } catch (error: any) {
      console.dir(error);

      // On some hosted/dev environments, popup flows fail (often reported as popup-closed-by-user).
      // Fallback to redirect flow which is more robust.
      const code = String(error?.code || '');
      const shouldFallback =
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/popup-blocked' ||
        code === 'auth/web-storage-unsupported' ||
        code === 'auth/operation-not-supported-in-this-environment';

      if (shouldFallback) {
        try {
          localStorage.setItem('calendar_oauth_flow', 'redirect');
          sessionStorage.setItem('calendar_oauth_redirect', '1');
          sessionStorage.setItem('calendar_settings_reopen', '1');
          const isGoogleLinked = user.providerData.some(p => p.providerId === 'google.com');
          if (isGoogleLinked) {
            await reauthenticateWithRedirect(user, provider);
          } else {
            await linkWithRedirect(user, provider);
          }
          return;
        } catch (redirectErr: any) {
          console.error(redirectErr);
          alert('ポップアップが使えず、リダイレクト連携も失敗しました。');
          return;
        }
      }

      alert("ポップアップエラー: " + (error?.code || 'unknown'));
    }
  };

  const ensureAccessToken = async (forceReauth: boolean = false): Promise<string | null> => {
    const cached = pendingToken || localStorage.getItem('googleAccessToken') || '';
    if (cached && !forceReauth) return cached;

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('先にシステムへログインしてください。');

    const provider = new GoogleAuthProvider();
    provider.addScope(CALENDAR_SCOPE);

    try {
      const result = await reauthenticateWithPopup(user, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken || '';
      if (token) {
        setPendingToken(token);
        localStorage.setItem('googleAccessToken', token);
        return token;
      }
    } catch (err) {
      console.error(err);
      sessionStorage.setItem('calendar_oauth_redirect', '1');
      sessionStorage.setItem('calendar_settings_reopen', '1');
      await reauthenticateWithRedirect(user, provider);
      return null;
    }

    return null;
  };

  const handleSave = async () => {
    if (pendingEmail === '') return;

    setSyncStatus('syncing');
    try {
      const storedCalendarName = localStorage.getItem('googleCalendarName') || '注文管理アプリ';
      const shouldForceReauth = calendarId === '' || calendarName !== storedCalendarName;
      let accessToken = await ensureAccessToken(shouldForceReauth);
      if (!accessToken) return;

      // Save first so other parts can read it immediately.
      localStorage.setItem('googleAccessToken', accessToken);
      localStorage.setItem('googleCalendarEmail', pendingEmail);
      localStorage.setItem('googleCalendarName', calendarName);

      let ensuredCalendarId = calendarId;
      try {
        const { ensureCalendarId } = await import('../googleCalendar');
        ensuredCalendarId = await ensureCalendarId({
          accessToken,
          calendarId,
          calendarName,
        });
        if (ensuredCalendarId) {
          localStorage.setItem('googleCalendarId', ensuredCalendarId);
          setCalendarId(ensuredCalendarId);
        }
      } catch (err: any) {
        // If scope is insufficient, reauth once with full calendar scope.
        const msg = String(err?.message || '');
        if (msg.includes('403') || msg.includes('insufficient') || msg.includes('PERMISSION_DENIED')) {
          accessToken = await ensureAccessToken(true);
          if (!accessToken) return;
          const { ensureCalendarId } = await import('../googleCalendar');
          ensuredCalendarId = await ensureCalendarId({
            accessToken,
            calendarId,
            calendarName,
          });
          if (ensuredCalendarId) {
            localStorage.setItem('googleCalendarId', ensuredCalendarId);
            setCalendarId(ensuredCalendarId);
          }
        } else {
          throw err;
        }
      }

      try {
        await syncShippingOrdersToGoogleCalendar({
          accessToken,
          orders,
          customers,
          products,
          calendarId: ensuredCalendarId || calendarId || 'primary',
        });
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (msg.includes('403') || msg.includes('insufficient') || msg.includes('PERMISSION_DENIED')) {
          accessToken = await ensureAccessToken(true);
          if (!accessToken) return;
          await syncShippingOrdersToGoogleCalendar({
            accessToken,
            orders,
            customers,
            products,
            calendarId: ensuredCalendarId || calendarId || 'primary',
          });
        } else {
          throw err;
        }
      }

      setConnectedEmail(pendingEmail);
      setPendingEmail('');
      setPendingToken('');
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (err: any) {
      console.error(err);
      const msg = String(err?.message || '');
      if (msg.includes('403') || msg.includes('insufficient') || msg.includes('PERMISSION_DENIED')) {
        localStorage.removeItem('googleAccessToken');
        setPendingToken('');
      }
      if (msg.includes('401') || msg.includes('UNAUTHENTICATED')) {
        localStorage.removeItem('googleAccessToken');
        setPendingToken('');
      }
      alert(err?.message || 'カレンダー連携に失敗しました。');
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };
  
  const handleClose = () => {
    setPendingEmail('');
    setPendingToken('');
    onClose();
  }

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
          <button onClick={handleClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-indigo-50 rounded-2xl p-4 text-sm text-indigo-700 font-bold leading-relaxed">
            Google カレンダーと連携すると、出荷予定を自動で Google カレンダーに登録できます。
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAccount}
              disabled={syncStatus === 'syncing'}
              className="flex-1 flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-left hover:bg-white hover:border-indigo-300 transition-all disabled:opacity-60"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <UserCircle className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="min-w-0">
                  <p className="text-xs font-black text-slate-700 truncate">
                    {pendingEmail || connectedEmail || "アカウントを選択してください"}
                  </p>
                  {pendingEmail && (
                    <p className="text-[10px] text-orange-500 font-bold">(未連携・保存してください)</p>
                  )}
                  {connectedEmail && !pendingEmail && (
                     <p className="text-[10px] text-emerald-500 font-bold">連携済み</p>
                  )}
              </div>
            </button>

            <button
              onClick={handleSave}
              disabled={pendingEmail === '' || syncStatus !== 'idle'}
              className={`px-4 py-3 rounded-2xl text-sm font-black transition-all active:scale-95 flex-shrink-0 flex items-center gap-1.5 ${
                pendingEmail === '' ? 'bg-slate-100 text-slate-300 cursor-not-allowed' :
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
               syncStatus === 'error'   ? '連携エラー' : '保存'}
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-widest">カレンダー名</label>
            <input
              value={calendarName}
              onChange={(e) => setCalendarName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="注文管理アプリ"
            />
            <p className="text-[10px] text-slate-400 font-bold">
              連携済み: {calendarId ? 'はい' : 'いいえ'}
            </p>
          </div>

          <p className="text-[10px] text-slate-400 font-bold text-center">
            ※ アカウント選択後、ポップアップウィンドウが開きます
          </p>
        </div>
      </div>
    </div>
  );
};

export default CalendarSettings;
