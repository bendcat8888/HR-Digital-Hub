# HR Portal Hub

Internal web portal for InnoGen teams to access forms, tools, directory data, and support links from one place.

## Features

- Centralized hub cards on `index.html`
- Searchable internal pages:
  - Corporate Email Accounts
  - Local Numbers
  - Corporate Contact Numbers (TAB-delimited source)
- Privacy-focused UI behavior on directory list pages (restricted bulk copy/select)
- IT Support cards with modal prompt and `mailto:` fallback

## Tech Stack

- Static HTML/CSS/JavaScript
- Tailwind CSS (CDN)
- Lucide Icons (CDN)

## Project Structure

- `index.html` - Main hub landing page
- `pages/` - Feature pages
- `assets/css/` - Shared styles
- `assets/js/` - Page scripts
- `resources/` - Internal data files (CSV/TXT/PDF/XLSX)

## Local Run (Static)

Use any static server. Example:

```bash
python3 -m http.server 8517 --directory "HR_Portal/HR Portal Hub/"
```

Open: `http://<host>:8517/`

## Privacy & Security Notes

This project may include internal company contact data.

- Keep repository **Private**
- Do **not** publish sensitive `resources/` files publicly
- Prefer backend/API-based auditing for production compliance

Suggested `.gitignore` entries:

```gitignore
resources/EmailAccounts2.csv
resources/company-mobile-numbers.txt
resources/local_directory.csv
portal.log
```

## GitHub Publish (Recommended)

1. Initialize git repo
2. Commit code
3. Publish to a **Private** GitHub repository
4. Verify sensitive resource files are excluded before push

## Optional Backend Upgrade

For authentication and accurate proxy-aware IP audit logging, integrate FastAPI behind Nginx with trusted forwarded headers.
