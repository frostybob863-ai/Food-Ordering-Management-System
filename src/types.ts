export type UserRole = 'admin' | 'vendor' | 'customer';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  phoneNumber?: string;
  address?: string;
  createdAt: string;
}

export interface MenuItem {
  id: string;
  vendorId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  dietaryLabels?: string[];
  available: boolean;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  customerId: string;
  vendorId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  deliveryMethod: 'pickup' | 'delivery';
  deliveryAddress?: string;
  paymentMethod: 'cash' | 'momo';
  paymentStatus: 'pending' | 'paid';
  createdAt: string;
  updatedAt: string;
}

export interface VendorProfile {
  id: string;
  businessName: string;
  businessNumber?: string;
  contactPerson: string;
  phoneNumber: string;
  email: string;
  address: string;
  locationDetails: string;
  socialMedia?: string;
  openingHours: string;
  closingHours: string;
  deliveryZones: string[];
  deliveryFee: string;
  averagePrepTime: string;
  averageDeliveryTime: string;
  minOrderAmount: number;
  acceptedPaymentMethods: string[];
  momoNumber: string;
  isActive: boolean;
  onboardingDate: string;
}
