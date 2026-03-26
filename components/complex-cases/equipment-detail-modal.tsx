"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, MessageSquare, Edit, History, MapPin, Zap } from "lucide-react";
import { Equipment } from "./equipment-table";

interface EquipmentDetailModalProps {
  equipment: Equipment | null;
  isOpen: boolean;
  onClose: () => void;
  onMarkProcessed: (equipment: Equipment, comment: string) => void;
  onAddComment: (equipment: Equipment, comment: string) => void;
}

export function EquipmentDetailModal({
  equipment,
  isOpen,
  onClose,
  onMarkProcessed,
  onAddComment,
}: EquipmentDetailModalProps) {
  const [comment, setComment] = useState("");
  const [activeTab, setActiveTab] = useState("details");

  if (!equipment) return null;

  const handleMarkProcessed = () => {
    onMarkProcessed(equipment, comment);
    setComment("");
    onClose();
  };

  const handleAddComment = () => {
    if (comment.trim()) {
      onAddComment(equipment, comment);
      setComment("");
    }
  };

  // Mock history data
  const historyItems = [
    { date: "2024-01-15 14:30", action: "Cree", user: "Systeme" },
    { date: "2024-01-16 09:15", action: "Assigne a Jean Dupont", user: "Admin" },
    { date: "2024-01-17 11:45", action: "Commentaire ajoute", user: "Jean Dupont" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">{equipment.code}</DialogTitle>
              <DialogDescription>{equipment.type}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
            <TabsTrigger value="action">Action</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-muted-foreground">Code</Label>
                <p className="font-medium">{equipment.code}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">Type</Label>
                <p className="font-medium">{equipment.type}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">Localisation</Label>
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{equipment.location}</p>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">Statut</Label>
                <Badge variant={equipment.status === "completed" ? "default" : "outline"}>
                  {equipment.status === "pending" && "En attente"}
                  {equipment.status === "in_progress" && "En cours"}
                  {equipment.status === "completed" && "Complete"}
                  {equipment.status === "validated" && "Valide"}
                  {equipment.status === "rejected" && "Rejete"}
                </Badge>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">Assigne a</Label>
                <p className="font-medium">{equipment.assignedTo || "Non assigne"}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">Derniere mise a jour</Label>
                <p className="font-medium">{equipment.lastUpdate}</p>
              </div>
            </div>

            {/* Mock additional data */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">Donnees techniques</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Puissance:</span>
                  <span className="ml-2 font-medium">250 kVA</span>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Tension:</span>
                  <span className="ml-2 font-medium">30/0.4 kV</span>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Annee installation:</span>
                  <span className="ml-2 font-medium">2018</span>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">Etat:</span>
                  <span className="ml-2 font-medium">Fonctionnel</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <div className="space-y-3">
              {historyItems.map((item, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <History className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{item.action}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.user} - {item.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="action" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="comment">Commentaire</Label>
              <Textarea
                id="comment"
                placeholder="Ajoutez un commentaire ou une observation..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleMarkProcessed} className="gap-2">
                <CheckCircle className="h-4 w-4" />
                Marquer comme traite
              </Button>
              <Button variant="outline" onClick={handleAddComment} className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Ajouter commentaire
              </Button>
              <Button variant="outline" className="gap-2">
                <Edit className="h-4 w-4" />
                Modifier les donnees
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}