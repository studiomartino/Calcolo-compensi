import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Palette, Search, FileText, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Analysis, CompensoRecord } from "@shared/schema";

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
  totalPrestazioni: number;
  totalGiornate: number;
  monthsCount: number;
  allRecords: (CompensoRecord & { analysisName: string; analysisId: string })[];
  monthLabels: string[];
}

export function OperatorsTab({ analyses, operatorColors, onUpdateOperatorColors }: OperatorsTabProps) {
  const [expandedOperators, setExpandedOperators] = useState<Set<string>>(new Set());
  const [selectedOperator, setSelectedOperator] = useState<OperatorStats | null>(null);
  const [detailsSearch, setDetailsSearch] = useState("");
  const [periodRange, setPeriodRange] = useState<[number, number]>([0, 100]);
  const [colorEditOperator, setColorEditOperator] = useState<string | null>(null);

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
          existing.totalPrestazioni += 1;
        } else {
          analysisIds.add(analysis.id);
          statsMap.set(record.operatore, {
            operatore: record.operatore,
            totalAnalyses: 0,
            totalCompensation: record.compensoOperatore,
            totalCompensationA: record.categoriaCompenso === "card" ? record.compensoOperatore : 0,
            totalCompensationB: record.categoriaCompenso === "cash" ? record.compensoOperatore : 0,
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
    
    return Array.from(statsMap.values()).sort((a, b) => a.operatore.localeCompare(b.operatore));
  }, [analyses]);

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
    
    return {
      totalCompensation,
      avgCompensation: totalCompensation / monthsCount,
      totalCompensationA,
      avgCompensationA: totalCompensationA / monthsCount,
      totalCompensationB,
      avgCompensationB: totalCompensationB / monthsCount,
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

  if (analyses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-medium">Nessun operatore disponibile</h3>
          <p className="text-muted-foreground">
            Importa e archivia delle analisi per visualizzare le statistiche degli operatori
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Operatori</h2>
          <p className="text-sm text-muted-foreground">
            {operatorStats.length} operatori trovati in {analyses.length} analisi
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {operatorStats.map((stats) => {
          const isExpanded = expandedOperators.has(stats.operatore);
          const hexColor = operatorColors[stats.operatore] || "#6B7280";
          
          return (
            <div key={stats.operatore} className="border rounded-lg overflow-hidden">
              <div 
                className="flex items-center gap-3 p-3 cursor-pointer hover-elevate"
                onClick={() => toggleExpanded(stats.operatore)}
                data-testid={`operator-row-${stats.operatore}`}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div 
                    className="w-4 h-4 rounded-full shrink-0 border"
                    style={{ backgroundColor: hexColor }}
                  />
                </div>
                <span className="font-medium flex-1">{stats.operatore}</span>
                <Badge variant="secondary" className="text-xs">
                  {stats.totalAnalyses} {stats.totalAnalyses === 1 ? "analisi" : "analisi"}
                </Badge>
              </div>
              
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t bg-muted/20 space-y-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-6 h-6 rounded-full border-2 cursor-pointer"
                      style={{ backgroundColor: hexColor }}
                      onClick={() => setColorEditOperator(stats.operatore)}
                      data-testid={`color-picker-${stats.operatore}`}
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setColorEditOperator(stats.operatore)}
                    >
                      <Palette className="h-3 w-3 mr-1" />
                      Modifica colore
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">Analisi</p>
                      <p className="font-medium">{stats.totalAnalyses}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">Compenso medio mensile</p>
                      <p className="font-medium">{formatCurrency(stats.totalCompensation / stats.monthsCount)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">Cat. A medio mensile</p>
                      <p className="font-medium">{formatCurrency(stats.totalCompensationA / stats.monthsCount)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">Cat. B medio mensile</p>
                      <p className="font-medium">{formatCurrency(stats.totalCompensationB / stats.monthsCount)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">Prestazioni medie mensili</p>
                      <p className="font-medium">{(stats.totalPrestazioni / stats.monthsCount).toFixed(1)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">Giornate medie mensili</p>
                      <p className="font-medium">{(stats.totalGiornate / stats.monthsCount).toFixed(1)}</p>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={() => {
                      setSelectedOperator(stats);
                      setDetailsSearch("");
                      setPeriodRange([0, 100]);
                    }}
                    data-testid={`details-button-${stats.operatore}`}
                  >
                    Dettagli
                  </Button>
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
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: operatorColors[selectedOperator?.operatore || ""] || "#6B7280" }}
              />
              Dettagli {selectedOperator?.operatore}
            </DialogTitle>
          </DialogHeader>
          
          {selectedOperator && filteredStats && (
            <div className="flex-1 overflow-hidden flex flex-col gap-4 pl-[4px] pr-[4px]">
              <div className="text-sm text-muted-foreground">
                Presente in {selectedOperator.totalAnalyses} {selectedOperator.totalAnalyses === 1 ? "analisi" : "analisi"}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="rounded-lg border p-3 bg-card">
                  <p className="text-xs text-muted-foreground">Compenso Totale</p>
                  <p className="text-lg font-bold">{formatCurrency(filteredStats.totalCompensation)}</p>
                </div>
                <div className="rounded-lg border p-3 bg-card">
                  <p className="text-xs text-muted-foreground">Compenso Medio Mensile</p>
                  <p className="text-lg font-bold">{formatCurrency(filteredStats.avgCompensation)}</p>
                </div>
                <div className="rounded-lg border p-3 bg-card">
                  <p className="text-xs text-muted-foreground">Cat. A Totale</p>
                  <p className="text-lg font-bold text-blue-600">{formatCurrency(filteredStats.totalCompensationA)}</p>
                </div>
                <div className="rounded-lg border p-3 bg-card">
                  <p className="text-xs text-muted-foreground">Cat. A Medio Mensile</p>
                  <p className="text-lg font-bold text-blue-600">{formatCurrency(filteredStats.avgCompensationA)}</p>
                </div>
                <div className="rounded-lg border p-3 bg-card">
                  <p className="text-xs text-muted-foreground">Cat. B Totale</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(filteredStats.totalCompensationB)}</p>
                </div>
                <div className="rounded-lg border p-3 bg-card">
                  <p className="text-xs text-muted-foreground">Cat. B Medio Mensile</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(filteredStats.avgCompensationB)}</p>
                </div>
                <div className="rounded-lg border p-3 bg-card">
                  <p className="text-xs text-muted-foreground">Prestazioni Totali</p>
                  <p className="text-lg font-bold">{filteredStats.totalPrestazioni}</p>
                </div>
                <div className="rounded-lg border p-3 bg-card">
                  <p className="text-xs text-muted-foreground">Prestazioni Medie Mensili</p>
                  <p className="text-lg font-bold">{filteredStats.avgPrestazioni.toFixed(1)}</p>
                </div>
                <div className="rounded-lg border p-3 bg-card">
                  <p className="text-xs text-muted-foreground">Giornate Totali</p>
                  <p className="text-lg font-bold">{filteredStats.totalGiornate}</p>
                </div>
                <div className="rounded-lg border p-3 bg-card">
                  <p className="text-xs text-muted-foreground">Giornate Medie Mensili</p>
                  <p className="text-lg font-bold">{filteredStats.avgGiornate.toFixed(1)}</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
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
                
                {allMonthLabels.length > 1 && (
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

              <div className="text-sm text-muted-foreground">
                {filteredRecordsForDetails.length} prestazioni trovate
              </div>

              <ScrollArea className="flex-1 border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium">Cat.</th>
                      <th className="text-left p-2 font-medium">Data</th>
                      <th className="text-left p-2 font-medium">Paziente</th>
                      <th className="text-left p-2 font-medium">Prestazione</th>
                      <th className="text-left p-2 font-medium">Elementi</th>
                      <th className="text-right p-2 font-medium">Prezzo Paz.</th>
                      <th className="text-right p-2 font-medium">Compenso</th>
                      <th className="text-left p-2 font-medium">Analisi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecordsForDetails.map((record, idx) => (
                      <tr 
                        key={`${record.id}-${idx}`} 
                        className={`border-t ${record.hasAnomaly ? "bg-red-50 dark:bg-red-950/20" : ""}`}
                      >
                        <td className="p-2">
                          <Badge variant={record.categoriaCompenso === "card" ? "default" : "secondary"} className="text-xs">
                            {record.categoriaCompenso === "card" ? "A" : "B"}
                          </Badge>
                        </td>
                        <td className="p-2 whitespace-nowrap">{record.data || "-"}</td>
                        <td className="p-2">{record.paziente}</td>
                        <td className="p-2">{record.prestazione}</td>
                        <td className="p-2">{record.elementiDentali || "-"}</td>
                        <td className="p-2 text-right">€ {record.prezzoAlPaziente.toLocaleString("it-IT")}</td>
                        <td className="p-2 text-right font-medium">€ {record.compensoOperatore.toLocaleString("it-IT")}</td>
                        <td className="p-2 text-xs text-muted-foreground">{record.analysisName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
