import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../index';
import { pool } from '../db';
import employeeService from '../services/employeeService';
import stockService from '../services/stockService';

const created = { employees: [], items: [] };
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const director = { id: null, name: 'Test Director', role: 'director', isDirector: true, permissions: ['*'] };

const login = async (email) => {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password' });
  return { Authorization: `Bearer ${res.body.data.token}` };
};

beforeAll(async () => {
  director.id = (await pool.query("SELECT id FROM employees WHERE email = 'admin@company.com'")).rows[0].id;
});
afterAll(async () => {
  await pool.query('DELETE FROM stock_holdings WHERE stock_item_id = ANY($1)', [created.items]);
  await pool.query('DELETE FROM stock_items WHERE id = ANY($1)', [created.items]);
  await pool.query('DELETE FROM stock_holdings WHERE employee_id = ANY($1)', [created.employees]);
  await pool.query('DELETE FROM employees WHERE id = ANY($1)', [created.employees]);
});

const newPerson = async (extra = {}) => {
  const employee = await employeeService.createEmployee({ name: 'Stock Test Person', email: `stock.${unique()}@company.com`, ...extra });
  created.employees.push(employee.id);
  return employee;
};
const newItem = async (quantity = 50, extra = {}) => {
  const item = await stockService.createItem({ name: `Laptop Bag ${unique()}`, quantity, ...extra }, director);
  created.items.push(item.id);
  return item;
};

describe('work mode', () => {
  it('defaults to office and can be set to hybrid or remote by HR', async () => {
    const hr = await login('hr@company.com');
    const res = await request(app).post('/api/employees').set(hr)
      .send({ name: 'Remote Person', email: `remote.${unique()}@company.com`, workMode: 'remote' });
    expect(res.status).toBe(201);
    created.employees.push(res.body.data.id);
    expect(res.body.data.workMode).toBe('remote');

    const office = await newPerson();
    expect(office.workMode).toBe('office');
    const patched = await request(app).patch(`/api/employees/${office.id}`).set(hr).send({ workMode: 'hybrid' });
    expect(patched.status).toBe(200);
    expect(patched.body.data.workMode).toBe('hybrid');

    // Editing another field keeps the work mode.
    const renamed = await request(app).patch(`/api/employees/${office.id}`).set(hr).send({ name: 'Renamed Person' });
    expect(renamed.body.data.workMode).toBe('hybrid');

    expect((await request(app).patch(`/api/employees/${office.id}`).set(hr).send({ workMode: 'moon' })).status).toBe(400);

    const remoteOnly = await request(app).get('/api/employees?workMode=remote').set(hr);
    expect(remoteOnly.body.data.every((e) => e.workMode === 'remote')).toBe(true);
    expect(remoteOnly.body.data.some((e) => e.id === res.body.data.id)).toBe(true);
    expect((await request(app).get('/api/employees?workMode=space').set(hr)).status).toBe(400);
  });

  it('cannot be changed by employees on their own profile', async () => {
    const employee = await login('employee@company.com');
    const me = (await request(app).get('/api/auth/me').set(employee)).body.data;
    await request(app).patch('/api/employees/me').set(employee).send({ name: 'Test Employee', workMode: 'remote' }).expect(200);
    expect((await employeeService.getEmployeeById(me.id)).workMode).toBe('office');
  });
});

