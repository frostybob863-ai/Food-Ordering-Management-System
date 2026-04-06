import { MenuItem } from "./types";

export const INITIAL_MENU_ITEMS: Partial<MenuItem>[] = [
  {
    name: "Assorted Fried Rice",
    description: "Vibrant fried rice with a mix of vegetables and meats.",
    price: 35.00,
    category: "Main Meals",
    imageUrl: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80",
    available: true,
  },
  {
    name: "Fried Rice & Chicken",
    description: "Classic fried rice served with crispy fried chicken.",
    price: 40.00,
    category: "Main Meals",
    imageUrl: "https://images.unsplash.com/photo-1512058560366-cd2427ffbb82?auto=format&fit=crop&w=800&q=80",
    available: true,
  },
  {
    name: "Stir Fry Noodles",
    description: "Savory stir-fried noodles with fresh vegetables.",
    price: 30.00,
    category: "Main Meals",
    imageUrl: "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80",
    available: true,
  },
  {
    name: "Frozen Spring Rolls",
    description: "Ready-to-fry spring rolls (pack of 10).",
    price: 25.00,
    category: "Frozen Foods",
    imageUrl: "https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=800&q=80",
    available: true,
  },
  {
    name: "Samosas",
    description: "Crispy pastry filled with spiced meat or vegetables (pack of 10).",
    price: 25.00,
    category: "Frozen Foods",
    imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
    available: true,
  }
];

export const VENDOR_ID = "miracle-bites-catering";
