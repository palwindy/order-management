
import { Customer, Product, Order } from './types';

export const CATEGORIES: string[] = [
  '裏白',
  'ゆずり葉',
  'しめ縄',
  '関西ゴンボ関係',
  'その他・未定',
];

export const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'c1', name: '田中 太郎', company: '株式会社テック', email: 'tanaka@example.com', phone: '03-1234-5678', fax: '03-1234-5679', zipCode: '150-0002', address: '東京都渋谷区渋谷' },
  { id: 'c2', name: '佐藤 花子', company: 'サトー貿易', email: 'sato@example.com', phone: '06-8765-4321', fax: '06-8765-4322', zipCode: '541-0041', address: '大阪府大阪市中央区北浜' },
  { id: 'c3', name: '鈴木 一郎', company: 'スズキ工業', email: 'suzuki@example.com', phone: '052-111-2222', fax: '052-111-2223', zipCode: '460-0002', address: '愛知県名古屋市中区丸の内' },
  { id: 'c4', name: '高橋 健一', company: '高橋商事', email: 'taka@example.com', phone: '011-333-4444', fax: '011-333-4445', zipCode: '060-0001', address: '北海道札幌市中央区北一条西' },
  { id: 'c5', name: '伊藤 美咲', company: 'イトーデザイン', email: 'ito@example.com', phone: '092-555-6666', fax: '092-555-6667', zipCode: '812-0011', address: '福岡県福岡市博多区博多駅前' },
  { id: 'c6', name: '渡辺 誠', company: 'ナベ物流', email: 'watanabe@example.com', phone: '045-777-8888', fax: '045-777-8889', zipCode: '220-0011', address: '神奈川県横浜市西区高島' },
  { id: 'c7', name: '山本 裕子', company: '山元マテリアル', email: 'yama@example.com', phone: '022-999-0000', fax: '022-999-0001', zipCode: '980-0021', address: '宮城県仙台市青葉区中央' },
  { id: 'c8', name: '中村 剛', company: '中村電気', email: 'naka@example.com', phone: '075-222-3333', fax: '075-222-3334', zipCode: '600-8216', address: '京都府京都市下京区東塩小路町' },
  { id: 'c9', name: '小林 瑞希', company: 'コバヤシ製薬', email: 'koba@example.com', phone: '078-444-5555', fax: '078-444-5556', zipCode: '650-0001', address: '兵庫県神戸市中央区加納町' },
  { id: 'c10', name: '加藤 亮', company: 'カトー建築', email: 'kato@example.com', phone: '082-666-7777', fax: '082-666-7778', zipCode: '730-0011', address: '広島県広島市中区基町' },
];

export const INITIAL_PRODUCTS: Product[] = Array.from({ length: 30 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `商品 ${i + 1}`,
  category: CATEGORIES[i % CATEGORIES.length],
  stock: Math.floor(Math.random() * 50) + 10,
}));

export const INITIAL_ORDERS: Order[] = Array.from({ length: 20 }, (_, i) => {
  const customer = INITIAL_CUSTOMERS[i % INITIAL_CUSTOMERS.length];
  const items = [
    {
      productId: INITIAL_PRODUCTS[i % INITIAL_PRODUCTS.length].id,
      quantity: Math.floor(Math.random() * 3) + 1,
      unitPrice: Math.floor(Math.random() * 50) * 100 + 1000,
    }
  ];
  
  // 50%の確率で2つ目の商品を追加
  if (Math.random() > 0.5) {
    items.push({
      productId: INITIAL_PRODUCTS[(i + 1) % INITIAL_PRODUCTS.length].id,
      quantity: 1,
      unitPrice: 2000,
    });
  }

  const orderDate = new Date();
  orderDate.setDate(orderDate.getDate() - (i % 5));
  const shippingDate = new Date();
  shippingDate.setDate(shippingDate.getDate() + (i % 7));
  const deliveryDate = new Date(shippingDate);
  deliveryDate.setDate(deliveryDate.getDate() + 2);
  
  const totalAmount = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

  return {
    id: `ord-${i + 1}`,
    customerId: customer.id,
    items: items,
    totalAmount: totalAmount,
    orderDate: orderDate.toISOString().split('T')[0],
    shippingDate: shippingDate.toISOString().split('T')[0],
    deliveryDate: deliveryDate.toISOString().split('T')[0],
    status: i % 4 === 0 ? 'Shipped' : 'Pending',
  };
});
