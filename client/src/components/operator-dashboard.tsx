import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Users, AlertTriangle, Calculator, Download, CreditCard, Banknote, Check, X, Edit2, FileSpreadsheet, FileText, Copy, Calendar as CalendarIcon, Plus, Trash2 } from "lucide-react";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import type { CompensoRecord, OperatorReport, OperatorPaymentStatus, Operator } from "@shared/schema";

interface DailyPaymentSettings {
  enabled: boolean;
  workedDays: string[];
  dayModes: Record<string, "minimo" | "fisso" | "none">;
}

interface DailyPaymentResult {
  total: number;
  cardTotal: number;
  cashTotal: number;
}

interface OperatorDashboardProps {
  records: CompensoRecord[];
  onExportExcel: () => void;
  selectedOperator: string | null;
  onSelectOperator: (operator: string | null) => void;
  onUpdateRecord?: (id: string, compensoOperatore: number) => void;
  dateRange?: string;
  operatorColors?: Record<string, string>;
  managedOperators?: Operator[];
  analysisId?: string;
}

export function OperatorDashboard({
  records,
  onExportExcel,
  selectedOperator,
  onSelectOperator,
  onUpdateRecord,
  dateRange,
  operatorColors = {},
  managedOperators = [],
  analysisId,
}: OperatorDashboardProps) {
  const [showAnomaliesModal, setShowAnomaliesModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showTextReportModal, setShowTextReportModal] = useState(false);
  const [showDailyPaymentModal, setShowDailyPaymentModal] = useState(false);
  const [selectedDailyOperator, setSelectedDailyOperator] = useState<string | null>(null);
  const [dailyPaymentSettings, setDailyPaymentSettings] = useState<Record<string, DailyPaymentSettings>>({});
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const { toast } = useToast();

  // Query payment status
  const { data: paymentStatusList = [] } = useQuery<OperatorPaymentStatus[]>({
    queryKey: ['/api/payment-status'],
  });

  // Create a map for easy lookup
  const paymentStatusMap = useMemo(() => {
    const map: Record<string, OperatorPaymentStatus> = {};
    paymentStatusList.forEach(status => {
      map[status.operatore] = status;
    });
    return map;
  }, [paymentStatusList]);

  // Mutation to update payment status
  const updatePaymentStatusMutation = useMutation({
    mutationFn: async ({ operatore, field, value }: { operatore: string; field: 'paidA' | 'paidB'; value: boolean }) => {
      const res = await apiRequest('PATCH', `/api/payment-status/${encodeURIComponent(operatore)}`, { field, value });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-status'] });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato di pagamento",
        variant: "destructive",
      });
    },
  });

  const togglePaymentStatus = (operatore: string, field: 'paidA' | 'paidB') => {
    const currentStatus = paymentStatusMap[operatore];
    const currentValue = currentStatus ? currentStatus[field] : false;
    updatePaymentStatusMutation.mutate({ operatore, field, value: !currentValue });
  };

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

  const getOperatorConfig = (operatore: string): Operator | undefined => {
    return managedOperators.find(op => op.name.toUpperCase() === operatore.toUpperCase());
  };

  const getDefaultDayMode = (operatore: string): "minimo" | "fisso" | "none" => {
    const config = getOperatorConfig(operatore);
    if (!config?.pagamentoGiornataAttivo) return "none";
    if ((config.pagamentoGiornataMinimoA ?? 0) > 0 || (config.pagamentoGiornataMinimoB ?? 0) > 0) return "minimo";
    if ((config.pagamentoGiornataFissoA ?? 0) > 0 || (config.pagamentoGiornataFissoB ?? 0) > 0) return "fisso";
    return "minimo";
  };

  const calculateDailyPayment = (operatore: string): DailyPaymentResult | null => {
    const settings = dailyPaymentSettings[operatore];
    if (!settings?.enabled) return null;
    const config = getOperatorConfig(operatore);
    if (!config) return null;

    const workedDays = settings.workedDays;
    if (workedDays.length === 0) return { total: 0, cardTotal: 0, cashTotal: 0 };

    let totalCard = 0;
    let totalCash = 0;

    workedDays.forEach((day) => {
      const dayMode = settings.dayModes[day] || "none";
      const dayRecords = records.filter(
        (r) => r.operatore === operatore && r.data && parseItalianDate(r.data) === day
      );
      const dayCard = dayRecords
        .filter((r) => r.categoriaCompenso === "card")
        .reduce((sum, r) => sum + r.compensoOperatore, 0);
      const dayCash = dayRecords
        .filter((r) => r.categoriaCompenso === "cash")
        .reduce((sum, r) => sum + r.compensoOperatore, 0);

      if (dayMode === "minimo") {
        const minA = config.pagamentoGiornataMinimoA ?? 0;
        const minB = config.pagamentoGiornataMinimoB ?? 0;
        totalCard += Math.max(dayCard, minA);
        totalCash += Math.max(dayCash, minB);
      } else if (dayMode === "fisso") {
        totalCard += config.pagamentoGiornataFissoA ?? 0;
        totalCash += config.pagamentoGiornataFissoB ?? 0;
      } else {
        totalCard += dayCard;
        totalCash += dayCash;
      }
    });

    return {
      total: totalCard + totalCash,
      cardTotal: totalCard,
      cashTotal: totalCash,
    };
  };

  const openDailyPaymentModal = async (operatore: string) => {
    setSelectedDailyOperator(operatore);
    const workedDays = getOperatorWorkedDays(operatore);
    const defaultMode = getDefaultDayMode(operatore);

    let existingDayModes: Record<string, "minimo" | "fisso" | "none"> = {};
    if (dailyPaymentSettings[operatore]) {
      existingDayModes = { ...dailyPaymentSettings[operatore].dayModes };
    }

    if (analysisId) {
      try {
        const res = await fetch(`/api/pagamento-giornata-modes?analysisId=${encodeURIComponent(analysisId)}&operatorName=${encodeURIComponent(operatore)}`);
        if (res.ok) {
          const modes = await res.json();
          modes.forEach((m: { workDate: string; mode: string }) => {
            existingDayModes[m.workDate] = m.mode as "minimo" | "fisso" | "none";
          });
        }
      } catch {}
    }

    const dayModes: Record<string, "minimo" | "fisso" | "none"> = {};
    workedDays.forEach(day => {
      dayModes[day] = existingDayModes[day] || defaultMode;
    });

    setDailyPaymentSettings((prev) => ({
      ...prev,
      [operatore]: {
        enabled: prev[operatore]?.enabled ?? false,
        workedDays,
        dayModes,
      },
    }));
    setShowDailyPaymentModal(true);
  };

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

  const updateDayMode = async (operatore: string, day: string, mode: "minimo" | "fisso" | "none") => {
    setDailyPaymentSettings((prev) => ({
      ...prev,
      [operatore]: {
        ...prev[operatore],
        dayModes: { ...prev[operatore].dayModes, [day]: mode },
      },
    }));
    if (analysisId) {
      try {
        await apiRequest("POST", "/api/pagamento-giornata-modes", {
          analysisId,
          operatorName: operatore,
          workDate: day,
          mode,
        });
      } catch {}
    }
  };

  const addWorkedDay = (operatore: string, date: Date) => {
    const settings = dailyPaymentSettings[operatore];
    if (!settings) return;
    
    const normalized = date.toISOString().split('T')[0];
    if (settings.workedDays.includes(normalized)) {
      toast({ title: "Giornata già presente", variant: "destructive" });
      return;
    }
    
    const defaultMode = getDefaultDayMode(operatore);
    setDailyPaymentSettings((prev) => ({
      ...prev,
      [operatore]: {
        ...prev[operatore],
        workedDays: [...prev[operatore].workedDays, normalized].sort(),
        dayModes: { ...prev[operatore].dayModes, [normalized]: defaultMode },
      },
    }));
    setCalendarOpen(false);
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
          {operatorReports.map((report) => {
            const hexColor = operatorColors[report.operatore] || "#6B7280";
            
            return (
              <div
                key={report.operatore}
                className="rounded-lg border-2 p-5"
                style={{
                  backgroundColor: `${hexColor}15`,
                  borderColor: `${hexColor}50`,
                }}
                data-testid={`operator-card-${report.operatore}`}
              >
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: hexColor }}
                      />
                      <h4 className="font-semibold text-lg truncate uppercase">{report.operatore}</h4>
                    </div>
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
                            <span className="text-xs font-bold">G</span>
                          )}
                          <CalendarIcon className="h-4 w-4" />
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
                    const isDailyEnabled = settings?.enabled && dailyPayment !== null;
                    
                    const displayTotal = isDailyEnabled ? dailyPayment.total : report.compensoTotale;
                    const displayCard = isDailyEnabled ? dailyPayment.cardTotal : report.compensoCard;
                    const displayCash = isDailyEnabled ? dailyPayment.cashTotal : report.compensoCash;
                    
                    return (
                      <>
                        <div className="rounded-md bg-background/80 dark:bg-background/40 p-3 border">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">
                              Compenso Totale
                            </span>
                            <span className="text-xl font-bold" style={{ color: hexColor }}>
                              {formatCurrency(roundToTen(displayTotal))}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-md bg-background/80 dark:bg-background/40 p-3 border">
                            <span className="text-xs font-medium text-muted-foreground">Compenso A</span>
                            <div className="flex items-center justify-between">
                              <CreditCard className="h-4 w-4 text-muted-foreground" />
                              <span className="text-lg font-semibold">
                                {formatCurrency(roundToTen(displayCard))}
                              </span>
                            </div>
                            <div className="flex justify-center mt-2">
                              <button
                                className={`text-xs font-medium rounded-full px-3 py-1 transition-colors ${
                                  paymentStatusMap[report.operatore]?.paidA
                                    ? 'bg-green-500 dark:bg-green-600 text-white'
                                    : 'bg-red-500 dark:bg-red-600 text-white'
                                } ${updatePaymentStatusMutation.isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover-elevate'}`}
                                onClick={() => !updatePaymentStatusMutation.isPending && togglePaymentStatus(report.operatore, 'paidA')}
                                disabled={updatePaymentStatusMutation.isPending}
                                data-testid={`badge-paid-a-${report.operatore}`}
                              >
                                Pagato
                              </button>
                            </div>
                          </div>
                          <div className="rounded-md bg-background/80 dark:bg-background/40 p-3 border">
                            <span className="text-xs font-medium text-muted-foreground">Compenso B</span>
                            <div className="flex items-center justify-between">
                              <Banknote className="h-4 w-4 text-muted-foreground" />
                              <span className="text-lg font-semibold">
                                {formatCurrency(roundToTen(displayCash))}
                              </span>
                            </div>
                            <div className="flex justify-center mt-2">
                              <button
                                className={`text-xs font-medium rounded-full px-3 py-1 transition-colors ${
                                  paymentStatusMap[report.operatore]?.paidB
                                    ? 'bg-green-500 dark:bg-green-600 text-white'
                                    : 'bg-red-500 dark:bg-red-600 text-white'
                                } ${updatePaymentStatusMutation.isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover-elevate'}`}
                                onClick={() => !updatePaymentStatusMutation.isPending && togglePaymentStatus(report.operatore, 'paidB')}
                                disabled={updatePaymentStatusMutation.isPending}
                                data-testid={`badge-paid-b-${report.operatore}`}
                              >
                                Pagato
                              </button>
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
                    <TableCell className="uppercase">{record.operatore}</TableCell>
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
          setCalendarOpen(false);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Pagamento a Giornata
              </div>
              {selectedDailyOperator && (
                <span className="text-base font-semibold bg-muted/50 px-3 py-1 rounded-lg pl-[20px] pr-[20px] ml-[30px] mr-[30px]">
                  {selectedDailyOperator}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedDailyOperator && dailyPaymentSettings[selectedDailyOperator] && (() => {
            const config = getOperatorConfig(selectedDailyOperator);
            const hasConfig = config?.pagamentoGiornataAttivo;
            return (
            <div className="space-y-6 flex-1 flex flex-col min-h-0">

              <div className="flex items-center gap-2 border rounded-md px-2 py-1.5">
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
                <Label htmlFor="daily-enabled" className="text-sm">
                  Attiva
                </Label>
              </div>

              {!hasConfig && (
                <p className="text-sm text-muted-foreground">
                  Configurare i valori Minimo/Fisso nelle impostazioni operatore (tab Operatori → icona ingranaggio)
                </p>
              )}

              {hasConfig && config && (
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="border rounded px-2 py-1">
                    <span className="font-medium">Min A:</span> € {config.pagamentoGiornataMinimoA ?? 0}
                  </div>
                  <div className="border rounded px-2 py-1">
                    <span className="font-medium">Min B:</span> € {config.pagamentoGiornataMinimoB ?? 0}
                  </div>
                  <div className="border rounded px-2 py-1">
                    <span className="font-medium">Fisso A:</span> € {config.pagamentoGiornataFissoA ?? 0}
                  </div>
                  <div className="border rounded px-2 py-1">
                    <span className="font-medium">Fisso B:</span> € {config.pagamentoGiornataFissoB ?? 0}
                  </div>
                </div>
              )}

              {dailyPaymentSettings[selectedDailyOperator].enabled && (
                <>
                  <div className="space-y-3 flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between shrink-0">
                      <Label className="text-sm font-medium">
                        Giornate lavorate ({dailyPaymentSettings[selectedDailyOperator].workedDays.length})
                      </Label>
                    </div>

                    <div className="flex-1 min-h-[200px] max-h-[250px] overflow-y-auto border rounded-lg">
                      <div className="divide-y">
                        {dailyPaymentSettings[selectedDailyOperator].workedDays.map((day) => {
                          const dayRecords = records.filter(
                            (r) => r.operatore === selectedDailyOperator && r.data && parseItalianDate(r.data) === day
                          );
                          const daySum = dayRecords.reduce((sum, r) => sum + r.compensoOperatore, 0);
                          const currentMode = dailyPaymentSettings[selectedDailyOperator].dayModes[day] || "none";
                          
                          return (
                            <div key={day} className="p-2 hover:bg-muted/50">
                              <div className="flex items-center justify-between">
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
                              {hasConfig && (
                                <div className="flex items-center gap-2 mt-1">
                                  <RadioGroup
                                    value={currentMode}
                                    onValueChange={(value) => updateDayMode(selectedDailyOperator, day, value as "minimo" | "fisso" | "none")}
                                    className="flex gap-2"
                                  >
                                    <div className="flex items-center space-x-1">
                                      <RadioGroupItem value="minimo" id={`mode-minimo-${day}`} className="h-3 w-3" />
                                      <Label htmlFor={`mode-minimo-${day}`} className="text-xs cursor-pointer">Minimo</Label>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <RadioGroupItem value="fisso" id={`mode-fisso-${day}`} className="h-3 w-3" />
                                      <Label htmlFor={`mode-fisso-${day}`} className="text-xs cursor-pointer">Fisso</Label>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <RadioGroupItem value="none" id={`mode-none-${day}`} className="h-3 w-3" />
                                      <Label htmlFor={`mode-none-${day}`} className="text-xs cursor-pointer">Standard</Label>
                                    </div>
                                  </RadioGroup>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        
                        <div className="p-2">
                          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                            <PopoverTrigger asChild>
                              <button
                                className="flex items-center gap-2 text-sm text-primary hover:underline w-full"
                                data-testid="button-show-add-day"
                              >
                                <Plus className="h-4 w-4" />
                                Aggiungi giornata lavorata
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={undefined}
                                onSelect={(date) => {
                                  if (date && selectedDailyOperator) {
                                    addWorkedDay(selectedDailyOperator, date);
                                  }
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const result = calculateDailyPayment(selectedDailyOperator);
                    
                    return (
                      <div className="p-3 bg-primary/10 rounded-lg space-y-2 shrink-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Compenso calcolato:</span>
                          <span className="text-lg font-bold">
                            {formatCurrency(roundToTen(result?.total || 0))}
                          </span>
                        </div>
                        {result && (
                          <div className="grid grid-cols-2 text-sm text-muted-foreground border-t pt-2">
                            <div className="flex items-center gap-1">
                              <CreditCard className="h-3 w-3" />
                              <span>A: {formatCurrency(roundToTen(result.cardTotal))}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Banknote className="h-3 w-3" />
                              <span>B: {formatCurrency(roundToTen(result.cashTotal))}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}

            </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
