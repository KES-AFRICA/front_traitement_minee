"use client"

import { useI18n } from "@/lib/i18n/context"
import { useAuth } from "@/lib/auth/context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { LanguageSwitch } from "@/components/shared/language-switch"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { User, Bell, Shield, Palette } from "lucide-react"

export default function SettingsPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  
  // Vérifier si l'utilisateur est admin
  const isAdmin = user?.role === 'admin'

  const roleLabels: Record<string, string> = {
    admin: "Administrateur",
    team_lead: "Chef d'équipe",
    validation_agent: "Agent de validation",
    processing_agent: "Agent de traitement",
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Section */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Profil</CardTitle>
            </div>
            <CardDescription>
              {isAdmin 
                ? "Gérez vos informations personnelles"
                : "Consultez vos informations (lecture seule)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {user?.firstName?.charAt(0) || ""}{user?.lastName?.charAt(0) || ""}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold">{user?.firstName} {user?.lastName}</h3>
                <p className="text-muted-foreground">{user?.email}</p>
                <Badge className="mt-1">{roleLabels[user?.role || "processing_agent"]}</Badge>
              </div>
            </div>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nom complet</Label>
                {isAdmin ? (
                  <Input id="name" defaultValue={`${user?.firstName} ${user?.lastName}`} />
                ) : (
                  <div className="p-2 bg-muted/20 rounded-md text-sm">
                    {user?.firstName} {user?.lastName}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                {isAdmin ? (
                  <Input id="email" type="email" defaultValue={user?.email} />
                ) : (
                  <div className="p-2 bg-muted/20 rounded-md text-sm">
                    {user?.email}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Entreprise</Label>
                {isAdmin ? (
                  <Input id="company" defaultValue={user?.company} />
                ) : (
                  <div className="p-2 bg-muted/20 rounded-md text-sm">
                    {user?.company || "-"}
                  </div>
                )}
              </div>
            </div>
            {isAdmin && <Button>{t("common.save")}</Button>}
          </CardContent>
        </Card>

        {/* Quick Settings */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                <CardTitle>Apparence</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{t("settings.theme")}</Label>
                <ThemeToggle />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label>{t("settings.language")}</Label>
                <LanguageSwitch />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle>{t("settings.notifications")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Notifications email</p>
                  <p className="text-sm text-muted-foreground">Recevoir les alertes par email</p>
                </div>
                <Switch defaultChecked disabled={!isAdmin} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Nouvelles tâches</p>
                  <p className="text-sm text-muted-foreground">Alertes pour les nouvelles assignations</p>
                </div>
                <Switch defaultChecked disabled={!isAdmin} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Rappels</p>
                  <p className="text-sm text-muted-foreground">Rappels pour les tâches en retard</p>
                </div>
                <Switch defaultChecked disabled={!isAdmin} />
              </div>
              {!isAdmin && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Les préférences de notification sont en lecture seule pour les non-administrateurs.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Security Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>{t("settings.security")}</CardTitle>
          </div>
          <CardDescription>
            {isAdmin 
              ? "Gérez la sécurité de votre compte"
              : "Consultez les options de sécurité (lecture seule)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="current-password">Mot de passe actuel</Label>
              {isAdmin ? (
                <Input id="current-password" type="password" />
              ) : (
                <div className="p-2 bg-muted/20 rounded-md text-sm text-muted-foreground">
                  ••••••••
                </div>
              )}
            </div>
            <div />
            <div className="space-y-2">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              {isAdmin ? (
                <Input id="new-password" type="password" />
              ) : (
                <div className="p-2 bg-muted/20 rounded-md text-sm text-muted-foreground">
                  Non modifiable
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
              {isAdmin ? (
                <Input id="confirm-password" type="password" />
              ) : (
                <div className="p-2 bg-muted/20 rounded-md text-sm text-muted-foreground">
                  Non modifiable
                </div>
              )}
            </div>
          </div>
          {isAdmin && <Button className="mt-4">{t("settings.changePassword")}</Button>}
          {!isAdmin && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Seul un administrateur peut modifier le mot de passe.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}