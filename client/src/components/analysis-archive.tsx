import { useState, useMemo } from "react";
import { Archive, Calendar, Trash2, FileText, Users, ChevronDown, ChevronUp, CreditCard, Banknote, CheckSquare, Square, FolderOpen, Download, FileSpreadsheet, Copy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import type { Analysis } from "@shared/schema";

interface AnalysisArchiveProps {
  analyses: Analysis[];
  onDeleteAnalysis: (id: string) => void;
  onBulkDeleteAnalyses: (ids: string[]) => void;
  onOpenAnalysis?: (analysis: Analysis) => void;
  isLoading?: boolean;
}

export function AnalysisArchive({ analyses, onDeleteAnalysis, onBulkDeleteAnalyses, onOpenAnalysis, isLoading }: AnalysisArchiveProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showTextReportModal, setShowTextReportModal] = useState(false);
  const [exportAnalysis, setExportAnalysis] = useState<Analysis | null>(null);
  const { toast } = useToast();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const roundToTen = (value: number): number => {
    return Math.round(value / 10) * 10;
  };

  const getAnalysisStats = (analysis: Analysis) => {
    const records = analysis.records;
    const totalCompenso = records.reduce((sum, r) => sum + r.compensoOperatore, 0);
    const cardCompenso = records.filter(r => r.categoriaCompenso === "card").reduce((sum, r) => sum + r.compensoOperatore, 0);
    const cashCompenso = records.filter(r => r.categoriaCompenso === "cash").reduce((sum, r) => sum + r.compensoOperatore, 0);
    const uniqueOperators = new Set(records.map(r => r.operatore)).size;
    const anomalies = records.filter(r => r.hasAnomaly).length;

    return {
      totalRecords: records.length,
      totalCompenso: roundToTen(totalCompenso),
      cardCompenso: roundToTen(cardCompenso),
      cashCompenso: roundToTen(cashCompenso),
      uniqueOperators,
      anomalies,
    };
  };

  const textReport = useMemo(() => {
    if (!exportAnalysis) return "";
    const records = exportAnalysis.records;
    const operatorMap = new Map<string, { card: number; cash: number; total: number }>();
    
    records.forEach((r) => {
      const existing = operatorMap.get(r.operatore) || { card: 0, cash: 0, total: 0 };
      if (r.categoriaCompenso === "card") {
        existing.card += r.compensoOperatore;
      } else {
        existing.cash += r.compensoOperatore;
      }
      existing.total += r.compensoOperatore;
      operatorMap.set(r.operatore, existing);
    });

    return Array.from(operatorMap.entries()).map(([operatore, data]) => {
      return `Nome operatore: ${operatore}
Periodo analisi: ${exportAnalysis.dateRange}
Compenso totale: ${roundToTen(data.total)} €
Compenso A: ${roundToTen(data.card)} €
Compenso B: ${roundToTen(data.cash)} €`;
    }).join("\n\n---\n\n");
  }, [exportAnalysis]);

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === analyses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(analyses.map(a => a.id)));
    }
  };

  const handleBulkDelete = () => {
    onBulkDeleteAnalyses(Array.from(selectedIds));
    setSelectedIds(new Set());
    setShowBulkDeleteDialog(false);
  };

  const handleOpenExportModal = (analysis: Analysis, e: React.MouseEvent) => {
    e.stopPropagation();
    setExportAnalysis(analysis);
    setShowExportModal(true);
  };

  const handleExportExcel = () => {
    if (!exportAnalysis) return;
    
    const records = exportAnalysis.records;
    const operatorMap = new Map<string, { card: number; cash: number; count: number }>();
    
    records.forEach((r) => {
      const existing = operatorMap.get(r.operatore) || { card: 0, cash: 0, count: 0 };
      if (r.categoriaCompenso === "card") {
        existing.card += r.compensoOperatore;
      } else {
        existing.cash += r.compensoOperatore;
      }
      existing.count++;
      operatorMap.set(r.operatore, existing);
    });

    const reportData = Array.from(operatorMap.entries()).map(([operatore, data]) => ({
      Operatore: operatore,
      "Numero Prestazioni": data.count,
      "Compenso Totale": roundToTen(data.card + data.cash),
      "Compenso A": roundToTen(data.card),
      "Compenso B": roundToTen(data.cash),
    }));

    const detailData = records.map((r) => ({
      "Categoria": r.categoriaCompenso === "card" ? "Compenso A" : "Compenso B",
      Data: r.data || "",
      Operatore: r.operatore,
      Paziente: r.paziente,
      Prestazione: r.prestazione,
      "Elementi Dentali": r.elementiDentali,
      "Prezzo Al Paziente": r.prezzoAlPaziente,
      "Compenso Operatore": r.compensoOperatore,
      Anomalia: r.hasAnomaly ? "Sì" : "No",
    }));

    const wb = XLSX.utils.book_new();
    const wsReport = XLSX.utils.json_to_sheet(reportData);
    const wsDetail = XLSX.utils.json_to_sheet(detailData);

    XLSX.utils.book_append_sheet(wb, wsReport, "Report Operatori");
    XLSX.utils.book_append_sheet(wb, wsDetail, "Dettaglio Prestazioni");

    const fileName = `${exportAnalysis.name.replace(/\s+/g, "_")}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({
      title: "Export completato",
      description: `File ${fileName} scaricato con successo`,
    });

    setShowExportModal(false);
  };

  const handleExportText = () => {
    setShowExportModal(false);
    setShowTextReportModal(true);
  };

  const handleCopyTextReport = () => {
    navigator.clipboard.writeText(textReport);
    toast({
      title: "Report copiato",
      description: "Il report testuale è stato copiato negli appunti",
    });
  };

  const handleOpenAnalysis = (analysis: Analysis, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenAnalysis) {
      onOpenAnalysis(analysis);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Caricamento archivio...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (analyses.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Archive className="h-12 w-12 opacity-40" />
            <p className="font-medium">Nessuna analisi archiviata</p>
            <p className="text-sm text-center max-w-md">
              Le analisi precedenti verranno automaticamente archiviate quando importi nuovi dati
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Archive className="h-5 w-5 text-primary" />
              Archivio Analisi
            </CardTitle>
            <CardDescription className="mt-1">
              {analyses.length} analisi archiviate
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              data-testid="button-select-all-analyses"
            >
              {selectedIds.size === analyses.length ? (
                <>
                  <Square className="mr-1 h-4 w-4" />
                  Deseleziona tutti
                </>
              ) : (
                <>
                  <CheckSquare className="mr-1 h-4 w-4" />
                  Seleziona tutti
                </>
              )}
            </Button>
            {selectedIds.size > 0 && (
              <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    data-testid="button-bulk-delete-analyses"
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Elimina selezionati ({selectedIds.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminare le analisi selezionate?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Stai per eliminare {selectedIds.size} analisi dall'archivio.
                      Questa azione non può essere annullata e tutti i dati associati saranno persi definitivamente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleBulkDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      data-testid="button-confirm-bulk-delete"
                    >
                      Elimina {selectedIds.size} analisi
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {analyses.map((analysis) => {
          const stats = getAnalysisStats(analysis);
          const isExpanded = expandedId === analysis.id;
          const isSelected = selectedIds.has(analysis.id);

          return (
            <Collapsible
              key={analysis.id}
              open={isExpanded}
              onOpenChange={() => setExpandedId(isExpanded ? null : analysis.id)}
            >
              <div className={`rounded-lg border transition-colors ${isSelected ? 'border-primary bg-primary/5' : ''}`}>
                <div className="flex items-center gap-3 p-4">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggleSelect(analysis.id)}
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`checkbox-analysis-${analysis.id}`}
                  />
                  <CollapsibleTrigger asChild>
                    <div className="flex-1 flex items-center justify-between cursor-pointer hover-elevate rounded-md p-2 -m-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium">{analysis.name}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span>{stats.uniqueOperators} operatori</span>
                            <span className="mx-1">•</span>
                            <span>{stats.totalRecords} record</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right mr-2">
                          <div className="flex items-center gap-3 text-sm">
                            <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> {formatCurrency(stats.cardCompenso)}</span>
                            <span className="flex items-center gap-1"><Banknote className="h-3 w-3" /> {formatCurrency(stats.cashCompenso)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Archiviata il {new Date(analysis.createdAt).toLocaleDateString("it-IT")}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleOpenAnalysis(analysis, e)}
                          data-testid={`button-open-analysis-${analysis.id}`}
                        >
                          <FolderOpen className="mr-1 h-4 w-4" />
                          Apri
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleOpenExportModal(analysis, e)}
                          data-testid={`button-export-analysis-${analysis.id}`}
                        >
                          <Download className="mr-1 h-4 w-4" />
                          Esporta
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`button-delete-analysis-${analysis.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminare questa analisi?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Stai per eliminare "{analysis.name}" dall'archivio.
                                Questa azione non può essere annullata.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onDeleteAnalysis(analysis.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Elimina
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent>
                  <div className="border-t px-4 py-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-lg bg-muted/50 p-4">
                        <p className="text-sm text-muted-foreground">Compenso Totale</p>
                        <p className="text-2xl font-bold">{formatCurrency(stats.totalCompenso)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-4">
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <CreditCard className="h-3 w-3" /> Compenso A
                        </p>
                        <p className="text-2xl font-bold">{formatCurrency(stats.cardCompenso)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-4">
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Banknote className="h-3 w-3" /> Compenso B
                        </p>
                        <p className="text-2xl font-bold">{formatCurrency(stats.cashCompenso)}</p>
                      </div>
                    </div>

                    <div>
                      <h5 className="font-medium mb-2">Dettaglio per Operatore</h5>
                      <div className="rounded-lg border overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Operatore</TableHead>
                              <TableHead className="text-right">Prestazioni</TableHead>
                              <TableHead className="text-right"><span className="flex items-center justify-end gap-1"><CreditCard className="h-3 w-3" /> Compenso A</span></TableHead>
                              <TableHead className="text-right"><span className="flex items-center justify-end gap-1"><Banknote className="h-3 w-3" /> Compenso B</span></TableHead>
                              <TableHead className="text-right">Totale</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Array.from(
                              analysis.records.reduce((map, r) => {
                                const existing = map.get(r.operatore) || { card: 0, cash: 0, count: 0 };
                                if (r.categoriaCompenso === "card") {
                                  existing.card += r.compensoOperatore;
                                } else {
                                  existing.cash += r.compensoOperatore;
                                }
                                existing.count++;
                                map.set(r.operatore, existing);
                                return map;
                              }, new Map<string, { card: number; cash: number; count: number }>())
                            ).map(([operatore, data]) => (
                              <TableRow key={operatore}>
                                <TableCell className="font-medium">{operatore}</TableCell>
                                <TableCell className="text-right">{data.count}</TableCell>
                                <TableCell className="text-right">{formatCurrency(roundToTen(data.card))}</TableCell>
                                <TableCell className="text-right">{formatCurrency(roundToTen(data.cash))}</TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(roundToTen(data.card + data.cash))}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>

      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Esporta Analisi
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Scegli il formato di esportazione per "{exportAnalysis?.name}"
          </p>
          <div className="flex flex-col gap-3">
            <Button onClick={handleExportExcel} className="w-full" data-testid="button-archive-export-excel">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Esporta Excel
            </Button>
            <Button onClick={handleExportText} variant="outline" className="w-full" data-testid="button-archive-export-text">
              <FileText className="mr-2 h-4 w-4" />
              Esporta Testo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showTextReportModal} onOpenChange={setShowTextReportModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Report Testuale - {exportAnalysis?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-end mb-2">
            <Button variant="outline" size="sm" onClick={handleCopyTextReport} data-testid="button-archive-copy-report">
              <Copy className="mr-2 h-4 w-4" />
              Copia
            </Button>
          </div>
          <Textarea 
            value={textReport} 
            readOnly 
            className="min-h-[400px] font-mono text-sm"
            data-testid="textarea-archive-text-report"
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
