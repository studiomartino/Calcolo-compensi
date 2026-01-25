import { useMemo, useState } from "react";
import { Users, AlertTriangle, Calculator, Download, CreditCard, Banknote, Check, X, Edit2, FileSpreadsheet, FileText, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { CompensoRecord, OperatorReport } from "@shared/schema";

interface OperatorDashboardProps {
  records: CompensoRecord[];
  onExportExcel: () => void;
  selectedOperator: string | null;
  onSelectOperator: (operator: string | null) => void;
  onUpdateRecord?: (id: string, compensoOperatore: number) => void;
  dateRange?: string;
}

export function OperatorDashboard({
  records,
  onExportExcel,
  selectedOperator,
  onSelectOperator,
  onUpdateRecord,
  dateRange,
}: OperatorDashboardProps) {
  const [showAnomaliesModal, setShowAnomaliesModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showTextReportModal, setShowTextReportModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const { toast } = useToast();

  const roundToTen = (value: number): number => {
    return Math.round(value / 10) * 10;
  };

  const anomalousRecords = useMemo(() => {
    return records.filter((r) => r.hasAnomaly);
  }, [records]);

  const operatorReports = useMemo((): OperatorReport[] => {
    const operatorMap = new Map<string, CompensoRecord[]>();
    
    records.forEach((record) => {
      const existing = operatorMap.get(record.operatore) || [];
      existing.push(record);
      operatorMap.set(record.operatore, existing);
    });

    return Array.from(operatorMap.entries()).map(([operatore, operatorRecords]) => {
      const compensoTotale = operatorRecords.reduce(
        (sum, r) => sum + r.compensoOperatore,
        0
      );
      const compensoCard = operatorRecords
        .filter((r) => r.categoriaCompenso === "card")
        .reduce((sum, r) => sum + r.compensoOperatore, 0);
      const compensoCash = operatorRecords
        .filter((r) => r.categoriaCompenso === "cash")
        .reduce((sum, r) => sum + r.compensoOperatore, 0);
      const numeroAnomalie = operatorRecords.filter((r) => r.hasAnomaly).length;

      return {
        operatore,
        compensoTotale,
        compensoCard,
        compensoCash,
        compensoTotaleArrotondato: roundToTen(compensoTotale),
        compensoCardArrotondato: roundToTen(compensoCard),
        compensoCashArrotondato: roundToTen(compensoCash),
        numeroAnomalie,
        numeroRecord: operatorRecords.length,
      };
    }).sort((a, b) => b.compensoTotale - a.compensoTotale);
  }, [records]);

  const globalStats = useMemo(() => {
    const totalCompenso = records.reduce((sum, r) => sum + r.compensoOperatore, 0);
    const totalCard = records
      .filter((r) => r.categoriaCompenso === "card")
      .reduce((sum, r) => sum + r.compensoOperatore, 0);
    const totalCash = records
      .filter((r) => r.categoriaCompenso === "cash")
      .reduce((sum, r) => sum + r.compensoOperatore, 0);
    const totalAnomalie = records.filter((r) => r.hasAnomaly).length;

    return {
      totalRecords: records.length,
      totalOperators: operatorReports.length,
      totalCompenso: roundToTen(totalCompenso),
      totalCard: roundToTen(totalCard),
      totalCash: roundToTen(totalCash),
      totalAnomalie,
      cardPercentage: totalCompenso > 0 ? (totalCard / totalCompenso) * 100 : 0,
      cashPercentage: totalCompenso > 0 ? (totalCash / totalCompenso) * 100 : 0,
    };
  }, [records, operatorReports]);

  const textReport = useMemo(() => {
    const periodo = dateRange || "Non specificato";
    return operatorReports.map((report) => {
      return `Nome operatore: ${report.operatore}
Periodo analisi: ${periodo}
Compenso totale: ${roundToTen(report.compensoTotale)} €
Compenso A: ${roundToTen(report.compensoCard)} €
Compenso B: ${roundToTen(report.compensoCash)} €`;
    }).join("\n\n---\n\n");
  }, [operatorReports, dateRange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyWithDecimals = (amount: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  };

  const handleStartEdit = (id: string, currentValue: number) => {
    setEditingId(id);
    setEditValue(currentValue.toString());
  };

  const handleSaveEdit = (id: string) => {
    const numValue = parseFloat(editValue);
    if (!isNaN(numValue) && numValue >= 0 && onUpdateRecord) {
      onUpdateRecord(id, numValue);
    }
    setEditingId(null);
    setEditValue("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const handleCopyTextReport = () => {
    navigator.clipboard.writeText(textReport);
    toast({
      title: "Report copiato",
      description: "Il report testuale è stato copiato negli appunti",
    });
  };

  const handleExportExcel = () => {
    setShowExportModal(false);
    onExportExcel();
  };

  const handleExportText = () => {
    setShowExportModal(false);
    setShowTextReportModal(true);
  };

  const selectedReport = selectedOperator
    ? operatorReports.find((r) => r.operatore === selectedOperator)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard Operatori</h2>
          <p className="text-muted-foreground">
            Riepilogo compensi e statistiche per operatore
          </p>
        </div>
        <Button onClick={() => setShowExportModal(true)} data-testid="button-export">
          <Download className="mr-2 h-4 w-4" />
          Esporta
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-start space-y-0 pb-2 gap-2">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Compenso Totale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(globalStats.totalCompenso)}</div>
            <p className="text-xs text-muted-foreground">
              Da {globalStats.totalRecords} prestazioni
            </p>
            {globalStats.totalAnomalie > 0 && (
              <Badge 
                variant="outline" 
                className="mt-2 text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 cursor-pointer hover-elevate"
                onClick={() => setShowAnomaliesModal(true)}
                data-testid="badge-anomalies"
              >
                <AlertTriangle className="mr-1 h-3 w-3" />
                {globalStats.totalAnomalie} anomalie
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-start space-y-0 pb-2 gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Compenso A</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(globalStats.totalCard)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {globalStats.cardPercentage.toFixed(1)}% del totale
            </p>
            <div className="mt-2">
              <Progress value={globalStats.cardPercentage} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-start space-y-0 pb-2 gap-2">
            <Banknote className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Compenso B</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(globalStats.totalCash)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {globalStats.cashPercentage.toFixed(1)}% del totale
            </p>
            <div className="mt-2">
              <Progress value={globalStats.cashPercentage} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-start space-y-0 pb-2 gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Operatori</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalStats.totalOperators}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Collaboratori attivi
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Report per Operatore</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {operatorReports.map((report, index) => {
            const colors = [
              { bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-200 dark:border-blue-800", accent: "bg-blue-500", text: "text-blue-700 dark:text-blue-300" },
              { bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-800", accent: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
              { bg: "bg-violet-50 dark:bg-violet-950/40", border: "border-violet-200 dark:border-violet-800", accent: "bg-violet-500", text: "text-violet-700 dark:text-violet-300" },
              { bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800", accent: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
              { bg: "bg-rose-50 dark:bg-rose-950/40", border: "border-rose-200 dark:border-rose-800", accent: "bg-rose-500", text: "text-rose-700 dark:text-rose-300" },
              { bg: "bg-cyan-50 dark:bg-cyan-950/40", border: "border-cyan-200 dark:border-cyan-800", accent: "bg-cyan-500", text: "text-cyan-700 dark:text-cyan-300" },
              { bg: "bg-orange-50 dark:bg-orange-950/40", border: "border-orange-200 dark:border-orange-800", accent: "bg-orange-500", text: "text-orange-700 dark:text-orange-300" },
              { bg: "bg-indigo-50 dark:bg-indigo-950/40", border: "border-indigo-200 dark:border-indigo-800", accent: "bg-indigo-500", text: "text-indigo-700 dark:text-indigo-300" },
            ];
            const color = colors[index % colors.length];

            return (
              <div
                key={report.operatore}
                className={`rounded-lg border-2 p-5 ${color.bg} ${color.border}`}
                data-testid={`operator-card-${report.operatore}`}
              >
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-semibold text-lg truncate ${color.text}`}>{report.operatore}</h4>
                    <p className="text-sm text-muted-foreground">
                      {report.numeroRecord} prestazioni
                    </p>
                  </div>
                  {report.numeroAnomalie > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-700">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          {report.numeroAnomalie}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {report.numeroAnomalie} record con anomalia
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="rounded-md bg-background/80 dark:bg-background/40 p-3 border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Compenso Totale</span>
                      <span className={`text-xl font-bold ${color.text}`}>
                        {formatCurrency(report.compensoTotaleArrotondato)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-background/80 dark:bg-background/40 p-3 border">
                      <div className="flex items-center gap-1 mb-1">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Compenso A</span>
                      </div>
                      <p className="text-lg font-semibold">
                        {formatCurrency(report.compensoCardArrotondato)}
                      </p>
                    </div>
                    <div className="rounded-md bg-background/80 dark:bg-background/40 p-3 border">
                      <div className="flex items-center gap-1 mb-1">
                        <Banknote className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Compenso B</span>
                      </div>
                      <p className="text-lg font-semibold">
                        {formatCurrency(report.compensoCashArrotondato)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-4">
          Importi arrotondati alla decina di euro
        </p>
      </div>

      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Esporta Report
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Scegli il formato di esportazione
          </p>
          <div className="flex flex-col gap-3">
            <Button onClick={handleExportExcel} className="w-full" data-testid="button-export-excel">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Esporta Excel
            </Button>
            <Button onClick={handleExportText} variant="outline" className="w-full" data-testid="button-export-text">
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
              Report Testuale
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-end mb-2">
            <Button variant="outline" size="sm" onClick={handleCopyTextReport} data-testid="button-copy-report">
              <Copy className="mr-2 h-4 w-4" />
              Copia
            </Button>
          </div>
          <Textarea 
            value={textReport} 
            readOnly 
            className="min-h-[400px] font-mono text-sm"
            data-testid="textarea-text-report"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showAnomaliesModal} onOpenChange={setShowAnomaliesModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Record con Anomalie ({anomalousRecords.length})
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Questi record hanno il compenso operatore uguale al prezzo paziente. Clicca sull'importo per modificarlo.
          </p>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Operatore</TableHead>
                  <TableHead>Paziente</TableHead>
                  <TableHead>Prestazione</TableHead>
                  <TableHead className="text-right">Prezzo Paz.</TableHead>
                  <TableHead className="text-right">Compenso Op.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalousRecords.map((record) => (
                  <TableRow key={record.id} className="bg-red-50/50 dark:bg-red-950/20">
                    <TableCell className="font-mono text-sm">
                      {record.data ? formatDate(record.data) : "-"}
                    </TableCell>
                    <TableCell>{record.operatore}</TableCell>
                    <TableCell>{record.paziente}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {record.prestazione}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrencyWithDecimals(record.prezzoAlPaziente)}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === record.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-24 h-8 text-right font-mono"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(record.id);
                              if (e.key === "Escape") handleCancelEdit();
                            }}
                            data-testid={`input-edit-compenso-${record.id}`}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleSaveEdit(record.id)}
                            data-testid={`button-save-edit-${record.id}`}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={handleCancelEdit}
                            data-testid={`button-cancel-edit-${record.id}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="group flex items-center justify-end gap-2 cursor-pointer"
                          onClick={() => handleStartEdit(record.id, record.compensoOperatore)}
                          data-testid={`cell-compenso-${record.id}`}
                        >
                          <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span className="font-mono">
                            {formatCurrencyWithDecimals(record.compensoOperatore)}
                          </span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
