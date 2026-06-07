# Pistol Performance Coaching

Website for Crystal's running coaching business - Pistol Performance Coaching.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Hosting:** Vercel
- **Domain:** crystalpistolperformance.com

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

## Deployment

This site is automatically deployed to Vercel on push to the `main` branch.

## Structure

- `src/app/page.tsx` - Main homepage
- `src/app/components/` - Reusable components
  - `Navigation.tsx` - Fixed top nav with mobile menu
  - `Hero.tsx` - Full-screen hero section
  - `About.tsx` - About Crystal section
  - `Services.tsx` - Coaching services
  - `Distances.tsx` - 5K to 100 miles grid
  - `Contact.tsx` - Contact/CTA section
  - `Footer.tsx` - Footer with social links
