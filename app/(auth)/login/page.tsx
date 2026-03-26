"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { LanguageSwitch } from "@/components/shared/language-switch";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { AlertCircle, Eye, EyeOff, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        toast.success(t("auth.welcomeBack"));
        router.push("/dashboard");
      } else {
        setError(result.error || t("auth.invalidCredentials"));
      }
    } catch {
      setError(t("errors.networkError"));
    } finally {
      setIsLoading(false);
    }
  };

  const demoAccounts = [
    { role: "Admin", email: "admin@minee.cm", password: "admin123" },
    { role: "Chef d'équipe", email: "marie.ekotto@minee.cm", password: "team123" },
    { role: "Agent validation", email: "paul.mvondo@minee.cm", password: "valid123" },
    { role: "Agent traitement", email: "agnes.fotso@minee.cm", password: "process123" },
  ];

  const handleDemoSelect = (email: string, password: string) => {
    setEmail(email);
    setPassword(password);
    toast.info(`Compte ${email.split('@')[0]} sélectionné`, {
      description: "Cliquez sur Se connecter pour continuer",
    });
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left Panel - Fixed with dark overlay */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden fixed lg:relative lg:h-full">
        
        
        <img
          src="/images/login-cover.png"
          alt="image de fond"
          className="absolute w-full h-full object-cover"
        />

         <div className="absolute inset-0 bg-black/30" />
        
        <div className="relative flex flex-col justify-between p-12 w-full z-10">
          <div>
            <h1 className="mt-2 text-2xl text-center font-bold text-white">
              PLATEFORME DE TRAITEMENT DES DONNEES DE COLLECTE DES ACTIFS DE DISTRIBUTION ELECTRIQUE ET COMMERCIAL
            </h1>
          </div>

          <div className="space-y-2">
            <div className="grid gap-2 container mx-auto w-1/2">
              <FeatureItem
                title="Traitement Intelligent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Scrollable */}
      <div className="flex-1 flex items-start justify-center p-4 bg-background overflow-y-auto h-full">
        <div className="w-full max-w-md my-auto py-2">
          {/* Header Controls 
          <div className="flex justify-end gap-2 mb-8">
            <LanguageSwitch />
            <ThemeToggle />
          </div>*/}

          {/* Mobile Logo */}
<div className="flex items-center justify-center w-full mx-auto mb-2 sm:mb-4 md:mb-6">
  <div className="flex flex-wrap gap-2 sm:gap-4 items-center justify-center">
    <img
      src="/logos/eneo.jpg"
      alt="eneo"
      className="w-20 sm:w-28  h-12 sm:h-16 object-contain"
    />
    <img
      src="/logos/minee.png"
      alt="minee"
      className="w-20 sm:w-28  h-20 sm:h-28  object-contain"
    />
    <img
      src="/logos/arsel.png"
      alt="arsel"
      className="w-20 sm:w-28  h-12 sm:h-16  object-contain"
    />
  </div>
</div>

          <Card className="border-border/50 shadow-lg">
            <CardHeader className="space-y-1 ">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                {t("auth.login")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-2">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="andremarie@minee.cm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="email"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t("auth.password")}</Label>
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 h-auto font-normal text-xs text-muted-foreground hover:text-primary"
                    >
                      {t("auth.forgotPassword")}
                    </Button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="current-password"
                      className="h-11 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-11 px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="sr-only">
                        {showPassword ? "Hide password" : "Show password"}
                      </span>
                    </Button>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    disabled={isLoading}
                  />
                  <Label
                    htmlFor="remember"
                    className="text-sm font-normal text-muted-foreground cursor-pointer"
                  >
                    {t("auth.rememberMe")}
                  </Label>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Spinner className="mr-2" />
                      {t("common.loading")}
                    </>
                  ) : (
                    t("auth.signIn")
                  )}
                </Button>
              </form>

              {/* Demo Credentials - Dropdown */}
              <div className="mt-6">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full justify-between"
                      disabled={isLoading}
                    >
                      <span>Comptes de démonstration</span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                    {demoAccounts.map((account, index) => (
                      <DropdownMenuItem
                        key={index}
                        onClick={() => handleDemoSelect(account.email, account.password)}
                        className="flex flex-col items-start py-2 cursor-pointer"
                      >
                        <span className="font-medium">{account.role}</span>
                        <span className="text-xs text-muted-foreground">{account.email}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Sélectionnez un compte pour remplir automatiquement les champs
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ title }: { title: string }) {
  const subPoints = [
    "Gestion des doublons",
    "Gestion des divergences",
    "Gestion des cas complexes",
  ];

  return (
    <div className="flex items-start gap-2 p-2 mx-7 rounded-lg bg-sidebar-accent/30 border border-sidebar-border/50 backdrop-blur-sm">
      <div className="w-2 h-2 rounded-full bg-sidebar-primary mt-2" />
      <div>
        <p className="font-medium text-white">{title}</p>
        <ul className="mt-1 space-y-1">
          {subPoints.map((point, index) => (
            <li key={index} className="text-sm text-white/90 flex items-start gap-1.5">
              <span className="text-sidebar-primary">•</span>
              {point}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}