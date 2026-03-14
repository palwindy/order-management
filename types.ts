
export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  fax: string;
  zipCode?: string;
  address: string;
  notes?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  stock: number;
}

export type OrderStatus = 'Pending' | 'Shipped';

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  orderDate: string;
  shippingDate: string; 
  deliveryDate: string;
  status: OrderStatus;
  notes?: string;
}

export interface AggregatedData {
  productName: string;
  totalQuantity: number;
  totalSales: number;
}
