const categoryService = require('./services/categoryService');
const employeeService = require('./services/employeeService');
const assetService = require('./services/assetService');
const { pool } = require('./db');
require('dotenv').config();

async function seed() {
  try {
    console.log('Seeding initial database...');

    // Insert Categories
    const categories = [
      { name: 'Laptop', description: 'MacBooks, ThinkPads and Workstations', badgeChar: 'L', color: 'Indigo' },
      { name: 'Monitor', description: 'External 4K and UltraWide monitors', badgeChar: 'M', color: 'Blue' },
      { name: 'Keyboard & Mouse', description: 'Mechanical keyboards, ergonomics, trackpads', badgeChar: 'K', color: 'Teal' },
      { name: 'Audio & Headset', description: 'Noise-canceling headphones, headsets, and microphones', badgeChar: 'A', color: 'Purple' }
    ];
    for (const c of categories) {
      await categoryService.createCategory(c);
    }
    console.log('Categories created.');

    // Insert Employees
    const employees = [
      { name: 'Rajan Sharma', email: 'rajan.sharma@company.com', department: 'IT Operations', location: 'Bangalore' },
      { name: 'Priya Nair', email: 'priya.nair@company.com', department: 'Operations', location: 'Mumbai' },
      { name: 'Sneha Kulkarni', email: 'sneha.kulkarni@company.com', department: 'Finance', location: 'Hyderabad' },
      { name: 'Arjun Rao', email: 'arjun.rao@company.com', department: 'Engineering', location: 'Bangalore' },
      { name: 'Ananya Verma', email: 'ananya.verma@company.com', department: 'Product', location: 'Delhi' },
      { name: 'Vikram Patel', email: 'vikram.patel@company.com', department: 'Engineering', location: 'Mumbai' },
      { name: 'Divya Menon', email: 'divya.menon@company.com', department: 'Design', location: 'Bangalore' },
      { name: 'Rohit Gupta', email: 'rohit.gupta@company.com', department: 'Marketing', location: 'Hyderabad' }
    ];
    for (const e of employees) {
      await employeeService.createEmployee(e);
    }
    console.log('Employees created.');

    // Insert Assets
    const sampleAssets = [
      { name: 'MacBook Pro 16" M3 Max', categoryId: 1, model: 'Apple MacBook Pro (16-inch, M3 Max, 36GB)', serialNumber: 'SN-MBP16M3X01', status: 'in-use', location: 'Bangalore', costCents: 349900, purchaseDate: '2025-11-15', notes: 'Primary dev machine for Engineering Lead', assignedTo: 4, assignedDate: '2025-11-20' },
      { name: 'MacBook Air 15" M3', categoryId: 1, model: 'Apple MacBook Air (15-inch, M3, 16GB)', serialNumber: 'SN-MBA15M3X02', status: 'in-use', location: 'Delhi', costCents: 169900, purchaseDate: '2026-01-10', notes: 'Product Management standard laptop', assignedTo: 5, assignedDate: '2026-01-12' },
      { name: 'ThinkPad X1 Carbon Gen 12', categoryId: 1, model: 'Lenovo ThinkPad X1 Carbon', serialNumber: 'SN-TPX1G12X03', status: 'available', location: 'Mumbai', costCents: 189900, purchaseDate: '2026-02-01', notes: 'Windows backup machine' },
      { name: 'Dell UltraSharp 27 4K', categoryId: 2, model: 'Dell U2723QE', serialNumber: 'SN-DELL27U01', status: 'in-use', location: 'Bangalore', costCents: 65900, purchaseDate: '2025-10-05', assignedTo: 4, assignedDate: '2025-11-20' },
      { name: 'LG 34" Curved UltraWide', categoryId: 2, model: 'LG 34WN80C-B', serialNumber: 'SN-LG34W01', status: 'available', location: 'Hyderabad', costCents: 72000, purchaseDate: '2025-08-15' },
      { name: 'Keychron K3 Pro', categoryId: 3, model: 'Keychron K3 Pro Wireless', serialNumber: 'SN-KCH3P01', status: 'in-use', location: 'Mumbai', costCents: 11000, purchaseDate: '2026-01-20', assignedTo: 2, assignedDate: '2026-01-22' },
      { name: 'Logitech MX Master 3S', categoryId: 3, model: 'Logitech MX Master 3S', serialNumber: 'SN-MXM3S01', status: 'in-use', location: 'Bangalore', costCents: 9999, purchaseDate: '2025-11-15', assignedTo: 4, assignedDate: '2025-11-20' },
      { name: 'Sony WH-1000XM5', categoryId: 4, model: 'Sony WH-1000XM5 Wireless Noise Canceling', serialNumber: 'SN-SNYXM501', status: 'retired', location: 'Delhi', costCents: 34990, purchaseDate: '2024-05-10', notes: 'Damaged right hinge, decommissioned' },
      { name: 'Jabra Evolve2 65', categoryId: 4, model: 'Jabra Evolve2 65 Wireless', serialNumber: 'SN-JAB6501', status: 'available', location: 'Mumbai', costCents: 22000, purchaseDate: '2025-12-01' },
      { name: 'Apple Magic Trackpad', categoryId: 3, model: 'Apple Magic Trackpad (Black)', serialNumber: 'SN-AMT01', status: 'in-use', location: 'Bangalore', costCents: 14900, purchaseDate: '2025-11-15', assignedTo: 1, assignedDate: '2025-11-16' },
    ];
    for (const a of sampleAssets) {
      await assetService.createAsset(a, 'System Seeder');
    }
    console.log('Assets created.');

    console.log('Seeding complete!');
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await pool.end();
  }
}

seed();
