import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthProvider";
import { ScryWalletProvider } from "@/context/WalletProvider";
import { SearchProvider } from "@/components/search/SearchProvider";
import { PublicReadsProvider } from "@/components/public-reads/PublicReadsProvider";
import { ForecasterSubscriptionsProvider } from "@/context/ForecasterSubscriptionsProvider";
import { NotificationsProvider } from "@/context/NotificationsProvider";
import { SentryUserSync } from "@/components/SentryUserSync";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/brand";
import "./globals.css";

const IS_DEV = process.env.NODE_ENV === "development";

/** Skip next/font in dev — avoids /_nextjs_font/* 403 when loopback host mismatches. */
let htmlFontClass = "h-full antialiased dev-system-fonts";
if (!IS_DEV) {
  const { Geist, Geist_Mono } = await import("next/font/google");
  const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
  const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
  htmlFontClass = `${geistSans.variable} ${geistMono.variable} h-full antialiased`;
}

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={htmlFontClass}>
      <body className="min-h-full flex flex-col font-sans antialiased">
        <ScryWalletProvider>
          <AuthProvider>
            <SentryUserSync />
            <SearchProvider>
              <ForecasterSubscriptionsProvider>
                <NotificationsProvider>
                  <PublicReadsProvider>{children}</PublicReadsProvider>
                </NotificationsProvider>
              </ForecasterSubscriptionsProvider>
            </SearchProvider>
          </AuthProvider>
        </ScryWalletProvider>
      </body>
    </html>
  );
}
