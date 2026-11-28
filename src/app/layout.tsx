import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import { GoogleTagManager } from "@next/third-parties/google";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const inter = Inter({ subsets: ["latin"] });

const SITE_URL = "https://www.trumategroup.com";
const gtmId = process.env.NEXT_PUBLIC_GTM_ID; 

export const metadata: Metadata = {
  title: {
    default: "Trumate | Biodegradable Tableware, Packaging & Pure Spices in Bhubaneswar",
    template: "%s | Trumate Bhubaneswar",
  },
  description:
    "Trumate supplies 100% biodegradable tableware, areca palm & bagasse packaging, compostable carry & garbage bags, and pure kitchen spices in Bhubaneswar, Odisha for homes, hotels, and restaurants.",
  keywords: [
    "Trumate Bhubaneswar",
    "biodegradable tableware Bhubaneswar",
    "areca palm plates Bhubaneswar",
    "bagasse containers suppliers Bhubaneswar",
    "compostable garbage bags Bhubaneswar",
    "eco friendly carry bags Bhubaneswar",
    "packaging suppliers in Bhubaneswar",
    "bulk disposable tableware Odisha",
    "pure kitchen spices Bhubaneswar",
    "hospitality supplies Bhubaneswar",
  ],
  authors: [{ name: "Trumate", url: SITE_URL }],
  creator: "Trumate",
  publisher: "Trumate",
  category: "Eco-Friendly Packaging & Tableware",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Trumate | Biodegradable Tableware, Packaging & Pure Spices in Bhubaneswar",
    description:
      "Eco-friendly biodegradable tableware, commercial packaging, and pure kitchen spices in Bhubaneswar, Odisha. Bulk & retail supply for kitchens, restaurants, and events.",
    url: SITE_URL,
    siteName: "Trumate",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: "/og-image.jpg", // Add a 1200x630 image in /public/og-image.jpg
        width: 1200,
        height: 630,
        alt: "Trumate biodegradable tableware, packaging & spices in Bhubaneswar",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trumate | Biodegradable Tableware & Pure Spices in Bhubaneswar",
    description:
      "Shop biodegradable tableware, packaging essentials, and pure kitchen spices in Bhubaneswar, Odisha.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "Store",
  name: "Trumate",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`, 
  image: `${SITE_URL}/og-image.jpg`,
  description:
    "Biodegradable tableware, eco-friendly packaging, garbage & carry bags, and pure kitchen spices supplier in Bhubaneswar, Odisha.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Bhubaneswar",
    addressRegion: "Odisha",
    postalCode: "751001", // Update with your exact PIN code
    addressCountry: "IN",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 20.2961,
    longitude: 85.8245,
  },
  areaServed: [
    { "@type": "City", name: "Bhubaneswar" },
    { "@type": "City", name: "Cuttack" },
    { "@type": "State", name: "Odisha" },
  ],
  priceRange: "₹₹",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      {gtmId && <GoogleTagManager gtmId={gtmId} />}
      <body className={inter.className}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
        />
        <main>
          <Toaster position="top-right" />
          {children}
        </main>
      </body>
    </html>
  );
}