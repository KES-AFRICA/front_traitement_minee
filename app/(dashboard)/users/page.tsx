"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { userService } from "@/lib/api/services/users";
import { User, UserRole } from "@/lib/api/types";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import {
  Users,
  UserPlus,
  MoreHorizontal,
  Edit,
  Trash2,
  Power,
  Search,
  Building2,
  UserCheck,
} from "lucide-react";

type Company = "ENEO" | "GROUPEMENT" | "ARSEL" | "MINEE";

const COMPANIES: Company[] = ["ENEO", "GROUPEMENT", "ARSEL", "MINEE"];

const roleLabels: Record<string, string> = {
  "Admin": "Administrateur",
  "Chef équipe": "Chef d'équipe",
  "Agent validation": "Agent de validation",
  "Agent traitement": "Agent de traitement",
};

const roleBadgeVariants: Record<UserRole, "default" | "secondary" | "destructive" | "outline"> = {
  "Admin": "destructive",
  "Chef équipe": "default",
  "Agent validation": "secondary",
  "Agent traitement": "outline",
};

const companyBadgeVariants: Record<Company, "default" | "secondary"> = {
  ENEO: "secondary",
  GROUPEMENT: "secondary",
  ARSEL: "secondary",
  MINEE: "secondary"
};

export default function UsersPage() {
  const { t, language } = useI18n();
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    company: "" as Company | "",
    role: "Agent traitement" as UserRole,
  });

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const response = await userService.getUsers({}, { pageSize: 100 });
        if (response.data) {
          setUsers(response.data.data);
        }
      } catch (error) {
        console.error("Failed to fetch users:", error);
        toast.error(t("errors.networkError"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [t]);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !search ||
      user.firstName.toLowerCase().includes(search.toLowerCase()) ||
      user.lastName.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === "all" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd MMM yyyy HH:mm", {
        locale: language === "fr" ? fr : enUS,
      });
    } catch {
      return "-";
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const resetForm = () => {
    setFormData({
      email: "",
      firstName: "",
      lastName: "",
      password: "",
      company: "",
      role: "Agent traitement",
    });
  };

  const handleCreate = async () => {
    if (!formData.email || !formData.firstName || !formData.lastName || !formData.company || !formData.role || !formData.password) {
      toast.error("Tous les champs sont obligatoires");
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("Veuillez saisir une adresse email valide");
      return;
    }

    setIsProcessing(true);
    try {
      const response = await userService.createUser(formData);
      if (response.data) {
        setUsers((prev) => [...prev, response.data!]);
        toast.success(t("common.success"));
        setIsCreateOpen(false);
        resetForm();
      } else {
        toast.error(response.error || t("errors.serverError"));
      }
    } catch {
      toast.error(t("errors.networkError"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = async () => {
    if (!editUser) return;

    const updates: Partial<User> = {};
    
    if (formData.email !== editUser.email) updates.email = formData.email;
    if (formData.firstName !== editUser.firstName) updates.firstName = formData.firstName;
    if (formData.lastName !== editUser.lastName) updates.lastName = formData.lastName;
    if (formData.company !== (editUser.company as Company)) updates.company = formData.company;
    if (formData.role !== editUser.role) updates.role = formData.role;

    if (Object.keys(updates).length === 0) {
      toast.info("Aucune modification détectée");
      setEditUser(null);
      resetForm();
      return;
    }

    setIsProcessing(true);
    try {
      const response = await userService.updateUser(editUser.id, updates);
      if (response.data) {
        setUsers((prev) =>
          prev.map((u) => (u.id === editUser.id ? response.data! : u))
        );
        toast.success("Utilisateur modifié avec succès");
        setEditUser(null);
        resetForm();
      } else {
        toast.error(response.error || t("errors.serverError"));
      }
    } catch (error: any) {
      toast.error(error.message || t("errors.networkError"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;

    setIsProcessing(true);
    try {
      const response = await userService.deleteUser(deleteUser.id);
      if (response.data !== undefined) {
        setUsers((prev) => prev.filter((u) => u.id !== deleteUser.id));
        toast.success("Utilisateur supprimé avec succès");
        setDeleteUser(null);
      } else {
        toast.error(response.error || "Erreur lors de la suppression");
      }
    } catch (error: any) {
      toast.error(error.message || t("errors.networkError"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    setIsProcessing(true);
    try {
      const response = await userService.toggleUserStatus(user.id, user.isActive);
      if (response.data) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? response.data! : u))
        );
        toast.success(response.data.isActive ? "Utilisateur activé" : "Utilisateur désactivé");
      } else {
        toast.error(response.error || "Erreur lors du changement de statut");
      }
    } catch (error: any) {
      toast.error(error.message || t("errors.networkError"));
    } finally {
      setIsProcessing(false);
    }
  };

  const openEditSheet = (user: User) => {
    setFormData({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      password: "",
      company: (user.company as Company) || "",
      role: user.role,
    });
    setEditUser(user);
  };

  const stats = {
    total: users.length,
    active: users.filter((u) => u.isActive).length,
    avgOccupancy: Math.round(
      users.reduce((acc, u) => acc + u.occupancyRate, 0) / Math.max(users.length, 1)
    ),
  };

  const companyStats = COMPANIES.map((company) => {
    const companyUsers = users.filter((u) => u.company === company);
    const activeCount = companyUsers.filter((u) => u.isActive).length;
    const totalCount = companyUsers.length;
    const activePercent = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0;
    const totalUser = stats.total;
    return { company, totalCount, activeCount, activePercent, totalUser };
  });

  const canManageUsers = hasPermission("manage:users");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            {t("users.title")}
          </h1>
          <p className="text-muted-foreground">
            {stats.total} utilisateurs, {stats.active} actifs
          </p>
        </div>

        {canManageUsers && (
          <Button
            onClick={() => {
              resetForm();
              setIsCreateOpen(true);
            }}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            {t("users.addUser")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {companyStats.map(({ company, totalCount, activeCount, activePercent, totalUser }) => (
          <Card key={company}>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                {company}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold">{totalCount}</p>
                  <p className="text-xs text-muted-foreground">
                    utilisateurs sur {totalUser}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <UserCheck className="h-4 w-4 text-green-500" />
                    <p className="text-xl font-semibold text-green-600">{activeCount}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">actifs</p>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Taux d'activité</span>
                  <span className="font-medium text-foreground">{activePercent}%</span>
                </div>
                <Progress value={activePercent} className="h-2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("common.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(value: string) => setRoleFilter(value as UserRole | "all")}
        >
          <SelectTrigger className="w-45">
            <SelectValue placeholder={t("common.role")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            {Object.entries(roleLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead className="text-center">{t("common.role")}</TableHead>
                <TableHead className="text-center">Entreprise</TableHead>
                <TableHead className="text-center">Dernière connexion</TableHead>
                <TableHead className="text-center">{t("common.status")}</TableHead>
                {canManageUsers && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    {canManageUsers && <TableCell><Skeleton className="h-8 w-8" /></TableCell>}
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManageUsers ? 6 : 5} className="h-24 text-center text-muted-foreground">
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(user.firstName, user.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={roleBadgeVariants[user.role]}>
                        {roleLabels[user.role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {user.company ? (
                        <Badge variant={companyBadgeVariants[user.company as Company]}>
                          {user.company}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {formatDate(user.lastLogin)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={user.isActive ? "default" : "secondary"}>
                        {user.isActive ? t("users.active") : t("users.inactive")}
                      </Badge>
                    </TableCell>
                    {canManageUsers && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t("common.actions")}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEditSheet(user)}>
                              <Edit className="mr-2 h-4 w-4" />
                              {t("common.edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                              <Power className="mr-2 h-4 w-4" />
                              {user.isActive ? "Désactiver" : "Activer"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {/* <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteUser(user)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t("common.delete")}
                            </DropdownMenuItem> */}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Create Sheet  */}
      <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <SheetContent
          side="right"
          className="w-screen! sm:w-120! max-w-none! sm:max-w-120! flex flex-col p-0 overflow-hidden"
        >
          <SheetHeader className="px-5 py-4 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4 text-primary shrink-0" />
              {t("users.addUser")}
            </SheetTitle>
            <SheetDescription className="text-sm">
              Créer un nouveau compte utilisateur
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <UserForm formData={formData} setFormData={setFormData} t={t} isEditMode={false} />
          </div>

          <SheetFooter className="px-5 py-4 border-t shrink-0 flex flex-row gap-3 sm:gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsCreateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button className="flex-1" onClick={handleCreate} disabled={isProcessing}>
              {isProcessing ? "Création..." : t("common.create")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit Sheet  */}
      <Sheet open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <SheetContent
          side="right"
          className="w-screen! sm:w-120! max-w-none! sm:max-w-120! flex flex-col p-0 overflow-hidden"
        >
          <SheetHeader className="px-5 py-4 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Edit className="h-4 w-4 text-primary shrink-0" />
              {t("users.editUser")}
            </SheetTitle>
            <SheetDescription className="text-sm">
              Modifier les informations de l&apos;utilisateur
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <UserForm formData={formData} setFormData={setFormData} t={t} isEditMode={true} />
          </div>

          <SheetFooter className="px-5 py-4 border-t shrink-0 flex flex-row gap-3 sm:gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditUser(null)}>
              {t("common.cancel")}
            </Button>
            <Button className="flex-1" onClick={handleEdit} disabled={isProcessing}>
              {isProcessing ? "Enregistrement..." : t("common.save")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation  */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer l&apos;utilisateur{" "}
              <span className="font-semibold">
                {deleteUser?.firstName} {deleteUser?.lastName}
              </span> ?
              <br />
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto mt-0">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isProcessing}
            >
              {isProcessing ? "Suppression..." : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type TFunction = ReturnType<typeof useI18n>["t"];

interface UserFormProps {
  formData: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    company: Company | "";
    role: UserRole;
  };
  setFormData: React.Dispatch<React.SetStateAction<UserFormProps["formData"]>>;
  t: TFunction;
  isEditMode?: boolean;
}

function UserForm({ formData, setFormData, t, isEditMode = false }: UserFormProps) {
  return (
    <div className="px-5 py-5 space-y-5">
      <div className="space-y-1.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">{t("users.firstName")}</Label>
            <Input
              id="firstName"
              required
              autoComplete="given-name"
              value={formData.firstName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, firstName: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">{t("users.lastName")}</Label>
            <Input
              id="lastName"
              required
              autoComplete="family-name"
              value={formData.lastName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, lastName: e.target.value }))
              }
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("common.email")}</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
            />
          </div>
          {!isEditMode &&
          <div className="space-y-2">
            <Label htmlFor="password">
              Mot de passe  *
              
            </Label>
            <Input
              id="password"
              type="password"
              required={!isEditMode}
              placeholder={isEditMode ? "Laissez vide pour ne pas modifier" : ""}
              value={formData.password}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, password: e.target.value }))
              }
            />
          </div>
}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Entreprise</Label>
              <Select
                value={formData.company}
                onValueChange={(value: string) =>
                  setFormData((prev) => ({ ...prev, company: value as Company }))
                }
                required
              >
                <SelectTrigger id="company" className="w-full">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANIES.map((company) => (
                    <SelectItem key={company} value={company}>
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">{t("common.role")}</Label>
              <Select
                value={formData.role}
                onValueChange={(value: string) =>
                  setFormData((prev) => ({ ...prev, role: value as UserRole }))
                }
                required
              >
                <SelectTrigger id="role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}