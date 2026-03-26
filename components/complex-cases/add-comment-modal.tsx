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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Equipment } from "./equipment-table";

interface AddCommentModalProps {
  equipment: Equipment | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (equipment: Equipment, comment: string, type: string) => void;
}

export function AddCommentModal({ equipment, isOpen, onClose, onSubmit }: AddCommentModalProps) {
  const [comment, setComment] = useState("");
  const [commentType, setCommentType] = useState("observation");

  const handleSubmit = () => {
    if (equipment && comment.trim()) {
      onSubmit(equipment, comment, commentType);
      setComment("");
      setCommentType("observation");
      onClose();
    }
  };

  if (!equipment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un commentaire</DialogTitle>
          <DialogDescription>
            Equipement: {equipment.code}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="type">Type de commentaire</Label>
            <Select value={commentType} onValueChange={setCommentType}>
              <SelectTrigger>
                <SelectValue placeholder="Selectionnez un type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="observation">Observation</SelectItem>
                <SelectItem value="problem">Probleme identifie</SelectItem>
                <SelectItem value="action">Action requise</SelectItem>
                <SelectItem value="resolution">Resolution</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Commentaire</Label>
            <Textarea
              id="comment"
              placeholder="Saisissez votre commentaire..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!comment.trim()}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}