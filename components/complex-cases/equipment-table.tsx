"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, MoreHorizontal, CheckCircle, MessageSquare, Edit, Loader2 } from "lucide-react";

export interface Equipment {
  id: string;
  code: string;
  type: string;
  location: string;
  status: "pending" | "in_progress" | "completed" | "validated" | "rejected";
  lastUpdate: string;
  assignedTo?: string;
}

interface EquipmentTableProps {
  equipments: Equipment[];
  isLoading?: boolean;
  onView: (equipment: Equipment) => void;
  onMarkProcessed: (equipment: Equipment) => void;
  onAddComment: (equipment: Equipment) => void;
  onModify: (equipment: Equipment) => void;
  onBulkAction?: (equipmentIds: string[], action: string) => void;
}

const statusConfig: Record<Equipment["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "outline" },
  in_progress: { label: "En cours", variant: "secondary" },
  completed: { label: "Complete", variant: "default" },
  validated: { label: "Valide", variant: "default" },
  rejected: { label: "Rejete", variant: "destructive" },
};

export function EquipmentTable({
  equipments,
  isLoading,
  onView,
  onMarkProcessed,
  onAddComment,
  onModify,
  onBulkAction,
}: EquipmentTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === equipments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(equipments.map((e) => e.id));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (equipments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Aucun equipement trouve
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <span className="text-sm font-medium">{selectedIds.length} selectionne(s)</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onBulkAction?.(selectedIds, "mark_processed")}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Marquer traites
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedIds([])}
          >
            Deselectionner
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.length === equipments.length && equipments.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Localisation</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Assigne a</TableHead>
              <TableHead>Derniere MAJ</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipments.map((equipment) => {
              const statusInfo = statusConfig[equipment.status];
              return (
                <TableRow key={equipment.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(equipment.id)}
                      onCheckedChange={() => toggleSelect(equipment.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{equipment.code}</TableCell>
                  <TableCell>{equipment.type}</TableCell>
                  <TableCell className="text-muted-foreground">{equipment.location}</TableCell>
                  <TableCell>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </TableCell>
                  <TableCell>{equipment.assignedTo || "-"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{equipment.lastUpdate}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(equipment)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Voir details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onMarkProcessed(equipment)}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Marquer traite
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onAddComment(equipment)}>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Ajouter commentaire
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onModify(equipment)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}