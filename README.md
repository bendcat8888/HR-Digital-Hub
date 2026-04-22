# 🏢 Internal Centralize Portal Hub
**Unified Enterprise Resource Planning (ERP) Gateway & Employee Directory**

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

## 🛠 Tech Stack

| Category | Tools |
| :--- | :--- |
| **Frontend** | **Tailwind CSS** (Utility-first UI), HTML5, Lucide Icons |
| **Logic** | Vanilla JavaScript (Dynamic Search & Filter Engines) |
| **Data Handling** | Asynchronous CSV/TXT/JSON Parsing |
| **Architecture** | Component-based Static Hub (Optimized for low-latency internal networks) |
| **Security** | Privacy-focused DOM manipulation (Anti-Scraping measures) |

---

## 🎯 Project Overview
The **Internal Centralize Portal Hub** serves as the "Digital Nervous System" for InnoGen. It is a high-performance, searchable gateway designed to eliminate information silos. It provides employees with a single point of access for corporate tools, IT support, and verified directory data.

### 🌟 High-Value Business Logic
* **Centralized Resource Management:** Aggregates disparate company resources into a unified, intuitive dashboard.
* **Intelligent Search Engine:** Features a real-time, searchable directory for corporate emails, local extensions, and mobile numbers.
* **IT Support Integration:** Streamlined support cards with automated modal prompts and secure `mailto:` fallback protocols.

---

## 🚀 Key Professional Capabilities

### 🛡️ Privacy & Data Integrity
* **Anti-Bulk Export Logic:** Implemented UI-level restrictions on directory pages to prevent unauthorized bulk copying or selection of sensitive contact lists.
* **Air-Gapped Privacy:** Designed as a static-first tool to ensure that sensitive company data remains strictly within the local intranet environment.
* **Audit-Ready Architecture:** Designed with an optional **FastAPI/Nginx upgrade path** for enterprise-grade IP audit logging and authentication.

### 🎨 Modern UI/UX Design
* **Responsive Hub Cards:** A mobile-friendly, card-based interface that ensures accessibility across office desktops and field-team mobile devices.
* **Dynamic Content Loading:** Optimized to parse internal resources (CSV/TXT) on the fly, ensuring that the directory is always as current as the source files.

---

## ⚙️ Directory Structure & Run Guide

### Project Layout
- `index.html`: The core landing hub.
- `pages/`: Independent modules for Email, Local Numbers, and Contact lists.
- `resources/`: Secured data layer for internal CSV/TXT files.

### Local Deployment
To run the portal for local testing:
```bash
python3 -m http.server 8517
```

Access the portal at: `http://localhost:8517/`

---

## 📜 License & Intellectual Property
**Copyright (c) 2026 Benedic Cater / InnoGen Pharmaceuticals Inc. (Solvang)**

**All Rights Reserved.**
This repository is published for **portfolio review and technical demonstration purposes only.**

**Strict Restrictions:**
- **No Reproduction:** No part of this code may be copied, modified, or distributed.
- **Brand Protection:** Use of the "InnoGen" or "Solvang" name, branding, or logos is strictly prohibited.
- **Data Privacy:** Use of any proprietary data or business logic contained herein for commercial or personal projects is strictly prohibited.

_For professional inquiries or permission requests, please contact Benedic Cater._

