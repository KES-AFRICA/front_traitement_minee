"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth/context";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilterBar } from "@/components/processing/filter-bar";
import { taskService } from "@/lib/api/services/tasks";
import { Task, TaskStatus, TaskPriority } from "@/lib/api/types";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import {
  CheckSquare,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpCircle,
  ArrowRightCircle,
  ArrowDownCircle,
} from "lucide-react";

const priorityIcons: Record<TaskPriority, React.ReactNode> = {
  high: <ArrowUpCircle className="h-4 w-4 text-destructive" />,
  medium: <ArrowRightCircle className="h-4 w-4 text-warning-foreground" />,
  low: <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />,
};

export default function ValidationPage() {
  const { user } = useAuth();
  const { t, language } = useI18n();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [actionTask, setActionTask] = useState<Task | null>(null);
  const [actionType, setActionType] = useState<"validate" | "reject" | null>(null);
  const [comment, setComment] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const [priority, setPriority] = useState<TaskPriority | "all">("all");

  useEffect(() => {
    const fetchTasks = async () => {
      setIsLoading(true);
      try {
        const response = await taskService.getPendingValidation();
        if (response.data) {
          setTasks(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch tasks:", error);
        toast.error(t("errors.networkError"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchTasks();
  }, [t]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (search && !task.title.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (priority !== "all" && task.priority !== priority) {
        return false;
      }
      return true;
    });
  }, [tasks, search, priority]);

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd MMM yyyy HH:mm", {
      locale: language === "fr" ? fr : enUS,
    });
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const handleOpenAction = (task: Task, type: "validate" | "reject") => {
    setActionTask(task);
    setActionType(type);
    setComment("");
  };

  const handleAction = async () => {
    if (!actionTask || !actionType || !user) return;

    setIsProcessing(true);
    try {
      if (actionType === "validate") {
        await taskService.validateTask(actionTask.id, user.id, comment);
      } else {
        await taskService.rejectTask(actionTask.id, user.id, comment);
      }

      setTasks((prev) => prev.filter((t) => t.id !== actionTask.id));
      toast.success(
        actionType === "validate" ? t("notifications.taskValidated") : t("notifications.taskRejected")
      );
      setActionTask(null);
      setActionType(null);
    } catch {
      toast.error(t("errors.networkError"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectTask = (taskId: string, selected: boolean) => {
    setSelectedTasks((prev) =>
      selected ? [...prev, taskId] : prev.filter((id) => id !== taskId)
    );
  };

  const handleSelectAll = (selected: boolean) => {
    setSelectedTasks(selected ? filteredTasks.map((t) => t.id) : []);
  };

  const handleBulkValidate = async () => {
    if (!user || selectedTasks.length === 0) return;

    setIsProcessing(true);
    try {
      await Promise.all(
        selectedTasks.map((id) => taskService.validateTask(id, user.id))
      );
      setTasks((prev) => prev.filter((t) => !selectedTasks.includes(t.id)));
      setSelectedTasks([]);
      toast.success(`${selectedTasks.length} tâches validées`);
    } catch {
      toast.error(t("errors.networkError"));
    } finally {
      setIsProcessing(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setPriority("all");
  };

  const stats = {
    total: tasks.length,
    highPriority: tasks.filter((t) => t.priority === "high").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CheckSquare className="h-6 w-6 text-primary" />
          {t("validation.title")}
        </h1>
        <p className="text-muted-foreground">
          {stats.total} {t("validation.tasksToValidate").toLowerCase()}
          {stats.highPriority > 0 && (
            <span className="text-destructive ml-2">
              ({stats.highPriority} haute priorité)
            </span>
          )}
        </p>
      </div>

      {/* Bulk Actions */}
      {selectedTasks.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <span className="text-sm">
              {selectedTasks.length} tâche(s) sélectionnée(s)
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleBulkValidate}
                disabled={isProcessing}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                {t("validation.bulkValidate")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedTasks([])}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        priority={priority}
        onPriorityChange={setPriority}
        onClear={clearFilters}
      />

      {/* Tasks List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          [...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        ) : filteredTasks.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success/50" />
            <p>{t("common.noData")}</p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <Card key={task.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedTasks.includes(task.id)}
                      onCheckedChange={(checked) =>
                        handleSelectTask(task.id, checked === true)
                      }
                    />
                    {priorityIcons[task.priority]}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {task.type.replace("_", " ")}
                  </Badge>
                </div>
                <CardTitle className="text-base line-clamp-1">{task.title}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {task.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Assigned Agent */}
                {task.assignedToUser && (
                  <div className="flex items-center gap-2 text-sm">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {getInitials(
                          task.assignedToUser.firstName,
                          task.assignedToUser.lastName
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground">
                      {task.assignedToUser.firstName} {task.assignedToUser.lastName}
                    </span>
                  </div>
                )}

                {/* Completed Date */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Terminé le {formatDate(task.completedAt || task.updatedAt)}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleOpenAction(task, "validate")}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {t("validation.validate")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    onClick={() => handleOpenAction(task, "reject")}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    {t("validation.reject")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Action Dialog */}
      <Dialog
        open={!!actionTask && !!actionType}
        onOpenChange={() => {
          setActionTask(null);
          setActionType(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === "validate" ? (
                <CheckCircle className="h-5 w-5 text-success" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              {actionType === "validate"
                ? t("validation.validate")
                : t("validation.reject")}{" "}
              la tâche
            </DialogTitle>
            <DialogDescription>
              {actionTask?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("validation.validationComment")}
                {actionType === "reject" && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </label>
              <Textarea
                placeholder={t("validation.addComment")}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionTask(null);
                setActionType(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant={actionType === "validate" ? "default" : "destructive"}
              onClick={handleAction}
              disabled={isProcessing || (actionType === "reject" && !comment)}
            >
              {t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
