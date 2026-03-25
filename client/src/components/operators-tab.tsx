import { useState, useMemo, useEffect } from "react";
import { ChevronDown, ChevronRight, Palette, Search, FileText, Calendar, CreditCard, Banknote, Plus, Pencil, Trash2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Analysis, CompensoRecord, Operator, OperatorAlias } from "@shared/schema";

const OPERATOR_COLORS = [
  { name: "Blu Scuro", hex: "#1E3A5F" },
  { name: "Giallo", hex: "#F4D03F" },
  { name: "Verde Lime", hex: "#82E0AA" },
  { name: "Rosso", hex: "#E74C3C" },
  { name: "Arancione", hex: "#E67E22" },
  { name: "Argento", hex: "#BDC3C7" },
  { name: "Verde Menta", hex: "#48C9B0" },
  { name: "Verde Scuro", hex: "#1D8348" },
  { name: "Ciano", hex: "#5DADE2" },
  { name: "Rosa Salmone", hex: "#F5B7B1" },
  { name: "Viola", hex: "#8E44AD" },
  { name: "Rosa Chiaro", hex: "#FADBD8" },
  { name: "Fucsia", hex: "#C71585" },
  { name: "Bordeaux", hex: "#7B241C" },
  { name: "Bianco", hex: "#FFFFFF" },
  { name: "Nero", hex: "#1C1C1C" },
  { name: "Blu Elettrico", hex: "#2E86AB" },
  { name: "Teal", hex: "#008080" },
];

interface OperatorsTabProps {
  analyses: Analysis[];
  operatorColors: Record<string, string>;
  onUpdateOperatorColors: (colors: Record<string, string>) => void;
  managedOperators: Operator[];
  onRefreshOperators: () => void;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  let year = parseInt(parts[2], 10);
  
