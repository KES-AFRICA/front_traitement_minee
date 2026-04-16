"use client";
import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 200); // apparaît après 200px
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <ProtectedRoute>
      <QueryClientProvider client={queryClient}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <AppHeader />
            <main className="flex-1 overflow-auto p-4 lg:p-6">
              {children}
            </main>

            {/*Bouton scroll to top */}
            {showScrollTop && (
              <button
                onClick={scrollToTop}
                className="fixed bottom-6 cursor-pointer right-6 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all duration-300"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
            )}
          </SidebarInset>
        </SidebarProvider>
      </QueryClientProvider>
    </ProtectedRoute>
  );
}