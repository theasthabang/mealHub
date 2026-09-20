# 🍔 MealHub

A full-stack food delivery web application built with the MERN stack (MongoDB, Express, React, Node.js). MealHub has three types of users — customers, restaurant owners, and delivery partners — and each one has their own dashboard and features.

I built this project to practice real full-stack development. Along the way, I also went back through my own code and did a proper security review — I found and fixed several real bugs and vulnerabilities, which I think is the most valuable part of this project.

---

## Table of Contents

- [What This Project Does](#what-this-project-does)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Security Fixes](#security-fixes)
- [How to Run This Project](#how-to-run-this-project)
- [Environment Variables](#environment-variables)
- [Folder Structure](#folder-structure)
- [Testing](#testing)
- [What I Would Add Next](#what-i-would-add-next)
- [Skills Demonstrated](#skills-demonstrated)
- [What I Learned](#what-i-learned)

---

## What This Project Does

MealHub works like Swiggy or Zomato. A customer can browse restaurants in their city, add food items to their cart, and place an order. A restaurant owner can manage their menu and see incoming orders. A delivery partner can accept orders and deliver them, with live location tracking.

One thing that makes this project different from a basic version: a customer's cart can have items from more than one restaurant at the same time. Each restaurant's part of the order is handled completely separately — it has its own status, its own delivery partner, its own OTP for delivery confirmation, and its own cancellation and refund. So if a customer orders from two restaurants in one checkout, one order can be marked "delivered" while the other is still "preparing," and that is normal, expected behavior.

## Features

### Customer Side
- Browse restaurants and food items by city
- Search for food or restaurants
- Add items from multiple restaurants to one cart
- Pay with Cash on Delivery or online (Razorpay)
- Track delivery live on a map
- View order history, cancel an order, and see refund status
- See real discounts and offers on restaurants and food items
- Mobile number is verified with a real OTP before placing the first order

### Restaurant Owner Side
- Add, edit, and delete menu items (with image upload)
- Turn the restaurant "open" or "closed"
- Get real-time notification when a new order comes in
- Accept and update order status
- See sales analytics — total revenue, number of orders, pending orders, best-selling items, and trends compared to the previous period
- Create discount offers — either for the whole restaurant or for one specific item

### Delivery Partner Side
- Get notified when a new delivery is available nearby
- Accept a delivery (only one delivery partner can accept each order, even if two try at the same time)
- Share live location with the customer while delivering
- Confirm delivery using a secure OTP
- See daily earnings and delivery history

## Tech Stack

**Frontend:** React, Redux Toolkit, Tailwind CSS, React Leaflet (for maps), Socket.IO Client

**Backend:** Node.js, Express, MongoDB with Mongoose, Socket.IO

**Other Databases:** PostgreSQL (for payments and refunds), Redis (for rate limiting)

**Other Services:** Razorpay (payments), Firebase (Google Sign-In), Cloudinary (image storage), Fast2SMS (OTP messages)

**Testing & Tools:** Jest, GitHub Actions (CI), Sentry (error tracking)

## System Architecture

This project uses three different databases, and each one has one clear job. I did not just use one database for everything — I picked the right tool for each part of the problem.

**MongoDB** is the main database. It stores users, restaurants, menu items, and orders. This is the data that changes often and needs to update together, like when an order is placed or a delivery is accepted.

**PostgreSQL** is used only for one thing — keeping a record of payments and refunds. I picked PostgreSQL for this because refunds need very careful, locked calculations (so the same payment can never be refunded twice, even if two refund requests happen at the exact same second). PostgreSQL is better at this kind of strict, rule-based data than MongoDB.

**Redis** is used only to keep track of login attempts and API request limits (rate limiting), so the app does not get overloaded and accounts cannot be brute-forced.

Since MongoDB and PostgreSQL are two separate databases, they cannot be updated in a single transaction together. To solve this, I built a small pattern (similar to something called the "Outbox Pattern"): when a payment is confirmed, the app writes a note to itself inside MongoDB saying "this also needs to be saved in PostgreSQL." A background process then reads that note and saves it to PostgreSQL, and keeps retrying automatically if it fails the first time. This way, no payment record is ever lost, even if PostgreSQL is briefly unavailable.

## Security Fixes

While building this project, I went back and tested my own application like an attacker would. Here are some real problems I found and fixed:

- **Login bypass:** Google Sign-In used to trust whatever email the browser sent, with no real check. Anyone could pretend to be any user. I fixed this by verifying the real Google token on the server.
- **Price tampering:** The total price of an order used to be trusted from the browser. This meant someone could open dev tools and change the price before paying. I fixed this so every price is now calculated fresh on the server, using the real price stored in the database.
- **Double-booking bug:** Two delivery partners could accept the same order at the same time if they clicked "Accept" together. I fixed this using an atomic database transaction, so only one of them can ever win.
- **Weak OTP security:** Delivery OTPs were originally stored as plain text with no limit on wrong attempts. I changed this so OTPs are hashed (like passwords), expire after a few minutes, and lock out after 5 wrong tries.
- **Missing permission checks:** Some pages let any logged-in user view or change someone else's order just by guessing the order ID in the URL. I added proper checks so users can only see their own data.

## How to Run This Project

### What You Need First
- Node.js installed
- A MongoDB Atlas account
- Accounts for Razorpay, Firebase, Cloudinary, Upstash (Redis), Supabase (PostgreSQL), and Fast2SMS

### Steps

```bash
# 1. Clone this repository
git clone https://github.com/your-username/mealhub.git
cd mealhub

# 2. Set up the backend
cd backend
npm install
# create a .env file here (see Environment Variables section)
npm run dev

# 3. Set up the frontend (open a new terminal)
cd frontend
npm install
# create a .env file here too
npm run dev
```

The backend will automatically create the PostgreSQL tables it needs the first time it starts, so no manual database setup is required there.

## Environment Variables

**`backend/.env`**
```
PORT=8000
MONGODB_URL=
JWT_SECRET=
EMAIL=
PASS=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
CLIENT_URL=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
REDIS_URL=
DATABASE_URL=
FAST2SMS_API_KEY=
SENTRY_DSN=
```

**`frontend/.env`**
```
VITE_FIREBASE_APIKEY=
VITE_GEOAPIKEY=
VITE_RAZORPAY_KEY_ID=
```

## Folder Structure

```
mealhub/
├── backend/
│   ├── controllers/    # main logic for each route
│   ├── models/         # MongoDB schemas
│   ├── routes/         # API routes
│   ├── middlewares/    # authentication, validation, rate limiting
│   ├── utils/           # database connections, helper functions
│   ├── db/               # PostgreSQL schema file
│   ├── validators/       # input validation rules
│   └── tests/              # automated tests
├── frontend/
│   └── src/
│       ├── components/   # reusable UI pieces
│       ├── pages/          # each page of the app
│       ├── redux/           # app state management
│       └── hooks/             # reusable data-fetching logic
└── .github/workflows/       # automatic testing on every push
```

## Testing

```bash
cd backend
npm test
```

I wrote tests for the three most important and highest-risk parts of the app: making sure prices cannot be faked, making sure two delivery partners cannot accept the same order, and making sure OTP verification locks out after too many wrong attempts.

## What I Would Add Next

I want to be honest about what is not finished yet, instead of pretending this project is complete:

- A real review and rating system for restaurants (right now, only individual food items can be rated)
- Making menu categories editable per restaurant, instead of one fixed list for the whole app
- Automatically reassigning a delivery if no delivery partner accepts it in time
- Full production deployment steps, like completing Razorpay's live payment approval process

## Skills Demonstrated

Working on MealHub was not just about adding features. It gave me real, hands-on experience with problems that show up in actual production systems, not just tutorials:

- **System design:** Chose three different databases (MongoDB, PostgreSQL, Redis) on purpose, each for a specific reason, instead of putting everything in one database by default.
- **Security thinking:** Went back through my own working code and found real vulnerabilities — an authentication bypass, price tampering, a race condition, and weak OTP handling — by trying to break my own app the way an attacker would, then fixed each one with a real, tested solution.
- **Concurrency handling:** Solved a real race condition (two delivery partners accepting the same order) using atomic database transactions instead of a simple check that could fail under pressure.
- **Cross-database consistency:** Built a reliable way (similar to the Outbox Pattern) to keep two separate databases in sync, so a payment is never lost even if one database is briefly unavailable.
- **Payment systems:** Integrated Razorpay properly — verifying payments on the server instead of trusting the browser, and building a refund system that cannot accidentally refund more money than was actually paid.
- **Real-time systems:** Built secure, authenticated WebSocket connections for live order tracking and notifications, making sure a user cannot pretend to be someone else over the connection.
- **Production readiness:** Set up automated testing, continuous integration (CI), error tracking, structured logging, and health checks — the kind of work that separates a project that "runs on my laptop" from one that could actually be trusted with real users.
- **Debugging skills:** Diagnosed a wide range of real, hard-to-catch bugs, including one that only appears when deploying from Windows to a Linux server, and an edge case where a background cleanup task could conflict with a payment happening at the same time.

## What I Learned

The most important thing I learned from this project was not a specific framework or library. It was learning to actually question my own code instead of assuming it works just because it runs without errors. Most of the real bugs I found — the price tampering issue, the login bypass, the double-booking race condition — would never show up in normal testing. I only found them by deliberately trying to break my own app the way a real attacker or a code reviewer would. That habit is the biggest thing I am taking away from building MealHub.

---

## Author

Built by **Astha**, a Computer Science student.

Feel free to reach out if you have any questions about how this project works.
