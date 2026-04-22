"use client"

import { useState } from "react"
import { useI18n } from "@/lib/i18n/context"
import { useAuth } from "@/lib/auth/context"
import { authService } from "@/lib/api/services/auth"
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
import { User, Bell, Shield, Palette, Loader2, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

const roleLabels: Record<string, string> = {
  "Admin":            "Administrateur",
  "Chef équipe":      "Chef d'équipe",
  "Agent validation": "Agent de validation",
  "Agent traitement": "Agent de traitement",
  "Coordonateur":    "Coordonateur",
}

// Composant InputPassword réutilisable
function PasswordInput({ 
  id, 
  label, 
  value, 
  onChange, 
  placeholder 
}: { 
  id: string
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
}) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useI18n()
  const { user } = useAuth()

  // ── État du formulaire profil ──────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName ?? "",
    lastName:  user?.lastName  ?? "",
    email:     user?.email     ?? "",
    company:   user?.company   ?? "",
  })
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // ── État du formulaire mot de passe ───────────────────────────────────────
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password:     "",
    confirm_password: "",
  })
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  // ── Sauvegarde profil ─────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    setIsSavingProfile(true)
    const response = await authService.updateMe({
      email:     profileForm.email,
      full_name: `${profileForm.firstName} ${profileForm.lastName}`.trim(),
      company:   profileForm.company,
    })
    setIsSavingProfile(false)

    if (response.data) {
      toast.success("Profil mis à jour avec succès")
    } else {
      toast.error(response.error ?? "Erreur lors de la mise à jour")
    }
  }

  // ── Changement de mot de passe ────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("Les mots de passe ne correspondent pas")
      return
    }
    if (passwordForm.new_password.length < 6) {
      toast.error("Le nouveau mot de passe doit contenir au moins 6 caractères")
      return
    }

    setIsSavingPassword(true)
    const response = await authService.changeMyPassword({
      current_password: passwordForm.current_password,
      new_password:     passwordForm.new_password,
    })
    setIsSavingPassword(false)

    if (response.data) {
      toast.success("Mot de passe modifié avec succès")
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" })
    } else {
      toast.error(response.error ?? "Erreur lors du changement de mot de passe")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">

        {/* ── Profil ── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Profil</CardTitle>
            </div>
            <CardDescription>Gérez vos informations personnelles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar + résumé */}
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold">{user?.firstName} {user?.lastName}</h3>
                <p className="text-muted-foreground">{user?.email}</p>
                <Badge className="mt-1">{roleLabels[user?.role ?? ""] ?? user?.role}</Badge>
              </div>
            </div>

            <Separator />

            {/* Champs */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input
                  id="firstName"
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm(p => ({ ...p, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm(p => ({ ...p, lastName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm(p => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Entreprise</Label>
                <Input
                  id="company"
                  value={profileForm.company}
                  onChange={(e) => setProfileForm(p => ({ ...p, company: e.target.value }))}
                />
              </div>
            </div>

            <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement…</>
                : t("common.save")}
            </Button>
          </CardContent>
        </Card>

        {/* ── Apparence + Notifications ── */}
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
              {[
                { label: "Notifications email",  desc: "Recevoir les alertes par email" },
                { label: "Nouvelles tâches",     desc: "Alertes pour les nouvelles assignations" },
                { label: "Rappels",              desc: "Rappels pour les tâches en retard" },
              ].map(({ label, desc }) => (
                <div key={label}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="text-sm text-muted-foreground">{desc}</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <Separator className="mt-4" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Sécurité ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>{t("settings.security")}</CardTitle>
          </div>
          <CardDescription>Changez votre mot de passe</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordInput
              id="current-password"
              label="Mot de passe actuel"
              value={passwordForm.current_password}
              onChange={(e) => setPasswordForm(p => ({ ...p, current_password: e.target.value }))}
              placeholder="Entrez votre mot de passe actuel"
            />
            <div /> {/* spacer */}
            <PasswordInput
              id="new-password"
              label="Nouveau mot de passe"
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm(p => ({ ...p, new_password: e.target.value }))}
              placeholder="Minimum 6 caractères"
            />
            <PasswordInput
              id="confirm-password"
              label="Confirmer le mot de passe"
              value={passwordForm.confirm_password}
              onChange={(e) => setPasswordForm(p => ({ ...p, confirm_password: e.target.value }))}
              placeholder="Répétez le nouveau mot de passe"
            />
          </div>

          <Button
            className="mt-4"
            onClick={handleChangePassword}
            disabled={
              isSavingPassword ||
              !passwordForm.current_password ||
              !passwordForm.new_password ||
              !passwordForm.confirm_password
            }
          >
            {isSavingPassword
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Modification…</>
              : t("settings.changePassword")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}