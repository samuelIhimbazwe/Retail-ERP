import {
  LayoutDashboard,
  Package,
  Warehouse,
  Boxes,
  Truck,
  ShoppingCart,
  Users,
  BookOpen,
  Receipt,
  Landmark,
  FileBarChart,
  LineChart,
  Bot,
  RefreshCw,
  Bell,
  UserCog,
  Heart,
  Building2,
  Shield,
  Plug,
  Settings,
  UserRoundCog,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  module: number;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const navigation: NavGroup[] = [
  {
    title: "Favorites",
    items: [
      { label: "Counter Mode", href: "/counter", icon: Zap, module: 0 },
      { label: "Sell (POS)", href: "/pos", icon: ShoppingCart, module: 7 },
      { label: "Stock check", href: "/stock-check", icon: Boxes, module: 4 },
      { label: "Receive goods", href: "/receive", icon: Truck, module: 6 },
    ],
  },
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, module: 2 },
      { label: "Business Intelligence", href: "/bi", icon: LineChart, module: 13 },
      { label: "AI Assistant", href: "/ai", icon: Bot, module: 14 },
      { label: "Notifications", href: "/notifications", icon: Bell, module: 16 },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Products", href: "/products", icon: Package, module: 3 },
      { label: "Inventory", href: "/inventory", icon: Boxes, module: 4 },
      { label: "Warehouse", href: "/warehouse", icon: Warehouse, module: 5 },
      { label: "Purchasing", href: "/purchasing", icon: Truck, module: 6 },
      { label: "Procurement", href: "/procurement", icon: RefreshCw, module: 15 },
    ],
  },
  {
    title: "People & CRM",
    items: [
      { label: "Customers", href: "/customers", icon: Users, module: 8 },
      { label: "Loyalty & CRM", href: "/loyalty", icon: Heart, module: 18 },
      { label: "Payroll & HR", href: "/payroll", icon: UserCog, module: 17 },
      { label: "Branches", href: "/branches", icon: Building2, module: 19 },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Accounting", href: "/accounting", icon: BookOpen, module: 9 },
      { label: "Tax", href: "/tax", icon: Receipt, module: 10 },
      { label: "Banking & Cash", href: "/banking", icon: Landmark, module: 11 },
      { label: "Reports", href: "/reports", icon: FileBarChart, module: 12 },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "User Management", href: "/users", icon: UserRoundCog, module: 23 },
      { label: "Security & Audit", href: "/security", icon: Shield, module: 21 },
      { label: "Integrations", href: "/integrations", icon: Plug, module: 22 },
      { label: "Settings", href: "/settings", icon: Settings, module: 1 },
    ],
  },
];

export const allModules = navigation.flatMap((g) => g.items);
