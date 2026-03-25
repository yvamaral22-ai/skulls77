export interface User {
  uid: string;
  name: string;
  email: string;
  role: 'owner' | 'employee';
  permissions: 'master' | 'standard'; // master = full access, standard = own agenda only
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
}

export interface Appointment {
  id: string;
  clientName: string;
  clientPhone: string; // Added for WhatsApp leads
  barberId: string;
  barberName: string;
  serviceId: string;
  serviceName: string;
  price: number; // Price at time of booking
  duration: number; // Duration at time of booking
  date: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  paymentMethod?: 'pix' | 'credit' | 'debit' | 'cash';
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  minStock: number;
  unit: string; // e.g., 'un', 'ml', 'g'
  lastUpdated: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'in' | 'out';
  quantity: number;
  reason: string;
  date: string;
  userId: string;
  userName: string;
}
