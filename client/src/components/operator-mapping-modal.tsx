import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertCircle, UserPlus, Link2 } from "lucide-react";
import type { Operator } from "@shared/schema";

export interface OperatorResolution {
  excelName: string;
  action: "exact" | "create" | "associate";
  officialName: string;
}

interface OperatorMappingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excelOperators: string[];
  officialOperators: Operator[];
  onConfirm: (resolutions: OperatorResolution[]) => void;
}

type UnmatchedAction = "create" | "associate";

interface UnmatchedState {
  action: UnmatchedAction | null;
  associateTo: string;
}

export function OperatorMappingModal({
  open,
  onOpenChange,
  excelOperators,
  officialOperators,
  onConfirm,
}: OperatorMappingModalProps) {
  const officialNames = useMemo(
    () => new Set(officialOperators.map((o) => o.name)),
    [officialOperators]
  );

  const exactMatches = useMemo(
    () => excelOperators.filter((op) => officialNames.has(op)),
    [excelOperators, officialNames]
  );

  const unmatched = useMemo(
    () => excelOperators.filter((op) => !officialNames.has(op)),
    [excelOperators, officialNames]
  );

  const [unmatchedStates, setUnmatchedStates] = useState<Record<string, UnmatchedState>>(() => {
    const initial: Record<string, UnmatchedState> = {};
    unmatched.forEach((op) => {
      initial[op] = { action: null, associateTo: "" };
    });
    return initial;
  });

  useEffect(() => {
    if (open) {
      const initial: Record<string, UnmatchedState> = {};
      unmatched.forEach((op) => {
        initial[op] = { action: null, associateTo: "" };
      });
      setUnmatchedStates(initial);
    }
  }, [open]);

  const allResolved = useMemo(() => {
    return unmatched.every((op) => {
      const state = unmatchedStates[op];
      if (!state) return false;
      if (state.action === "create") return true;
      if (state.action === "associate") return state.associateTo.trim() !== "";
      return false;
    });
  }, [unmatched, unmatchedStates]);

  const handleActionChange = (excelName: string, action: UnmatchedAction) => {
    setUnmatchedStates((prev) => ({
      ...prev,
      [excelName]: { action, associateTo: "" },
    }));
  };

  const handleAssociateChange = (excelName: string, officialName: string) => {
    setUnmatchedStates((prev) => ({
      ...prev,
      [excelName]: { ...prev[excelName], associateTo: officialName },
    }));
  };

  const handleConfirm = () => {
    const resolutions: OperatorResolution[] = [];

    exactMatches.forEach((op) => {
      resolutions.push({ excelName: op, action: "exact", officialName: op });
    });

    unmatched.forEach((op) => {
      const state = unmatchedStates[op];
      if (state.action === "create") {
        resolutions.push({ excelName: op, action: "create", officialName: op });
      } else if (state.action === "associate" && state.associateTo) {
        resolutions.push({ excelName: op, action: "associate", officialName: state.associateTo });
      }
    });

    onConfirm(resolutions);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Associazione Operatori
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground shrink-0 pb-3">
          {unmatched.length > 0 ? (
            <p>
              Trovati <strong>{unmatched.length}</strong> operatori senza corrispondenza nella lista ufficiale.
              Scegli se crearli come nuovi operatori o associarli a uno esistente.
            </p>
          ) : (
            <p>Tutti gli operatori del file corrispondono alla lista ufficiale.</p>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0 border rounded-lg px-1">
          <div className="divide-y">
            {unmatched.length > 0 && (
              <div className="py-2 px-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Senza corrispondenza ({unmatched.length})
                </p>
                <div className="space-y-3">
                  {unmatched.map((op) => {
                    const state = unmatchedStates[op] || { action: null, associateTo: "" };
                    const isResolved =
                      state.action === "create" ||
                      (state.action === "associate" && state.associateTo !== "");
                    return (
                      <div
                        key={op}
                        className="flex flex-col gap-2 rounded-md border p-3 bg-amber-50 dark:bg-amber-950/20"
                        data-testid={`operator-mapping-row-${op}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {isResolved ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                            )}
                            <span className="font-medium text-sm truncate">{op}</span>
                          </div>
                          <Badge variant="outline" className="text-amber-600 border-amber-400 shrink-0 text-xs">
                            Non trovato
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            variant={state.action === "create" ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleActionChange(op, "create")}
                            data-testid={`button-create-operator-${op}`}
                          >
                            <UserPlus className="mr-1 h-3 w-3" />
                            Crea nuovo
                          </Button>
                          <Button
                            variant={state.action === "associate" ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleActionChange(op, "associate")}
                            data-testid={`button-associate-operator-${op}`}
                          >
                            <Link2 className="mr-1 h-3 w-3" />
                            Associa a esistente
                          </Button>
                          {state.action === "associate" && (
                            <Select
                              value={state.associateTo}
                              onValueChange={(val) => handleAssociateChange(op, val)}
                            >
                              <SelectTrigger
                                className="h-7 text-xs w-48"
                                data-testid={`select-associate-${op}`}
                              >
                                <SelectValue placeholder="Seleziona operatore..." />
                              </SelectTrigger>
                              <SelectContent>
                                {officialOperators.map((official) => (
                                  <SelectItem key={official.id} value={official.name}>
                                    {official.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {exactMatches.length > 0 && (
              <div className="py-2 px-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Corrispondenza esatta ({exactMatches.length})
                </p>
                <div className="space-y-1">
                  {exactMatches.map((op) => (
                    <div
                      key={op}
                      className="flex items-center gap-2 py-1.5 px-2 rounded"
                      data-testid={`operator-matched-${op}`}
                    >
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <span className="text-sm text-muted-foreground">{op}</span>
                      <Badge variant="outline" className="text-green-600 border-green-400 text-xs ml-auto">
                        Trovato
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="text-xs text-muted-foreground shrink-0 pt-2">
          {unmatched.length > 0 && (
            <span>
              Risolti: <strong>{unmatched.filter((op) => {
                const s = unmatchedStates[op];
                return s?.action === "create" || (s?.action === "associate" && s.associateTo !== "");
              }).length}</strong> / <strong>{unmatched.length}</strong>
            </span>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 pt-2">
          <Button variant="outline" onClick={handleCancel} data-testid="button-cancel-operator-mapping">
            Annulla
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!allResolved}
            data-testid="button-confirm-operator-mapping"
          >
            Conferma e Importa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