describe('bulk stock items', () => {
  it('hands items out and takes them back, keeping the counts right', async () => {
    const it = await login('itadmin@company.com');
    const person = await newPerson();
    const create = await request(app).post('/api/stock').set(it)
      .send({ name: `Laptop Bag ${unique()}`, quantity: 50, location: 'Bangalore', lowStockThreshold: 5 });
    expect(create.status).toBe(201);
    const item = create.body.data;
    created.items.push(item.id);
    expect(item).toMatchObject({ totalQuantity: 50, givenOut: 0, inStock: 50, isLowStock: false });

    let res = await request(app).post(`/api/stock/${item.id}/assign`).set(it).send({ employeeId: person.id });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ givenOut: 1, inStock: 49, holdersCount: 1 });
    res = await request(app).post(`/api/stock/${item.id}/assign`).set(it).send({ employeeId: person.id, quantity: 2 });
    expect(res.body.data.holders).toEqual([expect.objectContaining({ employeeId: person.id, quantity: 3 })]);

    res = await request(app).post(`/api/stock/${item.id}/return`).set(it).send({ employeeId: person.id, quantity: 1 });
    expect(res.body.data).toMatchObject({ givenOut: 2, inStock: 48, totalQuantity: 50 });

    // Lost one: it leaves the total.
    res = await request(app).post(`/api/stock/${item.id}/write-off`).set(it).send({ employeeId: person.id, quantity: 1, note: 'Lost on train' });
    expect(res.body.data).toMatchObject({ givenOut: 1, inStock: 48, totalQuantity: 49 });

    const holdings = await request(app).get(`/api/stock/holdings/${person.id}`).set(it);
    expect(holdings.body.data).toEqual([expect.objectContaining({ stockItemId: item.id, quantity: 1 })]);

    expect(res.body.data.history.map((h) => h.eventType)).toEqual(['written_off', 'returned', 'assigned', 'assigned', 'created']);
  });

  it('refuses to hand out more than is in stock or take back more than someone has', async () => {
    const person = await newPerson();
    const item = await newItem(2);
    await expect(stockService.assign(item.id, person.id, 3, null, director)).rejects.toMatchObject({ statusCode: 409 });
    await stockService.assign(item.id, person.id, 2, null, director);
    await expect(stockService.assign(item.id, person.id, 1, null, director)).rejects.toMatchObject({ statusCode: 409 });
    await expect(stockService.takeBack(item.id, person.id, 3, null, director)).rejects.toMatchObject({ statusCode: 409 });
    await expect(stockService.assign(item.id, person.id, 0, null, director)).rejects.toMatchObject({ statusCode: 400 });
    // Stock on the shelf can't be removed below what people hold.
    await expect(stockService.adjustStock(item.id, -1, null, director)).rejects.toMatchObject({ statusCode: 409 });
    expect((await stockService.adjustStock(item.id, 10, 'Delivery', director)).inStock).toBe(10);
    // Can't delete while people hold some.
    await expect(stockService.deleteItem(item.id, director)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('never oversells under concurrent requests', async () => {
    const people = await Promise.all([newPerson(), newPerson(), newPerson(), newPerson()]);
    const item = await newItem(3);
    const results = await Promise.allSettled(people.map((p) => stockService.assign(item.id, p.id, 1, null, director)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    const fresh = await stockService.getItemById(item.id);
    expect(fresh).toMatchObject({ givenOut: 3, inStock: 0 });
  });

  it('flags low stock, rejects duplicate names per location, and gates by permission', async () => {
    const item = await newItem(3, { lowStockThreshold: 3, location: 'Pune' });
    expect(item.isLowStock).toBe(true);
    await expect(stockService.createItem({ name: item.name.toUpperCase(), location: 'pune' }, director))
      .rejects.toMatchObject({ statusCode: 409 });
    const elsewhere = await stockService.createItem({ name: item.name, location: 'Bangalore', quantity: 1 }, director);
    created.items.push(elsewhere.id);

    const employee = await login('employee@company.com');
    expect((await request(app).get('/api/stock').set(employee)).status).toBe(403);
    expect((await request(app).post('/api/stock').set(employee).send({ name: 'x' })).status).toBe(403);
    expect((await request(app).get('/api/stock/mine').set(employee)).status).toBe(200);
    const hr = await login('hr@company.com');
    expect((await request(app).post(`/api/stock/${item.id}/write-off`).set(hr).send({ employeeId: 1 })).status).toBe(403);
    expect((await request(app).patch(`/api/stock/${item.id}`).set(await login('itadmin@company.com')).send({ totalQuantity: 99 })).status).toBe(400);
  });

  it('removes an item only when nobody holds any, keeping its history', async () => {
    const item = await newItem(5);
    await stockService.deleteItem(item.id, director);
    await expect(stockService.getItemById(item.id)).rejects.toMatchObject({ statusCode: 404 });
    const { rows } = await pool.query('SELECT event_type FROM stock_history WHERE stock_item_id = $1 ORDER BY id', [item.id]);
    expect(rows.map((r) => r.event_type)).toEqual(['created', 'deleted']);
    // The name is free again for a new item.
    const again = await stockService.createItem({ name: item.name, quantity: 1 }, director);
    created.items.push(again.id);
  });

  it('keeps the first and latest assignment dates right, and refuses future dates', async () => {
    const person = await newPerson();
    const item = await newItem(10);
    await stockService.assign(item.id, person.id, 1, null, director, '2026-09-10');
    await stockService.assign(item.id, person.id, 1, null, director, '2026-08-01');
    const [holder] = (await stockService.getItemById(item.id)).holders;
    expect(holder).toMatchObject({ quantity: 2, firstAssignedAt: '2026-08-01', lastAssignedAt: '2026-09-10' });
    await expect(stockService.assign(item.id, person.id, 1, null, director, '2999-01-01')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('does not let a category used by bulk items be deleted', async () => {
    const { rows: [category] } = await pool.query(
      "INSERT INTO categories (name, badge_char, color) VALUES ($1, 'B', 'Blue') RETURNING id", [`Bags ${unique()}`]
    );
    const item = await newItem(1, { categoryId: category.id });
    const categoryService = require('../services/categoryService');
    await expect(categoryService.deleteCategory(category.id)).rejects.toMatchObject({ statusCode: 409 });
    await stockService.deleteItem(item.id, director);
    await categoryService.deleteCategory(category.id);
  });

  it('stores, updates and clears the purchase date', async () => {
    const it = await login('itadmin@company.com');
    const create = await request(app).post('/api/stock').set(it)
      .send({ name: `Dated Bag ${unique()}`, quantity: 5, purchaseDate: '2026-09-15' });
    expect(create.status).toBe(201);
    created.items.push(create.body.data.id);
    expect(create.body.data.purchaseDate).toBe('2026-09-15');

    const edit = await request(app).patch(`/api/stock/${create.body.data.id}`).set(it)
      .send({ purchaseDate: '2026-10-01' });
    expect(edit.body.data.purchaseDate).toBe('2026-10-01');

    const cleared = await request(app).patch(`/api/stock/${create.body.data.id}`).set(it)
      .send({ purchaseDate: null });
    expect(cleared.body.data.purchaseDate).toBeNull();

    expect((await request(app).post('/api/stock').set(it)
      .send({ name: `Bad Date ${unique()}`, quantity: 1, purchaseDate: '15/09/2026' })).status).toBe(400);
  });
});

