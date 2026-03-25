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
import { Droplets, Zap, AlertCircle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

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

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar text-sidebar-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sidebar via-sidebar to-sidebar-accent opacity-90" />
        
        {/* Decorative Elements */}
        <div className="absolute top-20 right-20 w-64 h-64 rounded-full bg-sidebar-primary/10 blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 rounded-full bg-sidebar-primary/5 blur-3xl" />
        
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div>
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sidebar-primary/20 border border-sidebar-border">
                <Droplets className="w-6 h-6 text-sidebar-primary" />
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sidebar-primary/20 border border-sidebar-border">
                <Zap className="w-6 h-6 text-sidebar-primary" />
              </div>
            </div>
            
            <h1 className="mt-8 text-4xl font-bold tracking-tight text-balance">
              TADEC
            </h1>
            <p className="mt-2 text-lg text-sidebar-foreground/70">
              {t("auth.welcomeMessage")}
            </p>
          </div>

          <div className="space-y-6">
            {/* Features */}
            <div className="grid gap-4">
              <FeatureItem
                title="Collecte de Données"
                description="Intégration Kobo et Eneo"
              />
              <FeatureItem
                title="Traitement Intelligent"
                description="Détection automatique des anomalies"
              />
              <FeatureItem
                title="Export SIG/AUTOCAD"
                description="Préparation pour cartographie"
              />
            </div>

            {/* Footer */}
            <div className="pt-8 border-t border-sidebar-border/50">
              <p className="text-sm text-sidebar-foreground/50">
                Ministère de l&apos;Eau et de l&apos;Énergie
              </p>
              <p className="text-xs text-sidebar-foreground/40 mt-1">
                République du Cameroun
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          {/* Header Controls */}
          <div className="flex justify-end gap-2 mb-8">
            <LanguageSwitch />
            <ThemeToggle />
          </div>

          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Droplets className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold">TADEC</span>
          </div>

          <Card className="border-border/50 shadow-lg">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                {t("auth.login")}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {t("auth.signInSubtitle")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
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

              {/* Demo Credentials */}
              <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Comptes de démonstration :
                </p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p><span className="font-medium">Admin:</span> admin@minee.cm / admin123</p>
                  <p><span className="font-medium">Chef d&apos;équipe:</span> marie.ekotto@minee.cm / team123</p>
                  <p><span className="font-medium">Agent validation:</span> paul.mvondo@minee.cm / valid123</p>
                  <p><span className="font-medium">Agent traitement:</span> agnes.fotso@minee.cm / process123</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-sidebar-accent/30 border border-sidebar-border/50">
      <div className="w-2 h-2 rounded-full bg-sidebar-primary mt-2" />
      <div>
        <p className="font-medium text-sidebar-foreground">{title}</p>
        <p className="text-sm text-sidebar-foreground/60">{description}</p>
      </div>
    </div>
  );
}
