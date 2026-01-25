import { useMemo, useState } from "react";
import { Users, AlertTriangle, Calculator, Download, CreditCard, Banknote, Check, X, Edit2, FileSpreadsheet, FileText, Copy, Calendar, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import type { CompensoRecord, OperatorReport } from "@shared/schema";

interface DailyPaymentSettings {
  enabled: boolean;
  type: "minimo" | "fisso";
  dailyAmount: number;
  workedDays: string[]; // Array of date strings YYYY-MM-DD
}

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
  const [showDailyPaymentModal, setShowDailyPaymentModal] = useState(false);
  const [selectedDailyOperator, setSelectedDailyOperator] = useState<string | null>(null);
  const [dailyPaymentSettings, setDailyPaymentSettings] = useState<Record<string, DailyPaymentSettings>>({});
  const [newDayInput, setNewDayInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const { toast } = useToast();

  const roundToTen = (value: number): number => {
    return Math.round(value / 10) * 10;
  };

  const anomalousRecords = useMemo(() => {
    return records.filter((r) => r.hasAnomaly);
  }, [records]);

  // Converte una data dal formato italiano a YYYY-MM-DD
  const parseItalianDate = (dateStr: string): string | null => {
    if (!dateStr) return null;
    // Formato: DD/MM/YY o DD/MM/YYYY
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) {
        year = '20' + year;
      }
      return `${year}-${month}-${day}`;
    }
    // Prova a parsare come ISO date
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      return null;
    }
    return null;
  };

  // Estrae le giornate lavorate per ogni operatore dai record
  const getOperatorWorkedDays = (operatore: string): string[] => {
    const days = new Set<string>();
    records
      .filter((r) => r.operatore === operatore && r.data)
      .forEach((r) => {
        if (r.data) {
          const normalized = parseItalianDate(r.data);
          if (normalized) {
            days.add(normalized);
          }
        }
      });
    return Array.from(days).sort();
  };

  // Calcola il compenso giornaliero per un operatore
  const calculateDailyPayment = (operatore: string): number | null => {
    const settings = dailyPaymentSettings[operatore];
    if (!settings?.enabled) return null;

    const workedDays = settings.workedDays;
    if (workedDays.length === 0) return 0;

    if (settings.type === "fisso") {
      // Fisso: importo fisso per ogni giorno
      return workedDays.length * settings.dailyAmount;
    } else {
      // Minimo: per ogni giorno, prendi il maggiore tra minimo e somma prestazioni
      let total = 0;
      workedDays.forEach((day) => {
        const dayRecords = records.filter(
          (r) => r.operatore === operatore && r.data && parseItalianDate(r.data) === day
        );
        const daySum = dayRecords.reduce((sum, r) => sum + r.compensoOperatore, 0);
        total += Math.max(settings.dailyAmount, daySum);
      });
      return total;
    }
  };

  // Apre il modal per configurare il pagamento a giornata
  const openDailyPaymentModal = (operatore: string) => {
    setSelectedDailyOperator(operatore);
    // Initialize settings if not present
    if (!dailyPaymentSettings[operatore]) {
      const workedDays = getOperatorWorkedDays(operatore);
      setDailyPaymentSettings((prev) => ({
        ...prev,
        [operatore]: {
          enabled: false,
          type: "minimo",
          dailyAmount: 0,
          workedDays,
        },
      }));
    }
    setShowDailyPaymentModal(true);
  };

  // Aggiorna impostazioni pagamento giornaliero
  const updateDailyPaymentSetting = <K extends keyof DailyPaymentSettings>(
    operatore: string,
    key: K,
    value: DailyPaymentSettings[K]
  ) => {
    setDailyPaymentSettings((prev) => ({
      ...prev,
      [operatore]: {
        ...prev[operatore],
        [key]: value,
      },
    }));
  };

  // Aggiungi giornata manuale
  const addWorkedDay = (operatore: string) => {
    if (!newDayInput) return;
    const settings = dailyPaymentSettings[operatore];
    if (!settings) return;
    
    // Verifica che la data sia valida
    const date = new Date(newDayInput);
    if (isNaN(date.getTime())) {
      toast({ title: "Data non valida", variant: "destructive" });
      return;
    }
    
    const normalized = date.toISOString().split('T')[0];
    if (settings.workedDays.includes(normalized)) {
      toast({ title: "Giornata già presente", variant: "destructive" });
      return;
    }
    
    updateDailyPaymentSetting(operatore, "workedDays", [...settings.workedDays, normalized].sort());
    setNewDayInput("");
  };

  // Rimuovi giornata
  const removeWorkedDay = (operatore: string, day: string) => {
    const settings = dailyPaymentSettings[operatore];
    if (!settings) return;
    updateDailyPaymentSetting(
      operatore,
      "workedDays",
      settings.workedDays.filter((d) => d !== day)
    );
  };

  // Formatta data per visualizzazione
  const formatDateFull = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("it-IT", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

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
      return `${report.operatore}
Periodo: ${periodo}
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
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-semibold text-lg truncate ${color.text}`}>{report.operatore}</h4>
                    <p className="text-sm text-muted-foreground">
                      {report.numeroRecord} prestazioni
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {report.numeroAnomalie > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge 
                            variant="outline" 
                            className="text-xs bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-700 cursor-pointer hover-elevate"
                            onClick={() => setShowAnomaliesModal(true)}
                          >
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {report.numeroAnomalie}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          Clicca per correggere {report.numeroAnomalie} anomalie
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 ${dailyPaymentSettings[report.operatore]?.enabled ? 'w-12 bg-primary/10 text-primary' : 'w-8'}`}
                          onClick={() => openDailyPaymentModal(report.operatore)}
                          data-testid={`button-daily-payment-${report.operatore}`}
                        >
                          {dailyPaymentSettings[report.operatore]?.enabled && (
                            <span className="text-xs font-bold">
                              {dailyPaymentSettings[report.operatore].type === "fisso" ? "F" : "M"}
                            </span>
                          )}
                          <Calendar className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {dailyPaymentSettings[report.operatore]?.enabled 
                          ? "Modifica pagamento a giornata" 
                          : "Attiva pagamento a giornata"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                <div className="space-y-3">
                  {(() => {
                    const dailyPayment = calculateDailyPayment(report.operatore);
                    const settings = dailyPaymentSettings[report.operatore];
                    const isDailyEnabled = settings?.enabled;
                    
                    return (
                      <>
                        <div className="rounded-md bg-background/80 dark:bg-background/40 p-3 border">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">
                              Compenso Totale
                            </span>
                            <span className={`text-xl font-bold ${color.text}`}>
                              {formatCurrency(roundToTen(isDailyEnabled && dailyPayment !== null ? dailyPayment : report.compensoTotale))}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-md bg-background/80 dark:bg-background/40 p-3 border">
                            <span className="text-xs font-medium text-muted-foreground">Compenso A</span>
                            <div className="flex items-center justify-between">
                              <CreditCard className="h-4 w-4 text-muted-foreground" />
                              <span className="text-lg font-semibold">
                                {formatCurrency(report.compensoCardArrotondato)}
                              </span>
                            </div>
                          </div>
                          <div className="rounded-md bg-background/80 dark:bg-background/40 p-3 border">
                            <span className="text-xs font-medium text-muted-foreground">Compenso B</span>
                            <div className="flex items-center justify-between">
                              <Banknote className="h-4 w-4 text-muted-foreground" />
                              <span className="text-lg font-semibold">
                                {formatCurrency(report.compensoCashArrotondato)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
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

      <Dialog open={showDailyPaymentModal} onOpenChange={(open) => {
        setShowDailyPaymentModal(open);
        if (!open) {
          setNewDayInput("");
        }
      }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Pagamento a Giornata
            </DialogTitle>
          </DialogHeader>
          
          {selectedDailyOperator && dailyPaymentSettings[selectedDailyOperator] && (
            <div className="space-y-6">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-semibold">{selectedDailyOperator}</p>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="daily-enabled" className="text-sm font-medium">
                  Attiva pagamento a giornata
                </Label>
                <Switch
                  id="daily-enabled"
                  checked={dailyPaymentSettings[selectedDailyOperator].enabled}
                  onCheckedChange={(checked) => updateDailyPaymentSetting(
                    selectedDailyOperator,
                    "enabled",
                    checked
                  )}
                  data-testid="switch-toggle-daily"
                />
              </div>

              {dailyPaymentSettings[selectedDailyOperator].enabled && (
                <>
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Tipo di calcolo</Label>
                    <RadioGroup
                      value={dailyPaymentSettings[selectedDailyOperator].type}
                      onValueChange={(value: "minimo" | "fisso") => 
                        updateDailyPaymentSetting(selectedDailyOperator, "type", value)
                      }
                      className="grid grid-cols-2 gap-4"
                    >
                      <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover-elevate">
                        <RadioGroupItem value="minimo" id="type-minimo" />
                        <div>
                          <Label htmlFor="type-minimo" className="cursor-pointer font-medium">Minimo</Label>
                          <p className="text-xs text-muted-foreground">
                            Importo minimo garantito, se le prestazioni superano il minimo si usa il totale prestazioni
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover-elevate">
                        <RadioGroupItem value="fisso" id="type-fisso" />
                        <div>
                          <Label htmlFor="type-fisso" className="cursor-pointer font-medium">Fisso</Label>
                          <p className="text-xs text-muted-foreground">
                            Importo fisso per ogni giorno, indipendentemente dalle prestazioni
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="daily-amount" className="text-sm font-medium">
                      Importo giornaliero (€)
                    </Label>
                    <Input
                      id="daily-amount"
                      type="number"
                      step="1"
                      min="0"
                      value={dailyPaymentSettings[selectedDailyOperator].dailyAmount || ""}
                      onChange={(e) => updateDailyPaymentSetting(
                        selectedDailyOperator,
                        "dailyAmount",
                        parseFloat(e.target.value) || 0
                      )}
                      placeholder="Es. 150"
                      data-testid="input-daily-amount"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">
                        Giornate lavorate ({dailyPaymentSettings[selectedDailyOperator].workedDays.length})
                      </Label>
                    </div>
                    
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={newDayInput}
                        onChange={(e) => setNewDayInput(e.target.value)}
                        className="flex-1"
                        data-testid="input-new-day"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => addWorkedDay(selectedDailyOperator)}
                        data-testid="button-add-day"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="max-h-48 overflow-y-auto border rounded-lg">
                      {dailyPaymentSettings[selectedDailyOperator].workedDays.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground text-center">
                          Nessuna giornata registrata
                        </p>
                      ) : (
                        <div className="divide-y">
                          {dailyPaymentSettings[selectedDailyOperator].workedDays.map((day) => {
                            const dayRecords = records.filter(
                              (r) => r.operatore === selectedDailyOperator && r.data && parseItalianDate(r.data) === day
                            );
                            const daySum = dayRecords.reduce((sum, r) => sum + r.compensoOperatore, 0);
                            
                            return (
                              <div key={day} className="flex items-center justify-between p-2 hover:bg-muted/50">
                                <div>
                                  <p className="text-sm font-medium">{formatDateFull(day)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {dayRecords.length} prestazioni - {formatCurrency(daySum)}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeWorkedDay(selectedDailyOperator, day)}
                                  data-testid={`button-remove-day-${day}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-primary/10 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Compenso calcolato:</span>
                      <span className="text-lg font-bold">
                        {formatCurrency(roundToTen(calculateDailyPayment(selectedDailyOperator) || 0))}
                      </span>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end">
                <Button onClick={() => setShowDailyPaymentModal(false)} data-testid="button-close-daily-modal">
                  Chiudi
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
