
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Order, Product } from '../types';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  orders: Order[];
  products: Product[];
}

const GeminiInsights: React.FC<Props> = ({ orders, products }) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const orderSummary = orders.map(o => ({
        product: products.find(p => p.id === o.productId)?.name,
        amount: o.totalAmount,
        date: o.orderDate
      }));

      const prompt = `以下の注文データ（JSON）を分析し、日本のビジネスオーナー向けに役立つ要約と改善アドバイスを300文字程度で日本語で作成してください。
      - 売上の傾向
      - 人気商品の推測
      - 在庫管理や今後の施策へのアドバイス
      
      データ: ${JSON.stringify(orderSummary.slice(0, 30))}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      setInsight(response.text || '分析結果を取得できませんでした。');
    } catch (err) {
      console.error(err);
      setError('AI分析の実行中にエラーが発生しました。APIキーまたは接続を確認してください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-2xl shadow-lg text-white">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-8 h-8 text-indigo-200" />
          <h3 className="text-2xl font-bold">ビジネスAIインサイト</h3>
        </div>
        <p className="text-indigo-100 mb-6 max-w-2xl leading-relaxed">
          Gemini 1.5 Flashが現在の注文データをリアルタイムで分析し、
          今後の売上向上に向けた戦略的なアドバイスを提案します。
        </p>
        <button 
          onClick={fetchInsights}
          disabled={loading}
          className="bg-white text-indigo-700 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-50 transition-all disabled:opacity-50 shadow-md active:scale-95"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          分析を開始する
        </button>
      </div>

      {loading && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-slate-500 shadow-sm">
          <Loader2 className="w-12 h-12 animate-spin mb-4 text-indigo-500" />
          <p className="font-medium">AIがデータを精査しています。少々お待ちください...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 p-6 rounded-2xl flex items-start gap-4 text-red-700 shadow-sm">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <div>
            <h4 className="font-bold mb-1">エラー</h4>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        </div>
      )}

      {insight && !loading && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h4 className="font-bold text-slate-800">AIによる分析レポート</h4>
          </div>
          <div className="prose prose-indigo max-w-none text-slate-700 leading-loose whitespace-pre-wrap">
            {insight}
          </div>
          <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-400">※この分析は試験的なAI機能によるものです。</span>
            <button 
              onClick={() => setInsight(null)}
              className="text-sm text-slate-500 hover:text-indigo-600 transition-colors"
            >
              結果を閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeminiInsights;
