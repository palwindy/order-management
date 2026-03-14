import React, { useState } from 'react';
import { X, Calendar, Link, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CalendarSettings: React.FC<Props> = ({ isOpen, onClose }) => {
  const [calendarId, setCalendarId] = useState(
    localStorage.getItem('googleCalendarId') || ''
  );
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem('googleCalendarId', calendarId.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

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
        <div className="p-6 space-y-6">
          
          {/* 説明 */}
          <div className="bg-indigo-50 rounded-2xl p-4 text-sm text-indigo-700 font-bold leading-relaxed">
            Google カレンダーと連携すると、出荷予定を自動で
            Google カレンダーに登録できます。
          </div>

          {/* カレンダーID入力 */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Google カレンダー ID
            </label>
            <div className="relative">
              <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
                placeholder="example@group.calendar.google.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-2 ml-1">
              Google カレンダーの設定 → カレンダーの統合 から確認できます
            </p>
          </div>

          {/* 連携ステータス（仮表示） */}
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-black text-slate-700">未連携</p>
              <p className="text-[10px] text-slate-400 font-bold">
                カレンダーIDを入力して保存してください
              </p>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="p-6 border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className={`flex-1 py-3 rounded-2xl text-sm font-black transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2 ${
              isSaved
                ? 'bg-emerald-600 text-white shadow-emerald-100'
                : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'
            }`}
          >
            {isSaved ? (
              <><CheckCircle2 className="w-4 h-4" /> 保存しました</>
            ) : (
              '保存する'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalendarSettings;