  if (year < 100) {
    year = year > 50 ? 1900 + year : 2000 + year;
  }
  
  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return null;
  return date;
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

interface OperatorStats {
  operatore: string;
  totalAnalyses: number;
  totalCompensation: number;
  totalCompensationA: number;
  totalCompensationB: number;
  totalStudioEarnings: number;
  totalStudioEarningsA: number;
  totalStudioEarningsB: number;
  totalPrestazioni: number;
  totalGiornate: number;
  monthsCount: number;
  allRecords: (CompensoRecord & { analysisName: string; analysisId: string })[];
  monthLabels: string[];
}

export function OperatorsTab({ analyses, operatorColors, onUpdateOperatorColors, managedOperators, onRefreshOperators }: OperatorsTabProps) {
  const [expandedOperators, setExpandedOperators] = useState<Set<string>>(new Set());
  const [selectedOperator, setSelectedOperator] = useState<OperatorStats | null>(null);
  const [detailsSearch, setDetailsSearch] = useState("");
  const [periodRange, setPeriodRange] = useState<[number, number]>([0, 100]);
  const [colorEditOperator, setColorEditOperator] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newOperatorName, setNewOperatorName] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editOperator, setEditOperator] = useState<Operator | null>(null);
  const [editOperatorName, setEditOperatorName] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteOperator, setDeleteOperator] = useState<Operator | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsOperator, setSettingsOperator] = useState<Operator | null>(null);
  const [settingsAttivo, setSettingsAttivo] = useState(false);
  const [settingsMinimoA, setSettingsMinimoA] = useState<number | "">("");
  const [settingsMinimoB, setSettingsMinimoB] = useState<number | "">("");
  const [settingsFissoA, setSettingsFissoA] = useState<number | "">("");
  const [settingsFissoB, setSettingsFissoB] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const { data: operatorAliases = [] } = useQuery<OperatorAlias[]>({
    queryKey: ["/api/operator-aliases"],
  });

  const handleDeleteAlias = async (aliasId: string) => {
    try {
      await apiRequest("DELETE", `/api/operator-aliases/${aliasId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/operator-aliases"] });
      toast({ title: "Alias eliminato" });
    } catch {
      toast({ title: "Errore", description: "Impossibile eliminare l'alias", variant: "destructive" });
    }
  };

  const operatorStats = useMemo(() => {
    const statsMap = new Map<string, OperatorStats>();
    const allMonthsSet = new Set<string>();
    
    analyses.forEach((analysis) => {
      analysis.records.forEach((record) => {
        if (record.data) {
          const date = parseDate(record.data);
          if (date) {
            allMonthsSet.add(getMonthKey(date));
          }
        }
        
        const existing = statsMap.get(record.operatore);
        const analysisIds = new Set<string>();
        
        if (existing) {
          existing.allRecords.push({
            ...record,
            analysisName: analysis.name,
            analysisId: analysis.id,
          });
          existing.totalCompensation += record.compensoOperatore;
          existing.totalCompensationA += record.categoriaCompenso === "card" ? record.compensoOperatore : 0;
          existing.totalCompensationB += record.categoriaCompenso === "cash" ? record.compensoOperatore : 0;
          existing.totalStudioEarnings += record.prezzoAlPaziente;
          existing.totalStudioEarningsA += record.categoriaCompenso === "card" ? record.prezzoAlPaziente : 0;
          existing.totalStudioEarningsB += record.categoriaCompenso === "cash" ? record.prezzoAlPaziente : 0;
          existing.totalPrestazioni += 1;
        } else {
          analysisIds.add(analysis.id);
          statsMap.set(record.operatore, {
            operatore: record.operatore,
            totalAnalyses: 0,
            totalCompensation: record.compensoOperatore,
            totalCompensationA: record.categoriaCompenso === "card" ? record.compensoOperatore : 0,
            totalCompensationB: record.categoriaCompenso === "cash" ? record.compensoOperatore : 0,
            totalStudioEarnings: record.prezzoAlPaziente,
            totalStudioEarningsA: record.categoriaCompenso === "card" ? record.prezzoAlPaziente : 0,
            totalStudioEarningsB: record.categoriaCompenso === "cash" ? record.prezzoAlPaziente : 0,
            totalPrestazioni: 1,
            totalGiornate: 0,
            monthsCount: 0,
            allRecords: [{
              ...record,
              analysisName: analysis.name,
              analysisId: analysis.id,
            }],
            monthLabels: [],
          });
        }
      });
    });
    
    const allMonths = Array.from(allMonthsSet).sort();
    
    statsMap.forEach((stats) => {
      const analysisIds = new Set(stats.allRecords.map((r) => r.analysisId));
      stats.totalAnalyses = analysisIds.size;
      
      const monthsForOperator = new Set<string>();
      const datesWorked = new Set<string>();
      
      stats.allRecords.forEach((record) => {
        if (record.data) {
          const date = parseDate(record.data);
          if (date) {
            monthsForOperator.add(getMonthKey(date));
            datesWorked.add(record.data);
          }
        }
      });
      
      stats.totalGiornate = datesWorked.size;
      stats.monthsCount = monthsForOperator.size || 1;
      stats.monthLabels = allMonths;
    });
    
    managedOperators.forEach((op) => {
      if (!statsMap.has(op.name)) {
        statsMap.set(op.name, {
          operatore: op.name,
          totalAnalyses: 0,
          totalCompensation: 0,
          totalCompensationA: 0,
          totalCompensationB: 0,
          totalStudioEarnings: 0,
          totalStudioEarningsA: 0,
          totalStudioEarningsB: 0,
          totalPrestazioni: 0,
          totalGiornate: 0,
          monthsCount: 1,
          allRecords: [],
          monthLabels: [],
        });
      }
    });

    return Array.from(statsMap.values()).sort((a, b) => a.operatore.localeCompare(b.operatore));
  }, [analyses, managedOperators]);

  const allMonthLabels = useMemo(() => {
    const monthsSet = new Set<string>();
    analyses.forEach((analysis) => {
      analysis.records.forEach((record) => {
        if (record.data) {
          const date = parseDate(record.data);
          if (date) {
            monthsSet.add(getMonthKey(date));
          }
        }
      });
    });
    return Array.from(monthsSet).sort();
  }, [analyses]);

  useEffect(() => {
    if (selectedOperator) {
      setPeriodRange([0, 100]);
      setDetailsSearch("");
    }
  }, [selectedOperator]);

  const toggleExpanded = (operatore: string) => {
    setExpandedOperators((prev) => {
      const next = new Set(prev);
      if (next.has(operatore)) {
        next.delete(operatore);
      } else {
        next.add(operatore);
      }
      return next;
    });
  };

  const handleColorChange = (operatore: string, color: string) => {
    onUpdateOperatorColors({
      ...operatorColors,
      [operatore]: color,
    });
    setColorEditOperator(null);
  };

  const handleAddOperator = async () => {
    if (!newOperatorName.trim()) return;
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/operators", { name: newOperatorName.trim() });
      queryClient.invalidateQueries({ queryKey: ["/api/operators"] });
      onRefreshOperators();
      setNewOperatorName("");
      setAddDialogOpen(false);
      toast({ title: "Operatore aggiunto", description: `${newOperatorName.trim()} aggiunto con successo` });
    } catch (error: any) {
      const msg = error?.message?.includes("409") ? "Operatore già esistente" : "Errore nella creazione dell'operatore";
      toast({ title: "Errore", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditOperator = async () => {
    if (!editOperator || !editOperatorName.trim()) return;
    setIsSubmitting(true);
    try {
      await apiRequest("PATCH", `/api/operators/${editOperator.id}`, { name: editOperatorName.trim() });
      queryClient.invalidateQueries({ queryKey: ["/api/operators"] });
      onRefreshOperators();
      setEditDialogOpen(false);
      setEditOperator(null);
      toast({ title: "Operatore modificato", description: `Nome aggiornato a "${editOperatorName.trim()}"` });
    } catch (error: any) {
      const msg = error?.message?.includes("409") ? "Operatore già esistente con questo nome" : "Errore nell'aggiornamento dell'operatore";
      toast({ title: "Errore", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOperator = async () => {
    if (!deleteOperator) return;
    setIsSubmitting(true);
    try {
      await apiRequest("DELETE", `/api/operators/${deleteOperator.id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/operators"] });
      onRefreshOperators();
      setDeleteDialogOpen(false);
      setDeleteOperator(null);
      toast({ title: "Operatore eliminato", description: "Operatore rimosso con successo" });
    } catch {
      toast({ title: "Errore", description: "Errore nell'eliminazione dell'operatore", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openSettingsDialog = (operator: Operator) => {
    setSettingsOperator(operator);
    setSettingsAttivo(operator.pagamentoGiornataAttivo ?? false);
    setSettingsMinimoA(operator.pagamentoGiornataMinimoA ?? "");
    setSettingsMinimoB(operator.pagamentoGiornataMinimoB ?? "");
    setSettingsFissoA(operator.pagamentoGiornataFissoA ?? "");
    setSettingsFissoB(operator.pagamentoGiornataFissoB ?? "");
    setSettingsDialogOpen(true);
  };

  const handleSaveSettings = async () => {
    if (!settingsOperator) return;
    setIsSubmitting(true);
    try {
      await apiRequest("PATCH", `/api/operators/${settingsOperator.id}`, {
        pagamentoGiornataAttivo: settingsAttivo,
        pagamentoGiornataMinimoA: settingsMinimoA === "" ? null : Number(settingsMinimoA),
        pagamentoGiornataMinimoB: settingsMinimoB === "" ? null : Number(settingsMinimoB),
        pagamentoGiornataFissoA: settingsFissoA === "" ? null : Number(settingsFissoA),
        pagamentoGiornataFissoB: settingsFissoB === "" ? null : Number(settingsFissoB),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/operators"] });
      onRefreshOperators();
      setSettingsDialogOpen(false);
      toast({ title: "Impostazioni salvate", description: `Configurazione aggiornata per "${settingsOperator.name}"` });
    } catch {
      toast({ title: "Errore", description: "Errore nel salvataggio delle impostazioni", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getManagedOperator = (name: string): Operator | undefined => {
    return managedOperators.find(op => op.name.toUpperCase() === name.toUpperCase());
  };

  const roundToTen = (value: number) => Math.round(value / 10) * 10;

  const formatCurrency = (value: number) => `€ ${roundToTen(value).toLocaleString("it-IT")}`;

  const getMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split("-");
    const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  const filteredRecordsForDetails = useMemo(() => {
    if (!selectedOperator) return [];
    
    let filtered = selectedOperator.allRecords;
    
    if (detailsSearch.trim()) {
      const search = detailsSearch.toLowerCase();
      filtered = filtered.filter((r) =>
        r.prestazione.toLowerCase().includes(search) ||
        r.paziente.toLowerCase().includes(search)
      );
    }
    
    if (allMonthLabels.length > 0) {
      const minIndex = Math.floor((periodRange[0] / 100) * (allMonthLabels.length - 1));
      const maxIndex = Math.ceil((periodRange[1] / 100) * (allMonthLabels.length - 1));
      const allowedMonths = new Set(allMonthLabels.slice(minIndex, maxIndex + 1));
      
      filtered = filtered.filter((r) => {
        if (!r.data) return true;
        const date = parseDate(r.data);
        if (date) {
          return allowedMonths.has(getMonthKey(date));
        }
        return true;
      });
    }
    
    return filtered;
  }, [selectedOperator, detailsSearch, periodRange, allMonthLabels]);

  const filteredStats = useMemo(() => {
    if (!selectedOperator) return null;
    
    const records = filteredRecordsForDetails;
    const datesWorked = new Set(records.map((r) => r.data).filter(Boolean));
    const monthsSet = new Set<string>();
    
    records.forEach((r) => {
      if (r.data) {
        const date = parseDate(r.data);
        if (date) {
          monthsSet.add(getMonthKey(date));
        }
      }
    });
    
    const monthsCount = monthsSet.size || 1;
    const totalCompensation = records.reduce((sum, r) => sum + r.compensoOperatore, 0);
    const totalCompensationA = records.filter((r) => r.categoriaCompenso === "card").reduce((sum, r) => sum + r.compensoOperatore, 0);
    const totalCompensationB = records.filter((r) => r.categoriaCompenso === "cash").reduce((sum, r) => sum + r.compensoOperatore, 0);
    const totalStudioEarnings = records.reduce((sum, r) => sum + r.prezzoAlPaziente, 0);
    const totalStudioEarningsA = records.filter((r) => r.categoriaCompenso === "card").reduce((sum, r) => sum + r.prezzoAlPaziente, 0);
    const totalStudioEarningsB = records.filter((r) => r.categoriaCompenso === "cash").reduce((sum, r) => sum + r.prezzoAlPaziente, 0);
    
    return {
      totalCompensation,
      avgCompensation: totalCompensation / monthsCount,
      totalCompensationA,
      avgCompensationA: totalCompensationA / monthsCount,
      totalCompensationB,
      avgCompensationB: totalCompensationB / monthsCount,
      totalStudioEarnings,
      avgStudioEarnings: totalStudioEarnings / monthsCount,
      totalStudioEarningsA,
      avgStudioEarningsA: totalStudioEarningsA / monthsCount,
      totalStudioEarningsB,
      avgStudioEarningsB: totalStudioEarningsB / monthsCount,
      totalPrestazioni: records.length,
      avgPrestazioni: records.length / monthsCount,
      totalGiornate: datesWorked.size,
      avgGiornate: datesWorked.size / monthsCount,
    };
  }, [filteredRecordsForDetails, selectedOperator]);

  const minMonthLabel = allMonthLabels.length > 0 
    ? getMonthLabel(allMonthLabels[Math.floor((periodRange[0] / 100) * (allMonthLabels.length - 1))])
    : "";
  const maxMonthLabel = allMonthLabels.length > 0 
    ? getMonthLabel(allMonthLabels[Math.ceil((periodRange[1] / 100) * (allMonthLabels.length - 1))])
    : "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Operatori</h2>
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {operatorStats.length} operatori {analyses.length > 0 ? `in ${analyses.length} analisi` : ""}
          </p>
          <Button 
            size="sm" 
            onClick={() => { setNewOperatorName(""); setAddDialogOpen(true); }}
            data-testid="button-add-operator"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Aggiungi Operatore
          </Button>
        </div>
      </div>

      {operatorStats.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <FileText className="h-16 w-16 text-muted-foreground" />
          <div className="text-center space-y-2">
            <h3 className="text-lg font-medium">Nessun operatore disponibile</h3>
            <p className="text-muted-foreground">
              Aggiungi operatori o importa e archivia delle analisi
            </p>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {operatorStats.map((stats) => {
          const isExpanded = expandedOperators.has(stats.operatore);
          const hexColor = operatorColors[stats.operatore] || "#6B7280";
          
          return (
            <div key={stats.operatore} className="border rounded-lg overflow-hidden">
              <div 
                className="flex items-center gap-3 p-3 cursor-pointer hover-elevate"
                data-testid={`operator-row-${stats.operatore}`}
              >
                <div className="flex items-center gap-2" onClick={() => toggleExpanded(stats.operatore)}>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div 
                    className="w-4 h-4 rounded-full shrink-0 border cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-1"
                    style={{ backgroundColor: hexColor }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setColorEditOperator(stats.operatore);
                    }}
                    data-testid={`color-picker-${stats.operatore}`}
                  />
                </div>
                <span className="font-medium flex-1 uppercase" onClick={() => toggleExpanded(stats.operatore)}>{stats.operatore}</span>
                <Badge variant="secondary" className="text-xs">
                  {stats.totalAnalyses} {stats.totalAnalyses === 1 ? "analisi" : "analisi"}
                </Badge>
                {(() => {
                  const managed = getManagedOperator(stats.operatore);
                  return (
                    <>
                      {managed?.pagamentoGiornataAttivo && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">
                          <Calendar className="h-3 w-3 mr-0.5" />
                          Giornata
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (managed) openSettingsDialog(managed);
                        }}
                        disabled={!managed}
                        data-testid={`settings-button-${stats.operatore}`}
                      >
                        <Settings className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button 
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (managed) {
                            setEditOperator(managed);
                            setEditOperatorName(managed.name);
                            setEditDialogOpen(true);
                          }
                        }}
                        disabled={!managed}
                        data-testid={`edit-button-${stats.operatore}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (managed) {
                            setDeleteOperator(managed);
                            setDeleteDialogOpen(true);
                          }
                        }}
                        disabled={!managed}
                        data-testid={`delete-button-${stats.operatore}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </>
                  );
                })()}
                <Button 
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedOperator(stats);
                    setDetailsSearch("");
                    setPeriodRange([0, 100]);
                  }}
                  data-testid={`details-button-${stats.operatore}`}
                >
                  <Search className="h-4 w-4 text-blue-500" />
                </Button>
              </div>
              
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t bg-muted/20">
                  <ul className="text-sm space-y-1">
                    <li>
                      <span className="text-muted-foreground">Analisi: </span>
                      <span className="font-medium">{stats.totalAnalyses}</span>
                    </li>
                    <li>
                      <span className="text-muted-foreground">Compenso medio mensile: </span>
                      <span className="font-medium">{formatCurrency(stats.totalCompensation / stats.monthsCount)}</span>
                    </li>
                    <li>
                      <span className="text-muted-foreground">Compenso Cat. A medio mensile: </span>
                      <span className="font-medium">{formatCurrency(stats.totalCompensationA / stats.monthsCount)}</span>
                    </li>
                    <li>
                      <span className="text-muted-foreground">Compenso Cat. B medio mensile: </span>
                      <span className="font-medium">{formatCurrency(stats.totalCompensationB / stats.monthsCount)}</span>
                    </li>
                    <li>
                      <span className="text-muted-foreground">Guadagno studio medio mensile: </span>
                      <span className="font-medium">{formatCurrency(stats.totalStudioEarnings / stats.monthsCount)}</span>
                    </li>
                    <li>
                      <span className="text-muted-foreground">Guadagno studio Cat. A medio mensile: </span>
                      <span className="font-medium">{formatCurrency(stats.totalStudioEarningsA / stats.monthsCount)}</span>
                    </li>
                    <li>
                      <span className="text-muted-foreground">Guadagno studio Cat. B medio mensile: </span>
                      <span className="font-medium">{formatCurrency(stats.totalStudioEarningsB / stats.monthsCount)}</span>
                    </li>
                    <li>
                      <span className="text-muted-foreground">Prestazioni medie mensili: </span>
                      <span className="font-medium">{(stats.totalPrestazioni / stats.monthsCount).toFixed(1)}</span>
                    </li>
                    <li>
                      <span className="text-muted-foreground">Giornate medie mensili: </span>
                      <span className="font-medium">{(stats.totalGiornate / stats.monthsCount).toFixed(1)}</span>
                    </li>
                  </ul>
                  {(() => {
                    const managed = getManagedOperator(stats.operatore);
                    const aliases = managed
                      ? operatorAliases.filter(a => a.operatorId === managed.id)
                      : [];
                    return (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">Alias importazione</p>
                        {aliases.length === 0 ? (
                          <p className="text-xs text-muted-foreground/60 italic">Nessun alias salvato</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {aliases.map((a) => (
                              <span
                                key={a.id}
                                className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded"
                                data-testid={`alias-${a.id}`}
                              >
                                <span className="uppercase">{a.alias}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteAlias(a.id); }}
                                  className="text-muted-foreground hover:text-destructive ml-0.5"
                                  data-testid={`delete-alias-${a.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Dialog open={colorEditOperator !== null} onOpenChange={() => setColorEditOperator(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Scegli colore per {colorEditOperator}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-6 gap-2 py-4">
            {OPERATOR_COLORS.map((color) => (
              <Tooltip key={color.hex}>
                <TooltipTrigger asChild>
                  <button
                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      operatorColors[colorEditOperator || ""] === color.hex 
                        ? "ring-2 ring-primary ring-offset-2" 
                        : ""
                    }`}
                    style={{ 
                      backgroundColor: color.hex,
                      borderColor: color.hex === "#FFFFFF" ? "#E5E7EB" : color.hex,
                    }}
                    onClick={() => colorEditOperator && handleColorChange(colorEditOperator, color.hex)}
                    data-testid={`color-option-${color.name}`}
                  />
                </TooltipTrigger>
                <TooltipContent>{color.name}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog 
        open={selectedOperator !== null} 
        onOpenChange={() => setSelectedOperator(null)}
      >
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: operatorColors[selectedOperator?.operatore || ""] || "#6B7280" }}
              />
              Dettagli {selectedOperator?.operatore?.toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          
          {selectedOperator && filteredStats && (
            <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
              <div className="text-sm text-muted-foreground shrink-0">
                Presente in {selectedOperator.totalAnalyses} {selectedOperator.totalAnalyses === 1 ? "analisi" : "analisi"}
              </div>
              
              <div className="space-y-3 shrink-0">
                <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                  <div className="rounded-lg border p-2 bg-card">
                    <p className="text-[10px] leading-tight text-muted-foreground">Compenso Totale</p>
                    <p className="text-sm font-bold">{formatCurrency(filteredStats.totalCompensation)}</p>
                  </div>
                  <div className="rounded-lg border p-2 bg-card">
                    <p className="text-[10px] leading-tight text-muted-foreground">Compenso Cat. A Totale</p>
                    <p className="text-sm font-bold text-blue-600">{formatCurrency(filteredStats.totalCompensationA)}</p>
                  </div>
                  <div className="rounded-lg border p-2 bg-card">
                    <p className="text-[10px] leading-tight text-muted-foreground">Compenso Cat. B Totale</p>
                    <p className="text-sm font-bold text-green-600">{formatCurrency(filteredStats.totalCompensationB)}</p>
                  </div>
                  <div className="rounded-lg border p-2 bg-card">
                    <p className="text-[10px] leading-tight text-muted-foreground">Guadagno Studio Totale</p>
                    <p className="text-sm font-bold">{formatCurrency(filteredStats.totalStudioEarnings)}</p>
                  </div>
                  <div className="rounded-lg border p-2 bg-card">
                    <p className="text-[10px] leading-tight text-muted-foreground">Guadagno Studio Cat. A Totale</p>
                    <p className="text-sm font-bold text-blue-600">{formatCurrency(filteredStats.totalStudioEarningsA)}</p>
                  </div>
                  <div className="rounded-lg border p-2 bg-card">
                    <p className="text-[10px] leading-tight text-muted-foreground">Guadagno Studio Cat. B Totale</p>
                    <p className="text-sm font-bold text-green-600">{formatCurrency(filteredStats.totalStudioEarningsB)}</p>
                  </div>
                  <div className="rounded-lg border p-2 bg-card">
                    <p className="text-[10px] leading-tight text-muted-foreground">Prestazioni Totali</p>
                    <p className="text-sm font-bold">{filteredStats.totalPrestazioni}</p>
                  </div>
                  <div className="rounded-lg border p-2 bg-card">
                    <p className="text-[10px] leading-tight text-muted-foreground">Giornate Totali</p>
                    <p className="text-sm font-bold">{filteredStats.totalGiornate}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                  <div className="rounded-lg border p-2 bg-card">
                    <p className="text-[10px] leading-tight text-muted-foreground">Compenso Medio Mensile</p>
                    <p className="text-sm font-bold">{formatCurrency(filteredStats.avgCompensation)}</p>
                  </div>
                  <div className="rounded-lg border p-2 bg-card">
                    <p className="text-[10px] leading-tight text-muted-foreground">Compenso Cat. A Medio Mensile</p>
                    <p className="text-sm font-bold text-blue-600">{formatCurrency(filteredStats.avgCompensationA)}</p>
                  </div>
                  <div className="rounded-lg border p-2 bg-card">
                    <p className="text-[10px] leading-tight text-muted-foreground">Compenso Cat. B Medio Mensile</p>
                    <p className="text-sm font-bold text-green-600">{formatCurrency(filteredStats.avgCompensationB)}</p>
                  </div>
                  <div className="rounded-lg border p-2 bg-card">
                    <p className="text-[10px] leading-tight text-muted-foreground">Guadagno Studio Medio Mensile</p>
                    <p className="text-sm font-bold">{formatCurrency(filteredStats.avgStudioEarnings)}</p>
                  </div>
                  <div className="rounded-lg border p-2 bg-card">
                    <p className="text-[10px] leading-tight text-muted-foreground">Guadagno Studio Cat. A Medio Mensile</p>
                    <p className="text-sm font-bold text-blue-600">{formatCurrency(filteredStats.avgStudioEarningsA)}</p>
                  </div>
                  <div className="rounded-lg border p-2 bg-card">
                    <p className="text-[10px] leading-tight text-muted-foreground">Guadagno Studio Cat. B Medio Mensile</p>
                    <p className="text-sm font-bold text-green-600">{formatCurrency(filteredStats.avgStudioEarningsB)}</p>
                  </div>
                  <div className="rounded-lg border p-2 bg-card">
                    <p className="text-[10px] leading-tight text-muted-foreground">Prestazioni Medie Mensili</p>
                    <p className="text-sm font-bold">{filteredStats.avgPrestazioni.toFixed(1)}</p>
                  </div>
                  <div className="rounded-lg border p-2 bg-card">
                    <p className="text-[10px] leading-tight text-muted-foreground">Giornate Medie Mensili</p>
                    <p className="text-sm font-bold">{filteredStats.avgGiornate.toFixed(1)}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center shrink-0">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cerca prestazione o paziente..."
                    value={detailsSearch}
                    onChange={(e) => setDetailsSearch(e.target.value)}
                    className="pl-10"
                    data-testid="details-search-input"
                  />
                </div>
                
                {allMonthLabels.length >= 1 && (
                  <div className="flex items-center gap-3 flex-1">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground whitespace-nowrap min-w-[60px]">
                      {minMonthLabel}
                    </span>
                    <Slider
                      value={periodRange}
                      onValueChange={(value) => setPeriodRange(value as [number, number])}
                      min={0}
                      max={100}
                      step={1}
                      className="flex-1"
                      data-testid="period-slider"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap min-w-[60px]">
                      {maxMonthLabel}
                    </span>
                  </div>
                )}
              </div>

              <div className="text-sm text-muted-foreground shrink-0">
                {filteredRecordsForDetails.length} prestazioni trovate
              </div>

              <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
                <ScrollArea className="h-full">
                  <table className="w-full text-sm table-fixed">
                    <thead className="bg-muted sticky top-0 z-10">
                      <tr>
                        <th className="text-left p-2 font-medium w-[40px]">Cat.</th>
                        <th className="text-left p-2 font-medium w-[80px]">Data</th>
                        <th className="text-left p-2 font-medium w-[20%]">Paziente</th>
                        <th className="text-left p-2 font-medium">Prestazione</th>
                        <th className="text-left p-2 font-medium w-[80px]">Elementi</th>
                        <th className="text-right p-2 font-medium w-[104px]">Prezzo Paz.</th>
                        <th className="text-right p-2 font-medium w-[104px]">Compenso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecordsForDetails.map((record, idx) => (
                        <tr 
                          key={`${record.id}-${idx}`} 
                          className={`border-t ${record.hasAnomaly ? "bg-red-50 dark:bg-red-950/20" : ""}`}
                        >
                          <td className="p-2">
                            {record.categoriaCompenso === "card" ? (
                              <CreditCard className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Banknote className="h-4 w-4 text-green-600" />
                            )}
                          </td>
                          <td className="p-2 whitespace-nowrap">{record.data || "-"}</td>
                          <td className="p-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block truncate">{record.paziente}</span>
                              </TooltipTrigger>
                              <TooltipContent>{record.paziente}</TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="p-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block truncate">{record.prestazione}</span>
                              </TooltipTrigger>
                              <TooltipContent>{record.prestazione}</TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="p-2 text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block truncate">{record.elementiDentali || "-"}</span>
                              </TooltipTrigger>
                              <TooltipContent>{record.elementiDentali || "-"}</TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="p-2 text-right whitespace-nowrap">€ {record.prezzoAlPaziente.toLocaleString("it-IT")}</td>
                          <td className="p-2 text-right font-medium whitespace-nowrap">€ {record.compensoOperatore.toLocaleString("it-IT")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Aggiungi Operatore</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Nome operatore"
              value={newOperatorName}
              onChange={(e) => setNewOperatorName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddOperator(); }}
              data-testid="input-new-operator-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleAddOperator} disabled={!newOperatorName.trim() || isSubmitting} data-testid="button-confirm-add-operator">
              Aggiungi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Modifica Operatore</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Nome operatore"
              value={editOperatorName}
              onChange={(e) => setEditOperatorName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleEditOperator(); }}
              data-testid="input-edit-operator-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleEditOperator} disabled={!editOperatorName.trim() || isSubmitting} data-testid="button-confirm-edit-operator">
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare l'operatore?</AlertDialogTitle>
            <AlertDialogDescription>
              L'operatore "{deleteOperator?.name}" verrà rimosso dalla lista gestita. 
              I dati nelle analisi archiviate non verranno modificati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOperator} disabled={isSubmitting} data-testid="button-confirm-delete-operator">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Pagamento a Giornata — {settingsOperator?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Switch
                id="settings-attivo"
                checked={settingsAttivo}
                onCheckedChange={setSettingsAttivo}
                data-testid="switch-giornata-attivo"
              />
              <Label htmlFor="settings-attivo">Attiva</Label>
            </div>

            {settingsAttivo && (
              <div className="space-y-3 border-t pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="settings-minimo-a" className="text-xs flex items-center gap-1">
                      <CreditCard className="h-3 w-3" /> Min A
                    </Label>
                    <Input
                      id="settings-minimo-a"
                      type="number"
                      min="0"
                      step="10"
                      value={settingsMinimoA}
                      onChange={(e) => setSettingsMinimoA(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="0"
                      data-testid="input-minimo-a"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="settings-minimo-b" className="text-xs flex items-center gap-1">
                      <Banknote className="h-3 w-3" /> Min B
                    </Label>
                    <Input
                      id="settings-minimo-b"
                      type="number"
                      min="0"
                      step="10"
                      value={settingsMinimoB}
                      onChange={(e) => setSettingsMinimoB(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="0"
                      data-testid="input-minimo-b"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="settings-fisso-a" className="text-xs flex items-center gap-1">
                      <CreditCard className="h-3 w-3" /> Fisso A
                    </Label>
                    <Input
                      id="settings-fisso-a"
                      type="number"
                      min="0"
                      step="10"
                      value={settingsFissoA}
                      onChange={(e) => setSettingsFissoA(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="0"
                      data-testid="input-fisso-a"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="settings-fisso-b" className="text-xs flex items-center gap-1">
                      <Banknote className="h-3 w-3" /> Fisso B
                    </Label>
                    <Input
                      id="settings-fisso-b"
                      type="number"
                      min="0"
                      step="10"
                      value={settingsFissoB}
                      onChange={(e) => setSettingsFissoB(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="0"
                      data-testid="input-fisso-b"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleSaveSettings} disabled={isSubmitting} data-testid="button-save-settings">
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
