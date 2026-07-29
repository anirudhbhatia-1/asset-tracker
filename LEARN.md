# AssetTrack — Complete Beginner's Learning Guide

> Welcome! If you've never written a single line of code before, this guide is written specifically for you. By the time you finish reading it, you'll understand exactly how this application works, why it was built the way it was, and what every single piece of code is doing. Let's take it one step at a time.

---

## Table of Contents

1. [What Is AssetTrack?](#section-1--what-is-assettrack)
2. [How a Web Application Works](#section-2--how-a-web-application-works-the-big-picture)
3. [The Languages Used and Why](#section-3--the-languages-used-and-why)
4. [The Project's Folder Structure](#section-4--the-projects-folder-structure-explained)
5. [What We Installed and Why](#section-5--what-we-installed-and-why-every-package-explained)
6. [Teaching the Languages Using Real Code](#section-6--teaching-the-languages-using-real-project-code)
7. [How the Login Flow Works End to End](#section-7--how-the-login-flow-works-end-to-end)
8. [How to Run This Project Yourself](#section-8--how-to-run-this-project-yourself-step-by-step)
9. [Common Beginner Mistakes](#section-9--common-beginner-mistakes-and-what-they-mean)
10. [Glossary of Every Technical Term](#section-10--glossary-of-every-technical-term-used-in-this-project)

---

## Section 1 — What Is AssetTrack?

### The Problem It Solves

Imagine a company with 200 employees. Every few weeks, someone joins, someone leaves, someone's laptop breaks, or someone needs a new monitor. The IT department is responsible for all of it — buying the equipment, handing it out, tracking who has what, and collecting it back when someone quits.

Without a system, this becomes a total mess. You'd have spreadsheets that nobody keeps updated, emails nobody responds to, and nobody actually knows where the 27 MacBooks went. AssetTrack solves this.

**AssetTrack is an internal web application for tracking IT hardware — laptops, monitors, phones, keyboards, and any other equipment a company owns.** It tells you exactly what you have, who has it, and what condition it's in.

### Who Uses It? (The Three Roles)

This app has three types of users, each with a different job:

**🔑 Admin (IT Department)**
The admin is the person running the show. They have the highest level of access. They can see every single asset, add new ones, assign them to employees, retire old ones, and manage every other user's account. Think of them as the head of the warehouse.

**👩‍💼 HR**
HR can see the employee directory, create new employee profiles when someone is hired, and manage onboarding requests — like "this new hire joining Monday will need a laptop and a monitor." HR cannot touch the assets themselves; that's the Admin's job.

**👤 Employee**
A regular employee can log in and see their own profile: which assets are assigned to them, their department, their location. They can also submit tickets — for example, "my laptop screen is cracked, I need a replacement." They cannot see other people's assets.

### What Can Each Person Do?

| Feature | Admin | HR | Employee |
|---|---|---|---|
| View full inventory | ✅ | ❌ | ❌ |
| Add / edit assets | ✅ | ❌ | ❌ |
| Assign asset to employee | ✅ | ❌ | ❌ |
| View employee directory | ✅ | ✅ | ❌ |
| Create employee profiles | ✅ | ✅ | ❌ |
| Submit support tickets | ✅ | ✅ | ✅ |
| View own assigned assets | ✅ | ✅ | ✅ |
| Create onboarding requests | ✅ | ✅ | ❌ |
| Scan barcodes | ✅ | ❌ | ❌ |
| Manage user logins | ✅ | ❌ | ❌ |

### Why Not Just Use a Spreadsheet?

A spreadsheet is fine when you have 10 laptops. But it breaks down quickly:

- **No access control.** Anyone with the spreadsheet can edit or delete anything.
- **No history.** If someone changes a row, you'll never know it happened.
- **No automation.** You can't automatically notify someone when a device is returned.
- **No roles.** A regular employee shouldn't be able to see what laptop the CEO has.
- **No real-time updates.** Two people editing the same spreadsheet at the same time causes conflicts.

AssetTrack solves all of these by using a proper database, a backend that enforces rules, and a frontend that shows only what you're allowed to see.

---

## Section 2 — How a Web Application Works (The Big Picture)

### The Restaurant Analogy

Let's say you go to a restaurant. Here's what happens:

1. You walk into the **dining room** and look at the menu (that's the **frontend**).
2. You tell the **waiter** what you want (that's an **HTTP request**).
3. The waiter goes to the **kitchen** and gives your order to the cook (that's the **backend**).
4. The cook goes to the **pantry/fridge** to get the ingredients (that's the **database**).
5. The cook prepares the food and sends it back through the waiter to you (that's the **response**).

You, the customer, never see the kitchen. You never touch the pantry. You only see what the waiter brings to your table.

**This is exactly how every web application works.** Including AssetTrack.

### How This Applies to AssetTrack

| Restaurant | AssetTrack |
|---|---|
| Dining room (what you see) | React app in your browser (`client/` folder) |
| Waiter (messenger) | Axios (our HTTP request tool) |
| Kitchen (does the work) | Express server running on Node.js (`server/` folder) |
| Pantry/Fridge (stores everything) | Supabase PostgreSQL database (in the cloud) |

**The frontend** lives in `client/`. It's the React application that runs inside your web browser. It shows you pages, buttons, tables, and forms. But by itself, it cannot save anything permanently — the moment you close the tab, everything you typed would be lost without the backend.

**The backend** lives in `server/`. It's an Express/Node.js application running on a server. It receives requests from the browser, applies the business rules ("does this person have permission?"), talks to the database, and sends back a response.

**The database** is Supabase PostgreSQL. It's where all the data lives permanently — every employee, every asset, every ticket, every session. Even if you restart the server, the data is still there.

### The Flow in a Simple Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR BROWSER                             │
│                                                                 │
│   React + Vite (client/)                                        │
│   "Show me the list of assets"                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │  HTTP Request
                           │  GET /api/assets
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                       NODE.JS SERVER                            │
│                                                                 │
│   Express (server/)                                             │
│   "OK, let me check who you are, then fetch the data"           │
└──────────────────────────┬──────────────────────────────────────┘
                           │  SQL Query
                           │  SELECT * FROM assets
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE POSTGRESQL                           │
│                                                                 │
│   PostgreSQL Database (cloud)                                   │
│   "Here are all 47 assets you asked for"                        │
└─────────────────────────────────────────────────────────────────┘
```

The data travels back up the chain: Database → Server → Browser. Every single feature in AssetTrack follows this exact pattern.

---

## Section 3 — The Languages Used and Why

### JavaScript — The Engine of Everything

**What it is:** JavaScript is the only programming language that runs natively inside web browsers. It makes web pages interactive.

**Why this project uses it:** Since JavaScript runs in the browser, it's the natural choice for the frontend. But here's the clever part — thanks to Node.js, JavaScript can also run on a server. So instead of learning two different languages (one for frontend, one for backend), this project uses JavaScript everywhere. One language, two places.

**Real example from this project** — the login function from `server/services/authService.js`:

```js
const login = async (email, password) => {
  const { rows } = await db.pool.query(
    'SELECT * FROM employees WHERE email = $1 AND password_hash IS NOT NULL',
    [email]
  );
  if (rows.length === 0) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }
  const user = rows[0];
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await db.pool.query(
    'INSERT INTO sessions (token, employee_id, expires_at) VALUES ($1, $2, $3)',
    [token, user.id, expiresAt]
  );
  return {
    token,
    user: { id: user.id, email: user.email, role: user.role, adminType: user.admin_type }
  };
};
```

---

### HTML — The Skeleton of Every Page

**What it is:** HTML (HyperText Markup Language) is the language that describes the structure of a webpage. It tells the browser: "here is a heading, here is a paragraph, here is a button."

**Why this project uses it:** In React, we don't write plain HTML files. Instead we write **JSX** — JavaScript that looks almost identical to HTML. The difference is tiny but important (for example: `className` instead of `class`). JSX gets converted to HTML automatically by the build tool.

**Real example** — the email input from `client/src/pages/Login.jsx`:

```jsx
<label className="text-sm font-medium text-primary ml-1" htmlFor="email">
  Email
</label>
<div className="relative">
  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" />
  <input
    id="email"
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    placeholder="admin@company.com"
    className="w-full pl-10 pr-4 py-3 bg-base/50 border border-border rounded-xl text-primary placeholder:text-secondary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/50 transition-all duration-200"
    required
  />
</div>
```

---

### CSS — Making Things Look Nice

**What it is:** CSS (Cascading Style Sheets) controls the visual appearance of everything — colors, fonts, sizes, spacing, animations.

**Why this project uses it — TailwindCSS:** Instead of writing a separate `.css` file with rules like `color: blue; font-size: 14px;`, Tailwind lets you write those styles as short class names directly on the HTML element. `text-blue-500` means blue text. `text-sm` means small text. It's faster and keeps everything in one place.

**Real example** — the `className` string on the email input above, broken down:

- `w-full` → make this input fill its entire container
- `pl-10 pr-4 py-3` → padding: left 10 units (room for the icon), right 4, vertical 3
- `bg-base/50` → background color is our "base" theme color at 50% opacity
- `border border-border` → add a border using our theme's border color
- `rounded-xl` → round the corners nicely
- `focus:outline-none focus:border-accent focus:ring-2` → when the user clicks inside, change the border color and show a glow ring

---

### SQL — Talking to the Database

**What it is:** SQL (Structured Query Language) is the language for reading and writing data in a database. Every time you save or load data, SQL is involved.

**Why this project uses it:** The database (PostgreSQL on Supabase) only understands SQL. So whenever the backend needs to fetch employees, create an asset, or check a session token, it sends an SQL query to the database.

**Real example** — the exact query from `server/services/authService.js`:

```sql
SELECT * FROM employees WHERE email = $1 AND password_hash IS NOT NULL
```

In plain English: "Look in the `employees` table. Find the row where the email matches what I'm searching for AND where the `password_hash` column is not empty (meaning this person has a login account)."

---

### JSON — The Standard Shipping Box for Data

**What it is:** JSON (JavaScript Object Notation) is a text format that both the frontend and backend use to package and send data to each other. It looks like a JavaScript object.

**Why this project uses it:** The frontend and backend are completely separate programs. They talk to each other over HTTP, and HTTP can only carry text. JSON is the agreed-upon text format — like a standardized shipping box that both sides know how to pack and unpack.

**Real example** — the response the login endpoint sends back:

```json
{
  "data": {
    "token": "a3f9b2c1d8e7...",
    "user": {
      "id": 1,
      "email": "admin@company.com",
      "role": "admin",
      "adminType": null
    }
  },
  "message": "Logged in successfully"
}
```

The frontend receives this JSON, unpacks it, saves the `token` to sessionStorage, saves the `user` data, and then redirects to the dashboard.

---

## Section 4 — The Project's Folder Structure Explained

Here is the full folder layout and what each folder does:

```
comppro/
├── client/          ← Everything the user sees in the browser
│   └── src/
│       ├── pages/       ← Each full page of the app
│       ├── components/  ← Reusable building blocks
│       ├── hooks/       ← Shared logic between pages
│       ├── api/         ← All "call the server" functions
│       └── context/     ← Global shared state
├── server/          ← Everything running on the server
│   ├── routes/      ← URL endpoints — what the server can respond to
│   ├── services/    ← Business logic and database queries
│   ├── middleware/  ← Code that runs on every request
│   └── db.js        ← The database connection
├── supabase/
│   └── migrations/  ← Scripts that built the database structure
└── package.json     ← The shopping list of tools this project uses
```

### `client/src/pages/`

Each file here is one full page of the application. `Login.jsx` is the login page. `Inventory.jsx` is the full asset table. `Employees.jsx` is the employee directory. The reason pages are separated from components is that pages represent entire views (like entire rooms in a house), while components are the smaller pieces inside them (like furniture).

### `client/src/components/`

These are reusable building blocks — a button, a modal dialog, a card, the sidebar, the top navigation bar. The same modal component might appear on the Inventory page and the Employees page. Because it's a component, you build it once and use it everywhere.

### `client/src/hooks/`

A hook is a reusable piece of logic. `useEmployees.js` contains all the logic for fetching, creating, deleting, and updating employees. The Employees page uses this hook — it just calls `useEmployees()` and gets back the data and the action functions. This keeps the page file clean.

### `client/src/api/`

Every function that sends an HTTP request to the backend lives here. `employeesApi.js` has functions like `getEmployees()`, `createEmployee()`, `deleteEmployeeApi()`. The hooks call these API functions, and the API functions talk to the server. It's a clean chain of responsibility.

### `client/src/context/`

Context is React's built-in way of sharing state globally. `AuthContext.jsx` holds who is currently logged in. Instead of passing "who's logged in" down through every single component manually, context makes it available everywhere at once.

### `server/routes/`

Routes are the menu of things the server can do. `auth.js` defines `/login`, `/logout`, `/change-password`. `employees.js` defines all the employee-related URLs. Think of each route file as one section of a restaurant's menu.

### `server/services/`

Services contain the actual business logic. When a login request arrives, the route file calls `authService.login(email, password)`. The actual work — querying the database, checking the password, creating the session — all happens in `authService.js`. This separation means routes are thin and focused; services are where the real logic lives.

### `server/middleware/`

Middleware is code that runs on every request before it reaches the route. `validateSession.js` checks if a valid session token is attached to every request. Think of it as the security guard at the door — you have to show your badge before you can enter. `errorHandler.js` catches any error that occurs anywhere in the server and sends a clean error response.

### `server/db.js`

This is the single file that connects to the PostgreSQL database. It creates a "pool" of database connections (like having multiple phone lines so you can handle multiple callers at once). Every service file imports this to run SQL queries.

### `supabase/migrations/`

Migration files are SQL scripts that built the database structure step by step. The first file, `20260724072117_initial_schema.sql`, creates the initial tables. Later files add columns, new tables, or change things. Think of migrations like Git for your database — you can see the history of every change ever made.

---

## Section 5 — What We Installed and Why (Every Package Explained)

### Server Packages (`server/package.json`)

**`express`** — The framework that turns Node.js into a web server. Without this, we'd have to write hundreds of lines of low-level code just to receive a web request. This project uses it to define all the API routes in `server/routes/`.

**`pg`** — The "driver" that lets Node.js talk to PostgreSQL. Think of it as a translator between JavaScript and the database's language. Every single database query in this project — every `pool.query(...)` — goes through this package.

**`bcrypt`** — A tool for hashing (scrambling) passwords before saving them. You should never, ever save a real password in a database. Instead you save a scrambled version. When someone logs in, you scramble what they typed and compare the two scrambles. If they match, the password was correct.

**`cors`** — Stands for "Cross-Origin Resource Sharing." Browsers have a security rule: by default, a page at `http://localhost:5173` is not allowed to talk to a server at `http://localhost:3001` — they have different "origins." CORS tells the browser "it's OK, I trust that frontend." This package configures that permission.

**`dotenv`** — Loads secret configuration values (like database passwords, API keys) from a `.env` file into the server's environment. This way secrets never get accidentally committed to Git. You'll see `process.env.DATABASE_URL` throughout the server — that value comes from the `.env` file via this package.

**`express-validator`** — Checks that data coming from users is valid before processing it. On the login route, it verifies that the email looks like a real email and the password isn't empty. Without this, someone could submit blank forms or malicious text.

**`express-rate-limit`** — Limits how many requests one person can make in a short time. Without this, someone could try 10,000 password guesses per second. With this, after a few failed attempts they get temporarily blocked.

**`google-auth-library`** — Verifies that a "Sign in with Google" token is real and wasn't tampered with. You never trust what the browser sends you directly — you always verify it on the server using Google's own library.

**`morgan`** — A logging tool that prints every incoming request to the console during development. When you run the server, you'll see lines like `GET /api/employees 200 15ms`. This is Morgan working, helping you see what's happening.

**`nodemon`** (dev only) — Automatically restarts the server every time you save a file. Without this, you'd have to manually stop and restart the server after every code change. This only runs during development.

---

### Client Packages (`client/package.json`)

**`react`** — The library that lets us build the user interface as small reusable pieces called components. Instead of one giant HTML file, we have hundreds of small, focused components like `<Login />`, `<Inventory />`, `<EmployeeCard />`.

**`react-dom`** — The part of React that connects the React component tree to the actual HTML in the browser. React itself is abstract — `react-dom` is what actually paints things on the screen.

**`react-router-dom`** — Handles navigation between pages without ever reloading the browser. When you click "Employees" in the sidebar, only the content area changes — not the whole page. This creates a much smoother, app-like experience.

**`axios`** — The tool the frontend uses to send HTTP requests to the backend. Like a messenger that carries your request to the server and brings back the response. Simpler and more powerful than the browser's built-in `fetch`.

**`react-hot-toast`** — Shows the small pop-up notification messages in the top corner ("Employee created successfully", "Invalid credentials"). Every `toast.success(...)` and `toast.error(...)` call in the code uses this.

**`tailwindcss`** — The CSS framework where instead of writing `color: blue; font-size: 14px;` in a separate file, you write `text-blue-500 text-sm` directly on the element. It makes styling very fast once you know the class names.

**`lucide-react`** — A library of icons. Every icon in this project (the shield on the login page, the bell for notifications, the person icon for profiles) comes from Lucide. You import them like `import { ShieldCheck, Mail, Lock } from 'lucide-react'`.

**`vite`** — The build tool that compiles and serves the React application during development. It runs a local web server at `http://localhost:5173` where you can see your app. It also bundles everything into a single optimised package when you're ready for production.

**`@vitejs/plugin-react`** — A Vite plugin that teaches Vite how to understand JSX (the HTML-like syntax inside `.jsx` files). Without this, Vite wouldn't know what to do with JSX.

**`@react-oauth/google`** — The official React component for adding a "Sign in with Google" button. Used during testing. The `<GoogleLogin />` component in `Login.jsx` comes from here.

**`date-fns`** — A library for formatting and manipulating dates in JavaScript. Used to display dates like "July 29, 2026" or "3 days ago" throughout the app.

**`@zxing/library`** — A barcode scanning library. Used by `Scanner.jsx` to read barcodes from the device camera — when the admin scans an asset tag to quickly look it up.

**`react-focus-lock`** — When a modal dialog opens, this library "traps" the keyboard focus inside the modal. This is important for accessibility: a screen reader user pressing Tab should stay inside the modal, not accidentally navigate to buttons behind it.

**`postcss` / `autoprefixer`** — Tools that process CSS files as part of the build. Autoprefixer automatically adds browser-specific prefixes (like `-webkit-`) to CSS properties so they work across all browsers. Required by Tailwind's build process.


---

## Section 6 — Teaching the Languages Using Real Project Code

This is the most important section. We'll read 10 real code snippets from this project and explain every single line, like a patient tutor sitting next to you.

---

### Snippet 1 — A JavaScript Function: The Login Service

**File:** `server/services/authService.js`

```js
// We need three tools. "require" is how Node.js imports a module (a package or file).
const bcrypt = require('bcrypt');   // the password-hashing tool
const crypto = require('crypto');   // Node.js built-in for generating random data
const db = require('../db');        // our database connection

// "const login" gives this function a name.
// "async" means this function does things that take time (like talking to a database).
// "(email, password) =>" means it accepts two inputs: an email and a password.
const login = async (email, password) => {

  // "await" means "pause here and wait for the result before continuing"
  // db.pool.query() sends an SQL query to the database and waits for a response
  // "$1" is a placeholder — it gets replaced with the value in [email]
  // This prevents SQL Injection attacks (never build queries by gluing strings together)
  const { rows } = await db.pool.query(
    'SELECT * FROM employees WHERE email = $1 AND password_hash IS NOT NULL',
    [email]
  );

  // "rows" is the list of matching database records
  // rows.length === 0 means no record was found — the email doesn't exist
  if (rows.length === 0) {
    const err = new Error('Invalid email or password'); // create an error object
    err.statusCode = 401;                               // attach an HTTP status code to it
    throw err;                                          // "throw" stops execution and sends the error up
  }

  // rows[0] means "take the first (and only) result" — the employee we found
  const user = rows[0];

  // bcrypt.compare() takes what the user typed and the scrambled version from the database
  // and checks if they match — WITHOUT unscrambling it.
  // This is the magic of bcrypt: you can verify without ever knowing the real password.
  const match = await bcrypt.compare(password, user.password_hash);

  if (!match) {
    // "!match" means "match is false" — the password was wrong
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  // crypto.randomBytes(32) generates 32 random bytes of data
  // .toString('hex') converts those bytes to a readable hex string
  // This becomes the session token — a unique temporary ID proving the user is logged in
  const token = crypto.randomBytes(32).toString('hex');

  // Calculate 8 hours from right now, in milliseconds
  // Date.now() gives the current time in ms; 8 * 60 * 60 * 1000 = 8 hours in ms
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

  // Save this token in the sessions table so the server can verify it on future requests
  await db.pool.query(
    'INSERT INTO sessions (token, employee_id, expires_at) VALUES ($1, $2, $3)',
    [token, user.id, expiresAt]
  );

  // "return" sends back the token and basic user info to whoever called this function
  // We only return what the frontend needs — NOT the password hash, NOT sensitive fields
  return {
    token,
    user: { id: user.id, email: user.email, role: user.role, adminType: user.admin_type }
  };
};
```

> 💡 **Why do we say "Invalid email or password" instead of specifying which one is wrong?** Because if we say "email not found", an attacker now knows that a guessed email doesn't exist. By giving the same vague message for both cases, we reveal less information.

---

### Snippet 2 — An API Route: POST /login

**File:** `server/routes/auth.js`

```js
const express = require('express');
const { body } = require('express-validator'); // "body" lets us validate fields inside req.body
const validateRequest = require('../middleware/validateRequest'); // our custom validator middleware
const authService = require('../services/authService'); // the actual login logic lives here

// express.Router() creates a mini-app for just this group of routes
// All routes in this file will be prefixed with /api/auth (set in server/index.js)
const router = express.Router();

// "router.post('/login', [...])" means: when a POST request arrives at /login...
// The array in the middle is a list of "validators" — checks that run BEFORE the main function
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),   // must look like an email
  body('password').notEmpty().withMessage('Password is required'),  // must not be empty
  validateRequest  // if any check above fails, this stops the request and returns an error
], async (req, res, next) => {
  // req = the incoming request (contains what the browser sent)
  // res = the outgoing response (what we send back to the browser)
  // next = a function to call if we want to pass control to the next middleware

  try {
    // req.body.email and req.body.password are the values the browser sent in the request body
    const result = await authService.login(req.body.email, req.body.password);

    // res.status(200) sets the HTTP status code to 200 (meaning "OK, everything worked")
    // .json() converts a JavaScript object to JSON and sends it as the response
    res.status(200).json({ data: result, message: 'Logged in successfully' });

  } catch (err) {
    // If authService.login() threw an error, we catch it here
    // "next(err)" passes it to the global error handler (in middleware/errorHandler.js)
    // which will send a proper error response to the browser
    next(err);
  }
});
```

> 💡 **The `try/catch` pattern** is how JavaScript handles errors in async code. If anything inside `try` throws an error or fails, execution jumps immediately to `catch`. Without try/catch around async code, an unhandled error would crash the server.

---

### Snippet 3 — A Database Query: The Session Validation

**File:** `server/middleware/validateSession.js`

```js
const { pool } = require('../db'); // import just "pool" from db.js

// This is a middleware function — it runs on every protected request before the route handler
const validateSession = async (req, res, next) => {
  try {
    // req.headers is an object of all the HTTP headers the browser sent
    // The Authorization header carries the session token, formatted as "Bearer <token>"
    const authHeader = req.headers.authorization;

    // If there's no Authorization header, or it doesn't start with "Bearer "...
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // ...send a 401 Unauthorized response immediately and stop
      return res.status(401).json({ error: true, message: 'Unauthorized - No token provided', code: 401 });
    }

    // Split "Bearer a3f9b2c1..." by the space character, take the second part
    // result: token = "a3f9b2c1..."
    const token = authHeader.split(' ')[1];

    // This SQL query uses a JOIN — it looks in TWO tables at the same time
    // "FROM sessions s" = start with the sessions table, nicknamed "s"
    // "JOIN employees e ON s.employee_id = e.id" = also look at the employees table (nicknamed "e")
    //   and connect them where sessions.employee_id matches employees.id
    // "WHERE s.token = $1" = only find the row where the token matches ours
    const { rows } = await pool.query(
      `SELECT s.employee_id, e.role, e.admin_type, s.expires_at
       FROM sessions s
       JOIN employees e ON s.employee_id = e.id
       WHERE s.token = $1`,
      [token]  // $1 is replaced with this value — NEVER put variables directly in SQL strings
    );

    // If no rows came back, the token doesn't exist in our database — it's fake or expired
    if (rows.length === 0) {
      return res.status(401).json({ error: true, message: 'Unauthorized - Invalid token', code: 401 });
    }

    const session = rows[0]; // take the first (only) result

    // Check if the token's expiry time is in the past
    if (new Date(session.expires_at) < new Date()) {
      await pool.query('DELETE FROM sessions WHERE token = $1', [token]); // clean it up
      return res.status(401).json({ error: true, message: 'Unauthorized - Token expired', code: 401 });
    }

    // Attach the user's identity to "req" so later route handlers can use it
    // req.user is now available for the rest of this request's journey
    req.user = {
      id: session.employee_id,
      role: session.role,
      adminType: session.admin_type
    };

    // "next()" means "the check passed, continue to the actual route handler"
    next();
  } catch (err) {
    next(err); // if something went wrong unexpectedly, pass it to the error handler
  }
};
```

> 🚨 **Why `$1` instead of template strings?** Never do this: `` `WHERE token = '${token}'` `` — that's called SQL Injection and it lets attackers destroy your database by putting SQL commands inside user input. `$1` with a separate array is called a "parameterized query" and it's always safe.

---

### Snippet 4 — A React Component: The Login Page

**File:** `client/src/pages/Login.jsx`

```jsx
import React, { useState } from 'react';
// "import" is how modern JavaScript brings in code from another file or package
// { useState } means we only want that specific thing from the 'react' package
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Mail, Lock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

// "const Login = () =>" defines our Login component as a function that returns JSX.
// "export default" makes it importable by other files (like App.jsx).
const Login = () => {

  // useState is a "hook" — a special React function that gives a component memory
  // useState('') creates a variable "email" that starts as an empty string
  // "setEmail" is the function you call to change it
  // When setEmail is called, React automatically re-renders the component with the new value
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // useAuth() reads the current user's login state from AuthContext
  const { login, loginWithToken } = useAuth();

  // useNavigate() gives us a function we can call to change the page (like clicking a link)
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  // This runs when the user clicks "Sign In"
  const handleSubmit = async (e) => {
    e.preventDefault(); // stop the browser from doing a full page reload (the default form behavior)

    if (!email || !password) {
      toast.error('Please enter both email and password');
      return; // stop execution right here
    }

    setIsSubmitting(true); // this triggers a re-render: the button now shows a spinner
    try {
      await login(email, password); // call the login function from AuthContext
      navigate(from, { replace: true }); // if it worked, go to the dashboard
    } catch (err) {
      // err.response?.data?.message is the error message from the server
      // The "?." is "optional chaining" — if .response is undefined, don't crash
      toast.error(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setIsSubmitting(false); // always run this — hide the spinner whether it succeeded or failed
    }
  };

  return (
    // Everything inside "return (" is JSX — it looks like HTML but it's JavaScript
    // "className" is used instead of "class" because "class" is a reserved word in JavaScript
    <div className="min-h-screen w-full flex items-center justify-center bg-base relative overflow-hidden">

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* "value={email}" connects this input to our state variable */}
        {/* "onChange={(e) => setEmail(e.target.value)}" — every time the user types,
            update the state variable. e.target.value is whatever is currently in the box. */}
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@company.com"
          className="w-full pl-10 pr-4 py-3 bg-base/50 border border-border rounded-xl"
          required
        />

        <button type="submit" disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 py-3 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold">
          {/* Ternary operator: if isSubmitting is true, show spinner; otherwise show "Sign In" */}
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
        </button>
      </form>
    </div>
  );
};

export default Login;
```

> 💡 **JSX Rule: One Root Element.** Everything returned from a React component must be wrapped in one outer element. You can't return two sibling `<div>`s directly — you'd need to wrap them. That's why there's always a big outer `<div>` wrapping everything.

---

### Snippet 5 — The AuthContext: Global Login State

**File:** `client/src/context/AuthContext.jsx`

```jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axiosInstance';
import toast from 'react-hot-toast';

// createContext() creates a "container" for shared data.
// Any component anywhere in the app can read from this container.
// This is the alternative to passing props down through 10 levels of components.
const AuthContext = createContext();

// AuthProvider is a component that "wraps" the whole app (see App.jsx)
// Everything inside it can access the auth state
export const AuthProvider = ({ children }) => {

  // "user" holds the logged-in user's info (or null if nobody is logged in)
  const [user, setUser] = useState(null);
  // "loading" is true while we're checking if there's a saved session on startup
  const [loading, setLoading] = useState(true);

  // useEffect runs a piece of code AFTER the component appears on screen.
  // The empty array [] at the end means "only run this once, when the app first loads"
  useEffect(() => {
    const checkAuth = async () => {
      // sessionStorage is a place in the browser to temporarily store data
      // It's cleared automatically when the browser tab is closed
      const token = sessionStorage.getItem('token');
      const storedUser = sessionStorage.getItem('user');

      if (token && storedUser) {
        try {
          // JSON.parse() converts the stored text back into a JavaScript object
          setUser(JSON.parse(storedUser));
        } catch (err) {
          console.error("Failed to parse stored user", err);
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
        }
      }
      setLoading(false); // we're done checking — stop the loading spinner
    };
    checkAuth();
  }, []); // the [] means: only run this effect once, when the component first mounts

  const login = async (email, password) => {
    try {
      // api.post sends a POST request to our backend at /auth/login
      const res = await api.post('/auth/login', { email, password });

      // The backend returns { data: { token, user }, message: '...' }
      const { token, user: userData } = res.data.data;

      // Save both the token and user info to sessionStorage
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('user', JSON.stringify(userData));

      // Update React's state — this triggers a re-render of everything using this context
      setUser(userData);
      toast.success('Logged in successfully');
      return true;
    } catch (err) {
      throw err; // re-throw so the Login page can catch and display the error
    }
  };

  // This JSX "provides" the auth data to all children components
  // Any component that calls useAuth() will receive { user, loading, login, logout, loginWithToken }
  return (
    <AuthContext.Provider value={{ user, loading, login, logout, loginWithToken }}>
      {!loading && children}
      {/* "!loading && children" means: don't show anything until we've checked for a saved session */}
    </AuthContext.Provider>
  );
};

// useAuth is a custom hook — a convenience function so components don't have to
// import both useContext and AuthContext. They just call useAuth().
export const useAuth = () => useContext(AuthContext);
```

> 💡 **Why not just use a global variable?** You could do `window.currentUser = userData` — but then React wouldn't know the variable changed and wouldn't re-render the UI. By using state and context, React automatically updates every component that depends on the user whenever it changes.

---

### Snippet 6 — A Custom Hook: useEmployees

**File:** `client/src/hooks/useEmployees.js`

```js
import { useState, useEffect, useCallback } from 'react';
import { getEmployees, createEmployee, deleteEmployeeApi, updateEmployeeRole, grantEmployeeAccess } from '../api/employeesApi';
import toast from 'react-hot-toast';

// This is a custom hook — a function that starts with "use" and uses other hooks inside it.
// A hook is just a reusable piece of logic. Instead of copying this fetch/state management
// code into every page that needs employees, we extract it here and reuse it.
export default function useEmployees() {

  // State variables for the data, loading status, and any error
  const [employees, setEmployees] = useState([]);   // start with an empty list
  const [loading, setLoading] = useState(true);     // start in the loading state
  const [error, setError] = useState(null);          // no error to start

  // useCallback wraps a function and "memoizes" it — it won't be recreated on every re-render.
  // This matters because useEffect (below) will run every time fetchEmployeesData changes.
  // Without useCallback, we'd accidentally create an infinite re-render loop.
  const fetchEmployeesData = useCallback(async () => {
    setLoading(true);   // show the loading spinner
    setError(null);     // clear any previous error
    try {
      const res = await getEmployees(); // call the API function in employeesApi.js
      // res.data?.data means: if res.data exists, get the .data property; otherwise undefined
      setEmployees(res.data?.data || (Array.isArray(res.data) ? res.data : []));
    } catch (err) {
      // If the fetch failed, save the error message to display it to the user
      setError(err.message || 'Failed to load employees');
    } finally {
      setLoading(false); // always hide the spinner, even if there was an error
    }
  }, []); // empty dependency array = this function never needs to be recreated

  // This runs fetchEmployeesData once when the hook is first used
  useEffect(() => {
    fetchEmployeesData();
  }, [fetchEmployeesData]); // run again if fetchEmployeesData ever changes (it won't)

  const addEmployee = async (data) => {
    try {
      const res = await createEmployee(data);
      const newEmp = res.data?.data || res.data;
      // Add the new employee to the FRONT of the list without re-fetching everything
      // "(prev) => [newEmp, ...prev]" means: new list = [newEmp, ...all previous items]
      setEmployees((prev) => [newEmp, ...prev]);
      toast.success('Employee profile created successfully');
      return res.data;
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to add employee');
      throw err;
    }
  };

  // Return everything the Employees page needs — data, status, and action functions
  return {
    employees: Array.isArray(employees) ? employees : [],
    loading,
    error,
    refresh: fetchEmployeesData,  // let pages manually trigger a re-fetch
    addEmployee,
    deleteEmployee,
    changeRole,
    grantAccess,
    grantGoogleAccess,
  };
}
```

> 💡 **Why have both `loading` and `error` states?** Because there are three possible states for any data fetch: (1) still loading, (2) loaded successfully, (3) failed with an error. You need all three to show the right UI: a spinner, the data table, or an error message.

---

### Snippet 7 — The Axios Instance: Auto-Attaching Tokens

**File:** `client/src/api/axiosInstance.js`

```js
import axios from 'axios';

// axios.create() creates a customised version of axios with default settings
// Every request made through "axiosInstance" will automatically use these settings
const axiosInstance = axios.create({
  // baseURL means all requests are relative to this path
  // Instead of writing "http://localhost:3001/api/employees", we just write "/employees"
  // import.meta.env.VITE_API_BASE_URL is a value from the .env file; fallback is '/api'
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,  // if the server doesn't respond in 10 seconds, give up
  headers: {
    'Content-Type': 'application/json', // tell the server we're sending JSON
  },
});

// --- REQUEST INTERCEPTOR ---
// This runs automatically before EVERY request we send to the server.
// Think of it as middleware, but on the frontend.
axiosInstance.interceptors.request.use(
  (config) => {
    // config is the settings object for the outgoing request
    const token = sessionStorage.getItem('token'); // read the saved session token
    if (token) {
      // Attach it to the request's Authorization header
      // The server's validateSession middleware reads this exact header
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config; // return the (now modified) config — the request continues
  },
  (error) => {
    return Promise.reject(error); // if something went wrong building the request, reject it
  }
);

// --- RESPONSE INTERCEPTOR ---
// This runs automatically after EVERY response comes back from the server.
axiosInstance.interceptors.response.use(
  (response) => {
    return response; // if it was a success (2xx), just pass it through unchanged
  },
  (error) => {
    // If the server responded with 401 (Unauthorized)...
    if (error.response?.status === 401) {
      // ...the token is invalid or expired. Clear it and force a re-login.
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.href = '/login'; // hard redirect to the login page
    }
    console.error('API Error:', error.response?.data?.message || error.message);
    return Promise.reject(error); // pass the error along so the caller can handle it too
  }
);

export default axiosInstance;
```

> 💡 **The interceptor pattern is powerful.** Without it, every single API call in the app would need to manually attach the token and handle 401 errors. With interceptors, you write that logic once and it applies everywhere automatically.

---

### Snippet 8 — Middleware and RBAC: Who Is Allowed In?

**File:** `server/middleware/validateSession.js`

```js
// requireRole is a "factory function" — it returns a new middleware function.
// You call it like this: requireRole('admin', 'hr') — it gives you back a middleware
// that only allows users with those roles.
const requireRole = (...roles) => {
  // "...roles" means "accept any number of arguments as an array called roles"
  // So requireRole('admin', 'hr') makes roles = ['admin', 'hr']

  // This is the actual middleware function that runs on each request:
  return (req, res, next) => {
    // req.user was set by validateSession (which runs before this)
    if (!req.user) {
      return res.status(401).json({ error: true, message: 'Unauthorized', code: 401 });
    }

    // roles.includes(req.user.role) checks if the user's role is in our allowed list
    // If they're an 'employee' and we required 'admin', this is false
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: true, message: 'Forbidden - Insufficient permissions', code: 403 });
    }

    // If we get here, the user has the right role — let them through
    next();
  };
};

module.exports = { validateSession, requireRole };
```

And here's how it's used in a real route:

```js
// To get the employee list, you must:
//   1. Be authenticated (validateSession checks your token)
//   2. Have either 'admin' or 'hr' role (requireRole checks your role)
router.get('/', [validateSession, requireRole('admin', 'hr')], async (req, res, next) => {
  // If we reach here, we know for certain:
  // - The user is logged in
  // - Their role is either 'admin' or 'hr'
  // - req.user.id, req.user.role are all available for use
});
```

> 💡 **This is RBAC — Role-Based Access Control.** Every protected route in this app has two guards: `validateSession` (are you logged in?) and `requireRole(...)` (are you allowed?). A logged-in employee trying to visit the inventory API would be rejected at the second guard with 403 Forbidden.

---

### Snippet 9 — A SQL Migration: Building the Database

**File:** `supabase/migrations/20260724072117_initial_schema.sql`

```sql
-- SQL comments start with two dashes
-- "CREATE TABLE IF NOT EXISTS" means: create this table, but only if it doesn't already exist
-- This makes the migration safe to run multiple times

CREATE TABLE IF NOT EXISTS employees (
  -- "id" is the unique identifier for each row. SERIAL means "auto-increment"
  -- so the first employee gets id=1, second gets id=2, automatically
  id               SERIAL PRIMARY KEY,

  -- TEXT is the data type — it can hold any string of characters
  -- NOT NULL means this column CANNOT be empty — every employee must have a name
  name             TEXT    NOT NULL,

  -- UNIQUE means no two employees can have the same email — enforced by the database itself
  email            TEXT    UNIQUE NOT NULL,

  department       TEXT,    -- no NOT NULL = this field is optional
  location         TEXT,
  google_id        TEXT,
  avatar_url       TEXT,

  -- This column tracks whether the employee uses Google Sign-In
  -- INTEGER DEFAULT 0 means it starts as 0 (false) unless specified otherwise
  is_google_synced INTEGER DEFAULT 0,

  -- deleted_at being NULL means the employee is active.
  -- If it has a date, the employee was "soft deleted" (hidden but not erased from the DB)
  deleted_at       TIMESTAMPTZ,

  -- TIMESTAMPTZ = timestamp with timezone. DEFAULT NOW() = automatically set to right now
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assets (
  id              SERIAL PRIMARY KEY,
  name            TEXT    NOT NULL,

  -- "REFERENCES categories(id)" is a FOREIGN KEY
  -- It means this column must contain an id that actually exists in the categories table
  -- ON DELETE SET NULL means: if the category is deleted, set this field to NULL (don't crash)
  category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,

  -- CHECK() adds a constraint that validates the value before saving
  -- The status can only ever be one of these three exact strings — the database enforces it
  status          TEXT    NOT NULL DEFAULT 'available'
                          CHECK(status IN ('available','in-use','retired')),

  -- This connects an asset to the employee who has it
  assigned_to     INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- An INDEX makes searching faster. Without it, every search scans the entire table.
-- We search assets by status very often, so we add an index on that column.
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
```

> 💡 **What is a "migration"?** It's a permanent, versioned record of a database change. Instead of manually connecting to the database and running SQL, you write a migration file. Every migration file ever created is a history of how the database was built. If you need to set up the database on a new server, you just run all the migrations in order.

---

### Snippet 10 — The Server Entry Point: server/index.js

**File:** `server/index.js`

```js
require('dotenv').config(); // load all variables from .env file into process.env
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const db = require('./db');
const errorHandler = require('./middleware/errorHandler');

// express() creates the application
const app = express();
const PORT = process.env.PORT || 3001; // use the .env PORT, or default to 3001

// --- MIDDLEWARE ---
// "app.use()" registers middleware that runs for EVERY request, in order.

// cors() allows the browser at localhost:5173 to talk to this server.
// Without CORS, the browser would block all requests from a different origin.
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', // only allow this origin
  credentials: true, // allow cookies/authorization headers
}));

app.use(express.json()); // parse incoming JSON request bodies (makes req.body work)
app.use(morgan('dev'));  // log every request to the console in development mode

// --- ROUTES ---
// Each line here says: "for any URL starting with /api/employees, use this router file"
// require('./routes/employees') loads that file and returns the Express router from it
app.use('/api/assets',        require('./routes/assets'));
app.use('/api/employees',     require('./routes/employees'));
app.use('/api/categories',    require('./routes/categories'));
app.use('/api/history',       require('./routes/history'));
app.use('/api/serial',        require('./routes/serial'));
app.use('/api/google',        require('./routes/google'));
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/tickets',       require('./routes/tickets'));
app.use('/api/onboarding',    require('./routes/onboarding'));
app.use('/api/notifications', require('./routes/notifications'));

// --- 404 HANDLER ---
// If none of the routes above matched, this runs and returns a 404 Not Found
app.use((req, res, next) => {
  res.status(404).json({
    error: true,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    code: 404,
  });
});

// --- GLOBAL ERROR HANDLER ---
// This is a special Express middleware with 4 parameters (err, req, res, next)
// It catches any error that was passed via next(err) from any route
// errorHandler.js formats it into a clean JSON response
app.use(errorHandler);

// --- START THE SERVER ---
// app.listen() starts the HTTP server on the specified port
const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app;
```

> 💡 **Why does the order of `app.use()` matter?** Express processes middleware from top to bottom, in the exact order you called `app.use()`. If you put the error handler before the routes, errors from those routes would never reach it. Always put: CORS → body parser → routes → 404 handler → error handler — in that order.


---

## Section 7 — How the Login Flow Works End to End

This is the story of what happens between "I click Sign In" and "I see the dashboard." Every file is involved. Let's trace it together.

```
User types email + password → clicks "Sign In"
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  client/src/pages/Login.jsx                                  │
│  handleSubmit() fires                                        │
│  e.preventDefault() stops the page from reloading          │
│  setIsSubmitting(true) → shows the spinner                  │
│  calls: await login(email, password)                        │
└─────────────────────────┬───────────────────────────────────┘
                          │  calls login() from AuthContext
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  client/src/context/AuthContext.jsx                          │
│  login(email, password) function runs                        │
│  calls: api.post('/auth/login', { email, password })        │
└─────────────────────────┬───────────────────────────────────┘
                          │  Axios sends HTTP POST request
                          │  Body: { "email": "...", "password": "..." }
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  client/src/api/axiosInstance.js (Request Interceptor)       │
│  Looks for a token in sessionStorage (none yet — first login)│
│  No Authorization header added                              │
└─────────────────────────┬───────────────────────────────────┘
                          │  HTTP POST /api/auth/login
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  server/index.js                                             │
│  app.use('/api/auth', require('./routes/auth'))              │
│  Routes the request to server/routes/auth.js                │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  server/routes/auth.js  →  POST /login                       │
│  body('email').isEmail() → validates the email format       │
│  body('password').notEmpty() → checks password isn't blank  │
│  validateRequest middleware → if validation fails, 400 error│
│  calls: authService.login(req.body.email, req.body.password) │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  server/services/authService.js  →  login()                  │
│                                                             │
│  STEP 1: Query the database                                 │
│  SQL: SELECT * FROM employees                               │
│       WHERE email = $1 AND password_hash IS NOT NULL        │
│  → Finds the employee row                                   │
│                                                             │
│  STEP 2: Check the password                                 │
│  bcrypt.compare(password, user.password_hash)               │
│  → If wrong: throw 401 error                                │
│  → If right: continue                                       │
│                                                             │
│  STEP 3: Create a session token                             │
│  crypto.randomBytes(32).toString('hex')                     │
│  → "a3f9b2c1d8e7f6a5b4c3d2e1f0..."  (64 random hex chars)  │
│                                                             │
│  STEP 4: Save to database                                   │
│  SQL: INSERT INTO sessions (token, employee_id, expires_at) │
│       VALUES ($1, $2, $3)                                   │
│  → Token now lives in the database with an 8-hour expiry   │
│                                                             │
│  STEP 5: Return the result                                  │
│  return { token, user: { id, email, role, adminType } }     │
└─────────────────────────┬───────────────────────────────────┘
                          │  Result bubbles back up to routes/auth.js
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  server/routes/auth.js                                       │
│  res.status(200).json({                                     │
│    data: { token: "a3f9b2...", user: { id, email, role } }, │
│    message: "Logged in successfully"                        │
│  })                                                         │
└─────────────────────────┬───────────────────────────────────┘
                          │  HTTP 200 Response arrives
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  client/src/api/axiosInstance.js (Response Interceptor)      │
│  Status is 200 — pass through unchanged                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  client/src/context/AuthContext.jsx                          │
│  const { token, user: userData } = res.data.data;           │
│  sessionStorage.setItem('token', token)  → saved!           │
│  sessionStorage.setItem('user', JSON.stringify(userData))   │
│  setUser(userData) → triggers React re-render               │
│  toast.success('Logged in successfully')                    │
└─────────────────────────┬───────────────────────────────────┘
                          │  control returns to Login.jsx
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  client/src/pages/Login.jsx                                  │
│  navigate(from, { replace: true })                          │
│  → Browser URL changes to "/" (or wherever they came from)  │
│  → App.jsx renders the correct dashboard for their role     │
└─────────────────────────────────────────────────────────────┘
```

### Every Future Request After Login

From this point forward, every single HTTP request made to the server automatically includes the token — without you doing anything extra. Here's why:

The axios **request interceptor** reads the token from `sessionStorage` and adds `Authorization: Bearer <token>` to every request header. The server's `validateSession` middleware reads that header, looks up the token in the sessions table, confirms it's not expired, and sets `req.user` so the route handler knows who's making the request.

---

## Section 8 — How to Run This Project Yourself (Step by Step)

### Step 1: Install Node.js

Node.js is the program that runs JavaScript on your computer (outside of a browser). You need to install it first.

**Where to get it:** Go to [https://nodejs.org](https://nodejs.org) and download the **LTS** (Long Term Support) version. Install it like any other program. When it's done, you'll have two new commands available: `node` and `npm`.

- `node` runs JavaScript files
- `npm` is the package manager — it downloads and installs the tools listed in `package.json`

### Step 2: Open Your Terminal

A **terminal** (also called a command line, command prompt, or shell) is a text-based way to control your computer. On a Mac, open the **Terminal** app (search for it with Spotlight: `Cmd + Space`, type "Terminal").

### Step 3: Navigate to the Project

The `cd` command means "change directory" — it moves you into a folder.

```bash
cd /Users/anirudhbhatia/comppro
```

After running this, your terminal is now "inside" the project folder. Every command you type from now on runs relative to this location.

### Step 4: Install All Dependencies

```bash
npm install
```

This reads the root `package.json` and downloads the tools listed there. Then you need to do the same inside the `server` and `client` folders:

```bash
npm install --prefix server
npm install --prefix client
```

`--prefix server` means "run this command as if you're inside the `server` folder." This downloads all the packages listed in `server/package.json` (like `express`, `bcrypt`, `pg`).

### Step 5: Set Up Environment Variables

Environment variables are secret configuration values that the app needs — like the database password. They're stored in a `.env` file that is **never committed to Git** (it's in `.gitignore`).

The project includes `.env.example` files that show you what variables you need. Copy them:

```bash
# Copy the example file to create your actual .env file
cp server/.env.example server/.env
```

Then open `server/.env` in a text editor and fill in the real values. The most important one is `DATABASE_URL` — the connection string to your Supabase database.

> 🚨 **Never share your `.env` file.** It contains secrets like database passwords. Never commit it to Git or send it to anyone.

### Step 6: Start the Application

```bash
npm run dev
```

This single command (defined in the root `package.json`) starts **both** the server and client simultaneously using `concurrently`. You'll see coloured output in the terminal:

- **Blue (SERVER):** The Express backend starting on port **3001**
- **Green (CLIENT):** The Vite frontend starting on port **5173**

### Step 7: Open the App

Open your web browser and go to:

```
http://localhost:5173
```

You'll see the AssetTrack login page. Use the demo credentials shown at the bottom of the login form:

- **Admin:** `admin@company.com` / `password`
- **HR:** `hr@company.com` / `password`
- **Employee:** `employee@company.com` / `password`

> 💡 **What is `localhost`?** It's a special address that means "this computer." Port 5173 is like a specific door into your computer — the Vite dev server is listening behind that door.

---

## Section 9 — Common Beginner Mistakes and What They Mean

### ❌ `Cannot GET /api/employees`

**What it means:** The server returned a 404 — it has no route that matches `/api/employees`. This happens if the server isn't running, or you made a typo in the URL.

**How to fix:** Check that the backend server is running (you should see "Server listening on port 3001" in your terminal). Then check `server/routes/employees.js` and `server/index.js` to make sure the route is registered.

---

### ❌ `401 Unauthorized`

**What it means:** The request arrived at the server but had no valid session token. Either you're not logged in, or your session expired (after 8 hours).

**How to fix:** Log in again. The `validateSession` middleware checks for a valid `Authorization: Bearer <token>` header and rejected the request because the token was missing, invalid, or expired.

---

### ❌ `403 Forbidden`

**What it means:** You're logged in, but your role doesn't have permission for this action. For example, an `employee` trying to call `GET /api/employees` which requires `admin` or `hr` role.

**How to fix:** This isn't a bug — it's the security working correctly. Log in as a user with the correct role, or check the `requireRole(...)` call in the relevant route.

---

### ❌ `409 Conflict`

**What it means:** You're trying to create something that already exists. The most common case is trying to create an employee with an email that already exists in the database.

**How to fix:** The `UNIQUE NOT NULL` constraint on `employees.email` in the database rejects duplicate emails. Either use a different email or check if the record already exists before creating it.

---

### ❌ `ECONNREFUSED 127.0.0.1:3001`

**What it means:** The frontend tried to send a request to the backend server, but nothing was listening on port 3001. The backend server isn't running.

**How to fix:** Start the backend server: `npm run dev` from the project root, or `npm run dev --prefix server`. Make sure there are no errors in the terminal when it starts.

---

### ❌ `Cannot read properties of undefined (reading 'map')`

**What it means:** You're trying to call `.map()` on a variable that is `undefined` — meaning the data hasn't loaded from the server yet when the component tries to render.

**How to fix:** Always check if the data exists before using it. In this project, every hook has a `loading` state. In your JSX: `if (loading) return <Spinner />`. Or use optional chaining: `employees?.map(...)`.

---

### ❌ `Missing required field` / `Valid email is required`

**What it means:** The `express-validator` middleware in the route rejected your request because a required field was empty or had the wrong format.

**How to fix:** Look at the validators at the top of the route handler. For the login route: `body('email').isEmail()` — the email must be a valid format. `body('password').notEmpty()` — the password cannot be blank. Check what you're sending in the request body.

---

### ❌ The employee exists in the database but login says "Invalid email or password"

**What it means:** The employee record exists in the database, but the `password_hash` column is `NULL` (empty) for that employee. The query `AND password_hash IS NOT NULL` filters them out, so login fails.

**What this means:** This employee was added as a profile (name, department, etc.) but was never granted login access. Their account exists but they can't log in.

**How to fix:** An admin needs to go to the Employees page, find this employee, and click "Grant Access" — which sets a password and activates their account.

---

## Section 10 — Glossary of Every Technical Term Used in This Project

**API (Application Programming Interface)** — A defined set of rules for how two programs can talk to each other. The AssetTrack backend is an API: it exposes URLs the frontend can call to get or change data.

**REST (Representational State Transfer)** — A style of API design where each URL represents a "resource" (like an employee or an asset), and you use HTTP methods (GET, POST, PUT, DELETE) to interact with them.

**HTTP (HyperText Transfer Protocol)** — The language of the web. Every time you visit a webpage, your browser is sending HTTP requests and receiving HTTP responses.

**GET** — An HTTP method for fetching/reading data. `GET /api/employees` asks for a list of employees without changing anything.

**POST** — An HTTP method for creating new data. `POST /api/employees` with a body creates a new employee.

**PUT** — An HTTP method for completely replacing an existing record. `PUT /api/employees/1` with a body replaces employee #1's entire profile.

**PATCH** — An HTTP method for partially updating a record. `PATCH /api/employees/1/role` changes just the role field without touching other fields.

**DELETE** — An HTTP method for removing data. `DELETE /api/employees/1` removes employee #1.

**Request** — The message sent from the browser (or frontend) to the server. It includes: method (GET/POST), URL, headers, and optionally a body.

**Response** — The message the server sends back after processing a request. It includes: a status code, headers, and a body (usually JSON).

**JSON (JavaScript Object Notation)** — A text format for representing data as key-value pairs. It's how this app's frontend and backend communicate: `{ "email": "admin@company.com", "role": "admin" }`.

**JWT (JSON Web Token)** — A cryptographically signed token that encodes user data. The signature lets any server verify the token without a database lookup. This project uses **session tokens** instead (see below).

**Session Token** — A long random string (generated by `crypto.randomBytes`) stored in the database. When the server receives it, it looks it up in the `sessions` table to verify who it belongs to. More database lookups than JWT, but easier to invalidate (just delete the row).

**JWT vs Session Token** — JWT stores data in the token itself (stateless — no DB lookup needed, but can't be easily revoked). Session tokens store nothing in the token — the server always looks up the database (stateful — a database row must exist, but can be instantly invalidated by deleting the row). **This project uses session tokens.**

**Cookie** — A small piece of data the browser stores and automatically sends with every request to the same website. This project uses `sessionStorage` instead of cookies.

**Hash** — A one-way scrambling of data. `bcrypt.hash('mypassword', 10)` → `$2b$10$Ezttvv...`. You can never reverse the hash to get the original. You can only compare a new hash against the stored one.

**Encryption** — Two-way scrambling. Unlike hashing, you can decrypt to get back the original value. Passwords should be hashed (one-way), not encrypted (two-way).

**SQL (Structured Query Language)** — The language for talking to relational databases. `SELECT`, `INSERT`, `UPDATE`, `DELETE` are the four main commands.

**Query** — A single SQL command sent to the database. `SELECT * FROM employees WHERE role = 'admin'` is a query.

**Table** — A structured collection of related data in a database. Like a spreadsheet tab. This project has: `employees`, `assets`, `sessions`, `tickets`, `categories`, etc.

**Row** — One record in a table. One employee is one row in the `employees` table.

**Column** — One field in a table. `email`, `name`, `role` are columns in the `employees` table.

**Primary Key** — A column that uniquely identifies each row. In this project, every table has `id SERIAL PRIMARY KEY` — an auto-incrementing number.

**Foreign Key** — A column that references the primary key of another table. `assets.assigned_to REFERENCES employees(id)` means this column must contain a valid employee `id`.

**Index** — A database optimization that speeds up searches on a specific column. `CREATE INDEX idx_assets_status ON assets(status)` makes filtering by status fast.

**Migration** — A versioned SQL script that makes a change to the database schema. Run in order, migrations are the complete history of the database structure.

**CORS (Cross-Origin Resource Sharing)** — A browser security mechanism that blocks requests from one domain to another unless the server explicitly allows it. The `cors` package in this project configures which origins (frontend URLs) are allowed to make requests.

**Middleware** — A function that runs between the incoming request and the outgoing response. In Express, middleware can check authentication, log requests, validate input, handle errors, and more.

**Route** — A specific URL path that the server handles. `router.post('/login', ...)` registers the `/login` route.

**Endpoint** — The full URL of a specific API route. `POST /api/auth/login` is an endpoint.

**Component** — In React, a reusable function that returns JSX (UI). `Login`, `Inventory`, `EmployeeCard` are all components.

**Hook** — A special React function (starting with `use`) that adds reusable logic to components. `useState`, `useEffect`, `useCallback` are built-in hooks. `useEmployees`, `useAssets` are custom hooks in this project.

**State** — Data that belongs to a component and can change over time. When state changes, React re-renders the component to reflect the new data. Managed with `useState`.

**Props** — Data passed from a parent component to a child component. Like function arguments, but for components. `<EmployeeCard name="John" role="admin" />` passes two props.

**Context** — React's built-in way to share state globally without passing it as props through every level of the component tree. `AuthContext` makes the logged-in user available everywhere.

**Async** — Short for "asynchronous." When a function is `async`, it can pause (using `await`) and wait for slow operations (like database calls) without freezing everything else.

**Await** — A keyword used inside `async` functions to pause execution until a Promise resolves. `const result = await db.query(...)` waits for the database to respond before continuing.

**Promise** — An object that represents a value that will be available in the future. All async operations (like HTTP requests and database queries) return Promises.

**Callback** — A function passed as an argument to another function, to be called later. Older JavaScript code used callbacks; modern code uses async/await instead.

**Module** — A file that exports values or functions for other files to use. In Node.js, `module.exports = { login, logout }` makes those functions available to other files via `require()`.

**Import / Export** — The modern way to share code between files. In client-side React code: `export default Login;` and `import Login from './Login'`. In server-side Node.js: `module.exports = { login }` and `const { login } = require('./authService')`.

**Environment Variable** — A value set outside the code (in a `.env` file or the server's environment) that the code reads with `process.env.VARIABLE_NAME`. Used for secrets that should never be hardcoded.

**npm (Node Package Manager)** — The tool that downloads and manages JavaScript packages. `npm install` downloads everything in `package.json`. `npm run dev` runs the dev script.

**Node.js** — A runtime environment that lets JavaScript run on a server (outside the browser). The AssetTrack backend runs on Node.js.

**React** — A JavaScript library for building user interfaces out of small, reusable components. The entire `client/` folder is a React application.

**Express** — A minimal web framework for Node.js that makes it easy to define routes, use middleware, and handle HTTP requests/responses. The entire `server/` folder is an Express application.

**PostgreSQL** — A powerful, open-source relational database. All of AssetTrack's data lives in a PostgreSQL database hosted on Supabase.

**Vite** — A modern build tool and development server for frontend JavaScript applications. It serves the React app at `localhost:5173` during development and bundles it for production.

**Axios** — A JavaScript library for making HTTP requests. Used in the `client/api/` folder to send requests to the backend server.

**RBAC (Role-Based Access Control)** — A security pattern where what you're allowed to do is determined by your role (e.g., `admin`, `hr`, `employee`). The `requireRole()` function in `validateSession.js` implements RBAC in this project.

**Soft Delete** — Deleting something without actually removing it from the database. Instead, you set a `deleted_at` timestamp. The record still exists but is filtered out of all queries. If you ever need it back, it's still there. The `employees.deleted_at` column in this project supports soft delete.

**Transaction** — A group of database operations that either all succeed or all fail together. In `authService.js`'s `changePassword` function: we update the password AND delete old sessions in one transaction. If the update fails, the session deletions are rolled back too — so you never end up in a half-changed state.

**Pool / Connection Pool** — A set of pre-opened database connections ready for use. Opening a database connection is slow. A pool keeps several connections open and reuses them. The `db.js` file creates a pool of up to 10 connections (`max: 10`). When a request comes in, it grabs a free connection, uses it, and releases it back to the pool.

---

> **Congratulations! 🎉** You've just read through a complete beginner's guide to a real, production-grade web application. If you understood 70% of this, you're doing better than most people who've been coding for a year. The remaining 30% will click as you spend more time reading and writing code. Keep going.

---

*This guide was written from the actual source code of the AssetTrack project. Every code snippet is real and unmodified.*
